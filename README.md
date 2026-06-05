# Painel de Design — Figma

Painel interno para rastrear o progresso de telas de UI em módulos de ERP. Permite visualizar e atualizar o status de cada tela (Feito, Revisar, Falta fazer, Não definido) com controle de acesso por perfil de usuário.

---

## Stack

- **Frontend:** HTML + CSS + JavaScript vanilla (sem framework)
- **Backend:** Node.js 20 + Express 4
- **Auth:** JWT em cookie `httpOnly` + bcrypt
- **Persistência:** Arquivos JSON (`server/data/`)
- **Deploy:** Docker (nginx substituído por Node)

---

## Estrutura

```
painel/
├── painel/
│   └── index.html          # Frontend completo (CSS + JS embutidos)
├── server/
│   ├── server.js           # App Express + todas as rotas
│   ├── data.js             # Leitura/escrita de users.json e modules.json
│   ├── middleware/
│   │   └── auth.js         # Verificação de JWT + requireRole()
│   ├── seed.js             # CLI para criar usuários
│   └── data/
│       ├── users.json      # Usuários (criado pelo seed, não commitado)
│       └── modules.json    # Dados do painel (criado automaticamente)
├── Dockerfile
├── .env.example
└── package.json
```

---

## Rodando localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` e defina um `JWT_SECRET` com pelo menos 32 caracteres:

```
JWT_SECRET=sua-chave-secreta-aleatoria-com-32-chars
NODE_ENV=development
PORT=3000
```

### 3. Criar o primeiro usuário admin

```bash
node server/seed.js --name Seu\ Nome --email seu@email.com --password suaSenha
```

Roles disponíveis: `admin` (padrão), `editor`, `viewer`.

### 4. Iniciar o servidor

```bash
npm start
```

Acesse **http://localhost:3000**

---

## Docker

### Build

```bash
docker build -t painel .
```

### Run

```bash
docker run -d -p 3000:3000 \
  --name painel \
  -e JWT_SECRET=sua-chave-secreta-aqui \
  -e NODE_ENV=production \
  -v $(pwd)/server/data:/app/server/data \
  painel
```

O volume `-v` persiste `users.json` e `modules.json` entre restarts. Após subir o container pela primeira vez, crie o admin:

```bash
docker exec -it painel \
  node server/seed.js --name Admin --email admin@email.com --password suaSenha
```

---

## API

Todos os endpoints protegidos requerem cookie JWT (setado pelo login).

| Método | Endpoint | Acesso | Descrição |
|--------|----------|--------|-----------|
| `POST` | `/auth/login` | Público | Login — retorna `{id, name, role}` e seta cookie |
| `GET` | `/auth/me` | Autenticado | Retorna usuário da sessão |
| `POST` | `/auth/logout` | Autenticado | Limpa o cookie |
| `GET` | `/api/modules` | Autenticado | Lista todos os módulos |
| `PUT` | `/api/modules` | Admin / Editor | Substitui todos os módulos |
| `POST` | `/api/modules/reset` | Admin | Restaura dados originais |
| `GET` | `/api/users` | Admin | Lista usuários (sem hash) |
| `POST` | `/api/users` | Admin | Cria novo usuário |
| `DELETE` | `/api/users/:id` | Admin | Remove usuário |

---

## Perfis (roles)

| Role | Permissões |
|------|-----------|
| `admin` | Tudo: editar módulos, itens, status + gerenciar usuários |
| `editor` | Editar módulos, itens e status. Sem gestão de usuários |
| `viewer` | Somente leitura — sem botões de edição |

---

## Testes

```bash
npm test
```

34 testes de integração cobrindo autenticação, módulos e usuários.

---

## Gerenciar usuários via CLI

```bash
# Criar usuário
node server/seed.js --name Nome --email email@x.com --password senha --role editor

# Roles: admin | editor | viewer
```

Para remover ou promover usuários use a página **Usuários** no painel (visível apenas para admins).
