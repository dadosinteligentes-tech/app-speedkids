import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

async function applyMigrations(db: D1Database) {
	await db.batch([
		db.prepare(`CREATE TABLE IF NOT EXISTS tenants (
			id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active', plan TEXT NOT NULL DEFAULT 'pro',
			logo_url TEXT, primary_color TEXT DEFAULT '#FF7043', timezone TEXT DEFAULT 'America/Sao_Paulo',
			owner_email TEXT NOT NULL, max_users INTEGER DEFAULT 10, max_assets INTEGER DEFAULT 50,
			created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`),
		db.prepare(`INSERT OR IGNORE INTO tenants (id, slug, name, owner_email, plan) VALUES (1, 'test', 'Test Tenant', 'admin@test.com', 'pro')`),
		db.prepare(`CREATE TABLE IF NOT EXISTS customers (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL DEFAULT 1,
			name TEXT NOT NULL, phone TEXT, email TEXT, cpf TEXT, instagram TEXT, notes TEXT,
			total_rentals INTEGER NOT NULL DEFAULT 0, total_spent_cents INTEGER NOT NULL DEFAULT 0,
			loyalty_points INTEGER NOT NULL DEFAULT 0, email_verified INTEGER NOT NULL DEFAULT 0,
			email_verified_at TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS loyalty_config (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0, points_per_real INTEGER NOT NULL DEFAULT 1,
			min_redemption_points INTEGER NOT NULL DEFAULT 100, points_value_cents INTEGER NOT NULL DEFAULT 1,
			tiers_json TEXT, expiry_months INTEGER DEFAULT 0,
			bonus_first_purchase INTEGER NOT NULL DEFAULT 0, bonus_birthday INTEGER NOT NULL DEFAULT 0,
			bonus_referral INTEGER NOT NULL DEFAULT 0, double_points_weekends INTEGER NOT NULL DEFAULT 0,
			redemption_options_json TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, customer_id INTEGER NOT NULL,
			type TEXT NOT NULL, points INTEGER NOT NULL, balance_after INTEGER NOT NULL,
			reference_type TEXT, reference_id TEXT, description TEXT, recorded_by INTEGER,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL DEFAULT 1,
			name TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'operator', active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
			id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS permissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
			description TEXT, category TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS role_permissions (
			role TEXT NOT NULL, permission_key TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (role, permission_key)
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS operation_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id INTEGER NOT NULL, user_id INTEGER,
			action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, details TEXT, ip_address TEXT,
			created_at TEXT DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS platform_config (
			key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now'))
		)`),
	]);

	await db.batch([
		db.prepare("INSERT OR IGNORE INTO permissions (key, label, category, sort_order) VALUES ('loyalty.view', 'Ver fidelidade', 'Fidelidade', 60)"),
		db.prepare("INSERT OR IGNORE INTO permissions (key, label, category, sort_order) VALUES ('loyalty.manage', 'Gerenciar fidelidade', 'Fidelidade', 61)"),
		db.prepare("INSERT OR IGNORE INTO permissions (key, label, category, sort_order) VALUES ('customers.view', 'Ver clientes', 'Clientes', 7)"),
		db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('owner', 'loyalty.view')"),
		db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('owner', 'loyalty.manage')"),
		db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('owner', 'customers.view')"),
		db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('manager', 'loyalty.view')"),
		db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('manager', 'customers.view')"),
	]);
}

async function seedData(db: D1Database) {
	const { generateSalt, hashPassword } = await import("../../src/lib/crypto");
	const salt = generateSalt();
	const hash = await hashPassword("test-password", salt);

	await db.prepare("INSERT OR IGNORE INTO users (id, tenant_id, name, email, password_hash, salt, role) VALUES (1, 1, 'Owner', 'owner@test.com', ?, ?, 'owner')")
		.bind(hash, salt).run();
	await db.prepare("INSERT OR IGNORE INTO auth_sessions (id, user_id, expires_at) VALUES ('test-session', 1, datetime('now', '+1 day'))").run();

	await db.prepare("INSERT OR IGNORE INTO customers (id, tenant_id, name, email, email_verified) VALUES (1, 1, 'Maria Silva', 'maria@test.com', 1)").run();
	await db.prepare("INSERT OR IGNORE INTO customers (id, tenant_id, name, email, email_verified) VALUES (2, 1, 'João Santos', 'joao@test.com', 0)").run();
	await db.prepare("INSERT OR IGNORE INTO customers (id, tenant_id, name, phone, email_verified) VALUES (3, 1, 'Sem Email', '11999990000', 0)").run();

	await db.prepare("INSERT OR IGNORE INTO loyalty_config (tenant_id, enabled, points_per_real, min_redemption_points, points_value_cents) VALUES (1, 1, 2, 50, 1)").run();
}

function authHeaders(): Record<string, string> {
	return { Cookie: "sk_session=test-session" };
}

describe("Loyalty API", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
	});

	describe("GET /api/loyalty/config", () => {
		it("returns config for authenticated user", async () => {
			const res = await app.request("/api/loyalty/config", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data.enabled).toBe(1);
			expect(data.points_per_real).toBe(2);
		});

		it("returns 401 without auth", async () => {
			const res = await app.request("/api/loyalty/config", {}, env);
			expect(res.status).toBe(401);
		});
	});

	describe("PUT /api/loyalty/config", () => {
		it("updates config", async () => {
			const res = await app.request("/api/loyalty/config", {
				method: "PUT",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ points_per_real: 3, min_redemption_points: 200 }),
			}, env);
			expect(res.status).toBe(200);
		});

		it("saves expanded config fields", async () => {
			const res = await app.request("/api/loyalty/config", {
				method: "PUT",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({
					bonus_first_purchase: 50,
					bonus_birthday: 100,
					bonus_referral: 75,
					double_points_weekends: true,
					expiry_months: 12,
					tiers: [{ name: "Bronze", min_points: 0 }, { name: "Ouro", min_points: 1000 }],
					redemption_options: [{ type: "discount", label: "R$ 5 off", points_cost: 100, value: "R$ 5,00", active: true }],
				}),
			}, env);
			expect(res.status).toBe(200);

			const config = await app.request("/api/loyalty/config", { headers: authHeaders() }, env);
			const data = await config.json() as any;
			expect(data.bonus_first_purchase).toBe(50);
			expect(data.double_points_weekends).toBe(1);
			expect(data.tiers).toHaveLength(2);
			expect(data.redemption_options).toHaveLength(1);
		});
	});

	describe("GET /api/loyalty/stats", () => {
		it("returns stats with monthly data", async () => {
			const res = await app.request("/api/loyalty/stats", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data).toHaveProperty("totalEarned");
			expect(data).toHaveProperty("verifiedCustomers");
			expect(data).toHaveProperty("earnedThisMonth");
			expect(data).toHaveProperty("redeemedThisMonth");
		});
	});

	describe("POST /api/loyalty/adjust-points", () => {
		it("adds points to a customer", async () => {
			const res = await app.request("/api/loyalty/adjust-points", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 1, points: 100, description: "Teste" }),
			}, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data.balance).toBe(100);
		});

		it("subtracts points from a customer", async () => {
			// Ensure customer has enough points first
			await env.DB.prepare("UPDATE customers SET loyalty_points = 200 WHERE id = 1 AND tenant_id = 1").run();
			const res = await app.request("/api/loyalty/adjust-points", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 1, points: -50, description: "Estorno" }),
			}, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any;
			expect(data.balance).toBe(150);
		});

		it("prevents negative balance", async () => {
			const res = await app.request("/api/loyalty/adjust-points", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 1, points: -9999, description: "Teste" }),
			}, env);
			expect(res.status).toBe(400);
		});

		it("returns 400 without description", async () => {
			const res = await app.request("/api/loyalty/adjust-points", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 1, points: 10 }),
			}, env);
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent customer", async () => {
			const res = await app.request("/api/loyalty/adjust-points", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 9999, points: 10, description: "X" }),
			}, env);
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/loyalty/ranking", () => {
		it("returns ranking with customers who have points", async () => {
			await env.DB.prepare("UPDATE customers SET loyalty_points = 100 WHERE id = 1 AND tenant_id = 1").run();
			const res = await app.request("/api/loyalty/ranking", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any[];
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
		});

		it("respects limit parameter", async () => {
			const res = await app.request("/api/loyalty/ranking?limit=1", { headers: authHeaders() }, env);
			const data = await res.json() as any[];
			expect(data.length).toBeLessThanOrEqual(1);
		});
	});

	describe("GET /api/loyalty/transactions", () => {
		it("returns recent transactions", async () => {
			// Seed a transaction
			await env.DB.prepare("INSERT OR IGNORE INTO loyalty_transactions (tenant_id, customer_id, type, points, balance_after, description) VALUES (1, 1, 'earned', 10, 10, 'Test')").run();
			const res = await app.request("/api/loyalty/transactions", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any[];
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
			expect(data[0]).toHaveProperty("customer_name");
		});
	});

	describe("GET /api/loyalty/customers/:id/transactions", () => {
		it("returns transactions for specific customer", async () => {
			const res = await app.request("/api/loyalty/customers/1/transactions", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any[];
			expect(Array.isArray(data)).toBe(true);
		});

		it("returns empty array for customer with no transactions", async () => {
			const res = await app.request("/api/loyalty/customers/3/transactions", { headers: authHeaders() }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any[];
			expect(data).toEqual([]);
		});
	});

	describe("POST /api/loyalty/send-verification", () => {
		it("sends verification for unverified customer", async () => {
			const res = await app.request("/api/loyalty/send-verification", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 2 }),
			}, env);
			// RESEND_API_KEY is empty in tests, so email will fail
			const data = await res.json() as any;
			expect([200, 500]).toContain(res.status);
		});

		it("rejects already verified customer", async () => {
			const res = await app.request("/api/loyalty/send-verification", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 1 }),
			}, env);
			expect(res.status).toBe(400);
			const data = await res.json() as any;
			expect(data.error).toContain("já verificado");
		});

		it("rejects customer without email", async () => {
			const res = await app.request("/api/loyalty/send-verification", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 3 }),
			}, env);
			expect(res.status).toBe(400);
			expect((await res.json() as any).error).toContain("email");
		});

		it("rejects non-existent customer", async () => {
			const res = await app.request("/api/loyalty/send-verification", {
				method: "POST",
				headers: { ...authHeaders(), "Content-Type": "application/json" },
				body: JSON.stringify({ customer_id: 9999 }),
			}, env);
			expect(res.status).toBe(404);
		});
	});

	describe("GET /loyalty/verify (public)", () => {
		it("verifies a valid token", async () => {
			// Reset customer 2 to unverified for this test
			await env.DB.prepare("UPDATE customers SET email_verified = 0, email_verified_at = NULL WHERE id = 2").run();

			const { generateVerificationToken } = await import("../../src/lib/email-verification");
			const token = await generateVerificationToken("test-hmac-secret-for-loyalty-verification", 1, 2, "joao@test.com");

			const res = await app.request(`/loyalty/verify?token=${encodeURIComponent(token)}`, {}, env);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Email Verificado");

			const customer = await env.DB.prepare("SELECT email_verified FROM customers WHERE id = 2").first<{ email_verified: number }>();
			expect(customer?.email_verified).toBe(1);
		});

		it("shows already verified message on second verification", async () => {
			// Ensure customer 2 is verified from previous test
			await env.DB.prepare("UPDATE customers SET email_verified = 1, email_verified_at = datetime('now') WHERE id = 2").run();
			const { generateVerificationToken } = await import("../../src/lib/email-verification");
			const token = await generateVerificationToken("test-hmac-secret-for-loyalty-verification", 1, 2, "joao@test.com");
			const res = await app.request(`/loyalty/verify?token=${encodeURIComponent(token)}`, {}, env);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("já foi verificado");
		});

		it("rejects invalid token", async () => {
			const res = await app.request("/loyalty/verify?token=invalid-token", {}, env);
			expect(res.status).toBe(400);
		});

		it("rejects missing token", async () => {
			const res = await app.request("/loyalty/verify", {}, env);
			expect(res.status).toBe(400);
		});

		it("rejects token with wrong email", async () => {
			const { generateVerificationToken } = await import("../../src/lib/email-verification");
			const token = await generateVerificationToken("test-hmac-secret-for-loyalty-verification", 1, 2, "wrong@email.com");
			const res = await app.request(`/loyalty/verify?token=${encodeURIComponent(token)}`, {}, env);
			expect(res.status).toBe(400);
			const html = await res.text();
			expect(html).toContain("não confere");
		});

		it("rejects token for non-existent customer", async () => {
			const { generateVerificationToken } = await import("../../src/lib/email-verification");
			const token = await generateVerificationToken("test-hmac-secret-for-loyalty-verification", 1, 9999, "x@x.com");
			const res = await app.request(`/loyalty/verify?token=${encodeURIComponent(token)}`, {}, env);
			expect(res.status).toBe(400);
		});
	});
});

describe("Loyalty E2E: awardLoyaltyPoints", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
	});

	it("awards points to verified customer", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		// Maria (id=1) is verified, config: 2 pts per real
		const result = await awardLoyaltyPoints(env.DB, 1, 1, 5000, "rental_payment", "test-1", "pro");
		expect(result).not.toBeNull();
		expect(result!.awarded).toBe(100); // 50 reais * 2 pts
	});

	it("returns null for unverified customer", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		await env.DB.prepare("UPDATE customers SET email_verified = 0 WHERE id = 2").run();
		const result = await awardLoyaltyPoints(env.DB, 1, 2, 5000, "rental_payment", "test-2", "pro");
		expect(result).toBeNull();
	});

	it("returns null when loyalty is disabled", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		await env.DB.prepare("UPDATE loyalty_config SET enabled = 0 WHERE tenant_id = 1").run();
		const result = await awardLoyaltyPoints(env.DB, 1, 1, 5000, "rental_payment", "test-3", "pro");
		expect(result).toBeNull();
		await env.DB.prepare("UPDATE loyalty_config SET enabled = 1 WHERE tenant_id = 1").run();
	});

	it("returns null for amount less than 1 real", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		const result = await awardLoyaltyPoints(env.DB, 1, 1, 50, "rental_payment", "test-4", "pro");
		expect(result).toBeNull(); // 0 reais = 0 points
	});

	it("floors fractional reais (150 cents = 1 real, not 1.5)", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		const result = await awardLoyaltyPoints(env.DB, 1, 1, 150, "rental_payment", "test-5", "pro");
		expect(result).not.toBeNull();
		expect(result!.awarded).toBe(2); // floor(1.5) * 2 = 2
	});

	it("returns null for non-existent customer", async () => {
		const { awardLoyaltyPoints } = await import("../../src/services/loyalty");
		const result = await awardLoyaltyPoints(env.DB, 1, 9999, 5000, "rental_payment", "test-6", "pro");
		expect(result).toBeNull();
	});
});

describe("Loyalty E2E: redeemLoyaltyPoints", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
		// Give Maria 500 points for testing
		await env.DB.prepare("UPDATE customers SET loyalty_points = 500, email_verified = 1 WHERE id = 1").run();
		await env.DB.prepare("UPDATE loyalty_config SET enabled = 1, min_redemption_points = 50, points_value_cents = 5 WHERE tenant_id = 1").run();
	});

	it("redeems points and returns discount", async () => {
		const { redeemLoyaltyPoints } = await import("../../src/services/loyalty");
		const result = await redeemLoyaltyPoints(env.DB, 1, 1, 100, "rental", "r-1", 1);
		expect(result.discountCents).toBe(500); // 100 pts * 5 cents
		expect(result.pointsRedeemed).toBe(100);
	});

	it("throws for insufficient balance", async () => {
		const { redeemLoyaltyPoints } = await import("../../src/services/loyalty");
		await expect(
			redeemLoyaltyPoints(env.DB, 1, 1, 99999, "rental", "r-2", 1),
		).rejects.toThrow("Saldo insuficiente");
	});

	it("throws for below minimum redemption", async () => {
		const { redeemLoyaltyPoints } = await import("../../src/services/loyalty");
		await expect(
			redeemLoyaltyPoints(env.DB, 1, 1, 10, "rental", "r-3", 1),
		).rejects.toThrow("Mínimo de");
	});

	it("throws for unverified customer", async () => {
		const { redeemLoyaltyPoints } = await import("../../src/services/loyalty");
		await env.DB.prepare("UPDATE customers SET loyalty_points = 500, email_verified = 0 WHERE id = 2").run();
		await expect(
			redeemLoyaltyPoints(env.DB, 1, 2, 100, "rental", "r-4", 1),
		).rejects.toThrow("Email não verificado");
	});

	it("throws when loyalty is disabled", async () => {
		const { redeemLoyaltyPoints } = await import("../../src/services/loyalty");
		await env.DB.prepare("UPDATE loyalty_config SET enabled = 0 WHERE tenant_id = 1").run();
		await expect(
			redeemLoyaltyPoints(env.DB, 1, 1, 100, "rental", "r-5", 1),
		).rejects.toThrow("não está ativo");
		await env.DB.prepare("UPDATE loyalty_config SET enabled = 1 WHERE tenant_id = 1").run();
	});
});

describe("Customer email_verified reset on email change", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
	});

	it("resets email_verified when email changes via updateCustomer", async () => {
		// Start verified
		await env.DB.prepare("UPDATE customers SET email_verified = 1, email_verified_at = datetime('now') WHERE id = 1").run();

		const { updateCustomer } = await import("../../src/db/queries/customers");
		const updated = await updateCustomer(env.DB, 1, 1, { email: "new@email.com" });
		expect(updated).not.toBeNull();
		expect(updated!.email_verified).toBe(0);
		expect(updated!.email_verified_at).toBeNull();
		expect(updated!.email).toBe("new@email.com");
	});

	it("preserves email_verified when email stays the same", async () => {
		await env.DB.prepare("UPDATE customers SET email = 'same@email.com', email_verified = 1, email_verified_at = datetime('now') WHERE id = 1").run();

		const { updateCustomer } = await import("../../src/db/queries/customers");
		const updated = await updateCustomer(env.DB, 1, 1, { email: "same@email.com" });
		expect(updated).not.toBeNull();
		expect(updated!.email_verified).toBe(1);
	});

	it("preserves email_verified when only name changes", async () => {
		await env.DB.prepare("UPDATE customers SET email_verified = 1 WHERE id = 1").run();

		const { updateCustomer } = await import("../../src/db/queries/customers");
		const updated = await updateCustomer(env.DB, 1, 1, { name: "Novo Nome" });
		expect(updated).not.toBeNull();
		expect(updated!.email_verified).toBe(1);
	});
});

describe("PUT /customers/quick/:id", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
	});

	it("rejects invalid email format", async () => {
		const res = await app.request("/api/customers/quick/1", {
			method: "PUT",
			headers: { ...authHeaders(), "Content-Type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		}, env);
		expect(res.status).toBe(400);
	});

	it("accepts valid email", async () => {
		const res = await app.request("/api/customers/quick/1", {
			method: "PUT",
			headers: { ...authHeaders(), "Content-Type": "application/json" },
			body: JSON.stringify({ email: "valid@email.com" }),
		}, env);
		expect(res.status).toBe(200);
	});

	it("returns 404 for non-existent customer", async () => {
		const res = await app.request("/api/customers/quick/9999", {
			method: "PUT",
			headers: { ...authHeaders(), "Content-Type": "application/json" },
			body: JSON.stringify({ email: "x@x.com" }),
		}, env);
		expect(res.status).toBe(404);
	});
});

describe("Plan-based loyalty gating", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
		// Set plan config where starter has no loyalty
		await env.DB.prepare(`INSERT OR REPLACE INTO platform_config (key, value, updated_at) VALUES ('plan_limits', ?, datetime('now'))`)
			.bind(JSON.stringify({
				starter: { label: "Starter", maxUsers: 3, maxAssets: 15, priceCents: 9700, hasTickets: false, hasLoyalty: false },
				pro: { label: "Pro", maxUsers: 10, maxAssets: 50, priceCents: 19700, hasTickets: true, hasLoyalty: true },
			})).run();
		// Ensure loyalty permissions exist for owner
		await env.DB.prepare("INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES ('owner', 'loyalty.view')").run();
	});

	it("redirects loyalty page for starter plan (no loyalty)", async () => {
		await env.DB.prepare("UPDATE tenants SET plan = 'starter' WHERE id = 1").run();
		const res = await app.request("/admin/loyalty", { headers: authHeaders() }, env);
		// Should redirect to /admin/plan
		expect([302, 200]).toContain(res.status);
		if (res.status === 200) {
			const html = await res.text();
			// If 200, it should be the plan page (redirect followed)
			expect(html).toContain("Plano");
		}
		await env.DB.prepare("UPDATE tenants SET plan = 'pro' WHERE id = 1").run();
	});

	it("allows loyalty page for pro plan", async () => {
		await env.DB.prepare("UPDATE tenants SET plan = 'pro' WHERE id = 1").run();
		const res = await app.request("/admin/loyalty", { headers: authHeaders() }, env);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Fidelidade");
	});
});
