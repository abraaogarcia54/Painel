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
  assert.ok(modules[0].name);
  assert.ok(Array.isArray(modules[0].items));
});

test('writeModules persists and getModules returns updated data', () => {
  const updated = [{ name: 'Novo', items: [{ n: 'x', s: 'todo' }] }];
  data.writeModules(updated);
  const loaded = data.getModules();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Novo');
});
