# Tema Claro / Escuro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar tema claro (Cool Blue-Gray) ao painel com botão de alternância ☀/🌙 no header e preferência salva em localStorage.

**Architecture:** `data-theme="light"` setado em `document.documentElement` via JS. CSS usa `[data-theme="light"]` para sobrescrever as custom properties do `:root` — zero duplicação de regras de layout. `loadTheme()` chamada no topo do `<script>` para evitar flash.

**Tech Stack:** HTML/CSS/JS vanilla (arquivo único `painel/index.html`), localStorage para persistência. Sem dependências novas.

---

## File Map

| Arquivo | Ação | O que muda |
|---|---|---|
| `painel/index.html` | Modificar | CSS: `[data-theme="light"]` + `.theme-btn`. HTML: botão no header. JS: `applyTheme`, `toggleTheme`, `loadTheme` + chamada no topo do script |

---

## Task 1: Adicionar CSS do tema claro e do botão

**Files:**
- Modify: `painel/index.html` (bloco `<style>`, após linha 37 — fim do `:root`)

- [ ] **Step 1: Inserir o bloco `[data-theme="light"]` após o fechamento do `:root`**

Localizar no `<style>`:
```css
  }

  body {
    background: var(--bg);
```

Inserir **entre** o `}` do `:root` e o `body {`:

```css
  [data-theme="light"] {
    --bg:       #f0f4f8;
    --bg2:      #e8eef4;
    --bg3:      #dde6ef;
    --border:   #c8d6e2;
    --border2:  #b0c4d4;
    --text:     #1a2a38;
    --muted:    #6a8090;
    --muted2:   #8a9fb0;
    --done-bg:  #d0ede3;
    --done-txt: #145c40;
    --rev-bg:   #fce8cc;
    --rev-txt:  #8a4800;
    --todo-bg:  #fad6d0;
    --todo-txt: #8a1a10;
    --nd-bg:    #dde6ef;
    --nd-txt:   #6a8090;
    --nd:       #8a9fb0;
    --accent:   #1a2a38;
  }

```

- [ ] **Step 2: Inserir o CSS do botão de tema**

Localizar no `<style>` (por volta da linha 75):
```css
  .global-bar {
```

Inserir **antes** de `.global-bar {`:

```css
  .theme-btn {
    background: none;
    border: 1px solid var(--border2);
    border-radius: 4px;
    cursor: pointer;
    color: var(--muted);
    font-size: 14px;
    padding: 4px 7px;
    line-height: 1;
    transition: all .15s;
  }
  .theme-btn:hover { background: var(--bg3); color: var(--text); }
  .theme-btn::before { content: '☀'; }
  [data-theme="light"] .theme-btn::before { content: '🌙'; }

```

- [ ] **Step 3: Verificar que o CSS está válido**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('painel/index.html', 'utf8');
const hasLight = html.includes('[data-theme=\"light\"]');
const hasThemeBtn = html.includes('.theme-btn');
const hasMoon = html.includes('content: \'🌙\'');
console.log('light block:', hasLight);
console.log('theme-btn:', hasThemeBtn);
console.log('moon icon:', hasMoon);
if (!hasLight || !hasThemeBtn || !hasMoon) process.exit(1);
"
```

Expected: todas as três linhas mostram `true`

- [ ] **Step 4: Commit**

```bash
git add painel/index.html
git commit -m "feat: add light theme CSS and theme-btn styles"
```

---

## Task 2: Adicionar botão no header

**Files:**
- Modify: `painel/index.html` (HTML do header, linha ~762)

- [ ] **Step 1: Inserir o botão antes do `#user-info`**

Localizar no HTML:
```html
    <div class="user-info" id="user-info"></div>
  </div>
</header>
```

Substituir por:
```html
    <div style="display:flex;align-items:center;gap:8px;">
      <button id="theme-toggle" class="theme-btn" onclick="toggleTheme()" title="Alternar tema"></button>
      <div class="user-info" id="user-info"></div>
    </div>
  </div>
</header>
```

- [ ] **Step 2: Verificar que o botão está no HTML**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('painel/index.html', 'utf8');
const hasBtn = html.includes('id=\"theme-toggle\"');
const hasToggle = html.includes('onclick=\"toggleTheme()\"');
console.log('theme-toggle button:', hasBtn);
console.log('toggleTheme onclick:', hasToggle);
if (!hasBtn || !hasToggle) process.exit(1);
"
```

Expected: ambas as linhas mostram `true`

- [ ] **Step 3: Commit**

```bash
git add painel/index.html
git commit -m "feat: add theme toggle button to header"
```

---

## Task 3: Adicionar funções JS e inicialização sem flash

**Files:**
- Modify: `painel/index.html` (bloco `<script>`, top e corpo)

- [ ] **Step 1: Adicionar `loadTheme()` como primeira instrução executada no script**

Localizar o início do `<script>`:
```js
<script>
const statusOrder = ['done', 'rev', 'todo', 'nd'];
```

Substituir por:
```js
<script>
(function () {
  const t = localStorage.getItem('painel-theme') || 'dark';
  document.documentElement.dataset.theme = t === 'light' ? 'light' : '';
}());

const statusOrder = ['done', 'rev', 'todo', 'nd'];
```

> Usar IIFE inline evita poluir o escopo global e garante execução imediata antes de qualquer render.

- [ ] **Step 2: Adicionar as três funções de tema no corpo do script**

Localizar no script:
```js
let modules = [];
let history = [];
```

Adicionar **antes** dessas linhas:

```js
/* ---- theme ---- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t === 'light' ? 'light' : '';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem('painel-theme', next);
}

function loadTheme() {
  applyTheme(localStorage.getItem('painel-theme') || 'dark');
}

```

- [ ] **Step 3: Verificar que as funções existem e a IIFE está no topo**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('painel/index.html', 'utf8');
const hasIIFE   = html.includes('(function ()');
const hasApply  = html.includes('function applyTheme(');
const hasToggle = html.includes('function toggleTheme(');
const hasLoad   = html.includes('function loadTheme(');
console.log('IIFE no topo:', hasIIFE);
console.log('applyTheme:', hasApply);
console.log('toggleTheme:', hasToggle);
console.log('loadTheme:', hasLoad);
if (!hasIIFE || !hasApply || !hasToggle || !hasLoad) process.exit(1);
"
```

Expected: todas as quatro linhas mostram `true`

- [ ] **Step 4: Garantir que a IIFE está antes do primeiro `const statusOrder`**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('painel/index.html', 'utf8');
const scriptStart = html.indexOf('<script>');
const iifePos  = html.indexOf('(function ()', scriptStart);
const orderPos = html.indexOf('const statusOrder', scriptStart);
if (iifePos === -1 || iifePos >= orderPos) {
  console.error('IIFE deve vir antes de statusOrder');
  process.exit(1);
}
console.log('ordem correta: IIFE em', iifePos, '< statusOrder em', orderPos);
"
```

Expected: `ordem correta: IIFE em X < statusOrder em Y` onde X < Y

- [ ] **Step 5: Rodar os testes para confirmar nenhuma regressão**

```bash
cd /Users/abraao101icloud.com/Documents/painel && node --test 2>&1 | tail -6
```

Expected:
```
# tests 42
# pass 42
# fail 0
```

- [ ] **Step 6: Commit**

```bash
git add painel/index.html
git commit -m "feat: add applyTheme, toggleTheme, loadTheme and IIFE for flash-free init"
```

---

## Task 4: Verificação visual no browser

**Files:**
- Nenhum arquivo novo

- [ ] **Step 1: Buildar e subir o container**

```bash
docker build -t painel /Users/abraao101icloud.com/Documents/painel 2>&1 | tail -3
docker run -d --name painel-theme-test --env-file /Users/abraao101icloud.com/Documents/painel/.env -p 3001:3000 painel
sleep 2
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```

Expected: `200`

- [ ] **Step 2: Verificar no browser**

Abrir `http://localhost:3001` e checar:
1. Página carrega em tema escuro (padrão)
2. Botão ☀ aparece no header ao lado do nome do usuário
3. Clicar no botão troca para tema claro (fundo azul-acinzentado)
4. Ícone muda para 🌙
5. Recarregar a página — tema claro persiste
6. Clicar novamente — volta ao tema escuro
7. Recarregar — tema escuro persiste

- [ ] **Step 3: Parar o container**

```bash
docker stop painel-theme-test && docker rm painel-theme-test
```

- [ ] **Step 4: Commit de documentação (se necessário)**

Se tudo funcionou sem nenhum ajuste, não há commit adicional.  
Se foi necessário algum fix, commitar com:

```bash
git add painel/index.html
git commit -m "fix: <descrever o ajuste feito>"
```

---

## Self-Review

### Spec coverage

| Requisito do spec | Task que implementa |
|---|---|
| `[data-theme="light"]` com paleta Cool Blue-Gray | Task 1, Step 1 |
| `.theme-btn` com ícone ☀/🌙 via CSS `::before` | Task 1, Step 2 |
| Botão `#theme-toggle` no header | Task 2, Step 1 |
| `applyTheme(t)` função | Task 3, Step 2 |
| `toggleTheme()` função | Task 3, Step 2 |
| `loadTheme()` função | Task 3, Step 2 |
| IIFE no topo do script para evitar flash | Task 3, Step 1 |
| Persistência em `localStorage` chave `painel-theme` | Task 3, Step 2 |
| Padrão `'dark'` quando chave ausente | Task 3, Steps 1 e 2 |
| Verificação visual completa | Task 4 |

### Placeholder scan
Sem TBD, TODO, ou passos vagos. Todos os steps têm código completo.

### Type consistency
- `applyTheme(t)` — recebe string `'light'` ou `'dark'` (Tasks 3) ✓
- `toggleTheme()` — chama `applyTheme` e `localStorage.setItem` (Task 3) ✓
- `loadTheme()` — chama `applyTheme` com valor do localStorage (Task 3) ✓
- IIFE replica exatamente a lógica de `applyTheme` para execução inline (Task 3, Step 1) ✓
