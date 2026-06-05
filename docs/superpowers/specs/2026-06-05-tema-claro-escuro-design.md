# Tema Claro / Escuro

**Data:** 2026-06-05
**Status:** aprovado

## Objetivo

Adicionar suporte a tema claro ao painel com um botão de alternância (ícone ☀/🌙) no header. A preferência é persistida em `localStorage` e aplicada sem flash na carga.

## O que será construído

1. Bloco CSS `[data-theme="light"]` em `painel/index.html` com paleta Cool Blue-Gray
2. Botão `#theme-toggle` no header com ícone via CSS `::before`
3. Três funções JS: `applyTheme`, `toggleTheme`, `loadTheme`
4. Chamada de `loadTheme()` no topo do `<script>` para evitar flash

## CSS

### Abordagem

`data-theme="light"` setado em `document.documentElement`. CSS usa o seletor `[data-theme="light"]` para sobrescrever as variáveis do `:root` existente. Zero duplicação de regras de layout — apenas as custom properties mudam.

### Paleta do tema claro (Cool Blue-Gray)

Adicionado logo após o bloco `:root` existente:

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

**Inalteradas em ambos os temas:** `--done` (#1D9E75), `--rev` (#d4860f), `--todo` (#c0392b) — funcionam bem em fundo claro e escuro.

### CSS do botão de tema

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

## HTML

O botão é inserido dentro do `<div class="global-bar">` no header, antes do `#user-info`:

```html
<button id="theme-toggle" class="theme-btn" onclick="toggleTheme()" title="Alternar tema"></button>
```

## JavaScript

### Funções

```js
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

### Inicialização

`loadTheme()` é chamada **uma única vez**, como primeira linha dentro do bloco `<script>`, antes de qualquer declaração de variável ou render:

```js
loadTheme();
```

Isso garante que o `data-theme` correto esteja no `<html>` antes do primeiro paint, evitando flash do tema errado.

## Persistência

- Chave: `painel-theme`
- Valores: `'light'` ou `'dark'`
- Padrão: `'dark'` (se chave ausente no localStorage)

## Fora do escopo

- `prefers-color-scheme` automático (sem detecção do sistema)
- Temas adicionais além de claro/escuro
- Sincronização de tema entre abas
