const express = require('express');
const requireAuth = require('../middleware/auth.js');
const { requireRole } = requireAuth;
const data = require('../data.js');

const router = express.Router();

const VALID_STATUSES = ['done', 'rev', 'todo', 'nd'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateModules(modules) {
  if (!Array.isArray(modules)) return 'Body deve ser um array';

  for (const mod of modules) {
    if (mod.id !== undefined && typeof mod.id !== 'string') return 'Cada módulo deve ter id (string)';
    if (typeof mod.name !== 'string') return 'Cada módulo deve ter name (string)';
    if (!Array.isArray(mod.items)) return 'Cada módulo deve ter items (array)';

    for (const item of mod.items) {
      if (item.id !== undefined && typeof item.id !== 'string') return 'Cada item deve ter id (string)';
      if (typeof item.n !== 'string') return 'Cada item deve ter n (string)';
      if (!VALID_STATUSES.includes(item.s)) return `Status inválido: "${item.s}"`;
    }
  }

  return null;
}

function moduleNotFound(res) {
  return res.status(404).json({ error: 'Módulo não encontrado' });
}

function itemNotFound(res) {
  return res.status(404).json({ error: 'Item não encontrado' });
}

router.get('/', requireAuth, (req, res) => {
  res.json(data.getModules());
});

router.post('/', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const { id, name } = req.body || {};
  if (id !== undefined && typeof id !== 'string') return res.status(400).json({ error: 'id deve ser string' });
  if (!isNonEmptyString(name)) return res.status(400).json({ error: 'name é obrigatório' });

  const module = data.addModule({ id, name: name.trim() });
  res.status(201).json(module);
});

router.put('/', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const error = validateModules(req.body);
  if (error) return res.status(400).json({ error });

  data.writeModules(req.body);
  res.json(data.getModules());
});

router.post('/reorder', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
    return res.status(400).json({ error: 'ids deve ser um array de strings' });
  }

  const modules = data.reorderModules(ids);
  if (!modules) return res.status(400).json({ error: 'ids deve conter todos os módulos exatamente uma vez' });

  res.json(modules);
});

router.post('/reset', requireAuth, requireRole('admin'), (req, res) => {
  data.writeModules(data.DEFAULT_MODULES);
  res.json(data.DEFAULT_MODULES);
});

router.patch('/:moduleId', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const { name } = req.body || {};
  if (!isNonEmptyString(name)) return res.status(400).json({ error: 'name é obrigatório' });

  const module = data.updateModule(req.params.moduleId, { name: name.trim() });
  if (!module) return moduleNotFound(res);

  res.json(module);
});

router.delete('/:moduleId', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  if (!data.removeModule(req.params.moduleId)) return moduleNotFound(res);
  res.json({ ok: true });
});

router.post('/:moduleId/items', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const { id, n, s = 'todo' } = req.body || {};
  if (id !== undefined && typeof id !== 'string') return res.status(400).json({ error: 'id deve ser string' });
  if (!isNonEmptyString(n)) return res.status(400).json({ error: 'n é obrigatório' });
  if (!VALID_STATUSES.includes(s)) return res.status(400).json({ error: `Status inválido: "${s}"` });

  const item = data.addItem(req.params.moduleId, { id, n: n.trim(), s });
  if (!item) return moduleNotFound(res);

  res.status(201).json(item);
});

router.patch('/:moduleId/items/:itemId', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  const { n, s } = req.body || {};
  const updates = {};

  if (n !== undefined) {
    if (!isNonEmptyString(n)) return res.status(400).json({ error: 'n deve ser string não vazia' });
    updates.n = n.trim();
  }

  if (s !== undefined) {
    if (!VALID_STATUSES.includes(s)) return res.status(400).json({ error: `Status inválido: "${s}"` });
    updates.s = s;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Informe n ou s para atualizar' });
  }

  const item = data.updateItem(req.params.moduleId, req.params.itemId, updates);
  if (!item) return itemNotFound(res);

  res.json(item);
});

router.delete('/:moduleId/items/:itemId', requireAuth, requireRole('admin', 'editor'), (req, res) => {
  if (!data.removeItem(req.params.moduleId, req.params.itemId)) return itemNotFound(res);
  res.json({ ok: true });
});

module.exports = router;
