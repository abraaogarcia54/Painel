# Dashboard de Progresso com Histórico

**Data:** 2026-06-05
**Status:** aprovado

## Objetivo

Adicionar um dashboard visual ao painel que mostra o progresso geral (donut SVG) e a evolução por módulo ao longo do tempo (sparklines SVG), com snapshots automáticos diários salvos no backend.

## O que será construído

1. Job `node-cron` no `server.js` — snapshot diário à meia-noite em `server/data/history.json`
2. Endpoint `GET /api/history` — autenticado, retorna o histórico completo
3. Dashboard SVG inline no `painel/index.html` — substitui a barra de stats atual

## Backend

### Snapshot diário

- **Trigger:** `node-cron` com expressão `0 0 * * *` (meia-noite todo dia)
- **Arquivo:** `server/data/history.json` (criado automaticamente se não existir)
- **Retenção:** últimos 90 dias — ao salvar um snapshot, entradas com `date` anterior a hoje - 90 dias são descartadas

**Estrutura de um snapshot:**
```json
{
  "date": "2026-06-05",
  "total": 120,
  "done": 72,
  "rev": 18,
  "todo": 24,
  "nd": 6,
  "modules": [
    { "name": "Cadastro — Produto", "done": 10, "total": 12 },
    { "name": "Estoque", "done": 5, "total": 10 }
  ]
}
```

### Endpoint

- **Rota:** `GET /api/history`
- **Auth:** `requireAuth` (qualquer role — viewer, editor, admin)
- **Resposta:** array de snapshots ordenado do mais antigo ao mais recente
- **Sem histórico:** retorna `[]`

## Frontend

### Posicionamento

O dashboard substitui a barra de stats atual (os cards de done/rev/todo/nd/total) e fica no topo, acima do grid de módulos.

### Layout

```
┌─────────────────────────────────────────────┐
│  [Donut]       Cadastro ───────── ↑+8%  ░░░ │
│                Estoque  ───────── ↑+3%  ░░░  │
│  Feito  60%    Fiscal   ──────────  →0% ░░░  │
│  Revisar 15%   Vendas   ───────── ↑+5%  ░░░  │
│  Falta  20%                                  │
└─────────────────────────────────────────────┘
```

**Donut SVG** (esquerda):
- Anel SVG com as 3 cores: verde (`--done`) / laranja (`--rev`) / vermelho (`--todo`)
- Percentual `done` no centro em `--done-txt`
- Legenda abaixo: Feito X% / Revisar X% / Falta X%

**Sparklines SVG** (direita):
- Uma linha por módulo, com os últimos 7 snapshots disponíveis
- Delta da semana (hoje vs 7 dias atrás): `↑+X%` verde, `→0%` cinza, `↓-X%` vermelho
- Se menos de 2 snapshots disponíveis: sparkline oculta, só mostra o % atual

### Busca de dados

```js
const [modules, history] = await Promise.all([
  fetch('/api/modules').then(r => r.json()),
  fetch('/api/history').then(r => r.json()).catch(() => [])
]);
```

`/api/history` falha silenciosamente — o painel carrega normalmente sem o dashboard histórico.

### Comportamento por role

Todos os roles (admin, editor, viewer) veem o dashboard. É somente leitura — nenhuma interação.

## Casos de borda

| Situação | Comportamento |
|---|---|
| `history.json` não existe | `GET /api/history` retorna `[]` |
| Primeiro dia (sem snapshots) | Donut usa dados ao vivo; sparklines ocultas |
| Server offline na meia-noite | Aquele dia não tem snapshot; sparkline mostra gap |
| `/api/history` retorna erro | Dashboard não renderiza; grid de módulos funciona normalmente |

## Dependências

- `node-cron` — única adição ao `package.json`
- Sem biblioteca de charting — SVG puro inline

## Fora do escopo

- Exportação de PDF/CSV do histórico
- Filtro de período no dashboard
- Edição manual de snapshots
- Notificações de progresso
