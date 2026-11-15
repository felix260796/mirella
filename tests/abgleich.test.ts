import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// syMerge & Co. direkt aus app/sync.js laden (ohne Netz und ohne App)
const src = readFileSync(new URL('../app/sync.js', import.meta.url), 'utf8');
const a = src.indexOf('const BASE_KEY'), b = src.indexOf('async function syPull');
const ctx: any = { localStorage: { getItem: () => null, setItem: () => { } } };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + ';this.syMerge=syMerge;this.syBaseOf=syBaseOf;', ctx);
const merge = (server: any, local: any, base: any) => JSON.parse(JSON.stringify(ctx.syMerge(server, local, ctx.syBaseOf(base))));
const st = (todos: any[], extra = {}) => ({ todos, settings: {}, ...extra });

test('am PC abgehakt, iPhone hat nur anderes gespeichert -> bleibt abgehakt', () => {
  const base = st([{ id: 't1', t: 'Brief', done: false }], { suppLog: { a: 1 } });
  const server = st([{ id: 't1', t: 'Brief', done: true }], { suppLog: { a: 1 } });
  const local = st([{ id: 't1', t: 'Brief', done: false }], { suppLog: { a: 1, b: 2 } });
  const m = merge(server, local, base);
  assert.equal(m.todos[0].done, true);
  assert.deepEqual(m.suppLog, { a: 1, b: 2 });
});

test('Eingabe am PC (Kreatin bestellt) geht nicht verloren', () => {
  const base = st([], { people: [], items: [{ id: 'k', t: 'Kreatin', bestellt: 0 }] });
  const server = st([], { people: [], items: [{ id: 'k', t: 'Kreatin', bestellt: 100 }] });
  const local = st([{ id: 'n', t: 'iPad mitnehmen' }], { people: [], items: [{ id: 'k', t: 'Kreatin', bestellt: 0 }] });
  const m = merge(server, local, base);
  assert.equal(m.items[0].bestellt, 100);
  assert.equal(m.todos.length, 1);
});

test('beide geändert -> dieses Gerät gewinnt, neue Einträge beider Seiten bleiben', () => {
  const base = st([{ id: 't1', t: 'A' }]);
  const m = merge(st([{ id: 't1', t: 'B' }, { id: 's', t: 'PC' }]), st([{ id: 't1', t: 'C' }, { id: 'l', t: 'iPhone' }]), base);
  assert.deepEqual(m.todos.map((x: any) => x.t), ['C', 'PC', 'iPhone']);
});

test('Löschen auf einem Gerät bleibt gelöscht', () => {
  const base = st([{ id: 'x', t: 'weg' }, { id: 'y', t: 'bleibt' }]);
  assert.deepEqual(merge(st([{ id: 'y', t: 'bleibt' }]), base, base).todos.map((x: any) => x.id), ['y']);
  assert.deepEqual(merge(base, st([{ id: 'y', t: 'bleibt' }]), base).todos.map((x: any) => x.id), ['y']);
});

test('Einstellungen: nur die geänderte Seite zählt', () => {
  const base = { todos: [], settings: { washMin: 120, name: 'Felix' } };
  const m = merge({ todos: [], settings: { washMin: 90, name: 'Felix' } }, { todos: [], settings: { washMin: 120, name: 'Felix B' } }, base);
  assert.deepEqual(m.settings, { washMin: 90, name: 'Felix B' });
});

test('ohne gemerkten Stand: alte Regel (alles von beiden, dieses Gerät gewinnt)', () => {
  const m = JSON.parse(JSON.stringify(ctx.syMerge(st([{ id: 't', done: true }, { id: 's' }]), st([{ id: 't', done: false }]), null)));
  assert.equal(m.todos.find((x: any) => x.id === 't').done, false);
  assert.equal(m.todos.length, 2);
});
