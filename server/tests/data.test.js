// Must be set before any require of data.js
process.env.DATA_DIR = require('path').join(__dirname, 'tmp-data-' + Date.now());

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR;

before(() => fs.mkdirSync(DATA_DIR, { recursive: true }));
after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

// Lazy-require so DATA_DIR is set first
let data;
before(() => { data = require('../data.js'); });

test('getUsers returns empty array when no users.json', () => {
  const users = data.getUsers();
  assert.deepStrictEqual(users, []);
});

test('addUser writes user to file and getUsers returns it', () => {
  data.addUser({ id: '1', name: 'Test', email: 'test@test.com', passwordHash: 'hash', role: 'admin' });
  const users = data.getUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'test@test.com');
});

test('findUserByEmail finds correct user', () => {
  const found = data.findUserByEmail('test@test.com');
  assert.ok(found);
  assert.equal(found.role, 'admin');
});

test('findUserByEmail returns null for unknown email', () => {
  const found = data.findUserByEmail('nobody@x.com');
  assert.equal(found, null);
});

test('findUserById finds correct user', () => {
  const found = data.findUserById('1');
  assert.ok(found);
  assert.equal(found.name, 'Test');
});

test('removeUser removes by id', () => {
  data.removeUser('1');
  assert.equal(data.getUsers().length, 0);
});

test('getModules initialises from DEFAULT_MODULES when no modules.json', () => {
  const modules = data.getModules();
  assert.ok(Array.isArray(modules));
  assert.ok(modules.length > 0);
  assert.ok(modules[0].id);
  assert.ok(modules[0].name);
  assert.ok(Array.isArray(modules[0].items));
  assert.ok(modules[0].items[0].id);
});

test('writeModules persists and assigns stable module and item ids when missing', () => {
  const updated = [{ name: 'Novo', items: [{ n: 'x', s: 'todo' }] }];
  data.writeModules(updated);
  const loaded = data.getModules();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'mod-novo');
  assert.equal(loaded[0].name, 'Novo');
  assert.equal(loaded[0].items[0].id, 'item-x');
});

test('writeModules preserves existing ids when module and item are renamed', () => {
  data.writeModules([{ id: 'mod-existing', name: 'Antes', items: [{ id: 'item-existing', n: 'Item antes', s: 'todo' }] }]);
  data.writeModules([{ id: 'mod-existing', name: 'Depois', items: [{ id: 'item-existing', n: 'Item depois', s: 'done' }] }]);
  const loaded = data.getModules();
  assert.equal(loaded[0].id, 'mod-existing');
  assert.equal(loaded[0].name, 'Depois');
  assert.equal(loaded[0].items[0].id, 'item-existing');
  assert.equal(loaded[0].items[0].n, 'Item depois');
});

test('normalizeModules disambiguates duplicate generated module and item ids', () => {
  const modules = data.normalizeModules([
    { name: 'Duplicado', items: [{ n: 'Item', s: 'todo' }, { n: 'Item', s: 'done' }] },
    { name: 'Duplicado', items: [{ n: 'Item', s: 'rev' }] }
  ]);
  assert.equal(modules[0].id, 'mod-duplicado');
  assert.equal(modules[1].id, 'mod-duplicado-2');
  assert.equal(modules[0].items[0].id, 'item-item');
  assert.equal(modules[0].items[1].id, 'item-item-2');
  assert.equal(modules[1].items[0].id, 'item-item');
});
