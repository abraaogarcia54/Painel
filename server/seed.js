require('dotenv').config();
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');
const data = require('./data.js');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
}

const name     = getArg('name');
const email    = getArg('email');
const password = getArg('password');
const role     = getArg('role') || 'admin';

if (!name || !email || !password) {
  console.error('Uso: node server/seed.js --name <nome> --email <email> --password <senha> [--role admin|editor|viewer]');
  process.exit(1);
}

if (!['admin', 'editor', 'viewer'].includes(role)) {
  console.error('Role inválido. Use: admin, editor ou viewer');
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

if (data.findUserByEmail(email)) {
  console.error(`Usuário com email ${email} já existe.`);
  process.exit(1);
}

(async () => {
  const passwordHash = await bcrypt.hash(password, 12);
  const id = randomUUID();
  data.addUser({ id, name, email, passwordHash, role });
  console.log(`✓ Usuário criado: ${name} <${email}> [${role}]`);
})();
