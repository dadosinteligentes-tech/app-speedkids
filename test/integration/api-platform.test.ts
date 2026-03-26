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
		db.prepare(`
			CREATE TABLE IF NOT EXISTS email_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER,
				recipient TEXT NOT NULL,
				subject TEXT NOT NULL,
				event_type TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'sent',
				error_message TEXT,
				metadata TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				FOREIGN KEY (tenant_id) REFERENCES tenants(id)
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS support_tickets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL REFERENCES tenants(id),
				subject TEXT NOT NULL,
				status TEXT NOT NULL DEFAULT 'open',
				priority TEXT NOT NULL DEFAULT 'normal',
				created_by INTEGER NOT NULL REFERENCES users(id),
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS ticket_messages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				ticket_id INTEGER NOT NULL REFERENCES support_tickets(id),
				sender_type TEXT NOT NULL,
				sender_id INTEGER NOT NULL REFERENCES users(id),
				sender_name TEXT NOT NULL,
				message TEXT NOT NULL,
				attachment_key TEXT,
				attachment_name TEXT,
				attachment_type TEXT,
				read INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS abandoned_checkouts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				slug TEXT NOT NULL,
				business_name TEXT NOT NULL,
				owner_name TEXT NOT NULL,
				owner_email TEXT NOT NULL,
				plan TEXT NOT NULL DEFAULT 'starter',
				converted INTEGER NOT NULL DEFAULT 0,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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

	describe("Sales intelligence queries", () => {
		it("getExpiringTrials returns trials near expiry", async () => {
			const { getExpiringTrials } = await import("../../src/db/queries/platform");
			// Add a trialing subscription expiring in 3 days
			await env.DB.prepare(
				"UPDATE subscriptions SET status = 'trialing', current_period_end = datetime('now', '+3 days') WHERE tenant_id = ?"
			).bind(clientTenantId).run();

			const results = await getExpiringTrials(env.DB, 7);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].days_remaining).toBeLessThanOrEqual(7);
			expect(results[0].tenant_slug).toBe("testclient");

			// Restore
			await env.DB.prepare(
				"UPDATE subscriptions SET status = 'active', current_period_end = NULL WHERE tenant_id = ?"
			).bind(clientTenantId).run();
		});

		it("getTenantEngagement returns health scores", async () => {
			const { getTenantEngagement } = await import("../../src/db/queries/platform");
			const results = await getTenantEngagement(env.DB);
			expect(results.length).toBeGreaterThanOrEqual(1);
			const tenant = results.find((t) => t.tenant_slug === "testclient");
			expect(tenant).toBeDefined();
			expect(["healthy", "warning", "critical"]).toContain(tenant!.health);
		});

		it("getDelinquentSubscriptions returns past_due subs", async () => {
			const { getDelinquentSubscriptions } = await import("../../src/db/queries/platform");
			// Set subscription to past_due
			await env.DB.prepare(
				"UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now', '-5 days') WHERE tenant_id = ?"
			).bind(clientTenantId).run();

			const results = await getDelinquentSubscriptions(env.DB);
			expect(results.length).toBeGreaterThanOrEqual(1);
			expect(results[0].status).toBe("past_due");
			expect(results[0].days_overdue).toBeGreaterThanOrEqual(4);

			// Restore
			await env.DB.prepare(
				"UPDATE subscriptions SET status = 'active', updated_at = datetime('now') WHERE tenant_id = ?"
			).bind(clientTenantId).run();
		});

		it("abandoned checkouts: record, list, and mark converted", async () => {
			const { recordAbandonedCheckout, getAbandonedCheckouts, markCheckoutConverted } = await import("../../src/db/queries/platform");

			await recordAbandonedCheckout(env.DB, {
				slug: "test-abandoned",
				businessName: "Abandoned Corp",
				ownerName: "John",
				ownerEmail: "john@test.com",
				plan: "pro",
			});

			let results = await getAbandonedCheckouts(env.DB);
			expect(results.length).toBeGreaterThanOrEqual(1);
			const found = results.find((a) => a.slug === "test-abandoned");
			expect(found).toBeDefined();
			expect(found!.business_name).toBe("Abandoned Corp");

			await markCheckoutConverted(env.DB, "test-abandoned");
			results = await getAbandonedCheckouts(env.DB);
			const converted = results.find((a) => a.slug === "test-abandoned");
			expect(converted).toBeUndefined(); // converted=1 is filtered out
		});
	});

	describe("Support tickets", () => {
		it("creates a ticket and adds messages", async () => {
			const { createTicket, getTicketsByTenant, addMessage, getTicketMessages, markMessagesRead, getUnreadTicketCount, getTenantUnreadCount }
				= await import("../../src/db/queries/support-tickets");

			// Create ticket as tenant user
			const ticket = await createTicket(env.DB, clientTenantId, 1, "Ajuda com relatórios", "Não consigo exportar relatórios", "Client Owner");
			expect(ticket.id).toBeGreaterThan(0);
			expect(ticket.status).toBe("open");

			// List tickets
			const tickets = await getTicketsByTenant(env.DB, clientTenantId);
			expect(tickets.length).toBeGreaterThanOrEqual(1);
			expect(tickets[0].subject).toBe("Ajuda com relatórios");

			// Platform admin replies
			const reply = await addMessage(env.DB, ticket.id, "platform", adminUserId, "Platform Admin", "Claro, vou te ajudar!");
			expect(reply.sender_type).toBe("platform");

			// Check messages
			const messages = await getTicketMessages(env.DB, ticket.id);
			expect(messages.length).toBe(2);
			expect(messages[0].message).toContain("relatórios");
			expect(messages[1].message).toContain("ajudar");

			// Unread counts
			const tenantUnread = await getTenantUnreadCount(env.DB, clientTenantId);
			expect(tenantUnread).toBeGreaterThanOrEqual(1);

			// Mark as read
			await markMessagesRead(env.DB, ticket.id, "tenant");
			const afterRead = await getTenantUnreadCount(env.DB, clientTenantId);
			expect(afterRead).toBe(0);

			// Polling - get messages after a certain ID
			const newMsgs = await getTicketMessages(env.DB, ticket.id, messages[0].id);
			expect(newMsgs.length).toBe(1);
			expect(newMsgs[0].sender_type).toBe("platform");
		});

		it("getAllTickets returns tickets for platform admin", async () => {
			const { getAllTickets, updateTicketStatus } = await import("../../src/db/queries/support-tickets");
			// Ensure there's an open ticket
			const { createTicket } = await import("../../src/db/queries/support-tickets");
			await createTicket(env.DB, clientTenantId, 1, "Outro problema", "Detalhe aqui", "Client Owner");
			const all = await getAllTickets(env.DB);
			expect(all.length).toBeGreaterThanOrEqual(1);
			expect(all[0]).toHaveProperty("tenant_name");
			expect(all[0]).toHaveProperty("unread_count");
		});
	});

	describe("Email logging", () => {
		it("logEmail persists an email log entry", async () => {
			const { logEmail } = await import("../../src/lib/email");
			await logEmail(env.DB, {
				tenantId: clientTenantId,
				recipient: "test@email.com",
				subject: "Test email",
				eventType: "welcome",
			}, "sent");

			const row = await env.DB.prepare(
				"SELECT * FROM email_logs WHERE recipient = 'test@email.com'"
			).first();
			expect(row).toBeDefined();
			expect(row!.status).toBe("sent");
			expect(row!.event_type).toBe("welcome");
		});

		it("logEmail records failures", async () => {
			const { logEmail } = await import("../../src/lib/email");
			await logEmail(env.DB, {
				tenantId: clientTenantId,
				recipient: "fail@email.com",
				subject: "Failed email",
				eventType: "payment_failed",
			}, "failed", "SMTP timeout");

			const row = await env.DB.prepare(
				"SELECT * FROM email_logs WHERE recipient = 'fail@email.com'"
			).first();
			expect(row).toBeDefined();
			expect(row!.status).toBe("failed");
			expect(row!.error_message).toBe("SMTP timeout");
		});
	});
});
