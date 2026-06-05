# Login System Design — Painel de Design Figma

**Data:** 2026-06-05  
**Status:** Aprovado

---

## Contexto

O painel atualmente é um arquivo HTML estático sem qualquer autenticação. Qualquer pessoa com acesso à URL pode editar os dados. O objetivo é adicionar um sistema de login completo seguindo boas práticas, com suporte a múltiplos usuários e três roles distintos.

---

## Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Backend | Node.js + Express | Leve, fácil de integrar, sem dependências pesadas |
| Token | JWT em httpOnly Cookie | Melhor proteção contra XSS; SameSite=Strict bloqueia CSRF |
| Persistência | Arquivo JSON | Zero dependências externas; suficiente para time pequeno |
| Roles | Admin / Editor / Viewer | Necessidade real de controle de acesso granular |
| Senha | bcrypt (salt rounds 12) | Padrão de mercado; nunca salvar em plaintext |

---

## Arquitetura

```
painel/
├── painel/
│   └── index.html          ← frontend (servido pelo Express, não mais Nginx)
├── server/
│   ├── server.js           ← app Express principal
│   ├── middleware/
│   │   └── auth.js         ← verifica JWT do cookie em routes protegidas
│   └── data/
│       ├── users.json      ← usuários com roles e hashes bcrypt
│       └── modules.json    ← dados do painel (migrado do localStorage)
├── package.json
├── Dockerfile              ← atualizado: Node em vez de Nginx
└── CLAUDE.md
```

### Fluxo de requests

```
Browser → GET /              → Express serve index.html
Browser → POST /auth/login   → Express valida credenciais, seta cookie JWT
Browser → GET /auth/me       → Express retorna {name, role} ou 401
Browser → GET /api/modules   → Express verifica cookie → retorna dados
Browser → PUT /api/modules   → Express verifica role (admin|editor) → atualiza JSON
Browser → POST /auth/logout  → Express limpa o cookie
```

---

## Autenticação

### Login

1. Usuário preenche email + senha na tela de login
2. `POST /auth/login` — Express compara senha com hash bcrypt em `users.json`
3. Se válido: gera JWT com payload `{ userId, role }`, seta cookie:
   - `httpOnly: true` — JS não pode acessar
   - `SameSite: 'Strict'` — bloqueia envio cross-site (CSRF)
   - `Secure: NODE_ENV === 'production'` — true em produção (HTTPS), false em localhost
   - `maxAge: 8h`
4. Frontend redireciona para o painel

### Middleware `auth.js`

Para cada request protegido:
1. Lê cookie `token`
2. Verifica assinatura JWT com `JWT_SECRET` (variável de ambiente)
3. Injeta `req.user = { userId, role }` no request
4. Se inválido ou expirado → `401 Unauthorized`

### Segurança

| Medida | Implementação |
|---|---|
| Senha nunca em plaintext | `bcrypt` com salt rounds = 12 |
| Token não acessível via JS | `httpOnly: true` |
| Token não enviado cross-site | `SameSite: 'Strict'` |
| Token expira | JWT com `expiresIn: '8h'` |
| Secret seguro | `JWT_SECRET` via variável de ambiente |

---

## Estrutura de Dados

### `users.json`

```json
[
  {
    "id": "1",
    "name": "Abraao",
    "email": "abraao-101@hotmail.com",
    "passwordHash": "$2b$12$...",
    "role": "admin"
  }
]
```

### `modules.json`

Mesmo formato que já existe no `DEFAULT_MODULES` do `index.html`. Migrado do localStorage para o servidor.

Na primeira inicialização, se `modules.json` não existir, o servidor cria automaticamente a partir do `DEFAULT_MODULES` hardcoded no `server.js`. Isso garante que o deploy inicial não perca os dados de seed já existentes no projeto.

```json
[
  {
    "name": "Cadastro — Produto",
    "items": [
      { "n": "Consultar", "s": "done" }
    ]
  }
]
```

---

## Roles e Permissões

### Definição

| Role | Capacidades |
|---|---|
| `admin` | Tudo: editar módulos/itens/status + gerenciar usuários (criar, remover, mudar role) |
| `editor` | Editar módulos, itens e status. Sem acesso à gestão de usuários |
| `viewer` | Somente leitura. Sem botões de edição |

### Endpoints por role

| Endpoint | viewer | editor | admin |
|---|---|---|---|
| `GET /api/modules` | ✓ | ✓ | ✓ |
| `PUT /api/modules` | ✗ | ✓ | ✓ |
| `GET /api/users` | ✗ | ✗ | ✓ |
| `POST /api/users` | ✗ | ✗ | ✓ |
| `DELETE /api/users/:id` | ✗ | ✗ | ✓ |

**Importante:** A validação de role acontece no backend. O frontend apenas adapta a UI para UX — a segurança real está no servidor.

---

## Frontend

### Inicialização

```js
async function init() {
  const user = await checkAuth(); // GET /auth/me → {name, role} ou 401
  if (!user) { renderLogin(); return; }
  currentUser = user;
  modules = await loadModules(); // GET /api/modules
  render();
}
```

### Tela de login

- Renderizada quando `GET /auth/me` retorna 401
- Mesmo estilo visual (dark, IBM Plex Mono)
- Campos: email + senha
- Submit → `POST /auth/login`
- Erro de credenciais → mensagem de erro inline

### Migração localStorage → API

| Antes | Depois |
|---|---|
| `loadModules()` lê localStorage | `loadModules()` faz `GET /api/modules` |
| `save()` escreve no localStorage | `save()` faz `PUT /api/modules` |
| Dados locais por browser | Dados compartilhados no servidor |

### Adaptação por role no header

- Todos: nome do usuário logado + badge do role + botão "Sair"
- `editor`/`admin`: botões de edição visíveis
- `viewer`: botões de edição ocultos (só UI)
- `admin`: link "Usuários" no header → página de gestão

### Role no frontend

O cookie é `httpOnly` — o JavaScript não consegue ler o token. O role e o nome do usuário chegam ao frontend exclusivamente via `GET /auth/me` na inicialização e são guardados em `currentUser = { name, role }`. Não há parsing de JWT no browser.

---

## Deployment

### Dockerfile atualizado

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server/server.js"]
```

### Variáveis de ambiente necessárias

```
JWT_SECRET=<string aleatória, mínimo 32 chars>
NODE_ENV=production
PORT=3000
```

---

## Script de seed

Um script `server/seed.js` para criar o primeiro usuário admin:

```
node server/seed.js --email abraao-101@hotmail.com --password <senha> --name Abraao
```

Gera hash bcrypt e adiciona em `users.json`.

---

## O que NÃO está no escopo

- Recuperação de senha (email)
- OAuth / login social
- 2FA
- Rate limiting avançado (pode ser adicionado depois com `express-rate-limit`)
- Audit log de ações
