/**
 * Tenant provisioning service.
 * Creates a new tenant with all required data: user, config, default permissions.
 */
import type { Tenant } from "../db/schema";
import { generateSalt, hashPassword } from "../lib/crypto";

export interface ProvisionParams {
	slug: string;
	name: string;
	ownerName: string;
	ownerEmail: string;
	ownerPassword: string;
	plan: string;
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
}

export async function provisionTenant(
	db: D1Database,
	params: ProvisionParams,
): Promise<Tenant> {
	// 1. Create tenant
	const tenant = await db
		.prepare(`
			INSERT INTO tenants (slug, name, owner_email, plan)
			VALUES (?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.slug, params.name, params.ownerEmail, params.plan)
		.first<Tenant>();

	if (!tenant) throw new Error("Failed to create tenant");

	const tenantId = tenant.id;

	// 2. Create owner user
	const salt = generateSalt();
	const hash = await hashPassword(params.ownerPassword, salt);

	await db
		.prepare(`
			INSERT INTO users (tenant_id, name, email, password_hash, salt, role)
			VALUES (?, ?, ?, ?, ?, 'owner')
		`)
		.bind(tenantId, params.ownerName, params.ownerEmail, hash, salt)
		.run();

	// 3. Create business_config
	await db
		.prepare(`
			INSERT INTO business_config (tenant_id, name)
			VALUES (?, ?)
		`)
		.bind(tenantId, params.name)
		.run();

	// 4. Seed default packages
	await db.batch([
		db.prepare("INSERT INTO packages (tenant_id, name, duration_minutes, price_cents, sort_order) VALUES (?, ?, ?, ?, ?)")
			.bind(tenantId, "15 Minutos", 15, 1500, 1),
		db.prepare("INSERT INTO packages (tenant_id, name, duration_minutes, price_cents, sort_order) VALUES (?, ?, ?, ?, ?)")
			.bind(tenantId, "30 Minutos", 30, 2500, 2),
		db.prepare("INSERT INTO packages (tenant_id, name, duration_minutes, price_cents, sort_order) VALUES (?, ?, ?, ?, ?)")
			.bind(tenantId, "1 Hora", 60, 4000, 3),
	]);

	// 5. Seed default asset types
	await db.batch([
		db.prepare("INSERT INTO asset_types (tenant_id, name, label) VALUES (?, ?, ?)")
			.bind(tenantId, "kart", "Kart"),
		db.prepare("INSERT INTO asset_types (tenant_id, name, label) VALUES (?, ?, ?)")
			.bind(tenantId, "bicicleta", "Bicicleta"),
		db.prepare("INSERT INTO asset_types (tenant_id, name, label) VALUES (?, ?, ?)")
			.bind(tenantId, "patinete", "Patinete"),
	]);

	// 6. Create subscription record (always — with or without Stripe IDs)
	const subStatus = params.stripeCustomerId ? "active" : "pending";
	await db
		.prepare(`
			INSERT INTO subscriptions (tenant_id, stripe_customer_id, stripe_subscription_id, plan, status)
			VALUES (?, ?, ?, ?, ?)
		`)
		.bind(tenantId, params.stripeCustomerId ?? null, params.stripeSubscriptionId ?? null, params.plan, subStatus)
		.run();

	return tenant;
}

export async function isSlugAvailable(db: D1Database, slug: string): Promise<boolean> {
	const reserved = ["www", "api", "admin", "app", "static", "assets", "cdn", "mail", "smtp", "ftp"];
	if (reserved.includes(slug)) return false;
	if (!/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/.test(slug)) return false;

	const existing = await db.prepare("SELECT id FROM tenants WHERE slug = ?").bind(slug).first();
	return !existing;
}
