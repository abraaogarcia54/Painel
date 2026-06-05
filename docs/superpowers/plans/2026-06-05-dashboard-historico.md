# Dashboard Histórico com Donut + Sparklines — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um dashboard visual (donut SVG + sparklines por módulo) ao painel com snapshots diários automáticos salvos no backend.

**Architecture:** Backend salva snapshots diários em `server/data/history.json` via `node-cron`. Novo endpoint `GET /api/history` serve o histórico. Frontend busca `/api/history` em paralelo com `/api/modules` e renderiza donut + sparklines com SVG puro, substituindo a barra de stats atual.

**Tech Stack:** Node.js, Express, `node-cron`, SVG puro (sem biblioteca de charting), `node:test` + `supertest` para testes.

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `server/data.js` | Modificar | Adicionar `historyPath`, `getHistory`, `appendSnapshot`, `pruneHistory` |
| `server/server.js` | Modificar | Adicionar `node-cron`, cron job meia-noite, `GET /api/history` |
| `server/tests/history.test.js` | Criar | Testes unitários das funções de histórico |
| `server/tests/server.test.js` | Modificar | Adicionar testes do endpoint `GET /api/history` |
| `painel/index.html` | Modificar | CSS do dashboard, `history` var, `renderDashboard`, donut SVG, sparklines, init |

---

## Task 1: Instalar node-cron

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar a dependência**

```bash
cd /Users/abraao101icloud.com/Documents/painel && npm install node-cron
```

Expected output: `added 1 package` (ou similar)

- [ ] **Step 2: Verificar que está em package.json**

```bash
grep node-cron package.json
```

Expected: `"node-cron": "^X.X.X"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install node-cron for daily snapshot scheduling"
```

---

## Task 2: Adicionar funções de histórico em data.js (TDD)

**Files:**
- Create: `server/tests/history.test.js`
- Modify: `server/data.js`

- [ ] **Step 1: Escrever os testes que vão falhar**

Criar `server/tests/history.test.js`:

```js
process.env.DATA_DIR = require('path').join(__dirname, 'tmp-history-' + Date.now());

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR;
before(() => fs.mkdirSync(DATA_DIR, { recursive: true }));
after(() => fs.rmSync(DATA_DIR, { recursive: true, force: true }));

let data;
before(() => { data = require('../data.js'); });

test('getHistory returns [] when history.json does not exist', () => {
  assert.deepStrictEqual(data.getHistory(), []);
});

test('appendSnapshot saves a snapshot with correct totals', () => {
  const mods = [
    { name: 'Mod A', items: [{ n: 'i1', s: 'done' }, { n: 'i2', s: 'todo' }] },
    { name: 'Mod B', items: [{ n: 'i3', s: 'rev'  }, { n: 'i4', s: 'nd'   }] }
  ];
  data.appendSnapshot(mods);
  const history = data.getHistory();
  assert.equal(history.length, 1);
  const snap = history[0];
  assert.equal(snap.total, 4);
  assert.equal(snap.done,  1);
  assert.equal(snap.rev,   1);
  assert.equal(snap.todo,  1);
  assert.equal(snap.nd,    1);
  assert.equal(snap.modules.length, 2);
  assert.equal(snap.modules[0].name, 'Mod A');
  assert.equal(snap.modules[0].done, 1);
  assert.equal(snap.modules[0].total, 2);
});

test('appendSnapshot does not duplicate snapshot for same date', () => {
  const mods = [{ name: 'Mod A', items: [{ n: 'i1', s: 'done' }] }];
  data.appendSnapshot(mods);
  assert.equal(data.getHistory().length, 1);
});

test('pruneHistory removes entries older than cutoff date', () => {
  const history = [
    { date: '2020-01-01', total: 1, done: 1, rev: 0, todo: 0, nd: 0, modules: [] },
    { date: '2026-06-04', total: 2, done: 2, rev: 0, todo: 0, nd: 0, modules: [] },
    { date: '2026-06-05', total: 3, done: 3, rev: 0, todo: 0, nd: 0, modules: [] },
  ];
  const result = data.pruneHistory(history, '2026-01-01');
  assert.equal(result.length, 2);
  assert.ok(!result.find(s => s.date === '2020-01-01'));
});

test('pruneHistory returns all entries when cutoff is old', () => {
  const history = [
    { date: '2025-01-01', total: 1, done: 1, rev: 0, todo: 0, nd: 0, modules: [] },
  ];
  const result = data.pruneHistory(history, '2020-01-01');
  assert.equal(result.length, 1);
});
```

- [ ] **Step 2: Rodar os testes — devem falhar**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test server/tests/history.test.js
```

Expected: erros de `data.getHistory is not a function` (ou similar)

- [ ] **Step 3: Implementar as funções em data.js**

Abrir `server/data.js` e adicionar após a linha `function modulesPath()`:

```js
function historyPath() { return path.join(getDataDir(), 'history.json'); }
```

Adicionar após `function writeModules`:

```js
function getHistory() {
  return readJSON(historyPath()) || [];
}

function pruneHistory(history, cutoffStr) {
  return history.filter(s => s.date >= cutoffStr);
}

function appendSnapshot(modules) {
  const today = new Date().toISOString().slice(0, 10);
  const history = getHistory();
  if (history.length > 0 && history[history.length - 1].date === today) return;

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
```

Atualizar `module.exports` no final de `server/data.js` para incluir as novas funções:

```js
module.exports = {
  getUsers, writeUsers, findUserByEmail, findUserById, addUser, removeUser,
  getModules, writeModules,
  getHistory, appendSnapshot, pruneHistory,
  DEFAULT_MODULES
};
```

- [ ] **Step 4: Rodar os testes — devem passar**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test server/tests/history.test.js
```

Expected: todos os testes `✓ pass`

- [ ] **Step 5: Rodar todos os testes para confirmar nenhuma regressão**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test
```

Expected: todos os testes passam

- [ ] **Step 6: Commit**

```bash
git add server/data.js server/tests/history.test.js
git commit -m "feat: add getHistory, appendSnapshot, pruneHistory to data.js"
```

---

## Task 3: Adicionar GET /api/history + cron job em server.js (TDD)

**Files:**
- Modify: `server/tests/server.test.js`
- Modify: `server/server.js`

- [ ] **Step 1: Escrever os testes que vão falhar**

Abrir `server/tests/server.test.js` e adicionar ao final do arquivo (antes do último fechamento, se houver):

```js
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
```

- [ ] **Step 2: Rodar os testes — devem falhar**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test server/tests/server.test.js
```

Expected: os 3 novos testes falham com 404

- [ ] **Step 3: Adicionar o endpoint e o cron job em server.js**

Abrir `server/server.js`. Após a linha `const data = require('./data.js');`, adicionar:

```js
const cron = require('node-cron');
```

Após o bloco `// ---- Users routes ----` (após o último `app.delete`), adicionar:

```js
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
```

- [ ] **Step 4: Rodar os testes — devem passar**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test server/tests/server.test.js
```

Expected: todos os testes `✓ pass`

- [ ] **Step 5: Rodar todos os testes**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test
```

Expected: todos os testes passam

- [ ] **Step 6: Commit**

```bash
git add server/server.js server/tests/server.test.js
git commit -m "feat: add GET /api/history endpoint and daily snapshot cron job"
```

---

## Task 4: Adicionar CSS do dashboard em index.html

**Files:**
- Modify: `painel/index.html`

- [ ] **Step 1: Adicionar CSS do dashboard**

No `painel/index.html`, localizar o comentário `/* ---- add module card ---- */` na seção `<style>` e inserir **antes** dele:

```css
/* ---- dashboard ---- */
.dashboard {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 24px;
}

.dash-donut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.dash-legend {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--muted);
}

.dash-legend span { display: flex; align-items: center; gap: 6px; }

.dash-sparklines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  justify-content: center;
}

.spark-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.spark-name {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .02em;
  width: 150px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spark-svg {
  flex: 1;
  height: 20px;
  min-width: 60px;
}

.spark-delta {
  font-family: var(--mono);
  font-size: 10px;
  width: 48px;
  text-align: right;
  flex-shrink: 0;
}

.dash-no-history {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--muted2);
  font-style: italic;
}
```

- [ ] **Step 2: Verificar que a página ainda carrega sem erros de CSS**

```bash
open /Users/abraao101icloud.com/Documents/painel/painel/index.html
```

(Página pode mostrar tela de login — o importante é não ter erros de parse no console do browser)

- [ ] **Step 3: Commit**

```bash
git add painel/index.html
git commit -m "feat: add dashboard CSS (donut, sparklines, legend)"
```

---

## Task 5: Adicionar renderDashboard() em index.html

**Files:**
- Modify: `painel/index.html`

- [ ] **Step 1: Adicionar a variável `history` e as funções do dashboard**

No `painel/index.html`, localizar a linha:

```js
let currentUser = null;
```

Adicionar **antes** dela:

```js
let history = [];
```

- [ ] **Step 2: Adicionar as funções de renderização do dashboard**

Localizar a função `function renderStats()` e **substituir o bloco inteiro** por:

```js
function buildDonutSVG(d, r, t, total) {
  if (total === 0) {
    return '<svg width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg3)" stroke-width="14"/><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-family="var(--mono)" font-size="10" fill="var(--muted)">sem itens</text></svg>';
  }
  const C = 251.3;
  let offset = 0;
  function seg(len, color) {
    if (len <= 0) return '';
    const s = `<circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${len.toFixed(1)} ${C}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 50 50)"/>`;
    offset += len;
    return s;
  }
  const dLen = (d / total) * C;
  const rLen = (r / total) * C;
  const tLen = (t / total) * C;
  const pct  = Math.round(d / total * 100);
  return `<svg width="100" height="100" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg3)" stroke-width="14"/>
    ${seg(dLen, 'var(--done)')}${seg(rLen, 'var(--rev)')}${seg(tLen, 'var(--todo)')}
    <text x="50" y="46" text-anchor="middle" font-family="var(--mono)" font-size="14" font-weight="500" fill="var(--done-txt)">${pct}%</text>
    <text x="50" y="58" text-anchor="middle" font-family="var(--mono)" font-size="8" fill="var(--muted)">feito</text>
  </svg>`;
}

function buildSparklines() {
  if (history.length < 2) return '';
  const recent = history.slice(-7);
  const n = recent.length;
  return modules.map(mod => {
    const snapPcts = recent.map(snap => {
      const m = snap.modules.find(sm => sm.name === mod.name);
      return m && m.total > 0 ? (m.done / m.total) * 100 : 0;
    });
    const points = snapPcts.map((pct, i) => {
      const x = n > 1 ? (i / (n - 1)) * 80 : 40;
      const y = 18 - (pct / 100) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const delta = Math.round(snapPcts[snapPcts.length - 1] - snapPcts[0]);
    const deltaColor = delta > 0 ? 'var(--done-txt)' : delta < 0 ? 'var(--todo-txt)' : 'var(--muted)';
    const deltaStr   = delta > 0 ? `↑+${delta}%` : delta < 0 ? `↓${delta}%` : '→ 0%';
    return `<div class="spark-row">
      <span class="spark-name">${esc(mod.name)}</span>
      <svg class="spark-svg" viewBox="0 0 80 20" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="var(--done)" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
      <span class="spark-delta" style="color:${deltaColor}">${deltaStr}</span>
    </div>`;
  }).join('');
}

function buildDashboardHTML(d, r, t, n, total) {
  const donutSVG = buildDonutSVG(d, r, t, total);
  const pctDone  = total ? Math.round(d / total * 100) : 0;
  const pctRev   = total ? Math.round(r / total * 100) : 0;
  const pctTodo  = total ? Math.round(t / total * 100) : 0;
  const sparklines = buildSparklines();
  const sparklinesSection = sparklines
    ? `<div class="dash-sparklines">${sparklines}</div>`
    : `<div class="dash-sparklines"><span class="dash-no-history">histórico disponível após o primeiro snapshot automático (meia-noite)</span></div>`;
  return `<div class="dashboard">
    <div class="dash-donut">
      ${donutSVG}
      <div class="dash-legend">
        <span><span class="dot d-done"></span>Feito ${pctDone}% (${d})</span>
        <span><span class="dot d-rev"></span>Revisar ${pctRev}% (${r})</span>
        <span><span class="dot d-todo"></span>Falta ${pctTodo}% (${t})</span>
        <span><span class="dot d-nd"></span>N/D ${n}</span>
      </div>
    </div>
    ${sparklinesSection}
  </div>`;
}

function renderDashboard() {
  const all   = allItems();
  const d     = all.filter(i => i.s === 'done').length;
  const r     = all.filter(i => i.s === 'rev').length;
  const t     = all.filter(i => i.s === 'todo').length;
  const n     = all.filter(i => i.s === 'nd').length;
  const total = all.length;
  const pct   = total ? Math.round(d / total * 100) : 0;

  document.getElementById('pct-global').textContent = pct + '%';
  document.getElementById('subtitle').textContent   = `${total} itens em ${modules.length} módulos`;
  document.getElementById('footer').textContent     = `atualizado pelo painel · ${total} itens · ${modules.length} módulos`;

  const btnEl = document.getElementById('action-buttons');
  if (btnEl && currentUser) {
    const exportBtn = currentUser.role !== 'viewer'
      ? `<button class="btn" onclick="exportData(event)">Exportar</button>`
      : '';
    const resetBtn = currentUser.role === 'admin'
      ? `<button class="btn btn-danger" onclick="resetData()">Reset</button>`
      : '';
    btnEl.innerHTML = exportBtn + resetBtn;
  }

  document.getElementById('stats').innerHTML = buildDashboardHTML(d, r, t, n, total);
}
```

- [ ] **Step 3: Atualizar render() para chamar renderDashboard em vez de renderStats**

Localizar:

```js
function render() {
  renderStats();
  renderGrid();
}
```

Substituir por:

```js
function render() {
  renderDashboard();
  renderGrid();
}
```

- [ ] **Step 4: Commit**

```bash
git add painel/index.html
git commit -m "feat: add buildDonutSVG, buildSparklines, renderDashboard to index.html"
```

---

## Task 6: Atualizar init flow para buscar histórico em paralelo

**Files:**
- Modify: `painel/index.html`

- [ ] **Step 1: Atualizar o handler de login**

Localizar no login form handler:

```js
currentUser = await res.json();
modules = await loadModules();
renderUserInfo();
showAppScreen();
render();
```

Substituir por:

```js
currentUser = await res.json();
[modules, history] = await Promise.all([
  loadModules(),
  fetch('/api/history').then(r => r.json()).catch(() => [])
]);
renderUserInfo();
showAppScreen();
render();
```

- [ ] **Step 2: Testar o fluxo completo no browser**

```bash
npm start
```

Abrir `http://localhost:3000`, fazer login e verificar:
- Dashboard aparece no lugar da barra de stats (donut + mensagem de "histórico disponível após primeiro snapshot")
- Grid de módulos continua funcionando normalmente
- Filtros da legend (no top-bar) continuam funcionando
- Exportar / Reset funcionam (se admin/editor)

- [ ] **Step 3: Commit**

```bash
git add painel/index.html
git commit -m "feat: fetch history in parallel with modules on login"
```

---

## Self-Review

### Spec coverage

| Requisito do spec | Task que implementa |
|---|---|
| `node-cron` job à meia-noite | Task 3, Step 3 (cron.schedule) |
| Snapshot em `server/data/history.json` | Task 2, Step 3 (appendSnapshot + historyPath) |
| Retenção de 90 dias | Task 2, Step 3 (pruneHistory com cutoff) |
| `GET /api/history` autenticado | Task 3, Step 3 |
| Todos os roles acessam o endpoint | Task 3, Step 1 (teste) |
| Donut SVG com done/rev/todo | Task 5, Step 2 (buildDonutSVG) |
| Sparklines por módulo | Task 5, Step 2 (buildSparklines) |
| Dashboard substitui barra de stats | Task 5, Step 3 (render → renderDashboard) |
| Busca em paralelo `/api/modules` + `/api/history` | Task 6, Step 1 |
| Falha silenciosa se `/api/history` falhar | Task 6, Step 1 (`.catch(() => [])`) |
| Sem histórico → oculta sparklines | Task 5, Step 2 (`if (history.length < 2)`) |

### Placeholder scan
Nenhum TBD, TODO, ou referência a "similar ao task N". Todos os steps têm código completo.

### Type consistency
- `history` → array de snapshots (definido em Task 2, usado em Task 5 e Task 6) ✓
- `appendSnapshot(modules)` → recebe array de módulos (Task 2 e Task 3) ✓
- `pruneHistory(history, cutoffStr)` → recebe array + string ISO date (Task 2) ✓
- `buildDonutSVG(d, r, t, total)` → quatro números (Task 5) ✓
- `buildDashboardHTML(d, r, t, n, total)` → cinco números (Task 5) ✓
