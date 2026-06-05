require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const requireAuth = require('./middleware/auth.js');
const { requireRole } = requireAuth;
const data = require('./data.js');
const cron = require('node-cron');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'painel')));

// ---- Simple rate limiter ----
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetTime) {
    if (entry.count >= 10) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
  }
  next();
}

// ---- Auth routes ----

app.post('/auth/login', loginRateLimit, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

  const user = data.findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  });

  res.json({ id: user.id, name: user.name, role: user.role });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const user = data.findUserById(req.user.userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  res.json({ id: user.id, name: user.name, role: user.role });
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ ok: true });
});

// ---- Modules routes ----

app.get('/api/modules', requireAuth, (req, res) => {
  res.json(data.getModules());
});

app.put('/api/modules', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Body deve ser um array' });
  for (const mod of req.body) {
    if (typeof mod.name !== 'string')
      return res.status(400).json({ error: 'Cada módulo deve ter name (string)' });
    if (!Array.isArray(mod.items))
      return res.status(400).json({ error: 'Cada módulo deve ter items (array)' });
    for (const item of mod.items) {
      if (typeof item.n !== 'string')
        return res.status(400).json({ error: 'Cada item deve ter n (string)' });
      if (!VALID_STATUSES.includes(item.s))
        return res.status(400).json({ error: `Status inválido: "${item.s}"` });
    }
  }
  data.writeModules(req.body);
  res.json(req.body);
});

app.post('/api/modules/reset', requireAuth, requireRole('admin'), (req, res) => {
  data.writeModules(data.DEFAULT_MODULES);
  res.json(data.DEFAULT_MODULES);
});

// ---- Users routes ----

const VALID_ROLES = ['admin', 'editor', 'viewer'];
const VALID_STATUSES = ['done', 'rev', 'todo', 'nd'];
const pendingUserEmails = new Set();

app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = data.getUsers().map(({ passwordHash: _, ...u }) => u);
  res.json(users);
});

app.post('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password e role são obrigatórios' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role deve ser um de: ${VALID_ROLES.join(', ')}` });
  }
  if (data.findUserByEmail(email) || pendingUserEmails.has(email)) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }
  pendingUserEmails.add(email);
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    if (data.findUserByEmail(email)) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    const id = randomUUID();
    const newUser = { id, name, email, passwordHash, role };
    data.addUser(newUser);
    const { passwordHash: _, ...safe } = newUser;
    res.status(201).json(safe);
  } finally {
    pendingUserEmails.delete(email);
  }
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const user = data.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  data.removeUser(req.params.id);
  res.json({ ok: true });
});

// ---- History route ----

app.get('/api/history', requireAuth, (req, res) => {
  res.json(data.getHistory());
});

// ---- Daily snapshot cron ----

if (process.env.NODE_ENV !== 'test') {
  cron.schedule('0 0 * * *', () => {
    data.appendSnapshot(data.getModules());
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
