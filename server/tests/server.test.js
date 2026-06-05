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
  assert.ok(res.body.id, 'should include id');
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
  assert.ok(res.body.id, 'should include id');
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

// --- Modules route tests ---

test('GET /api/modules returns array for any authenticated user', async () => {
  const cookie = await loginAs('viewer');
  const res = await request(app).get('/api/modules').set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length > 0);
});

test('GET /api/modules returns 401 without authentication', async () => {
  const res = await request(app).get('/api/modules');
  assert.equal(res.status, 401);
});

test('PUT /api/modules is forbidden for viewer', async () => {
  const cookie = await loginAs('viewer');
  const res = await request(app)
    .put('/api/modules')
    .set('Cookie', cookie)
    .send([{ name: 'X', items: [] }]);
  assert.equal(res.status, 403);
});

test('PUT /api/modules succeeds for editor', async () => {
  const cookie = await loginAs('editor');
  const newModules = [{ name: 'Editado', items: [{ n: 'i', s: 'done' }] }];
  const res = await request(app)
    .put('/api/modules')
    .set('Cookie', cookie)
    .send(newModules);
  assert.equal(res.status, 200);
  assert.equal(res.body[0].name, 'Editado');
});

test('PUT /api/modules rejects non-array body', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app)
    .put('/api/modules')
    .set('Cookie', cookie)
    .send({ notAnArray: true });
  assert.equal(res.status, 400);
});

test('POST /api/modules/reset restores DEFAULT_MODULES for admin', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app)
    .post('/api/modules/reset')
    .set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.ok(res.body.length > 5);
});

test('POST /api/modules/reset is forbidden for editor', async () => {
  const cookie = await loginAs('editor');
  const res = await request(app)
    .post('/api/modules/reset')
    .set('Cookie', cookie);
  assert.equal(res.status, 403);
});

// --- Users route tests ---

test('GET /api/users returns 403 for editor', async () => {
  const cookie = await loginAs('editor');
  const res = await request(app).get('/api/users').set('Cookie', cookie);
  assert.equal(res.status, 403);
});

test('GET /api/users returns user list for admin without passwordHash', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app).get('/api/users').set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body));
  assert.ok(res.body.length >= 3);
  assert.ok(!res.body[0].passwordHash, 'must not expose password hash');
});

test('POST /api/users creates a new user for admin', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app)
    .post('/api/users')
    .set('Cookie', cookie)
    .send({ name: 'Novo', email: 'novo@t.com', password: 'senha456', role: 'viewer' });
  assert.equal(res.status, 201);
  assert.equal(res.body.email, 'novo@t.com');
  assert.ok(!res.body.passwordHash, 'must not expose password hash');
});

test('POST /api/users returns 409 on duplicate email', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app)
    .post('/api/users')
    .set('Cookie', cookie)
    .send({ name: 'Dup', email: 'admin@t.com', password: 'senha456', role: 'viewer' });
  assert.equal(res.status, 409);
});

test('POST /api/users returns 400 on invalid role', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app)
    .post('/api/users')
    .set('Cookie', cookie)
    .send({ name: 'X', email: 'x@t.com', password: 'senha456', role: 'superuser' });
  assert.equal(res.status, 400);
});

test('DELETE /api/users/:id removes user for admin', async () => {
  const cookie = await loginAs('admin');
  const listRes = await request(app).get('/api/users').set('Cookie', cookie);
  const toDelete = listRes.body.find(u => u.email === 'novo@t.com');
  assert.ok(toDelete, 'user novo@t.com should exist');
  const res = await request(app)
    .delete(`/api/users/${toDelete.id}`)
    .set('Cookie', cookie);
  assert.equal(res.status, 200);
});

test('DELETE /api/users/:id returns 403 for viewer', async () => {
  const cookie = await loginAs('viewer');
  const res = await request(app).delete('/api/users/1').set('Cookie', cookie);
  assert.equal(res.status, 403);
});

test('DELETE /api/users/:id returns 404 for non-existent id', async () => {
  const cookie = await loginAs('admin');
  const res = await request(app).delete('/api/users/nonexistent-id-999').set('Cookie', cookie);
  assert.equal(res.status, 404);
});

// --- History route tests ---

test('GET /api/history returns 401 without auth', async () => {
  const res = await request(app).get('/api/history');
  assert.equal(res.status, 401);
});

test('GET /api/history returns [] when no history exists', async () => {
  const cookie = await loginAs('viewer');
  const res = await request(app).get('/api/history').set('Cookie', cookie);
  assert.equal(res.status, 200);
  assert.deepStrictEqual(res.body, []);
});

test('GET /api/history is accessible by all roles', async () => {
  for (const role of ['admin', 'editor', 'viewer']) {
    const cookie = await loginAs(role);
    const res = await request(app).get('/api/history').set('Cookie', cookie);
    assert.equal(res.status, 200, `role ${role} should be able to access /api/history`);
    assert.ok(Array.isArray(res.body));
  }
});
