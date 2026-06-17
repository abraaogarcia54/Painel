const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const requireAuth = require('../middleware/auth.js');
const data = require('../data.js');

const router = express.Router();

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

router.post('/login', loginRateLimit, async (req, res) => {
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

router.get('/me', requireAuth, (req, res) => {
  const user = data.findUserById(req.user.userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  res.json({ id: user.id, name: user.name, role: user.role });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'Strict',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ ok: true });
});

module.exports = router;
