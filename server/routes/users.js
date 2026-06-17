const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth.js');
const { requireRole } = requireAuth;
const data = require('../data.js');

const router = express.Router();

const VALID_ROLES = ['admin', 'editor', 'viewer'];
const pendingUserEmails = new Set();

router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const users = data.getUsers().map(({ passwordHash: _, ...u }) => u);
  res.json(users);
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
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

router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const user = data.findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  data.removeUser(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
