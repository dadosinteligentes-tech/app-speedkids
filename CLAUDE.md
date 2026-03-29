# Giro Kids — App Principal

## Sobre
SaaS para gestão de parques infantis, locadoras de brinquedos e espaços de diversão.
Multi-tenant com isolamento por subdomínio (`slug.giro-kids.com`).

## Stack
- **Runtime:** Cloudflare Workers (Hono 4.x + JSX SSR)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (logos, fotos)
- **Payments:** Stripe (checkout, subscriptions, webhooks)
- **Email:** Resend API (`contato@giro-kids.com`)
- **Frontend:** Tailwind CSS via CDN, vanilla JS inline

## Comandos
```bash
npx wrangler dev              # Dev server (localhost:8787)
npx tsc --noEmit              # Type check
npx vitest run                # Testes (186 testes, 13 arquivos)
npx wrangler deploy --dry-run # Verificar build
npx wrangler deploy           # Deploy produção
npx wrangler d1 migrations apply d1-sppedkids-database --local   # Migrations local
npx wrangler d1 migrations apply d1-sppedkids-database --remote  # Migrations produção
```

## Estrutura
```
src/
├── index.ts                 # Router principal (Hono)
├── types.ts                 # Bindings e AppEnv
├── db/
│   ├── schema.ts            # Interfaces TypeScript de todas as tabelas
│   └── queries/             # Queries por domínio (rentals, assets, platform, etc.)
├── routes/
│   ├── api/                 # Endpoints REST (auth, rentals, assets, stripe-webhook, etc.)
│   └── pages/               # Rotas SSR (dashboard, admin, reports, platform, landing)
├── views/                   # Componentes JSX (dashboard, admin, reports, platform, receipts)
├── middleware/               # Auth, permissions, role checks
├── lib/                     # Utilitários (email, crypto, timezone, stripe, validation)
└── services/                # Provisioning de tenants
migrations/                  # SQL migrations (D1)
public/                      # Assets estáticos (logos, apresentação)
test/                        # Testes unitários e de integração
```

## Convenções
- Views usam JSX com Hono (`html`, `raw` para JS inline)
- JS inline nos views usa `function` declarations (não arrow functions) para hoisting
- Classes CSS seguem o design system: `sk-orange`, `sk-blue`, `sk-green`, `font-display` (Fredoka), `font-body` (Quicksand)
- Modais usam bottom-sheet no mobile (`items-end sm:items-center`)
- Touch targets mínimos de 44px (`btn-touch`, `py-2.5`+)
- Tabelas admin usam `overflow-x-auto` e `hidden md:table-cell` para colunas secundárias
- Timestamps do D1 são UTC — usar `toBrazilDateTime()` de `lib/timezone.ts` para exibição
- Emails saem como `Giro Kids <contato@giro-kids.com>` via Resend
- Superadmins são notificados em: nova compra, mudança de plano, novo ticket

## Autenticação
- Session-based (cookie `session`)
- 3 roles: `operator`, `manager`, `owner`
- 20+ permissões configuráveis via `role_permissions`
- Platform admins: tenant `_platform` com emails em `PLATFORM_ADMIN_EMAILS`

## Projeto irmão
- **girokids-workflows/** — Worker de fluxos automatizados (onboarding drip, relatório mensal)
- Compartilha o mesmo banco D1 e a mesma API do Resend
- Trigger via HTTP POST do webhook do Stripe após provisioning
