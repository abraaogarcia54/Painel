process.env.JWT_SECRET = 'test-secret-minimum-32-characters-ok!!';

const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const requireAuth = require('../middleware/auth.js');

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireAuth, (req, res) => res.json(req.user));
  app.get('/admin-only', requireAuth, requireAuth.requireRole('admin'), (req, res) => res.json({ ok: true }));
  return app;
}

test('returns 401 with no token', async () => {
  const res = await request(makeApp()).get('/protected');
  assert.equal(res.status, 401);
});

test('returns 401 with invalid token', async () => {
  const res = await request(makeApp()).get('/protected').set('Cookie', 'token=invalid.token.here');
  assert.equal(res.status, 401);
});

test('injects req.user with valid token', async () => {
  const token = jwt.sign({ userId: '1', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = await request(makeApp()).get('/protected').set('Cookie', `token=${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.userId, '1');
  assert.equal(res.body.role, 'admin');
});

test('requireRole blocks wrong role', async () => {
  const token = jwt.sign({ userId: '2', role: 'viewer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = await request(makeApp()).get('/admin-only').set('Cookie', `token=${token}`);
  assert.equal(res.status, 403);
});

test('requireRole allows correct role', async () => {
  const token = jwt.sign({ userId: '1', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = await request(makeApp()).get('/admin-only').set('Cookie', `token=${token}`);
  assert.equal(res.status, 200);
});
