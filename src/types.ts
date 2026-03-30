import type { Hono } from "hono";
import type { Tenant } from "./db/schema";

export type Bindings = {
	DB: D1Database;
	B_BUCKET_SPEEDKIDS: R2Bucket;
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	STRIPE_PUBLISHABLE_KEY: string;
	APP_DOMAIN: string; // e.g. "giro-kids.com" — primary platform domain
	APP_DOMAIN_LEGACY: string; // e.g. "dadosinteligentes.app.br" — old domain, redirects to APP_DOMAIN
	STRIPE_PRICE_STARTER: string;
	STRIPE_PRICE_PRO: string;
	STRIPE_PRICE_ENTERPRISE: string;
	STRIPE_PRICE_STARTER_ANNUAL: string;
	STRIPE_PRICE_PRO_ANNUAL: string;
	STRIPE_PRICE_ENTERPRISE_ANNUAL: string;
	PLATFORM_ADMIN_EMAILS: string; // comma-separated emails with SaaS admin access
	RESEND_API_KEY: string; // Resend.com API key for transactional emails
	BLOG_API_KEY: string; // API key for external blog management (workflows)
	LOYALTY_HMAC_SECRET: string; // HMAC secret for email verification tokens
};

export type AppVariables = {
	user: { id: number; name: string; email: string; role: string; tenant_id: number } | null;
	tenant: Tenant | null;
	tenant_id: number;
	posId: number | null;
	isPlatformAdmin: boolean;
	_rolePermissions?: string[];
	_planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: AppVariables;
};
