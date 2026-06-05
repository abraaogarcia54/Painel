process.env.DATA_DIR = require('path').join(__dirname, 'tmp-history-' + Date.now());

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR;
before(() => fs.mkdirSync(DATA_DIR, { recursive: true }));
after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

let data;
before(() => { data = require('../data.js'); });

test('getHistory returns [] when history.json does not exist', () => {
  assert.deepStrictEqual(data.getHistory(), []);
});

test('appendSnapshot saves a snapshot with correct totals', () => {
  const mods = [
    { name: 'Mod A', items: [{ n: 'i1', s: 'done' }, { n: 'i2', s: 'todo' }] },
    { name: 'Mod B', items: [{ n: 'i3', s: 'rev'  }, { n: 'i4', s: 'nd'   }] }
  ];
  data.appendSnapshot(mods);
  const history = data.getHistory();
  assert.equal(history.length, 1);
  const snap = history[0];
  assert.equal(snap.total, 4);
  assert.equal(snap.done,  1);
  assert.equal(snap.rev,   1);
  assert.equal(snap.todo,  1);
  assert.equal(snap.nd,    1);
  assert.equal(snap.modules.length, 2);
  assert.equal(snap.modules[0].name, 'Mod A');
  assert.equal(snap.modules[0].done, 1);
  assert.equal(snap.modules[0].total, 2);
});

test('appendSnapshot does not duplicate snapshot for same date', () => {
  const before = data.getHistory().length;
  const mods = [{ name: 'Mod A', items: [{ n: 'i1', s: 'done' }] }];
  data.appendSnapshot(mods); // first call — may write (today's snapshot from test 2 already exists)
  data.appendSnapshot(mods); // second explicit call — must not add a new entry
  assert.equal(data.getHistory().length, before); // length unchanged by these two calls
});

test('pruneHistory removes entries older than cutoff date', () => {
  const history = [
    { date: '2020-01-01', total: 1, done: 1, rev: 0, todo: 0, nd: 0, modules: [] },
    { date: '2026-06-04', total: 2, done: 2, rev: 0, todo: 0, nd: 0, modules: [] },
    { date: '2026-06-05', total: 3, done: 3, rev: 0, todo: 0, nd: 0, modules: [] },
  ];
  const result = data.pruneHistory(history, '2026-01-01');
  assert.equal(result.length, 2);
  assert.ok(!result.find(s => s.date === '2020-01-01'));
});

test('pruneHistory returns all entries when cutoff is old', () => {
  const history = [
    { date: '2025-01-01', total: 1, done: 1, rev: 0, todo: 0, nd: 0, modules: [] },
  ];
  const result = data.pruneHistory(history, '2020-01-01');
  assert.equal(result.length, 1);
});
