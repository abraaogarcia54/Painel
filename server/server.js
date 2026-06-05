require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const requireAuth = require('./middleware/auth.js');
const { requireRole } = requireAuth;
const data = require('./data.js');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'painel')));

// ---- Auth routes ----

app.post('/auth/login', async (req, res) => {
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

  res.json({ name: user.name, role: user.role });
});

app.get('/auth/me', requireAuth, (req, res) => {
  const user = data.findUserById(req.user.userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  res.json({ name: user.name, role: user.role });
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
  data.writeModules(req.body);
  res.json(req.body);
});

app.post('/api/modules/reset', requireAuth, requireRole('admin'), (req, res) => {
  data.writeModules(data.DEFAULT_MODULES);
  res.json(data.DEFAULT_MODULES);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}

module.exports = app;
