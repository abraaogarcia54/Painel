const fs = require('fs');
const path = require('path');

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, 'data');
}

function usersPath() { return path.join(getDataDir(), 'users.json'); }
function modulesPath() { return path.join(getDataDir(), 'modules.json'); }
function historyPath() { return path.join(getDataDir(), 'history.json'); }

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getUsers() {
  return readJSON(usersPath()) || [];
}

function writeUsers(users) {
  writeJSON(usersPath(), users);
}

function findUserByEmail(email) {
  return getUsers().find(u => u.email === email) || null;
}

function findUserById(id) {
  return getUsers().find(u => u.id === id) || null;
}

function addUser(user) {
  const users = getUsers();
  users.push(user);
  writeUsers(users);
}

function removeUser(id) {
  writeUsers(getUsers().filter(u => u.id !== id));
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function moduleIdFromName(name, index) {
  const slug = slugify(name) || `module-${index + 1}`;
  return `mod-${slug}`;
}

function itemIdFromName(name, index) {
  const slug = slugify(name) || `item-${index + 1}`;
  return `item-${slug}`;
}

function uniqueModuleId(mod, index, used) {
  const rawId = typeof mod.id === 'string' ? mod.id.trim() : '';
  const base = rawId || moduleIdFromName(mod.name, index);
  let id = base;
  let suffix = 2;

  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }

  used.add(id);
  return id;
}

function uniqueItemId(item, index, used) {
  const rawId = typeof item.id === 'string' ? item.id.trim() : '';
  const base = rawId || itemIdFromName(item.n, index);
  let id = base;
  let suffix = 2;

  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }

  used.add(id);
  return id;
}

function normalizeItems(items) {
  const used = new Set();
  return items.map((item, index) => ({
    ...item,
    id: uniqueItemId(item, index, used)
  }));
}

function normalizeModules(modules) {
  const used = new Set();
  return modules.map((mod, index) => ({
    ...mod,
    id: uniqueModuleId(mod, index, used),
    items: Array.isArray(mod.items) ? normalizeItems(mod.items) : mod.items
  }));
}

const DEFAULT_MODULES = normalizeModules([
  { name: "Admin", items: [{ n: "Painel admin", s: "todo" }] },
  {
    name: "Cadastro — Produto",
    items: [
      { n: "Consultar",         s: "done" },
      { n: "Cadastrar",         s: "done" },
      { n: "Consultar preço",   s: "done" },
      { n: "Grade",             s: "done" },
      { n: "Grupo",             s: "done" },
      { n: "SubGrupo",          s: "done" },
      { n: "Fabricante",        s: "done" },
      { n: "Coleção",           s: "done" },
      { n: "Tipo de produto",   s: "done" },
      { n: "Marca",             s: "done" },
      { n: "Etiqueta",          s: "done" },
      { n: "Promoção",          s: "done" },
      { n: "Combo / Kit",       s: "done" },
      { n: "Padronizados",      s: "done" },
      { n: "Unidade de medida", s: "done" }
    ]
  },
  { name: "Cadastro — Pessoa", items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "done" }, { n: "Grupo", s: "todo" }] },
  { name: "Cadastro - Fiscal", items: [{ n: "CFOP", s: "done" }, { n: "CST ICMS", s: "done" }, { n: "Regra fiscal", s: "done" }] },
  {
    name: "Cadastro - Financeiro",
    items: [
      { n: "Tipo de pagamento", s: "done" },
      { n: "Prazo pagamento",   s: "done" },
      { n: "Plano de contas",   s: "done" },
      { n: "Centro de custo",   s: "todo" },
      { n: "Conta bancária",    s: "done" },
      { n: "Bandeira",          s: "done" },
      { n: "Banco",             s: "done" },
      { n: "Caixa",             s: "todo" }
    ]
  },
  { name: "Cadastro - Setor/Estoque", items: [{ n: "Consultar", s: "todo" }, { n: "Cadastrar", s: "todo" }] },
  { name: "Cadastro - Usuários", items: [{ n: "Consultar", s: "todo" }, { n: "Cadastrar", s: "todo" }, { n: "Grupo / Permissões", s: "todo" }] },
  { name: "Vendas - Vendas", items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "done" }] },
  { name: "Vendas - Condicional", items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "rev" }] },
  {
    name: "Vendas - PDV",
    items: [
      { n: "Consultar",         s: "done" },
      { n: "Entrar PDV",        s: "done" },
      { n: "Consulta de caixa", s: "todo" },
      { n: "Abrir caixa",       s: "done" },
      { n: "Fechar caixa",      s: "done" }
    ]
  },
  { name: "Vendas - Troca",        items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "rev" }] },
  { name: "Vendas - Vale Presente", items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "done" }] },
  { name: "Compras", items: [{ n: "Consultar", s: "done" }, { n: "Cadastrar", s: "done" }, { n: "Importar XML", s: "done" }, { n: "Manifesto", s: "done" }] },
  {
    name: "Financeiro",
    items: [
      { n: "Contas a pagar",       s: "done" },
      { n: "Contas a receber",     s: "done" },
      { n: "Gestão financeira",    s: "todo" },
      { n: "Fluxo de caixa",       s: "todo" },
      { n: "Conciliação bancária", s: "rev"  },
      { n: "Histórico de caixa",   s: "todo" }
    ]
  },
  { name: "Estoque", items: [{ n: "Balanço", s: "todo" }, { n: "Acerto de estoque", s: "todo" }, { n: "Transferência de estoque", s: "todo" }] },
  { name: "Fiscal", items: [{ n: "Gerar Sintegra", s: "todo" }, { n: "Gestão de documentos", s: "todo" }] },
  { name: "Relatórios",   items: [{ n: "A definir", s: "nd" }] },
  { name: "Integrações",  items: [{ n: "A definir", s: "nd" }] },
  { name: "CRM",          items: [{ n: "A definir", s: "nd" }] }
]);

function getModules() {
  const stored = readJSON(modulesPath());
  if (!stored) {
    writeJSON(modulesPath(), DEFAULT_MODULES);
    return DEFAULT_MODULES;
  }

  const modules = normalizeModules(stored);
  if (JSON.stringify(modules) !== JSON.stringify(stored)) {
    writeJSON(modulesPath(), modules);
  }
  return modules;
}

function writeModules(modules) {
  const normalized = normalizeModules(modules);
  writeJSON(modulesPath(), normalized);
  return normalized;
}

function addModule(module) {
  const modules = getModules();
  const next = writeModules([...modules, { id: module.id, name: module.name, items: [] }]);
  return next[next.length - 1];
}

function updateModule(id, updates) {
  const modules = getModules();
  const index = modules.findIndex(mod => mod.id === id);
  if (index === -1) return null;

  modules[index] = { ...modules[index], ...updates };
  return writeModules(modules)[index];
}

function removeModule(id) {
  const modules = getModules();
  const next = modules.filter(mod => mod.id !== id);
  if (next.length === modules.length) return false;

  writeModules(next);
  return true;
}

function reorderModules(ids) {
  const modules = getModules();
  const byId = new Map(modules.map(mod => [mod.id, mod]));

  if (ids.length !== modules.length) return null;
  if (new Set(ids).size !== ids.length) return null;
  if (!ids.every(id => byId.has(id))) return null;

  return writeModules(ids.map(id => byId.get(id)));
}

function addItem(moduleId, item) {
  const modules = getModules();
  const moduleIndex = modules.findIndex(mod => mod.id === moduleId);
  if (moduleIndex === -1) return null;

  modules[moduleIndex].items.push({ id: item.id, n: item.n, s: item.s });
  const next = writeModules(modules);
  const items = next[moduleIndex].items;
  return items[items.length - 1];
}

function updateItem(moduleId, itemId, updates) {
  const modules = getModules();
  const moduleIndex = modules.findIndex(mod => mod.id === moduleId);
  if (moduleIndex === -1) return null;

  const itemIndex = modules[moduleIndex].items.findIndex(item => item.id === itemId);
  if (itemIndex === -1) return null;

  modules[moduleIndex].items[itemIndex] = { ...modules[moduleIndex].items[itemIndex], ...updates };
  return writeModules(modules)[moduleIndex].items[itemIndex];
}

function removeItem(moduleId, itemId) {
  const modules = getModules();
  const moduleIndex = modules.findIndex(mod => mod.id === moduleId);
  if (moduleIndex === -1) return false;

  const items = modules[moduleIndex].items;
  const nextItems = items.filter(item => item.id !== itemId);
  if (nextItems.length === items.length) return false;

  modules[moduleIndex].items = nextItems;
  writeModules(modules);
  return true;
}

function getHistory() {
  return readJSON(historyPath()) || [];
}

function pruneHistory(history, cutoffStr) {
  return history.filter(s => s.date >= cutoffStr);
}

function appendSnapshot(modules) {
  const today = new Date().toISOString().slice(0, 10);
  const history = getHistory();
  if (history.some(s => s.date === today)) return;

  const allItems = modules.flatMap(m => m.items);
  const total = allItems.length;
  const done  = allItems.filter(i => i.s === 'done').length;
  const rev   = allItems.filter(i => i.s === 'rev').length;
  const todo  = allItems.filter(i => i.s === 'todo').length;
  const nd    = allItems.filter(i => i.s === 'nd').length;

  const snapshot = {
    date: today,
    total, done, rev, todo, nd,
    modules: modules.map(m => ({
      name: m.name,
      done: m.items.filter(i => i.s === 'done').length,
      total: m.items.length
    }))
  };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const pruned = pruneHistory(history, cutoffStr);
  pruned.push(snapshot);
  writeJSON(historyPath(), pruned);
}

module.exports = {
  getUsers, writeUsers, findUserByEmail, findUserById, addUser, removeUser,
  getModules, writeModules, normalizeModules,
  addModule, updateModule, removeModule, reorderModules,
  addItem, updateItem, removeItem,
  getHistory, appendSnapshot, pruneHistory,
  DEFAULT_MODULES
};
