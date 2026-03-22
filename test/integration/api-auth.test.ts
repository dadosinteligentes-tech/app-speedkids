/**
 * Integration tests for the auth API endpoints.
 *
 * These tests run against the actual Hono app with a real D1 database
 * using the Cloudflare Workers Vitest pool.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

// Helper to apply migrations to the test D1 database
async function applyMigrations(db: D1Database) {
	// Create minimal tables needed for auth tests
	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				email TEXT NOT NULL UNIQUE,
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
				user_id INTEGER,
				action TEXT NOT NULL,
				entity_type TEXT NOT NULL,
				entity_id TEXT,
				details TEXT,
				ip_address TEXT,
				created_at TEXT DEFAULT (datetime('now'))
			)
		`),
	]);
}

// Helper to create a test user with known credentials
async function seedTestUser(db: D1Database) {
	const { generateSalt, hashPassword } = await import("../../src/lib/crypto");
	const salt = generateSalt();
	const hash = await hashPassword("test-password-123", salt);
	await db
		.prepare("INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)")
		.bind("Test Admin", "admin@test.com", hash, salt, "owner")
		.run();
}

describe("Auth API", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedTestUser(env.DB);
	});

	describe("POST /api/auth/login", () => {
		it("returns 401 for invalid email", async () => {
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "nobody@test.com", password: "wrong" }),
			}, env);
			expect(res.status).toBe(401);
			const body = await res.json() as { error: string };
			expect(body.error).toContain("inválidos");
		});

		it("returns 401 for wrong password", async () => {
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "wrong-password" }),
			}, env);
			expect(res.status).toBe(401);
		});

		it("returns 400 for invalid body", async () => {
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "not-an-email" }),
			}, env);
			expect(res.status).toBe(400);
		});

		it("returns user data and sets cookie on success", async () => {
			const res = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "test-password-123" }),
			}, env);
			expect(res.status).toBe(200);

			const body = await res.json() as { id: number; name: string; email: string; role: string };
			expect(body.name).toBe("Test Admin");
			expect(body.email).toBe("admin@test.com");
			expect(body.role).toBe("owner");

			const setCookie = res.headers.get("set-cookie");
			expect(setCookie).toContain("sk_session=");
			expect(setCookie).toContain("HttpOnly");
		});
	});

	describe("GET /api/auth/me", () => {
		it("returns 401 without session cookie", async () => {
			const res = await app.request("/api/auth/me", {}, env);
			expect(res.status).toBe(401);
		});

		it("returns user data with valid session", async () => {
			// Login first to get session
			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "test-password-123" }),
			}, env);
			const cookie = loginRes.headers.get("set-cookie")!;
			const sessionId = cookie.match(/sk_session=([^;]+)/)?.[1];

			const res = await app.request("/api/auth/me", {
				headers: { Cookie: `sk_session=${sessionId}` },
			}, env);
			expect(res.status).toBe(200);
			const body = await res.json() as { name: string };
			expect(body.name).toBe("Test Admin");
		});
	});

	describe("POST /api/auth/logout", () => {
		it("clears session and returns ok", async () => {
			// Login first
			const loginRes = await app.request("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "admin@test.com", password: "test-password-123" }),
			}, env);
			const cookie = loginRes.headers.get("set-cookie")!;
			const sessionId = cookie.match(/sk_session=([^;]+)/)?.[1];

			// Logout
			const res = await app.request("/api/auth/logout", {
				method: "POST",
				headers: { Cookie: `sk_session=${sessionId}` },
			}, env);
			expect(res.status).toBe(200);
			const body = await res.json() as { ok: boolean };
			expect(body.ok).toBe(true);

			// Session should be invalid now
			const meRes = await app.request("/api/auth/me", {
				headers: { Cookie: `sk_session=${sessionId}` },
			}, env);
			expect(meRes.status).toBe(401);
		});
	});
});
