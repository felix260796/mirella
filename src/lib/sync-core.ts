// Mirella: Abgleich zwischen Geräten (reine Funktionen, ohne Netz, damit testbar)
// Regel: Pro Zeile gewinnt der neueste Stand (updated_at). Offline-Änderungen warten in einer
// Warteschlange und werden geschickt, sobald wieder Netz da ist.

export interface Row { owner: string; updated_at: string; [k: string]: unknown }
export type Table = Map<string, Row>;

// Schlüsselspalten je Tabelle (Standard: id). owner ist immer dabei, steht aber nicht im Schlüssel,
// weil der lokale Speicher ohnehin pro Profil getrennt ist. (owner = Profil-id)
export const KEYS: Record<string, string[]> = {
  settings: ['owner'], expense_categories: ['name'],
  monthly_income: ['month'], record_kinds: ['area', 'kind'],
};
export const keyCols = (table: string) => KEYS[table] ?? ['id'];
export const rowKey = (table: string, row: Record<string, unknown>) =>
  keyCols(table).map(c => String(row[c])).join('|');
/** Nur die Schlüsselspalten (für Löschen auf dem Server). */
export const keyOf = (table: string, row: Record<string, unknown>) =>
  Object.fromEntries(keyCols(table).map(c => [c, row[c]]));

export type Change =
  | { type: 'upsert'; table: string; row: Row }
  | { type: 'delete'; table: string; key: Record<string, unknown> };

/** Eine Änderung (vom Server oder von diesem Gerät) in den lokalen Stand übernehmen. */
export function applyChange(cache: Map<string, Table>, ch: Change): boolean {
  const t = cache.get(ch.table) ?? new Map<string, Row>();
  cache.set(ch.table, t);
  if (ch.type === 'delete') return t.delete(rowKey(ch.table, ch.key));
  const k = rowKey(ch.table, ch.row);
  const old = t.get(k);
  if (old && Date.parse(old.updated_at) > Date.parse(ch.row.updated_at)) return false; // älter: ignorieren
  t.set(k, ch.row);
  return true;
}

/** Warteschlange zusammenfassen: pro Zeile zählt nur die letzte Änderung. */
export function compactOutbox(outbox: Change[]): Change[] {
  const last = new Map<string, Change>();
  for (const ch of outbox) {
    const k = `${ch.table}:${rowKey(ch.table, ch.type === 'delete' ? ch.key : ch.row)}`;
    last.delete(k);                            // neu einsortieren, Reihenfolge bleibt erhalten
    last.set(k, ch);
  }
  return [...last.values()];
}

/** Sicherheitsnetz: nie Zeilen eines anderen Profils in den lokalen Stand lassen. */
export function belongsTo(row: Row, profileId: string): boolean {
  return row.owner === profileId;
}

/** Lokaler Speicher ist pro Profil getrennt, damit beim Wechsel nichts vermischt wird. */
export const storageKey = (profileId: string, what: 'cache' | 'outbox') => `mirella:${profileId}:${what}`;
