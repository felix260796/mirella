import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChange, compactOutbox, belongsTo, storageKey, rowKey, type Row, type Table } from '../src/lib/sync-core.ts';

const r = (id: string, at: string, extra = {}): Row => ({ id, owner: 'privat', updated_at: at, ...extra });

test('neuerer Stand gewinnt, älterer wird ignoriert', () => {
  const c = new Map<string, Table>();
  assert.equal(applyChange(c, { type: 'upsert', table: 'items', row: r('1', '2026-11-07T10:00:00Z', { title: 'iPad' }) }), true);
  assert.equal(applyChange(c, { type: 'upsert', table: 'items', row: r('1', '2026-11-07T09:00:00Z', { title: 'alt' }) }), false);
  assert.equal(c.get('items')!.get('1')!.title, 'iPad');
  applyChange(c, { type: 'upsert', table: 'items', row: r('1', '2026-11-07T11:00:00Z', { title: 'iPhone' }) });
  assert.equal(c.get('items')!.get('1')!.title, 'iPhone');
});

test('Löschen auf einem Gerät entfernt die Zeile', () => {
  const c = new Map<string, Table>();
  applyChange(c, { type: 'upsert', table: 'shopping_items', row: r('m', '2026-11-07T10:00:00Z') });
  assert.equal(applyChange(c, { type: 'delete', table: 'shopping_items', key: { id: 'm' } }), true);
  assert.equal(c.get('shopping_items')!.size, 0);
});

test('Offline-Warteschlange: pro Zeile nur die letzte Änderung', () => {
  const out = compactOutbox([
    { type: 'upsert', table: 'items', row: r('1', 'a', { title: 'A' }) },
    { type: 'upsert', table: 'items', row: r('2', 'a') },
    { type: 'upsert', table: 'items', row: r('1', 'b', { title: 'B' }) },
    { type: 'delete', table: 'items', key: { id: '2' } },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(c => c.type), ['upsert', 'delete']);
  assert.equal((out[0] as any).row.title, 'B');
});

test('Profile bleiben getrennt', () => {
  assert.equal(belongsTo(r('1', 'a'), 'privat'), true);
  assert.equal(belongsTo(r('1', 'a'), 'geschaeft'), false);
  assert.notEqual(storageKey('privat', 'cache'), storageKey('geschaeft', 'cache'));
});

test('Tabellen ohne id (Kategorien, Einstellungen) werden richtig zugeordnet', () => {
  const c = new Map<string, Table>();
  applyChange(c, { type: 'upsert', table: 'expense_categories', row: { owner: 'privat', updated_at: 'a', name: 'Lebensmittel', monthly_budget: 400 } });
  applyChange(c, { type: 'upsert', table: 'expense_categories', row: { owner: 'privat', updated_at: 'b', name: 'Lebensmittel', monthly_budget: 450 } });
  assert.equal(c.get('expense_categories')!.size, 1);
  assert.equal(rowKey('settings', { owner: 'privat' }), 'privat');
  assert.equal(applyChange(c, { type: 'delete', table: 'expense_categories', key: { name: 'Lebensmittel' } }), true);
});
