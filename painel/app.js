const statusOrder = ['done', 'rev', 'todo', 'nd'];
const label = { done: "Feito", rev: "Revisar", todo: "Falta fazer", nd: "Não definido" };
const bcls  = { done: "b-done", rev: "b-rev", todo: "b-todo", nd: "b-nd" };

let modules = [];
let history = [];
let activeFilter   = "all";
let editingModule  = null; // index being renamed
let addingToModule = null; // index getting new item, or -1 for new module

/* ---- persistence ---- */
async function loadModules() {
  const res = await fetch('/api/modules');
  if (!res.ok) throw new Error('Falha ao carregar módulos');
  return res.json();
}

async function apiJSON(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Falha na operação');
  return body;
}

function showSaved() {
  const el = document.getElementById('saved');
  el.textContent = 'salvo ✓';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function showSaveError() {
  const el = document.getElementById('saved');
  const orig = 'salvo ✓';
  el.textContent = 'erro ao salvar';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = orig; el.classList.remove('show'); }, 3000);
}

async function save() {
  try {
    modules = await apiJSON('/api/modules', {
      method: 'PUT',
      body: JSON.stringify(modules)
    });
    showSaved();
  } catch {
    showSaveError();
  }
}

/* ---- helpers ---- */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function allItems() {
  return modules.flatMap(m => m.items);
}

function createEntityId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createModuleId() {
  return createEntityId('mod');
}

function createItemId() {
  return createEntityId('item');
}

/* ---- mutations ---- */
async function cycleStatus(mi, ii) {
  const mod = modules[mi];
  const item = modules[mi].items[ii];
  const previous = item.s;
  const next = statusOrder[(statusOrder.indexOf(item.s) + 1) % statusOrder.length];
  item.s = next;
  render();
  try {
    Object.assign(item, await apiJSON(`/api/modules/${encodeURIComponent(mod.id)}/items/${encodeURIComponent(item.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ s: next })
    }));
    showSaved();
    render();
  } catch {
    item.s = previous;
    showSaveError();
    render();
  }
}

async function deleteItem(mi, ii) {
  const mod = modules[mi];
  const [removed] = modules[mi].items.splice(ii, 1);
  render();
  try {
    await apiJSON(`/api/modules/${encodeURIComponent(mod.id)}/items/${encodeURIComponent(removed.id)}`, {
      method: 'DELETE'
    });
    showSaved();
  } catch {
    modules[mi].items.splice(ii, 0, removed);
    showSaveError();
    render();
  }
}

async function deleteModule(mi) {
  if (!confirm(`Remover o módulo "${modules[mi].name}"?`)) return;
  const [removed] = modules.splice(mi, 1);
  if (editingModule === mi) editingModule = null;
  render();
  try {
    await apiJSON(`/api/modules/${encodeURIComponent(removed.id)}`, { method: 'DELETE' });
    showSaved();
  } catch {
    modules.splice(mi, 0, removed);
    showSaveError();
    render();
  }
}

function startRename(mi) {
  editingModule = mi;
  renderGrid();
  setTimeout(() => {
    const el = document.getElementById(`rename-${mi}`);
    if (el) { el.focus(); el.select(); }
  }, 0);
}

async function commitRename(mi) {
  const el = document.getElementById(`rename-${mi}`);
  const name = el ? el.value.trim() : '';
  const mod = modules[mi];
  const previous = mod.name;
  if (name) mod.name = name;
  editingModule = null;
  renderGrid();
  if (!name || name === previous) return;
  try {
    Object.assign(mod, await apiJSON(`/api/modules/${encodeURIComponent(mod.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    }));
    showSaved();
    render();
  } catch {
    mod.name = previous;
    showSaveError();
    render();
  }
}

function renameKeydown(e, mi) {
  if (e.key === 'Enter') commitRename(mi);
  if (e.key === 'Escape') { editingModule = null; renderGrid(); }
  e.stopPropagation();
}

function showAddItem(mi) {
  addingToModule = mi;
  renderGrid();
  setTimeout(() => {
    const el = document.getElementById(`new-item-${mi}`);
    if (el) el.focus();
  }, 0);
}

function cancelAddItem() {
  addingToModule = null;
  renderGrid();
}

async function commitAddItem(mi) {
  const el = document.getElementById(`new-item-${mi}`);
  const name = el ? el.value.trim() : '';
  if (!name) { cancelAddItem(); return; }
  const mod = modules[mi];
  const item = { id: createItemId(), n: name, s: 'todo' };
  mod.items.push(item);
  addingToModule = null;
  render();
  try {
    Object.assign(item, await apiJSON(`/api/modules/${encodeURIComponent(mod.id)}/items`, {
      method: 'POST',
      body: JSON.stringify(item)
    }));
    showSaved();
    render();
  } catch {
    mod.items = mod.items.filter(current => current.id !== item.id);
    showSaveError();
    render();
  }
}

function addItemKeydown(e, mi) {
  if (e.key === 'Enter') commitAddItem(mi);
  if (e.key === 'Escape') cancelAddItem();
  e.stopPropagation();
}

function showAddModule() {
  addingToModule = -1;
  renderGrid();
  setTimeout(() => {
    const el = document.getElementById('new-module-input');
    if (el) el.focus();
  }, 0);
}

function cancelAddModule() {
  addingToModule = null;
  renderGrid();
}

async function commitAddModule() {
  const el = document.getElementById('new-module-input');
  const name = el ? el.value.trim() : '';
  if (!name) { cancelAddModule(); return; }
  const mod = { id: createModuleId(), name, items: [] };
  modules.push(mod);
  addingToModule = null;
  render();
  try {
    Object.assign(mod, await apiJSON('/api/modules', {
      method: 'POST',
      body: JSON.stringify({ id: mod.id, name })
    }));
    showSaved();
    render();
  } catch {
    modules = modules.filter(current => current.id !== mod.id);
    showSaveError();
    render();
  }
}

function addModuleKeydown(e) {
  if (e.key === 'Enter') commitAddModule();
  if (e.key === 'Escape') cancelAddModule();
  e.stopPropagation();
}

function exportData(e) {
  const btn = e.target;
  const orig = btn.textContent;
  const json = JSON.stringify(modules, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    btn.textContent = 'copiado!';
    setTimeout(() => btn.textContent = orig, 1800);
  }).catch(() => alert('Não foi possível copiar. Verifique as permissões do navegador.'));
}

async function resetData() {
  if (!confirm('Resetar para os dados originais? Todas as alterações serão perdidas.')) return;
  const res = await fetch('/api/modules/reset', { method: 'POST' });
  if (!res.ok) { alert('Falha ao resetar.'); return; }
  modules = await res.json();
  editingModule = null;
  addingToModule = null;
  activeFilter = 'all';
  render();
}

/* ---- drag to reorder ---- */
let dragSrcMi = null;

function onDragStart(e, mi) {
  dragSrcMi = mi;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => {
    const card = document.querySelector(`[data-mi="${mi}"]`);
    if (card) card.classList.add('dragging');
  }, 0);
}

function onDragEnd() {
  dragSrcMi = null;
  document.querySelectorAll('.card').forEach(c => c.classList.remove('dragging', 'drag-over'));
}

function onDragOver(e, mi) {
  if (dragSrcMi === null || dragSrcMi === mi) return;
  e.preventDefault();
  document.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
  const card = document.querySelector(`[data-mi="${mi}"]`);
  if (card) card.classList.add('drag-over');
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function onDrop(e, mi) {
  e.preventDefault();
  if (dragSrcMi === null || dragSrcMi === mi) return;
  const previous = modules.slice();
  const [moved] = modules.splice(dragSrcMi, 1);
  modules.splice(mi, 0, moved);
  dragSrcMi = null;
  render();
  try {
    modules = await apiJSON('/api/modules/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids: modules.map(mod => mod.id) })
    });
    showSaved();
    render();
  } catch {
    modules = previous;
    showSaveError();
    render();
  }
}

/* ---- render dashboard ---- */
function renderDashboard() {
  const all   = allItems();
  const total = all.length;

  document.getElementById('subtitle').textContent = `${total} itens em ${modules.length} módulos`;
  document.getElementById('footer').textContent   = `atualizado pelo painel · ${total} itens · ${modules.length} módulos`;

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
}

/* ---- render grid ---- */
function progClass(items) {
  if (items.every(i => i.s === 'nd')) return 'prog-nd';
  if (items.some(i => i.s === 'todo')) return 'prog-todo';
  if (items.some(i => i.s === 'rev'))  return 'prog-rev';
  return 'prog-done';
}

function renderGrid() {
  const visibleModules = activeFilter === 'all'
    ? modules.map((m, mi) => ({ ...m, mi }))
    : modules.map((m, mi) => ({ ...m, mi, items: m.items.filter(i => i.s === activeFilter) }))
             .filter(m => m.items.length > 0);

  const cards = visibleModules.map(m => {
    const mi    = m.mi;
    const allIt = modules[mi].items; // always use full items for progress
    const done  = allIt.filter(i => i.s === 'done').length;
    const total = allIt.length;
    const pct   = total ? Math.round(done / total * 100) : 0;
    const pc    = progClass(allIt);
    const isViewer = currentUser && currentUser.role === 'viewer';

    const nameHtml = (!isViewer && editingModule === mi)
      ? `<input id="rename-${mi}" class="card-name-input"
           value="${esc(m.name)}"
           onblur="commitRename(${mi})"
           onkeydown="renameKeydown(event, ${mi})"
           onclick="event.stopPropagation()">`
      : isViewer
        ? `<span class="card-name">${esc(m.name)}</span>`
        : `<span class="card-name" title="Clique para renomear" onclick="startRename(${mi})">${esc(m.name)}</span>`;

    const itemsHtml = m.items.map((item, ii) => {
      // When filtered, find real index in original module
      const realIdx = activeFilter === 'all' ? ii : modules[mi].items.indexOf(item);
      return `
        <div class="item">
          ${!isViewer ? `<button class="item-del" onclick="deleteItem(${mi}, ${realIdx})" title="Remover">×</button>` : ''}
          <span class="item-name">${esc(item.n)}</span>
          <span class="badge ${bcls[item.s]}" ${!isViewer ? `onclick="cycleStatus(${mi}, ${realIdx})"` : ''} title="${!isViewer ? 'Clique para mudar status' : label[item.s]}">${label[item.s]}</span>
        </div>`;
    }).join('');

    const addFormHtml = isViewer ? '' : (addingToModule === mi
      ? `<div class="add-item-row">
           <input id="new-item-${mi}" placeholder="Nome do item…" onkeydown="addItemKeydown(event, ${mi})">
           <button onclick="commitAddItem(${mi})">ok</button>
           <button class="cancel-btn" onclick="cancelAddItem()">×</button>
         </div>`
      : `<div class="add-item-link" onclick="showAddItem(${mi})">+ item</div>`);

    const dragEnabled = activeFilter === 'all';
    const dragAttrs = dragEnabled
      ? `draggable="true" data-mi="${mi}"
         ondragstart="onDragStart(event,${mi})"
         ondragend="onDragEnd()"
         ondragover="onDragOver(event,${mi})"
         ondragleave="onDragLeave(event)"
         ondrop="onDrop(event,${mi})"`
      : '';
    const dragHandle = dragEnabled
      ? `<span class="drag-handle" title="Arrastar para reordenar">⠿</span>`
      : '';

    return `
      <div class="card" ${dragAttrs}>
        <div class="card-head">
          ${dragHandle}${nameHtml}
          <div class="card-head-right">
            <span class="card-count">${done}/${total}</span>
            ${!isViewer ? `<button class="icon-btn" onclick="deleteModule(${mi})" title="Remover módulo">×</button>` : ''}
          </div>
        </div>
        <div class="prog-track">
          <div class="prog-fill ${pc}" style="width:${pct}%"></div>
        </div>
        <div class="card-body">${itemsHtml}</div>
        ${addFormHtml}
      </div>`;
  }).join('');

  const isViewerGlobal = currentUser && currentUser.role === 'viewer';
  const addModuleCard = isViewerGlobal ? '' : (addingToModule === -1
    ? `<div class="card-add-module">
         <div class="add-module-row">
           <input id="new-module-input" placeholder="Nome do módulo…" onkeydown="addModuleKeydown(event)">
           <button onclick="commitAddModule()">ok</button>
         </div>
         <span style="cursor:pointer;color:var(--muted)" onclick="cancelAddModule()">cancelar</span>
       </div>`
    : `<div class="card-add-module" onclick="showAddModule()">
         <span>+ módulo</span>
       </div>`);

  document.getElementById('grid').innerHTML = cards + addModuleCard;
}

function render() {
  renderDashboard();
  renderGrid();
}

function setFilter(f) {
  activeFilter = f;
  render();
}

/* ---- state: current user ---- */
let currentUser = null;

/* ---- auth helpers ---- */
async function checkAuth() {
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  currentUser = null;
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'block';
}

function showAppScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
}

function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (!el || !currentUser) return;
  const badgeCls = `badge-${esc(currentUser.role)}`;
  const usersLink = currentUser.role === 'admin'
    ? `<span class="btn" style="cursor:pointer" onclick="showUsersPage()">Usuários</span>`
    : '';
  el.innerHTML = `
    <span>${esc(currentUser.name)}</span>
    <span class="user-badge ${badgeCls}">${esc(currentUser.role)}</span>
    ${usersLink}
    <button class="btn btn-danger" onclick="logout()">Sair</button>
  `;
}

/* ---- login form ---- */
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  try {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      errEl.textContent = body.error || 'Credenciais inválidas';
      return;
    }
    currentUser = await res.json();
    [modules, history] = await Promise.all([
      loadModules(),
      fetch('/api/history').then(r => r.ok ? r.json() : []).catch(() => [])
    ]);
    renderUserInfo();
    showAppScreen();
    render();
  } catch {
    errEl.textContent = 'Erro de conexão. Tente novamente.';
  }
});

/* ---- admin users page ---- */
function showUsersPage() {
  document.getElementById('users-page').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
  renderUsersPage();
}

function showMainPage() {
  document.getElementById('users-page').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
}

async function renderUsersPage() {
  const container = document.getElementById('users-page');
  container.innerHTML = '<p style="font-family:var(--mono);color:var(--muted);padding:16px">carregando...</p>';

  let users;
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error();
    users = await res.json();
  } catch {
    container.innerHTML = '<p style="color:var(--todo-txt);font-family:var(--mono);padding:16px">Erro ao carregar usuários.</p>';
    return;
  }

  container.innerHTML = `
    <div class="users-page-header">
      <h2>Gestão de Usuários</h2>
      <button class="btn" onclick="showMainPage()">← Voltar</button>
    </div>
    <table class="users-table">
      <thead><tr><th>Nome</th><th>Email</th><th>Role</th><th></th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${esc(u.name)}</td>
            <td>${esc(u.email)}</td>
            <td><span class="user-badge badge-${esc(u.role)}">${esc(u.role)}</span></td>
            <td>${u.id !== currentUser.id
              ? `<button class="btn btn-danger" onclick="deleteUserById('${esc(u.id)}')">×</button>`
              : '<span style="color:var(--muted);font-size:10px;font-family:var(--mono)">(você)</span>'
            }</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="add-user-form">
      <input id="nu-name"     type="text"     placeholder="Nome">
      <input id="nu-email"    type="email"    placeholder="Email">
      <input id="nu-password" type="password" placeholder="Senha">
      <select id="nu-role">
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <button class="btn" onclick="createUser()">+ Usuário</button>
    </div>
    <p class="users-msg" id="users-msg"></p>
  `;
}

async function createUser() {
  const name     = document.getElementById('nu-name').value.trim();
  const email    = document.getElementById('nu-email').value.trim();
  const password = document.getElementById('nu-password').value;
  const role     = document.getElementById('nu-role').value;
  const msgEl    = document.getElementById('users-msg');
  msgEl.textContent = '';
  msgEl.className = 'users-msg';

  if (!name || !email || !password) {
    msgEl.textContent = 'Preencha nome, email e senha.';
    msgEl.className = 'users-msg err';
    return;
  }

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const body = await res.json();
    if (!res.ok) {
      msgEl.textContent = body.error || 'Erro ao criar usuário.';
      msgEl.className = 'users-msg err';
      return;
    }
    renderUsersPage();
  } catch {
    msgEl.textContent = 'Erro de conexão.';
    msgEl.className = 'users-msg err';
  }
}

async function deleteUserById(id) {
  if (!confirm('Remover este usuário?')) return;
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Erro ao remover usuário.'); return; }
    renderUsersPage();
  } catch {
    alert('Erro de conexão.');
  }
}

/* ---- init ---- */
async function init() {
  currentUser = await checkAuth();
  if (!currentUser) {
    showLoginScreen();
    return;
  }
  try {
    [modules, history] = await Promise.all([
      loadModules(),
      fetch('/api/history').then(r => r.ok ? r.json() : []).catch(() => [])
    ]);
  } catch {
    showLoginScreen();
    return;
  }
  renderUserInfo();
  showAppScreen();
  render();
}

init();
