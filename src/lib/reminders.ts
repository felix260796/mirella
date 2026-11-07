// Mirella, die Sekretärin: Erinnerungslogik
// Reine Funktionen ohne Datenbank, damit sie getestet werden können.
// Alle Zeiten sind lokale Zeit (Europe/Berlin); der Server läuft mit TZ=Europe/Berlin.

export type Cycle = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'birthday_only';
export type State = 'BW' | 'BY';
export type WindowKind = 'call' | 'message';

export interface Settings {
  nagIntervalMin: number;       // erster Tag
  nagIntervalDay2Min: number;   // ab Tag 2
  callWindow: [string, string]; // '08:00', '18:00'
  callWeekdays: number[];       // 1 = Montag … 7 = Sonntag
  messageWindow: [string, string];
  maxCallsPerDay: number;
  birthdayTime: string;         // '09:00'
  giftLeadDays: number;
  retryAfterWorkdays: number;
  state: State;
  vacationUntil?: Date;
}

export const DEFAULTS: Settings = {
  nagIntervalMin: 60,
  nagIntervalDay2Min: 30,
  callWindow: ['08:00', '18:00'],
  callWeekdays: [1, 2, 3, 4, 5],
  messageWindow: ['08:00', '21:00'],
  maxCallsPerDay: 3,
  birthdayTime: '09:00',
  giftLeadDays: 14,
  retryAfterWorkdays: 2,
  state: 'BW',
};

const DAY = 86_400_000;

// ---------- Datum-Helfer ----------
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const atTime = (d: Date, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const x = new Date(d); x.setHours(h, m, 0, 0); return x;
};
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoWeekday = (d: Date) => ((d.getDay() + 6) % 7) + 1; // 1 = Montag
function addMonthsClamped(d: Date, n: number) {
  const x = new Date(d); const day = x.getDate();
  x.setDate(1); x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last)); return x;
}

// ---------- Feiertage ----------
function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day, 12);
}
export function holidays(year: number, state: State): Set<string> {
  const e = easterSunday(year);
  const list = [
    new Date(year, 0, 1), new Date(year, 0, 6), addDays(e, -2), addDays(e, 1), new Date(year, 4, 1),
    addDays(e, 39), addDays(e, 50), addDays(e, 60), new Date(year, 9, 3), new Date(year, 10, 1),
    new Date(year, 11, 25), new Date(year, 11, 26),
  ];
  if (state === 'BY') list.push(new Date(year, 7, 15)); // Mariä Himmelfahrt (überwiegend katholische Gemeinden)
  return new Set(list.map(ymd));
}
export const isHoliday = (d: Date, s: Settings) => holidays(d.getFullYear(), s.state).has(ymd(d));

// ---------- Zeitfenster ----------
function windowFor(kind: WindowKind, s: Settings) { return kind === 'call' ? s.callWindow : s.messageWindow; }
function dayAllowed(d: Date, kind: WindowKind, s: Settings) {
  if (s.vacationUntil && d < s.vacationUntil) return false;
  if (kind === 'message') return true;
  return s.callWeekdays.includes(isoWeekday(d)) && !isHoliday(d, s);
}
export function isAllowed(dt: Date, kind: WindowKind, s: Settings = DEFAULTS) {
  const [from, to] = windowFor(kind, s);
  return dayAllowed(dt, kind, s) && dt >= atTime(dt, from) && dt < atTime(dt, to);
}
/** Frühester erlaubter Zeitpunkt ab `from` (inklusive). */
export function nextAllowed(from: Date, kind: WindowKind, s: Settings = DEFAULTS): Date {
  const [start, end] = windowFor(kind, s);
  let d = new Date(from);
  for (let i = 0; i < 400; i++) {
    if (dayAllowed(d, kind, s)) {
      if (d < atTime(d, start)) return atTime(d, start);
      if (d < atTime(d, end)) return d;
    }
    d = atTime(addDays(d, 1), '00:00');
  }
  throw new Error('Kein erlaubter Zeitpunkt in den nächsten 400 Tagen');
}

// ---------- Anruf-Zyklen ----------
export function addCycle(d: Date, c: Cycle): Date | null {
  switch (c) {
    case 'weekly': return addDays(d, 7);
    case 'biweekly': return addDays(d, 14);
    case 'monthly': return addMonthsClamped(d, 1);
    case 'quarterly': return addMonthsClamped(d, 3);
    case 'yearly': return addMonthsClamped(d, 12);
    case 'birthday_only': return null;
  }
}
/** Nächster fälliger Anruf: Zyklus ab dem letzten erreichten Anruf, auf einen erlaubten Anruftag geschoben. */
export function nextCallDue(lastReached: Date, c: Cycle, s: Settings = DEFAULTS): Date | null {
  const raw = addCycle(lastReached, c);
  return raw ? nextAllowed(atTime(raw, '00:00'), 'call', s) : null;
}
/** Nicht erreicht: neuer Versuch nach n Werktagen. */
export function retryAfterNoAnswer(at: Date, s: Settings = DEFAULTS): Date {
  let d = new Date(at), n = 0;
  while (n < s.retryAfterWorkdays) { d = addDays(d, 1); if (dayAllowed(d, 'call', s)) n++; }
  return nextAllowed(atTime(d, '00:00'), 'call', s);
}
/** Standard-Verschiebung bei „Später“ ohne eigene Wahl. */
export function defaultSnooze(c: Cycle): number {
  return c === 'weekly' || c === 'biweekly' ? 1 : c === 'monthly' ? 7 : 21; // Tage
}

// ---------- Nerv-Modus ----------
/** Nächste Erinnerung für etwas Offenes, das seit `dueAt` fällig ist. */
export function nextNag(dueAt: Date, now: Date, kind: WindowKind, s: Settings = DEFAULTS): Date {
  const overdueMs = now.getTime() - dueAt.getTime();
  const step = (overdueMs >= DAY ? s.nagIntervalDay2Min : s.nagIntervalMin) * 60_000;
  const candidate = new Date(Math.max(now.getTime(), dueAt.getTime()) + (now >= dueAt ? step : 0));
  return nextAllowed(candidate, kind, s);
}

// ---------- Geburtstage ----------
export interface BirthdayReminder { at: Date; type: 'gift' | 'gift_check' | 'day'; }
export function birthdayReminders(birthday: Date, year: number, giftPerson: boolean, s: Settings = DEFAULTS): BirthdayReminder[] {
  let day = new Date(year, birthday.getMonth(), birthday.getDate(), 12);
  if (birthday.getMonth() === 1 && birthday.getDate() === 29 && day.getMonth() !== 1) day = new Date(year, 1, 28, 12);
  const out: BirthdayReminder[] = [];
  if (giftPerson) {
    out.push({ at: atTime(addDays(day, -s.giftLeadDays), s.birthdayTime), type: 'gift' });
    out.push({ at: atTime(addDays(day, -3), s.birthdayTime), type: 'gift_check' });
  }
  out.push({ at: atTime(day, s.birthdayTime), type: 'day' });
  return out;
}

// ---------- Tagesplanung ----------
export interface DueContact { id: string; name: string; due: Date; }
/** Wählt die Anrufe für einen Tag: am längsten überfällig zuerst, höchstens maxCallsPerDay. */
export function planCalls(contacts: DueContact[], day: Date, s: Settings = DEFAULTS): DueContact[] {
  if (!dayAllowed(day, 'call', s)) return [];
  const end = atTime(day, '23:59');
  return contacts.filter(c => c.due <= end).sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, s.maxCallsPerDay);
}

// ---------- Verträge und Dokumente ----------
/** Letzter Tag, an dem noch gekündigt werden kann. */
export function cancelBy(endsOn: Date, noticeDays: number): Date {
  return addDays(endsOn, -noticeDays);
}
/** Erinnerung vor einer Frist (Kündigung, Ablauf Ausweis …) um 9 Uhr, nur an einem Tag mit erlaubtem Nachrichtenfenster. */
export function deadlineReminder(deadline: Date, daysBefore: number, s: Settings = DEFAULTS): Date {
  return nextAllowed(atTime(addDays(deadline, -daysBefore), s.birthdayTime), 'message', s);
}
