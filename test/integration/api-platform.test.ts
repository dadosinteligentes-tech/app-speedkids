/**
 * Integration tests for the Platform Admin API endpoints.
 *
 * These tests verify that platform admin routes are accessible only to
 * users belonging to the _platform tenant, and that core platform
 * management operations work correctly.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

let adminCookie: string;
let clientCookie: string;
let platformTenantId: number;
let clientTenantId: number;
let adminUserId: number;

async function applyMigrations(db: D1Database) {
	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS tenants (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				slug TEXT UNIQUE NOT NULL,
				name TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'active',
				plan TEXT NOT NULL DEFAULT 'pro',
				logo_url TEXT,
				primary_color TEXT DEFAULT '#FF7043',
				timezone TEXT DEFAULT 'America/Sao_Paulo',
				owner_email TEXT NOT NULL,
				max_users INTEGER DEFAULT 10,
				max_assets INTEGER DEFAULT 50,
				setup_completed INTEGER DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				name TEXT NOT NULL,
				email TEXT NOT NULL,
				password_hash TEXT NOT NULL,
				salt TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'operator',
				active INTEGER NOT NULL DEFAULT 1,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id TEXT PRIMARY KEY,
				user_id INTEGER NOT NULL,
				expires_at TEXT NOT NULL,
				created_at TEXT DEFAULT (datetime('now')),
				FOREIGN KEY (user_id) REFERENCES users(id)
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS operation_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				user_id INTEGER,
				action TEXT NOT NULL,
				entity_type TEXT NOT NULL,
				entity_id TEXT,
				details TEXT,
				ip_address TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS business_config (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id),
				name TEXT NOT NULL,
				cnpj TEXT,
				address TEXT,
				phone TEXT,
				receipt_footer TEXT,
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS platform_config (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS packages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				name TEXT NOT NULL,
				duration_minutes INTEGER NOT NULL,
				price_cents INTEGER NOT NULL,
				overtime_block_minutes INTEGER DEFAULT 0,
				overtime_block_price_cents INTEGER DEFAULT 0,
				grace_period_minutes INTEGER DEFAULT 0,
				active INTEGER DEFAULT 1,
				sort_order INTEGER DEFAULT 0,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS asset_types (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				name TEXT NOT NULL,
				label TEXT NOT NULL,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS assets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				name TEXT NOT NULL,
				asset_type TEXT NOT NULL,
				status TEXT DEFAULT 'available',
				pos_id INTEGER,
				model TEXT,
				photo_url TEXT,
				battery_level INTEGER,
				uses_battery INTEGER DEFAULT 0,
				max_weight_kg REAL,
				min_age INTEGER,
				max_age INTEGER,
				sort_order INTEGER DEFAULT 0,
				last_maintenance_at TEXT,
				notes TEXT,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS subscriptions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				stripe_customer_id TEXT,
				stripe_subscription_id TEXT,
				plan TEXT NOT NULL DEFAULT 'pro',
				status TEXT NOT NULL DEFAULT 'active',
				current_period_start TEXT,
				current_period_end TEXT,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS rental_sessions (
				id TEXT PRIMARY KEY,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				asset_id INTEGER NOT NULL,
				package_id INTEGER NOT NULL,
				pos_id INTEGER,
				attendant_id INTEGER,
				customer_id INTEGER,
				child_id INTEGER,
				cash_register_id INTEGER,
				status TEXT DEFAULT 'running',
				start_time TEXT NOT NULL,
				pause_time TEXT,
				total_paused_ms INTEGER DEFAULT 0,
				end_time TEXT,
				duration_minutes INTEGER NOT NULL,
				amount_cents INTEGER NOT NULL,
				overtime_minutes INTEGER DEFAULT 0,
				overtime_cents INTEGER DEFAULT 0,
				payment_method TEXT,
				paid INTEGER DEFAULT 0,
				notes TEXT,
				created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS product_sales (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				cash_register_id INTEGER,
				customer_id INTEGER,
				attendant_id INTEGER,
				total_cents INTEGER NOT NULL,
				discount_cents INTEGER DEFAULT 0,
				payment_method TEXT,
				paid INTEGER DEFAULT 0,
				notes TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
	]);
}

async function seedData(db: D1Database) {
	const { generateSalt, hashPassword } = await import("../../src/lib/crypto");

	// Tenant 1: regular client (id=1, used as localhost fallback by tenant middleware)
	const clientTenant = await db
		.prepare(
			`INSERT INTO tenants (slug, name, owner_email, status, plan)
			VALUES ('testclient', 'Test Client', 'client@test.com', 'active', 'pro')
			RETURNING id`,
		)
		.first<{ id: number }>();
	clientTenantId = clientTenant!.id;

	// Tenant 2: _platform admin tenant
	const pTenant = await db
		.prepare(
			`INSERT INTO tenants (slug, name, owner_email, status, plan)
			VALUES ('_platform', 'Platform Admin', 'admin@test.com', 'active', 'enterprise')
			RETURNING id`,
		)
		.first<{ id: number }>();
	platformTenantId = pTenant!.id;

	// Client user (tenant 1)
	const clientSalt = generateSalt();
	const clientHash = await hashPassword("client123", clientSalt);
	await db
		.prepare(
			"INSERT INTO users (tenant_id, name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?, ?)",
		)
		.bind(clientTenantId, "Client Owner", "client@test.com", clientHash, clientSalt, "owner")
		.run();

	// Platform admin user (tenant _platform)
	const adminSalt = generateSalt();
	const adminHash = await hashPassword("admin123", adminSalt);
	const adminRow = await db
		.prepare(
			`INSERT INTO users (tenant_id, name, email, password_hash, salt, role)
			VALUES (?, ?, ?, ?, ?, ?)
			RETURNING id`,
		)
		.bind(platformTenantId, "Platform Admin", "admin@test.com", adminHash, adminSalt, "owner")
		.first<{ id: number }>();
	adminUserId = adminRow!.id;

	// Business config for client tenant
	await db
		.prepare(
			"INSERT INTO business_config (tenant_id, name, cnpj, address, phone) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(clientTenantId, "Test Client Business", "12.345.678/0001-90", "Rua Teste 123", "(11) 99999-0000")
		.run();

	// Platform config with plan limits
	const planLimits = {
		starter: { label: "Starter", maxUsers: 3, maxAssets: 10, priceCents: 9700 },
		pro: { label: "Pro", maxUsers: 10, maxAssets: 50, priceCents: 19700 },
		enterprise: { label: "Enterprise", maxUsers: 50, maxAssets: 200, priceCents: 39700 },
	};
	await db
		.prepare("INSERT INTO platform_config (key, value) VALUES ('plan_limits', ?)")
		.bind(JSON.stringify(planLimits))
		.run();

	// Some assets for tenant 1 (for stats)
	await db
		.prepare("INSERT INTO assets (tenant_id, name, asset_type, status) VALUES (?, ?, ?, ?)")
		.bind(clientTenantId, "Kart 01", "kart", "available")
		.run();

	// A subscription for tenant 1
	await db
		.prepare(
			"INSERT INTO subscriptions (tenant_id, plan, status) VALUES (?, ?, ?)",
		)
		.bind(clientTenantId, "pro", "active")
		.run();
}

async function loginAs(email: string, password: string): Promise<string> {
	const res = await app.request(
		"/api/auth/login",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		},
		env,
	);
	if (res.status !== 200) {
		const body = await res.text();
		throw new Error(`Login failed for ${email}: ${res.status} ${body}`);
	}
	const cookie = res.headers.get("set-cookie")!;
	return `sk_session=${cookie.match(/sk_session=([^;]+)/)?.[1]}`;
}

function req(path: string, opts: RequestInit = {}, cookie = adminCookie) {
	return app.request(
		path,
		{
			...opts,
			headers: { ...(opts.headers as Record<string, string>), Cookie: cookie },
		},
		env,
	);
}

function jsonReq(path: string, body: unknown, method = "POST", cookie = adminCookie) {
	return req(
		path,
		{
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
		cookie,
	);
}

describe("Platform Admin API", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
		adminCookie = await loginAs("admin@test.com", "admin123");
		clientCookie = await loginAs("client@test.com", "client123");
	});

	describe("GET /api/platform/stats", () => {
		it("returns platform stats", async () => {
			const res = await req("/api/platform/stats");
			expect(res.status).toBe(200);
			const body = await res.json() as {
				total_tenants: number;
				active_tenants: number;
				total_users: number;
			};
			// _platform is excluded from tenant count
			expect(body.total_tenants).toBe(1);
			expect(body.active_tenants).toBe(1);
			// Both users across all tenants are counted
			expect(body.total_users).toBeGreaterThanOrEqual(2);
		});
	});

	describe("GET /api/platform/tenants", () => {
		it("returns tenant list excluding _platform", async () => {
			const res = await req("/api/platform/tenants");
			expect(res.status).toBe(200);
			const body = await res.json() as Array<{ slug: string; name: string }>;
			expect(body.length).toBe(1);
			expect(body[0].slug).toBe("testclient");
			// _platform tenant should not appear
			expect(body.find((t) => t.slug === "_platform")).toBeUndefined();
		});

		it("returns 401 without auth", async () => {
			const res = await app.request("/api/platform/tenants", {}, env);
			expect(res.status).toBe(401);
		});
	});

	describe("GET /api/platform/tenants/:id", () => {
		it("returns tenant detail with activity", async () => {
			const res = await req(`/api/platform/tenants/${clientTenantId}`);
			expect(res.status).toBe(200);
			const body = await res.json() as {
				id: number;
				slug: string;
				name: string;
				rentals_today: number;
				rentals_week: number;
			};
			expect(body.id).toBe(clientTenantId);
			expect(body.slug).toBe("testclient");
			expect(body).toHaveProperty("rentals_today");
			expect(body).toHaveProperty("rentals_week");
		});

		it("returns 404 for invalid id", async () => {
			const res = await req("/api/platform/tenants/9999");
			expect(res.status).toBe(404);
		});
	});

	describe("Superadmin management", () => {
		let createdAdminId: number;

		it("GET /api/platform/superadmins returns admin list", async () => {
			const res = await req("/api/platform/superadmins");
			expect(res.status).toBe(200);
			const body = await res.json() as Array<{ id: number; email: string; role: string }>;
			expect(body.length).toBeGreaterThanOrEqual(1);
		});

		it("POST /api/platform/superadmins creates new admin", async () => {
			const res = await jsonReq("/api/platform/superadmins", {
				name: "New Admin",
				email: "newadmin@test.com",
				password: "newpass123",
			});
			expect(res.status).toBe(201);
			const body = await res.json() as Record<string, unknown>;
			expect(body.name).toBe("New Admin");
			createdAdminId = body.id as number;
			expect(createdAdminId).toBeGreaterThan(0);
		});

		it("POST /api/platform/superadmins/:id/reset-password changes password", async () => {
			const res = await jsonReq(`/api/platform/superadmins/${createdAdminId}/reset-password`, {
				new_password: "updatedpass456",
			});
			expect(res.status).toBe(200);
		});

		it("POST /api/platform/superadmins/:id/toggle-active deactivates admin", async () => {
			const res = await jsonReq(`/api/platform/superadmins/${createdAdminId}/toggle-active`, {
				active: false,
			});
			expect(res.status).toBe(200);
		});
	});

	describe("Plans management", () => {
		it("GET /api/platform/plans returns plan definitions", async () => {
			const res = await req("/api/platform/plans");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<
				string,
				{ label: string; maxUsers: number; maxAssets: number; priceCents: number }
			>;
			expect(body).toHaveProperty("starter");
			expect(body).toHaveProperty("pro");
			expect(body).toHaveProperty("enterprise");
			expect(body.pro.maxUsers).toBe(10);
			expect(body.pro.priceCents).toBe(19700);
		});

		it("PUT /api/platform/plans updates plan definitions", async () => {
			const updatedPlans = {
				starter: { label: "Starter", maxUsers: 5, maxAssets: 15, priceCents: 9900 },
				pro: { label: "Pro", maxUsers: 15, maxAssets: 75, priceCents: 24900 },
				enterprise: { label: "Enterprise", maxUsers: 100, maxAssets: 500, priceCents: 49900 },
			};

			const res = await jsonReq("/api/platform/plans", updatedPlans, "PUT");
			expect(res.status).toBe(200);
			const body = await res.json() as { ok: boolean };
			expect(body.ok).toBe(true);

			// Verify the update persisted
			const getRes = await req("/api/platform/plans");
			const plans = await getRes.json() as Record<
				string,
				{ maxUsers: number; priceCents: number }
			>;
			expect(plans.starter.maxUsers).toBe(5);
			expect(plans.pro.priceCents).toBe(24900);
			expect(plans.enterprise.maxUsers).toBe(100);
		});
	});

	describe("Access control", () => {
		it("returns 403 for non-platform user", async () => {
			const res = await req("/api/platform/stats", {}, clientCookie);
			expect(res.status).toBe(403);
		});
	});
});
