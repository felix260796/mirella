import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, isAllowed, nextAllowed, nextCallDue, retryAfterNoAnswer, nextNag,
  birthdayReminders, planCalls, holidays, ymd,
} from '../src/lib/reminders.ts';

const d = (s: string) => new Date(s); // lokale Zeit, TZ=Europe/Berlin

test('Anrufe nur Mo–Fr 8–18', () => {
  assert.equal(isAllowed(d('2026-11-11T10:00'), 'call'), true);   // Mittwoch
  assert.equal(isAllowed(d('2026-11-11T18:00'), 'call'), false);
  assert.equal(isAllowed(d('2026-11-14T10:00'), 'call'), false);  // Samstag
});

test('Nachrichten auch am Wochenende 8–21', () => {
  assert.equal(isAllowed(d('2026-11-14T20:30'), 'message'), true);
  assert.equal(isAllowed(d('2026-11-14T21:00'), 'message'), false);
});

test('Freitag 19 Uhr → nächster Anruf Montag 8 Uhr', () => {
  assert.equal(nextAllowed(d('2026-11-13T19:00'), 'call').toString(), d('2026-11-16T08:00').toString());
});

test('Feiertage werden übersprungen (Weihnachten, Neujahr)', () => {
  assert.ok(holidays(2026, 'BW').has('2026-12-25'));
  assert.ok(holidays(2026, 'BW').has('2026-04-03')); // Karfreitag 2026
  assert.equal(ymd(nextAllowed(d('2026-12-24T19:00'), 'call')), '2026-12-28');
});

test('Zyklen ab letztem Anruf', () => {
  assert.equal(ymd(nextCallDue(d('2026-11-11T10:00'), 'weekly')!), '2026-11-18');
  assert.equal(ymd(nextCallDue(d('2026-01-31T10:00'), 'monthly')!), '2026-03-02'); // 28.02. ist Samstag
  assert.equal(ymd(nextCallDue(d('2026-11-11T10:00'), 'quarterly')!), '2027-02-11');
  assert.equal(nextCallDue(d('2026-11-11T10:00'), 'birthday_only'), null);
});

test('Nicht erreicht → nach 2 Werktagen erneut', () => {
  assert.equal(ymd(retryAfterNoAnswer(d('2026-11-12T10:00'))), '2026-11-16'); // Do → Mo
});

test('Nerv-Modus: 60 Min am ersten Tag, ab Tag 2 alle 30 Min, nie außerhalb des Fensters', () => {
  const due = d('2026-11-11T09:00');
  assert.equal(nextNag(due, d('2026-11-11T10:00'), 'call').toString(), d('2026-11-11T11:00').toString());
  assert.equal(nextNag(due, d('2026-11-12T10:00'), 'call').toString(), d('2026-11-12T10:30').toString());
  assert.equal(nextNag(due, d('2026-11-11T17:30'), 'call').toString(), d('2026-11-12T08:00').toString());
});

test('Geburtstag: Geschenk 14 Tage vorher, Check 3 Tage vorher, am Tag 9 Uhr', () => {
  const r = birthdayReminders(d('1988-12-03'), 2026, true);
  assert.deepEqual(r.map(x => [x.type, x.at.toString()]), [
    ['gift', d('2026-11-19T09:00').toString()],
    ['gift_check', d('2026-11-30T09:00').toString()],
    ['day', d('2026-12-03T09:00').toString()],
  ]);
  assert.equal(birthdayReminders(d('1988-12-03'), 2026, false).length, 1);
  assert.equal(ymd(birthdayReminders(d('1992-02-29'), 2027, false)[0].at), '2027-02-28');
});

test('Höchstens 3 Anrufe pro Tag, am längsten überfällig zuerst', () => {
  const c = ['A', 'B', 'C', 'D'].map((n, i) => ({ id: n, name: n, due: d(`2026-11-0${9 - i}T08:00`) }));
  assert.deepEqual(planCalls(c, d('2026-11-11T08:00')).map(x => x.name), ['D', 'C', 'B']);
  assert.deepEqual(planCalls(c, d('2026-11-14T08:00')), []); // Samstag
  assert.equal(DEFAULTS.maxCallsPerDay, 3);
});

import { cancelBy, deadlineReminder } from '../src/lib/reminders.ts';
test('Handyvertrag: Ende 31.03., 3 Monate Frist → kündigen bis 31.12., Erinnerung 30 Tage vorher', () => {
  const by = cancelBy(d('2027-03-31T12:00'), 90);
  assert.equal(ymd(by), '2026-12-31');
  assert.equal(deadlineReminder(by, 30).toString(), d('2026-12-01T09:00').toString());
});
