/**
 * Integration tests for the rentals API endpoints.
 *
 * Tests the full rental lifecycle: start → pause → resume → stop → pay.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

let sessionCookie: string;

async function applyMigrations(db: D1Database) {
	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS tenants (
				id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL,
				name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
				plan TEXT NOT NULL DEFAULT 'pro', logo_url TEXT,
				primary_color TEXT DEFAULT '#FF7043', timezone TEXT DEFAULT 'America/Sao_Paulo',
				owner_email TEXT NOT NULL, max_users INTEGER DEFAULT 10, max_assets INTEGER DEFAULT 50,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			INSERT OR IGNORE INTO tenants (id, slug, name, owner_email)
			VALUES (1, 'test', 'Test Tenant', 'op@test.com')
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				name TEXT NOT NULL, email TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL,
				role TEXT NOT NULL DEFAULT 'operator', active INTEGER NOT NULL DEFAULT 1,
				created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS auth_sessions (
				id TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
				expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS operation_logs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				user_id INTEGER, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
				details TEXT, ip_address TEXT, created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS packages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				name TEXT NOT NULL, duration_minutes INTEGER NOT NULL, price_cents INTEGER NOT NULL,
				overtime_block_minutes INTEGER DEFAULT 0, overtime_block_price_cents INTEGER DEFAULT 0,
				grace_period_minutes INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
				sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS assets (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				name TEXT NOT NULL, asset_type TEXT NOT NULL, status TEXT DEFAULT 'available',
				pos_id INTEGER, model TEXT, photo_url TEXT,
				battery_level INTEGER, uses_battery INTEGER DEFAULT 0,
				max_weight_kg REAL, min_age INTEGER, max_age INTEGER,
				sort_order INTEGER DEFAULT 0, last_maintenance_at TEXT,
				notes TEXT, created_at TEXT DEFAULT (datetime('now')),
				updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS rental_sessions (
				id TEXT PRIMARY KEY,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				asset_id INTEGER NOT NULL, package_id INTEGER NOT NULL,
				pos_id INTEGER, attendant_id INTEGER, customer_id INTEGER, child_id INTEGER,
				cash_register_id INTEGER, status TEXT DEFAULT 'running',
				start_time TEXT NOT NULL, pause_time TEXT, total_paused_ms INTEGER DEFAULT 0,
				end_time TEXT, duration_minutes INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
				overtime_minutes INTEGER DEFAULT 0, overtime_cents INTEGER DEFAULT 0,
				payment_method TEXT, paid INTEGER DEFAULT 0,
				promotion_id INTEGER, discount_cents INTEGER DEFAULT 0,
				notes TEXT,
				created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS session_pauses (
				id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
				paused_at TEXT NOT NULL, resumed_at TEXT, duration_ms INTEGER,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS customers (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				name TEXT NOT NULL, phone TEXT, email TEXT, cpf TEXT, instagram TEXT, notes TEXT,
				total_rentals INTEGER DEFAULT 0, total_spent_cents INTEGER DEFAULT 0,
				loyalty_points INTEGER DEFAULT 0,
				created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS children (
				id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
				name TEXT NOT NULL, age INTEGER NOT NULL, birth_date TEXT,
				created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS cash_registers (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				shift_id INTEGER, opened_by INTEGER NOT NULL, closed_by INTEGER,
				opening_balance_cents INTEGER DEFAULT 0, closing_balance_cents INTEGER,
				expected_balance_cents INTEGER, status TEXT DEFAULT 'open',
				opened_at TEXT DEFAULT (datetime('now')), closed_at TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS cash_transactions (
				id INTEGER PRIMARY KEY AUTOINCREMENT, cash_register_id INTEGER NOT NULL,
				rental_session_id TEXT, product_sale_id INTEGER,
				type TEXT NOT NULL, amount_cents INTEGER NOT NULL,
				payment_method TEXT, description TEXT, recorded_by INTEGER,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS cash_register_denominations (
				id INTEGER PRIMARY KEY AUTOINCREMENT, cash_register_id INTEGER NOT NULL,
				cash_transaction_id INTEGER, event_type TEXT NOT NULL,
				denomination_cents INTEGER NOT NULL, quantity INTEGER NOT NULL,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS batteries (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
				label TEXT NOT NULL, asset_id INTEGER, status TEXT DEFAULT 'ready',
				full_charge_minutes INTEGER DEFAULT 90, charge_time_minutes INTEGER DEFAULT 480,
				estimated_minutes_remaining INTEGER DEFAULT 90,
				last_charged_at TEXT, notes TEXT,
				created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
			)
		`),
	]);
}

async function seedData(db: D1Database) {
	const { generateSalt, hashPassword } = await import("../../src/lib/crypto");
	const salt = generateSalt();
	const hash = await hashPassword("test123", salt);

	await db.batch([
		db.prepare("INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)")
			.bind("Operator", "op@test.com", hash, salt, "operator"),
		db.prepare("INSERT INTO packages (name, duration_minutes, price_cents) VALUES (?, ?, ?)")
			.bind("15 min", 15, 3000),
		db.prepare("INSERT INTO assets (name, asset_type, status) VALUES (?, ?, ?)")
			.bind("Kart 01", "kart", "available"),
		db.prepare("INSERT INTO assets (name, asset_type, status) VALUES (?, ?, ?)")
			.bind("Kart 02", "kart", "available"),
		db.prepare("INSERT INTO cash_registers (opened_by, opening_balance_cents, status) VALUES (?, ?, ?)")
			.bind(1, 10000, "open"),
	]);
}

async function login(): Promise<string> {
	const res = await app.request("/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "op@test.com", password: "test123" }),
	}, env);
	const cookie = res.headers.get("set-cookie")!;
	return `sk_session=${cookie.match(/sk_session=([^;]+)/)?.[1]}`;
}

function req(path: string, opts: RequestInit = {}) {
	return app.request(path, {
		...opts,
		headers: { ...opts.headers as Record<string, string>, Cookie: sessionCookie },
	}, env);
}

function jsonReq(path: string, body: unknown, method = "POST") {
	return req(path, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("Rentals API", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedData(env.DB);
		sessionCookie = await login();
	});

	it("returns empty active sessions initially", async () => {
		const res = await req("/api/rentals/active");
		expect(res.status).toBe(200);
		const body = await res.json() as unknown[];
		expect(body).toEqual([]);
	});

	it("rejects invalid body with 400", async () => {
		const res = await jsonReq("/api/rentals/start", { asset_id: "not-a-number" });
		expect(res.status).toBe(400);
	});

	it("rejects non-existent asset", async () => {
		const res = await jsonReq("/api/rentals/start", { asset_id: 999, package_id: 1 });
		expect(res.status).toBe(404);
	});

	it("rejects non-existent package", async () => {
		const res = await jsonReq("/api/rentals/start", { asset_id: 1, package_id: 999 });
		expect(res.status).toBe(404);
	});

	it("full lifecycle: start → pause → resume → stop → pay", async () => {
		// START
		const startRes = await jsonReq("/api/rentals/start", { asset_id: 1, package_id: 1 });
		expect(startRes.status).toBe(201);
		const started = await startRes.json() as { id: string; status: string; asset_name: string; amount_cents: number };
		expect(started.status).toBe("running");
		expect(started.asset_name).toBe("Kart 01");
		expect(started.amount_cents).toBe(3000);
		const sid = started.id;

		// Verify asset is in active sessions
		const activeRes1 = await req("/api/rentals/active");
		const active1 = await activeRes1.json() as unknown[];
		expect(active1).toHaveLength(1);

		// DUPLICATE: same asset should be rejected (either "not available" or "active session")
		const dupRes = await jsonReq("/api/rentals/start", { asset_id: 1, package_id: 1 });
		expect(dupRes.status).toBe(400);
		const dupBody = await dupRes.json() as { error: string };
		expect(dupBody.error).toBeTruthy();

		// GET single session
		const getRes = await req(`/api/rentals/${sid}`);
		expect(getRes.status).toBe(200);
		const got = await getRes.json() as { id: string };
		expect(got.id).toBe(sid);

		// PAUSE
		const pauseRes = await req(`/api/rentals/${sid}/pause`, { method: "POST" });
		expect(pauseRes.status).toBe(200);
		const paused = await pauseRes.json() as { status: string };
		expect(paused.status).toBe("paused");

		// RESUME
		const resumeRes = await req(`/api/rentals/${sid}/resume`, { method: "POST" });
		expect(resumeRes.status).toBe(200);
		const resumed = await resumeRes.json() as { status: string };
		expect(resumed.status).toBe("running");

		// STOP
		const stopRes = await req(`/api/rentals/${sid}/stop`, { method: "POST" });
		expect(stopRes.status).toBe(200);
		const stopped = await stopRes.json() as { status: string; prepaid: boolean };
		expect(stopped.status).toBe("completed");
		expect(stopped.prepaid).toBe(false);

		// PAY
		const payRes = await jsonReq(`/api/rentals/${sid}/pay`, { payment_method: "pix" });
		expect(payRes.status).toBe(200);
		const paid = await payRes.json() as { paid: number; payment_method: string };
		expect(paid.paid).toBe(1);
		expect(paid.payment_method).toBe("pix");
	});

	it("supports prepaid rental with single payment", async () => {
		const res = await jsonReq("/api/rentals/start", {
			asset_id: 2,
			package_id: 1,
			payment_method: "cash",
			paid: true,
		});
		expect(res.status).toBe(201);
		const body = await res.json() as { paid: number; payment_method: string };
		expect(body.paid).toBe(1);
		expect(body.payment_method).toBe("cash");
	});

	it("requires authentication for all endpoints", async () => {
		const res = await app.request("/api/rentals/active");
		expect(res.status).toBe(401);
	});
});
