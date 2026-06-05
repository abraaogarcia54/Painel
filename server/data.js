const fs = require('fs');
const path = require('path');

function getDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, 'data');
}

function usersPath() { return path.join(getDataDir(), 'users.json'); }
function modulesPath() { return path.join(getDataDir(), 'modules.json'); }

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

const DEFAULT_MODULES = [
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
];

function getModules() {
  const data = readJSON(modulesPath());
  if (!data) {
    writeJSON(modulesPath(), DEFAULT_MODULES);
    return DEFAULT_MODULES;
  }
  return data;
}

function writeModules(modules) {
  writeJSON(modulesPath(), modules);
}

module.exports = {
  getUsers, writeUsers, findUserByEmail, findUserById, addUser, removeUser,
  getModules, writeModules,
  DEFAULT_MODULES
};
