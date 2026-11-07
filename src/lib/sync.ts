// Mirella: Cloud-Sync mit Supabase (Anmeldung, Profile Privat/Geschäft, Echtzeit-Abgleich, Offline-Warteschlange)
// Ein Login = eine Person. Darin Profile ("Privat", "Geschäft"); jedes Profil ist eine eigene Welt.
// Jedes Gerät merkt sich sein Profil (iPhone/iPad: Privat, Geschäftshandy: Geschäft) und kann darauf gesperrt werden.
// Wird in der Next.js-Oberfläche verwendet, sobald Supabase eingerichtet ist.
// Benötigt: npm i @supabase/supabase-js; Umgebungsvariablen NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { applyChange, belongsTo, compactOutbox, keyOf, rowKey, storageKey, type Change, type Row, type Table } from './sync-core.ts';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: true, autoRefreshToken: true } },  // angemeldet bleiben, auch nach Neustart
);

export const SYNC_TABLES = [
  'settings', 'contacts', 'contact_notes', 'calls', 'items', 'shopping_items', 'templates', 'rules',
  'areas', 'records', 'record_kinds', 'files', 'record_log', 'expenses', 'expense_categories',
  'savings_goals', 'monthly_income',
] as const;

// ---------- Anmeldung per 6-stelligem Code ----------
// Kein Link per Mail: Auf dem iPhone öffnet ein Link Safari statt der Home-Bildschirm-App.
// Den Code tippt man direkt in Mirella ein (iOS schlägt ihn aus der Mail automatisch vor).
// Neue Personen kommen nur per Einladung rein (shouldCreateUser: false).
export async function sendLoginCode(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
}
export async function verifyLoginCode(email: string, code: string) {
  return supabase.auth.verifyOtp({ email, token: code, type: 'email' });
}

// ---------- Abgleich ----------
let channel: RealtimeChannel | null = null;
const cache = new Map<string, Table>();
let outbox: Change[] = [];
let profileId = '';   // aktives Profil auf diesem Gerät

// ---------- Profile ----------
export interface Profile { id: string; label: string; sort: number }
const DEVICE_PROFILE = 'mirella:device-profile';
const DEVICE_LOCK = 'mirella:device-lock';      // '1' = Gerät fest auf sein Profil

export async function listProfiles(): Promise<Profile[]> {
  const { data } = await supabase.from('profiles').select('id,label,sort').order('sort');
  return (data ?? []) as Profile[];
}
/** Neues Profil, z. B. 'Geschäft'. Startdaten (Einstellungen, Bereiche, Kategorien) legt die Datenbank an. */
export async function createProfile(label: string) {
  const { data: u } = await supabase.auth.getUser();
  return supabase.from('profiles').insert({ user_id: u.user!.id, label, sort: 2 }).select().single();
}
export const activeProfile = () => profileId;
export const deviceLocked = () => localStorage.getItem(DEVICE_LOCK) === '1';
/** Geschäftshandy: fest auf "Geschäft". Entsperren nur mit neuem Code aus der E-Mail (unlockDevice). */
export const lockDevice = (on: boolean) => on ? localStorage.setItem(DEVICE_LOCK, '1') : localStorage.removeItem(DEVICE_LOCK);
export async function unlockDevice(email: string, code: string) {
  const { error } = await verifyLoginCode(email, code);
  if (!error) lockDevice(false);
  return !error;
}

/** Profil wechseln: anderes Profil laden, Echtzeit neu verbinden. Auf gesperrten Geräten nicht möglich. */
export async function switchProfile(id: string) {
  if (deviceLocked()) throw new Error('Dieses Gerät ist auf sein Profil festgelegt.');
  await stopSync();
  localStorage.setItem(DEVICE_PROFILE, id);
  await startSync();
}
const listeners = new Set<(table: string) => void>();

export const onChange = (fn: (table: string) => void) => (listeners.add(fn), () => listeners.delete(fn));
export const rows = (table: string) => [...(cache.get(table)?.values() ?? [])];

function persist() {
  const plain = Object.fromEntries([...cache].map(([t, m]) => [t, [...m.values()]]));
  localStorage.setItem(storageKey(profileId, 'cache'), JSON.stringify(plain));
  localStorage.setItem(storageKey(profileId, 'outbox'), JSON.stringify(outbox));
}

function loadLocal() {
  cache.clear();
  const plain = JSON.parse(localStorage.getItem(storageKey(profileId, 'cache')) ?? '{}') as Record<string, Row[]>;
  for (const [t, list] of Object.entries(plain)) cache.set(t, new Map(list.map(r => [rowKey(t, r), r])));
  outbox = JSON.parse(localStorage.getItem(storageKey(profileId, 'outbox')) ?? '[]');
}

/** Nach der Anmeldung: Profil dieses Geräts wählen, lokalen Stand laden, vom Server holen, Echtzeit abonnieren. */
export async function startSync() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const mine = await listProfiles();
  const saved = localStorage.getItem(DEVICE_PROFILE);
  profileId = mine.find(p => p.id === saved)?.id ?? data.user.id;   // Standard: Privat (id = Login-id)
  localStorage.setItem(DEVICE_PROFILE, profileId);
  loadLocal();
  await flushOutbox();
  await pullAll();

  channel = supabase.channel(`mirella-${profileId}`);
  for (const table of SYNC_TABLES) {
    // Nur Änderungen dieses Profils (Löschungen kommen ohne Inhalt, daher ohne Filter)
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `owner=eq.${profileId}` }, onRealtime(table));
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `owner=eq.${profileId}` }, onRealtime(table));
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onRealtime(table));
  }
  channel.subscribe();

  window.addEventListener('online', flushOutbox);
  document.addEventListener('visibilitychange', onVisible);
}

const onVisible = () => { if (!document.hidden) pullAll(); };   // App wieder geöffnet: sicherheitshalber neu holen

function onRealtime(table: string) {
  return (p: any) => {
      const ch: Change = p.eventType === 'DELETE'
        ? { type: 'delete', table, key: keyOf(table, p.old) }
        : { type: 'upsert', table, row: p.new as Row };
      if (ch.type === 'upsert' && !belongsTo(ch.row, profileId)) return;
      if (applyChange(cache, ch)) { persist(); listeners.forEach(fn => fn(table)); }
  };
}

async function stopSync() {
  if (channel) await supabase.removeChannel(channel);
  window.removeEventListener('online', flushOutbox);
  document.removeEventListener('visibilitychange', onVisible);
  channel = null; cache.clear(); outbox = []; profileId = '';
}

async function pullAll() {
  for (const table of SYNC_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('owner', profileId);  // nur dieses Profil
    if (error || !data) continue;
    const m = new Map<string, Row>();
    for (const r of data as Row[]) m.set(rowKey(table, r), r);
    cache.set(table, m);
    listeners.forEach(fn => fn(table));
  }
  persist();
}

/** Änderung auf diesem Gerät: sofort lokal anzeigen, dann an die Cloud schicken (oder warten, wenn offline). */
export async function save(table: string, row: Record<string, unknown>) {
  const full = { ...row, owner: profileId, updated_at: new Date().toISOString() } as Row;
  applyChange(cache, { type: 'upsert', table, row: full });
  outbox.push({ type: 'upsert', table, row: full });
  persist(); listeners.forEach(fn => fn(table));
  await flushOutbox();
}
export async function remove(table: string, key: Record<string, unknown>) {   // z. B. { id: '…' }
  applyChange(cache, { type: 'delete', table, key });
  outbox.push({ type: 'delete', table, key });
  persist(); listeners.forEach(fn => fn(table));
  await flushOutbox();
}

// Primärschlüssel je Tabelle (für upsert)
const PK: Record<string, string> = {
  settings: 'owner', areas: 'owner,id', expense_categories: 'owner,name',
  monthly_income: 'owner,month', record_kinds: 'owner,area,kind',
};

async function flushOutbox() {
  if (!navigator.onLine || !outbox.length) return;
  const pending = compactOutbox(outbox);
  const failed: Change[] = [];
  for (const ch of pending) {
    let error: unknown;
    if (ch.type === 'upsert') {
      const { updated_at, ...rest } = ch.row;                       // Zeitstempel setzt der Server
      ({ error } = await supabase.from(ch.table).upsert(rest, { onConflict: PK[ch.table] ?? 'id' }));
    } else {
      ({ error } = await supabase.from(ch.table).delete().match(ch.key)); // RLS: nur eigene Zeilen
    }
    if (error) failed.push(ch);
  }
  outbox = failed;
  persist();
}

// ---------- Abmelden ----------
/** Abmelden: Push für dieses Gerät abbestellen, Echtzeit beenden. */
export async function signOut() {
  const sub = await navigator.serviceWorker?.ready.then(r => r.pushManager.getSubscription()).catch(() => null);
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
  await stopSync();
  await supabase.auth.signOut();
}
