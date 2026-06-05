// Set env before any requires
process.env.DATA_DIR = require('path').join(__dirname, 'tmp-server-' + Date.now());
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-ok!!';
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const fs = require('fs');
const bcrypt = require('bcryptjs');

before(async () => {
  fs.mkdirSync(process.env.DATA_DIR, { recursive: true });
  const { addUser, writeModules } = require('../data.js');
  const hash = await bcrypt.hash('senha123', 12);
  addUser({ id: '1', name: 'Admin',  email: 'admin@t.com',  passwordHash: hash, role: 'admin'  });
  addUser({ id: '2', name: 'Editor', email: 'editor@t.com', passwordHash: hash, role: 'editor' });
  addUser({ id: '3', name: 'Viewer', email: 'viewer@t.com', passwordHash: hash, role: 'viewer' });
  writeModules([{ name: 'Módulo Teste', items: [{ n: 'Item 1', s: 'todo' }] }]);
});

after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));

const app = require('../server.js');

async function loginAs(role) {
  const emails = { admin: 'admin@t.com', editor: 'editor@t.com', viewer: 'viewer@t.com' };
  const res = await request(app)
    .post('/auth/login')
    .send({ email: emails[role], password: 'senha123' });
  return res.headers['set-cookie'][0].split(';')[0]; // "token=..."
}

// --- Auth route tests ---

test('POST /auth/login returns 200 and sets cookie on valid credentials', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@t.com', password: 'senha123' });
  assert.equal(res.status, 200);
  assert.ok(res.headers['set-cookie'], 'cookie should be set');
  assert.equal(res.body.role, 'admin');
  assert.equal(res.body.name, 'Admin');
  assert.ok(!res.body.passwordHash, 'should not expose hash');
});

test('POST /auth/login returns 401 on wrong password', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@t.com', password: 'errada' });
  assert.equal(res.status, 401);
});

test('POST /auth/login returns 401 on unknown email', async () => {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'nobody@x.com', password: 'senha123' });
  assert.equal(res.status, 401);
});

test('GET /auth/me returns user info with valid cookie', async () => {
  const cookie = await loginAs('editor');
  const res = await request(app).get('/auth/me').set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'editor');
  assert.equal(res.body.name, 'Editor');
  assert.ok(!res.body.passwordHash, 'should not expose hash');
});

test('GET /auth/me returns 401 without cookie', async () => {
  const res = await request(app).get('/auth/me');
  assert.equal(res.status, 401);
});

test('POST /auth/logout clears cookie', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app).post('/auth/logout').set('Cookie', cookie);
  assert.equal(res.status, 200);
  const setCookie = res.headers['set-cookie'] || [];
  assert.ok(setCookie.some(c => c.includes('token=;') || c.includes('Max-Age=0') || c.includes('Expires=')), 'cookie should be cleared');
});
