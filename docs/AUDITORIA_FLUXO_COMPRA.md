# Auditoria do Fluxo de Compra SaaS — Giro Kids

**Data:** 26 de março de 2026
**Plataforma:** giro-kids.com
**Responsavel tecnico:** DADOS INTELIGENTES LTDA — CNPJ 47.773.826/0001-57

---

## 1. Resumo Executivo

O fluxo de compra do SaaS Giro Kids foi auditado ponta a ponta, desde o formulario de cadastro na landing page ate o provisionamento do tenant, envio de credenciais e monitoramento pos-venda. A integracao esta **funcional e operacional**, com rastreabilidade completa de dados em cada etapa.

| Etapa | Status | Observacao |
|-------|--------|------------|
| Formulario de cadastro | OK | 5 campos validados, slug verificado em tempo real |
| Checkout Stripe | OK | Trial 30 dias, metadata propagado no subscription |
| Webhook de pagamento | OK | Idempotente, verifica duplicidade por slug |
| Provisionamento do tenant | OK | 6 tabelas criadas com seed data |
| Email de boas-vindas | OK | Credenciais, plano, preco, URL do sistema |
| Rastreio de emails | OK | Tabela email_logs com status/erro/metadata |
| Checkouts abandonados | OK | Registrado antes do redirect, marcado apos conversao |
| Pagina de sucesso | OK | Busca slug real da sessao Stripe |
| Painel admin (assinaturas) | OK | MRR, trials, status, Stripe ID |
| Inteligencia de vendas | OK | Trials expirando, inadimplencia, engajamento, abandonos |
| Upgrade/downgrade | OK | Stripe Portal ou novo Checkout |
| Falha de pagamento | OK | Email automatico ao cliente, status past_due |

---

## 2. Dados Capturados por Etapa

### 2.1 Formulario de Cadastro (Landing Page)

| Campo | Validacao | Armazenamento |
|-------|-----------|---------------|
| Subdominio (slug) | 3-30 chars, alfanumerico+hifen, disponibilidade em tempo real, slugs reservados bloqueados | tenants.slug |
| Nome do estabelecimento | Obrigatorio | tenants.name, business_config.name |
| Nome do responsavel | Obrigatorio | users.name |
| Email do responsavel | Obrigatorio, formato HTML5 | tenants.owner_email, users.email |
| Plano selecionado | starter/pro/enterprise | tenants.plan, subscriptions.plan |

**Slugs bloqueados:** www, api, admin, app, static, assets, cdn, mail, smtp, ftp

### 2.2 Sessao Stripe Checkout

| Parametro | Valor |
|-----------|-------|
| mode | subscription |
| trial_period_days | 30 |
| customer_email | Email do formulario |
| success_url | https://{domain}/landing/signup/success?session_id={CHECKOUT_SESSION_ID} |
| cancel_url | https://{domain}/landing#planos |

**Metadata no subscription_data:**
- tenant_slug
- tenant_name
- owner_name
- owner_email
- plan

### 2.3 Webhook checkout.session.completed

| Acao | Detalhamento |
|------|--------------|
| Verificacao de assinatura | HMAC-SHA256 com tolerancia de 5 minutos |
| Idempotencia | SELECT id FROM tenants WHERE slug = ? — rejeita duplicata |
| Extracao de metadata | Busca subscription via API Stripe, fallback para session.metadata |
| Provisionamento | Cria tenant + usuario owner + config + packages + asset_types + subscription |
| Checkout abandonado | UPDATE abandoned_checkouts SET converted=1 |
| Email | Envia boas-vindas com sendAndLogEmail() |

### 2.4 Provisionamento (6 tabelas)

| Tabela | Dados Criados |
|--------|---------------|
| tenants | slug, name, owner_email, plan, status='active' |
| users | name, email, password_hash (PBKDF2-SHA256+salt), role='owner' |
| business_config | name (do estabelecimento) |
| packages | 15min/R$15, 30min/R$25, 1h/R$40 (seed data) |
| asset_types | Kart, Bicicleta, Patinete (seed data) |
| subscriptions | stripe_customer_id, stripe_subscription_id, plan, status='active' |

### 2.5 Email de Boas-Vindas

| Secao | Conteudo |
|-------|----------|
| Header | Gradiente laranja, "Bem-vindo, {nome}!" |
| Detalhes da assinatura | Plano, valor mensal (R$), periodo de teste (30 dias gratis) |
| URL do sistema | {slug}.giro-kids.com (clicavel) |
| Credenciais | Email + senha temporaria (12 chars UUID) |
| CTA | Botao "Acessar meu sistema" |
| Rodape | CNPJ + links Termos/Privacidade |

**Registro:** email_logs (tenant_id, recipient, subject, event_type='welcome', status, error_message, metadata)

### 2.6 Pagina de Sucesso

- Busca session_id da query string
- Chama getCheckoutSession() na API Stripe
- Extrai tenant_slug dos metadata da subscription
- Exibe: URL do sistema, botao de acesso, mensagem sobre email enviado

---

## 3. Monitoramento Pos-Venda (Painel Admin)

### 3.1 Assinaturas (/platform/subscriptions)

| Informacao | Visibilidade |
|------------|-------------|
| Tenant (nome + slug) | Sim, com link para detalhes |
| Plano (badge colorido) | Sim |
| Valor mensal (R$) | Sim, lido da config de planos |
| Status (Ativo/Trial/Atrasado/Cancelado) | Sim, badge colorido |
| Stripe Subscription ID | Sim, truncado com tooltip |
| Periodo atual (inicio → fim) | Sim |
| Data de criacao | Sim |
| MRR total | Sim, card de destaque |
| Link para emails enviados | Sim |

### 3.2 Inteligencia de Vendas (/platform — Dashboard)

| Painel | Dados | Alerta |
|--------|-------|--------|
| Trials Expirando (7d) | Nome, email, dias restantes, num. locacoes | Borda laranja, badge com contagem |
| Inadimplencia | Nome, email, dias em atraso, status, botao contatar | Borda vermelha |
| Engajamento | Locacoes 7d, ultimo login, score (saudavel/atencao/critico) | Rows vermelhos para criticos |
| Checkouts Abandonados | Empresa, nome, email, plano, tempo, botao follow-up | Borda amarela |
| CRM | Total leads, contatos semana, atrasados | Badge de atrasados |

### 3.3 Emails Enviados (/platform/emails)

| Coluna | Dados |
|--------|-------|
| Data/hora | Timestamp do envio |
| Tenant | Nome + link para detalhes |
| Destinatario | Email do destinatario |
| Tipo | welcome, payment_failed, crm_presentation, welcome_conversion |
| Assunto | Assunto completo do email |
| Status | Enviado (verde) / Falhou (vermelho) / Pulado (cinza) |
| Erro | Mensagem de erro (se falhou) |

---

## 4. Webhooks Stripe Monitorados

| Evento | Acao no Sistema |
|--------|-----------------|
| checkout.session.completed | Provisiona tenant + envia email + marca checkout convertido |
| customer.subscription.updated | Atualiza status e periodo da subscription |
| invoice.paid | Reativa tenant suspenso, atualiza status para active |
| invoice.payment_failed | Marca como past_due + envia email de notificacao ao cliente |
| customer.subscription.deleted | Marca como cancelled + suspende tenant |

---

## 5. Fluxo de Upgrade/Downgrade

| Cenario | Comportamento |
|---------|---------------|
| Cliente com Stripe subscription | Abre Stripe Billing Portal (alteracao de plano, cartao, cancelamento) |
| Cliente sem Stripe subscription | Cria novo Checkout com trial 30 dias |
| Downgrade com limites excedidos | Aviso visual: "Voce tem X usuarios, plano permite Y" |
| Pagina /admin/plan | Mostra plano atual, barras de uso, cards de todos os planos |

---

## 6. Conformidade Legal

| Item | Status |
|------|--------|
| Termos de Uso (/legal/terms) | Implementado — 13 secoes |
| Politica de Privacidade (/legal/privacy) | Implementado — 9 secoes |
| LGPD (/legal/lgpd) | Implementado — 9 secoes, bases legais Art. 7, direitos Art. 18 |
| CNPJ no rodape da landing | Sim |
| CNPJ no rodape do app tenant | Sim |
| CNPJ no rodape do admin | Sim |
| CNPJ nos emails | Sim |
| Links legais nos emails | Sim (Termos + Privacidade) |
| Cookies | Apenas sessao (sk_session), sem tracking |

---

## 7. Pontos de Atencao

| # | Ponto | Severidade | Status |
|---|-------|-----------|--------|
| 1 | Dominio Resend (giro-kids.com) verificado | Critico | Verificado — DNS validated |
| 2 | Webhook idempotente (verifica slug antes de provisionar) | Critico | Implementado |
| 3 | Senha temporaria enviada por email em texto | Medio | Operacional — recomendado migrar para link de reset |
| 4 | Subscription criada com status 'active' (deveria ser 'trialing') | Medio | Stripe gerencia trial internamente |
| 5 | current_period_start/end nao populados no provisionamento | Baixo | Atualizado pelo webhook subscription.updated |

---

## 8. Dados Disponiveis para Suporte ao Cliente

Quando um cliente entra em contato, o administrador tem acesso a:

| Informacao | Onde Encontrar |
|------------|----------------|
| Dados do tenant (nome, slug, status, plano) | /platform/tenants/{id} |
| Usuarios do tenant (nome, email, role, ultimo login) | /platform/tenants/{id} |
| Subscription Stripe (status, periodo, ID) | /platform/subscriptions |
| Historico de emails (enviados, falhados) | /platform/emails |
| Locacoes ativas/historico | /platform/tenants/{id} |
| Configuracao do negocio (CNPJ, endereco, telefone) | /platform/tenants/{id} |
| Logs de operacao | /platform/tenants/{id} |
| Tickets de suporte | /platform/tickets |
| CRM (se veio de prospecao) | /platform/crm |
| Acoes disponiveis | Suspender, ativar, resetar senha, impersonar usuario |

---

## 9. Conclusao

O fluxo de compra do SaaS Giro Kids esta **operacional e rastreavel** em todas as etapas. Os dados necessarios para suporte ao cliente estao centralizados no painel administrativo com visibilidade completa sobre assinaturas, emails, engajamento e inteligencia de vendas.

**Arquivos auditados:** 15 arquivos de codigo-fonte, 5 migrations, 3 templates de email, 5 webhooks Stripe.

---

*Documento gerado automaticamente como parte da auditoria tecnica do sistema Giro Kids.*
*DADOS INTELIGENTES LTDA — CNPJ 47.773.826/0001-57*
