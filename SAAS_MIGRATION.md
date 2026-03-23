# Migração SaaS Multi-Tenant — Documentação Técnica

Este documento descreve a transformação do app de gestão de parques de diversão de um sistema sob medida (single-tenant) para uma plataforma SaaS multi-tenant por assinatura.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Plano de Execução e Status](#plano-de-execução-e-status)
4. [O que foi feito — Detalhamento técnico](#o-que-foi-feito)
5. [Configuração na Cloudflare](#configuração-na-cloudflare)
6. [Configuração no Stripe](#configuração-no-stripe)
7. [Deploy — Passo a passo](#deploy-passo-a-passo)
8. [Cuidados e Riscos](#cuidados-e-riscos)
9. [Testando localmente](#testando-localmente)
10. [Próximos passos](#próximos-passos)

---

## Visão Geral

O sistema foi originalmente construído para o cliente **SpeedKids**, que opera um parque de diversões com karts, bicicletas e patinetes. Após validação do produto, a decisão foi transformá-lo em SaaS para que outros estabelecimentos similares possam contratar.

**Modelo:** Assinatura mensal via Stripe com subdomínio exclusivo por cliente.

**Exemplo:** `speedykids.dadosinteligentes.app.br`, `aventurapark.dadosinteligentes.app.br`

**O SpeedKids (cliente original)** continua operando normalmente como tenant #1 — nenhum dado foi perdido, nenhuma URL mudou.

---

## Arquitetura

```
                    *.dadosinteligentes.app.br
                              │
                    ┌─────────┴──────────┐
                    │  Cloudflare Worker  │
                    │   (Hono + D1 + R2) │
                    └─────────┬──────────┘
                              │
               ┌──────────────┼──────────────┐
               │              │              │
         speedykids.    aventurapark.    cliente3.
        dadosintelig..  dadosintelig..  dadosintelig..
               │              │              │
               └──────┬───────┘              │
                      │                      │
              ┌───────┴───────┐      ┌───────┴───────┐
              │  D1 Database  │      │  R2 Bucket    │
              │  (compartilhado,     │  (paths por   │
              │   tenant_id)  │      │   tenant)     │
              └───────────────┘      └───────────────┘
```

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Cloudflare Workers (serverless edge) |
| Framework | Hono (TypeScript) |
| Banco | Cloudflare D1 (SQLite serverless) |
| Storage | Cloudflare R2 (S3-compatible) |
| Billing | Stripe (Checkout + Webhooks) |
| Validação | Zod |
| Testes | Vitest + Cloudflare Workers pool |

### Estratégia de isolamento

**Banco compartilhado com `tenant_id`** em todas as tabelas de dados. Toda query inclui `WHERE tenant_id = ?`. Não há banco separado por tenant — a isolação é lógica, não física.

---

## Plano de Execução e Status

| Fase | Descrição | Status | Observações |
|------|-----------|--------|-------------|
| **Fase 0** | Fundação multi-tenant | ✅ Concluída | Tabela tenants, tenant_id em 13 tabelas, middleware, 70+ queries refatoradas |
| **Fase 1** | White-label (marca dinâmica) | ✅ Concluída | Logo, títulos, cores, timezone por tenant |
| **Fase 2** | Self-service (landing, Stripe, provisioning) | ✅ Concluída | Landing page, checkout, webhook, provisioning automático |
| **Fase 3** | Planos e limites | 🔲 Pendente | Enforcement de max_users/max_assets por plano |
| **Fase 4** | Refinamento | 🔲 Pendente | Admin SaaS, emails, wizard de onboarding |

### Detalhamento das fases pendentes

**Fase 3 — Planos e Limites (~1 semana)**
- Middleware que verifica limites antes de criar users, assets, etc.
- Tela "Meu Plano" no admin mostrando uso vs. limites
- Webhook para atualizar plano quando upgrade/downgrade no Stripe
- Bloqueio gracioso (aviso, não erro seco) ao atingir limite

**Fase 4 — Refinamento (~1 semana)**
- Painel admin global (seu dashboard de dono do SaaS) para ver todos os tenants
- Email de boas-vindas com credenciais (via Cloudflare Email Workers ou Resend)
- Wizard de setup pós-signup (logo, cores, cadastro de ativos)
- Página "Meu Plano" com botão de upgrade/cancelamento

---

## O que foi feito

### Fase 0 — Fundação Multi-Tenant

**Migrations criadas:**
- `0029_create_tenants.sql` — Tabela `tenants` com: slug, name, status, plan, logo_url, primary_color, timezone, owner_email, max_users, max_assets
- `0030_add_tenant_id.sql` — Coluna `tenant_id` em 12 tabelas + recriação da `business_config` (removendo constraint singleton)
- `0031_create_subscriptions.sql` — Tabela `subscriptions` para billing Stripe

**Middleware de tenant** (`src/middleware/tenant.ts`):
- Resolve o tenant pelo subdomínio: extrai slug do header `Host`
- Em dev local (localhost/127.0.0.1), faz fallback para tenant #1
- Define `c.set('tenant_id')` e `c.set('tenant')` no contexto Hono
- Configura timezone do tenant via `setTimezone()`

**Queries refatoradas (~70+ funções):**
- Todas as funções de SELECT/INSERT/UPDATE/DELETE em 17 arquivos de queries
- Todas recebem `tenantId: number` como parâmetro
- Todas incluem `WHERE tenant_id = ?` ou `AND tenant_id = ?`
- INSERTs incluem `tenant_id` nos valores

**Rotas refatoradas (~30+ handlers):**
- 16 arquivos de rotas API
- 11 arquivos de rotas de página
- Todos extraem `c.get('tenant_id')` e passam para queries

**Preservação de dados do SpeedKids:**
- `DEFAULT 1` nas migrations garante que todos os registros existentes ficam vinculados ao tenant 1
- Nenhum dado foi movido, alterado ou deletado
- O login, dashboard, caixa e todos os módulos continuam funcionando normalmente

### Fase 1 — White-Label

**Marca dinâmica:**
- `tenant.name` substitui "SpeedKids" em todos os títulos de página (8 arquivos)
- `tenant.logo_url` substitui `/logo.svg` hardcoded (navbar, login, favicon)
- `tenant.primary_color` usado no meta `theme-color`
- Prop `tenant` propagado por toda a árvore de componentes (Layout → AdminLayout → ReportLayout → 30+ views)

**Timezone dinâmico:**
- `src/lib/timezone.ts` reescrito com cache de formatters
- `setTimezone()` chamado no middleware por request
- Cada tenant pode ter timezone diferente (campo `timezone` na tabela `tenants`)

### Fase 2 — Self-Service

**Landing page** (`/landing`):
- Hero, features, planos com preços, formulário de cadastro
- Validação de slug em tempo real (verifica disponibilidade via API)
- Integração com Stripe Checkout para pagamento

**API de signup:**
- `GET /api/signup/check-slug/:slug` — Verifica disponibilidade (reservados, formato, duplicatas)
- `POST /api/signup/checkout` — Cria sessão Stripe Checkout com metadata do tenant
- `POST /api/signup/provision` — Provisioning direto (apenas em dev local)

**Stripe Webhook** (`/api/stripe/webhook`):
- `checkout.session.completed` → Provisiona tenant automaticamente
- `customer.subscription.updated` → Atualiza status da assinatura
- `customer.subscription.deleted` → Cancela assinatura e suspende tenant

**Provisioning automático** (`src/services/provisioning.ts`):
- Cria tenant na tabela `tenants`
- Cria user owner com senha (hash PBKDF2)
- Cria `business_config`
- Seed de pacotes padrão (15min, 30min, 1h)
- Seed de tipos de ativo (kart, bicicleta, patinete)
- Cria registro de subscription se Stripe IDs fornecidos

**Lib Stripe** (`src/lib/stripe.ts`):
- Client fetch-based (sem dependência de SDK Node.js — compatível com Workers)
- Verificação de assinatura de webhook via HMAC-SHA256 (Web Crypto API)
- Tolerância de 5 minutos no timestamp

---

## Configuração na Cloudflare

### 1. DNS — Wildcard para subdomínios

No painel DNS do Cloudflare para o domínio `dadosinteligentes.app.br`:

```
Tipo    Nome    Conteúdo                              Proxy
CNAME   *       app-speedkids.<account>.workers.dev   ✅ Proxied
```

**Um único registro wildcard atende todos os tenants.** Não é necessário criar registros DNS por tenant.

O Cloudflare gera certificados SSL wildcard automaticamente.

### 2. Secrets do Worker

Estes valores **nunca** devem ficar no código ou no `wrangler.json`. Configurar via CLI:

```bash
# Chave secreta do Stripe (encontrar em https://dashboard.stripe.com/apikeys)
wrangler secret put STRIPE_SECRET_KEY
# Colar: sk_live_...

# Secret do webhook (gerado ao criar o webhook endpoint no Stripe)
wrangler secret put STRIPE_WEBHOOK_SECRET
# Colar: whsec_...
```

### 3. Variáveis de ambiente (wrangler.json)

Já configuradas no `wrangler.json`:

```json
{
  "vars": {
    "APP_DOMAIN": "dadosinteligentes.app.br",
    "STRIPE_PUBLISHABLE_KEY": ""  // ← Preencher com pk_live_...
  }
}
```

A `STRIPE_PUBLISHABLE_KEY` é pública (aparece no frontend), por isso fica em `vars` e não em secrets.

### 4. Variáveis no dashboard (alternativa)

Se preferir configurar pelo painel da Cloudflare em vez do CLI:

1. Workers & Pages → app-speedkids → Settings → Variables & Secrets
2. Adicionar:
   - `STRIPE_SECRET_KEY` (tipo: Secret/Encrypt)
   - `STRIPE_WEBHOOK_SECRET` (tipo: Secret/Encrypt)
   - `STRIPE_PUBLISHABLE_KEY` (tipo: Text)
   - `APP_DOMAIN` (tipo: Text) — `dadosinteligentes.app.br`

---

## Configuração no Stripe

### 1. Criar produtos e preços

No [Stripe Dashboard](https://dashboard.stripe.com/products):

1. Criar produto **"Starter"**
   - Preço: R$ 97,00/mês (recorrente)
   - Anotar o **Price ID** (ex: `price_1ABC...`)

2. Criar produto **"Pro"**
   - Preço: R$ 197,00/mês
   - Anotar o Price ID

3. Criar produto **"Enterprise"**
   - Preço: R$ 397,00/mês
   - Anotar o Price ID

### 2. Atualizar Price IDs no código

Editar `src/routes/api/signup.ts`, linhas 14-18:

```typescript
const PLAN_PRICES: Record<string, string> = {
    starter: "price_XXXXXXX",     // ← Price ID real do Starter
    pro: "price_YYYYYYY",         // ← Price ID real do Pro
    enterprise: "price_ZZZZZZZ",  // ← Price ID real do Enterprise
};
```

### 3. Criar webhook endpoint

No [Stripe Dashboard](https://dashboard.stripe.com/webhooks):

1. **URL:** `https://www.dadosinteligentes.app.br/api/stripe/webhook`
2. **Eventos a escutar:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Anotar o **Webhook Signing Secret** (começa com `whsec_`)
4. Configurar via `wrangler secret put STRIPE_WEBHOOK_SECRET`

### 4. Modo de teste

Para testes, usar chaves de teste do Stripe (`sk_test_...`, `pk_test_...`). O fluxo é idêntico, mas nenhuma cobrança real é feita.

---

## Deploy — Passo a passo

### Pré-requisitos
- [ ] DNS wildcard configurado
- [ ] Secrets do Stripe configurados no Worker
- [ ] Price IDs atualizados no código
- [ ] Webhook endpoint criado no Stripe

### Executar

```bash
# 1. Aplicar migrations no banco remoto (produção)
wrangler d1 migrations apply DB --remote

# 2. Deploy do Worker
npm run deploy
```

**⚠️ IMPORTANTE:** O comando `npm run predeploy` já executa `wrangler d1 migrations apply DB --remote` automaticamente antes do deploy. Mas na **primeira vez** após esta migração, recomendo rodar manualmente para verificar a saída.

### Verificar após deploy

```bash
# Verificar que tenants table existe
wrangler d1 execute d1-sppedkids-database --remote --command "SELECT id, slug, name FROM tenants;"

# Verificar que SpeedKids tem tenant_id = 1
wrangler d1 execute d1-sppedkids-database --remote --command "SELECT COUNT(*) as total, tenant_id FROM users GROUP BY tenant_id;"
```

---

## Cuidados e Riscos

### 🔴 Críticos

1. **Migrations em produção**
   - As migrations `0029` e `0030` alteram TODAS as tabelas do banco de produção
   - `0030` recria a tabela `business_config` (DROP + CREATE) — se houver transações em andamento no momento, pode dar conflito
   - **Recomendação:** Aplicar fora do horário de pico (cedo da manhã ou tarde da noite)
   - **Backup:** Exportar o banco antes com `wrangler d1 export d1-sppedkids-database --remote --output backup.sql`

2. **Stripe Webhook Secret**
   - Se o secret estiver errado, NENHUM tenant será provisionado após pagamento
   - O cliente pagará mas não receberá acesso
   - **Recomendação:** Testar com Stripe CLI antes do go-live: `stripe listen --forward-to localhost:8787/api/stripe/webhook`

3. **DNS Wildcard**
   - Sem o wildcard `*.dadosinteligentes.app.br`, novos tenants não terão URL acessível
   - Verificar que o registro está **Proxied** (nuvem laranja) no Cloudflare

### 🟡 Atenção

4. **Tenant fallback em dev**
   - Em localhost, TODAS as requests resolvem para tenant #1 (SpeedKids)
   - Para testar outros tenants localmente, adicionar entradas no `/etc/hosts`:
     ```
     127.0.0.1 speedykids.local
     127.0.0.1 aventurapark.local
     ```
   - E ajustar o middleware para reconhecer `.local` como não-dev

5. **Password temporário no provisioning via webhook**
   - Quando o tenant é criado via Stripe webhook, uma senha aleatória é gerada
   - Atualmente NÃO há envio de email com essa senha
   - **Workaround temporário:** Criar um fluxo de "esqueci minha senha" ou enviar manualmente
   - **Solução futura (Fase 4):** Integrar email via Cloudflare Email Workers ou Resend

6. **Price IDs hardcoded**
   - Os IDs dos preços do Stripe estão em `src/routes/api/signup.ts`
   - Se mudar os preços no Stripe, precisa atualizar o código e fazer deploy
   - **Melhoria futura:** Mover para variáveis de ambiente

7. **Isolamento de dados**
   - A segurança depende de TODA query incluir `tenant_id`
   - Se uma nova query for adicionada sem filtro de tenant, dados podem vazar entre clientes
   - **Recomendação:** Em todo novo código, sempre incluir `tenantId` nas queries

### 🟢 Informativo

8. **SpeedKids não é afetado**
   - O URL `speedykids.dadosinteligentes.app.br` continua funcionando
   - Os dados existentes receberam `tenant_id = 1` automaticamente
   - Nenhuma funcionalidade foi removida

9. **Custos Cloudflare**
   - Workers: Free tier inclui 100k requests/dia (suficiente para dezenas de tenants)
   - D1: 5 milhões de leituras/dia grátis
   - R2: 10 GB grátis
   - **Custo real só aparece com escala significativa**

---

## Testando localmente

```bash
# Instalar dependências
npm install

# Aplicar migrations locais
npm run seedLocalD1

# Iniciar dev server
npx wrangler dev

# O app do tenant 1 (SpeedKids) estará em:
# http://localhost:8787

# A landing page está em:
# http://localhost:8787/landing

# Testar provisioning local:
curl -X POST http://localhost:8787/api/signup/provision \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "meu-parque",
    "businessName": "Meu Parque",
    "ownerName": "João",
    "ownerEmail": "joao@email.com",
    "ownerPassword": "minhasenha123",
    "plan": "starter"
  }'

# Verificar slug disponível:
curl http://localhost:8787/api/signup/check-slug/meu-parque

# Rodar testes:
npm test
```

---

## Próximos passos

Após o deploy bem-sucedido e configuração do Stripe, as próximas fases são:

1. **Fase 3 — Planos e Limites:** Implementar enforcement de limites por plano (max_users, max_assets) e tela de gestão do plano
2. **Fase 4 — Refinamento:** Painel admin global, envio de emails, wizard de onboarding, cores CSS totalmente dinâmicas

---

*Documento gerado em 2026-03-22. Atualizar conforme as fases forem concluídas.*
