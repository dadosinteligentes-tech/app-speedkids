import type { Hono } from "hono";
import type { Tenant } from "./db/schema";

export type Bindings = {
	DB: D1Database;
	B_BUCKET_SPEEDKIDS: R2Bucket;
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	STRIPE_PUBLISHABLE_KEY: string;
	APP_DOMAIN: string; // e.g. "dadosinteligentes.app.br"
	PLATFORM_ADMIN_EMAILS: string; // comma-separated emails with SaaS admin access
	RESEND_API_KEY: string; // Resend.com API key for transactional emails
};

export type AppVariables = {
	user: { id: number; name: string; email: string; role: string; tenant_id: number } | null;
	tenant: Tenant | null;
	tenant_id: number;
	posId: number | null;
	isPlatformAdmin: boolean;
	_rolePermissions?: string[];
};

export type AppEnv = {
	Bindings: Bindings;
	Variables: AppVariables;
};
