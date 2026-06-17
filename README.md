# Painel de Design - Figma

Painel interno para acompanhar o progresso de telas de UI em módulos de ERP.
O sistema permite visualizar, filtrar e atualizar o status de cada tela, além de
controlar acesso por perfil de usuário.

Status disponíveis:

- `done`: Feito
- `rev`: Revisar
- `todo`: Falta fazer
- `nd`: Não definido

## Stack

- **Frontend:** HTML, CSS e JavaScript vanilla em `painel/`
- **Backend:** Node.js 20 com Express 4
- **Autenticação:** JWT em cookie `httpOnly` + bcrypt
- **Persistência:** arquivos JSON em `server/data/`
- **Agendamento:** `node-cron` para snapshots diários de histórico
- **Testes:** `node:test` + `supertest`
- **Deploy:** Docker com servidor Node

## Arquitetura Atual

O Express serve o frontend estático e também expõe a API REST. Depois do login,
o backend grava um cookie `token` com JWT `httpOnly`; o JavaScript do navegador
não acessa o token diretamente, apenas faz chamadas autenticadas para a API.

A persistência é baseada em arquivos JSON:

- `server/data/users.json`: usuários e hashes de senha
- `server/data/modules.json`: módulos, itens e status
- `server/data/history.json`: snapshots diários para o dashboard histórico

Por padrão, esses arquivos ficam em `server/data/`. Em testes ou deploys
customizados, o diretório pode ser alterado com `DATA_DIR`.

## Estrutura

```txt
painel/
├── painel/
│   ├── index.html              # Estrutura HTML
│   ├── styles.css              # Estilos do painel
│   └── app.js                  # Estado, renderização e chamadas de API
├── server/
│   ├── server.js               # App Express, rotas e cron
│   ├── data.js                 # Leitura/escrita de JSON
│   ├── seed.js                 # CLI para criar usuários
│   ├── middleware/
│   │   └── auth.js             # JWT + validação de roles
│   ├── routes/                 # Rotas separadas por domínio
│   │   ├── auth.js
│   │   ├── history.js
│   │   ├── modules.js
│   │   └── users.js
│   ├── tests/                  # Testes automatizados
│   └── data/                   # Dados locais persistidos
├── docs/superpowers/           # Specs e planos de implementação
├── Dockerfile
├── package.json
└── README.md
```

## Rodando Localmente

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar ambiente

```bash
cp .env.example .env
```

Edite `.env`:

```env
JWT_SECRET=sua-chave-secreta-aleatoria-com-pelo-menos-32-caracteres
NODE_ENV=development
PORT=3000
```

Variáveis suportadas:

| Variável | Obrigatória | Descrição |
|---|---:|---|
| `JWT_SECRET` | Sim | Chave usada para assinar os tokens JWT |
| `NODE_ENV` | Não | Use `development`, `test` ou `production` |
| `PORT` | Não | Porta do servidor. Padrão: `3000` |
| `DATA_DIR` | Não | Diretório alternativo para os arquivos JSON |

### 3. Criar o primeiro usuário

```bash
node server/seed.js --name Admin --email admin@email.com --password suaSenha --role admin
```

Roles disponíveis: `admin`, `editor` e `viewer`.

### 4. Iniciar o servidor

```bash
npm start
```

Acesse:

```txt
http://localhost:3000
```

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor Express |
| `npm test` | Executa todos os testes com `node:test` |
| `node server/seed.js ...` | Cria usuários pela CLI |

## API

Todos os endpoints protegidos exigem o cookie JWT criado no login.

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/login` | Público | Autentica usuário e seta o cookie |
| `GET` | `/auth/me` | Autenticado | Retorna o usuário da sessão |
| `POST` | `/auth/logout` | Público | Limpa o cookie de autenticação |
| `GET` | `/api/modules` | Autenticado | Lista módulos e itens |
| `POST` | `/api/modules` | Admin / Editor | Cria um módulo |
| `PUT` | `/api/modules` | Admin / Editor | Substitui todos os módulos; legado |
| `POST` | `/api/modules/reorder` | Admin / Editor | Reordena módulos por lista de IDs |
| `POST` | `/api/modules/reset` | Admin | Restaura os dados padrão |
| `PATCH` | `/api/modules/:moduleId` | Admin / Editor | Renomeia um módulo |
| `DELETE` | `/api/modules/:moduleId` | Admin / Editor | Remove um módulo |
| `POST` | `/api/modules/:moduleId/items` | Admin / Editor | Cria um item no módulo |
| `PATCH` | `/api/modules/:moduleId/items/:itemId` | Admin / Editor | Atualiza nome ou status do item |
| `DELETE` | `/api/modules/:moduleId/items/:itemId` | Admin / Editor | Remove um item |
| `GET` | `/api/history` | Autenticado | Lista snapshots históricos |
| `GET` | `/api/users` | Admin | Lista usuários sem `passwordHash` |
| `POST` | `/api/users` | Admin | Cria um usuário |
| `DELETE` | `/api/users/:id` | Admin | Remove um usuário |

### Modelo de módulo

```json
[
  {
    "id": "mod-cadastro-produto",
    "name": "Cadastro - Produto",
    "items": [
      { "id": "item-consultar", "n": "Consultar", "s": "done" },
      { "id": "item-cadastrar", "n": "Cadastrar", "s": "todo" }
    ]
  }
]
```

Os campos `id` de módulos e itens são estáveis e preservados em renomeações.
Dados antigos sem `id` são normalizados automaticamente ao carregar ou salvar
módulos.

Observação: a API ainda mantém `PUT /api/modules` por compatibilidade, mas o
fluxo principal da interface usa endpoints granulares para criar, renomear,
remover, atualizar status e reordenar módulos/itens.

## Perfis

| Role | Permissões |
|---|---|
| `admin` | Edita módulos, itens e status; reseta dados; gerencia usuários |
| `editor` | Edita módulos, itens e status |
| `viewer` | Visualiza o painel sem ações de edição |

## Histórico

O servidor agenda um snapshot diário à meia-noite com `node-cron`. Cada snapshot
salva totais gerais e progresso por módulo em `history.json`.

O histórico é usado pelo dashboard para renderizar donut e sparklines. A função
de snapshot evita duplicar entradas do mesmo dia e mantém apenas registros
recentes conforme a regra implementada em `server/data.js`.

## Testes

```bash
npm test
```

A suíte cobre:

- autenticação e autorização por role;
- rotas de módulos;
- gestão de usuários;
- leitura e escrita da camada de dados;
- endpoint e funções de histórico.

## Docker

### Build

```bash
docker build -t painel .
```

### Run

```bash
docker run -d -p 3000:3000 \
  --name painel \
  -e JWT_SECRET=sua-chave-secreta-com-pelo-menos-32-caracteres \
  -e NODE_ENV=production \
  -v $(pwd)/server/data:/app/server/data \
  painel
```

O volume em `server/data` preserva usuários, módulos e histórico entre restarts.

Depois de subir o container pela primeira vez, crie um usuário admin:

```bash
docker exec -it painel \
  node server/seed.js --name Admin --email admin@email.com --password suaSenha --role admin
```

## Gerenciar Usuários

Criar usuário pela CLI:

```bash
node server/seed.js --name Nome --email email@x.com --password senha --role editor
```

Remover usuários pode ser feito pela tela **Usuários**, disponível apenas para
admins. A CLI atual cria usuários, mas não altera nem remove usuários existentes.

## Limitações Conhecidas

- O frontend ainda usa renderização manual por strings e handlers globais.
- A persistência em JSON é simples, mas não é ideal para uso concorrente.
- `PUT /api/modules` ainda existe como endpoint legado.
- Não há testes automatizados de interface.

## Evolução Recomendada

Para modernizar sem reescrever tudo de uma vez:

1. Migrar a persistência de JSON para SQLite.
2. Migrar o frontend para componentes com React/Vite.
3. Avaliar Next.js apenas se o painel crescer em rotas, fluxos e requisitos de servidor.
