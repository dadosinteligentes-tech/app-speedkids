import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import app from "../../src/index";

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
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			INSERT OR IGNORE INTO tenants (id, slug, name, owner_email)
			VALUES (1, 'test', 'Test Tenant', 'admin@test.com')
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS blog_posts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				slug TEXT NOT NULL UNIQUE,
				title TEXT NOT NULL,
				description TEXT NOT NULL,
				icon TEXT NOT NULL DEFAULT '📝',
				cover_image_url TEXT,
				reading_time TEXT NOT NULL DEFAULT '5 min de leitura',
				sections TEXT NOT NULL DEFAULT '[]',
				cta_text TEXT DEFAULT 'Teste grátis por 30 dias',
				cta_href TEXT DEFAULT '/landing/#cadastro',
				published INTEGER NOT NULL DEFAULT 0,
				published_at TEXT,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now'))
			)
		`),
	]);
}

async function seedBlogPost(db: D1Database) {
	await db.prepare(`
		INSERT OR IGNORE INTO blog_posts (id, slug, title, description, icon, sections, published, published_at)
		VALUES (1, 'test-article', 'Test Article Title', 'Test description for SEO', '🧪', ?, 1, datetime('now'))
	`).bind(JSON.stringify([
		{ heading: "Section One", content: "<p>Content one</p>" },
		{ heading: "Section Two", content: "<p>Content two</p>" },
	])).run();

	await db.prepare(`
		INSERT OR IGNORE INTO blog_posts (id, slug, title, description, icon, sections, published, published_at)
		VALUES (2, 'draft-article', 'Draft Article', 'Draft description', '📝', '[]', 0, NULL)
	`).run();
}

describe("Blog Pages", () => {
	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedBlogPost(env.DB);
	});

	describe("GET /blog", () => {
		it("returns 200 and lists published articles from D1", async () => {
			const res = await app.request("/blog", { method: "GET" }, env);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Blog Giro Kids");
			expect(html).toContain("test-article");
		});

		it("does not show draft articles", async () => {
			const res = await app.request("/blog", { method: "GET" }, env);
			const html = await res.text();
			expect(html).not.toContain("draft-article");
		});

		it("contains SEO meta tags", async () => {
			const res = await app.request("/blog", { method: "GET" }, env);
			const html = await res.text();
			expect(html).toContain('<meta name="description"');
			expect(html).toContain("<title>");
		});
	});

	describe("GET /blog/:slug", () => {
		it("returns 200 for published article", async () => {
			const res = await app.request("/blog/test-article", { method: "GET" }, env);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Test Article Title");
			expect(html).toContain("Section One");
		});

		it("returns 404 for non-existent slug", async () => {
			const res = await app.request("/blog/does-not-exist", { method: "GET" }, env);
			expect(res.status).toBe(404);
		});

		it("returns 404 for draft article", async () => {
			const res = await app.request("/blog/draft-article", { method: "GET" }, env);
			expect(res.status).toBe(404);
		});

		it("contains breadcrumb navigation", async () => {
			const res = await app.request("/blog/test-article", { method: "GET" }, env);
			const html = await res.text();
			expect(html).toContain('href="/blog"');
		});

		it("contains OG meta tags", async () => {
			const res = await app.request("/blog/test-article", { method: "GET" }, env);
			const html = await res.text();
			expect(html).toContain("og:title");
			expect(html).toContain("og:description");
		});
	});

	describe("blog pages are public (no auth required)", () => {
		it("blog list accessible without auth", async () => {
			const res = await app.request("/blog", { method: "GET" }, env);
			expect(res.status).toBe(200);
		});

		it("blog post accessible without auth", async () => {
			const res = await app.request("/blog/test-article", { method: "GET" }, env);
			expect(res.status).toBe(200);
		});
	});
});

describe("Blog Workflow API", () => {
	const API_KEY = "test-blog-api-key-123";

	beforeAll(async () => {
		await applyMigrations(env.DB);
		await seedBlogPost(env.DB);
	});

	describe("GET /api/blog/posts (public)", () => {
		it("returns published posts as JSON", async () => {
			const res = await app.request("/api/blog/posts", { method: "GET" }, env);
			expect(res.status).toBe(200);
			const data = await res.json() as any[];
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThan(0);
		});
	});

	describe("POST /api/blog/posts (workflow)", () => {
		it("returns 401 without API key", async () => {
			const res = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug: "no-auth", title: "No", description: "No", sections: [] }),
			}, env);
			expect(res.status).toBe(401);
		});

		it("returns 401 with wrong API key", async () => {
			const res = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-key" },
				body: JSON.stringify({ slug: "wrong-key", title: "No", description: "No", sections: [] }),
			}, env);
			expect(res.status).toBe(401);
		});

		it("creates a post with valid API key", async () => {
			const res = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({
					slug: "workflow-article",
					title: "Workflow Article",
					description: "Created by workflow",
					icon: "🤖",
					sections: [{ heading: "AI Section", content: "<p>AI generated</p>" }],
					published: true,
				}),
			}, env);
			expect(res.status).toBe(201);
			const data = await res.json() as any;
			expect(data.slug).toBe("workflow-article");
			expect(data.published).toBe(1);
			expect(data.published_at).toBeTruthy();
		});

		it("returns 400 for invalid slug", async () => {
			const res = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({ slug: "Invalid Slug!", title: "T", description: "D", sections: [] }),
			}, env);
			expect(res.status).toBe(400);
		});

		it("returns 400 for missing fields", async () => {
			const res = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({ slug: "missing" }),
			}, env);
			expect(res.status).toBe(400);
		});
	});

	describe("PUT /api/blog/posts/:id (workflow)", () => {
		it("returns 401 without API key", async () => {
			const res = await app.request("/api/blog/posts/1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Updated" }),
			}, env);
			expect(res.status).toBe(401);
		});

		it("updates an existing post with valid API key", async () => {
			// First create a post to update
			const createRes = await app.request("/api/blog/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({
					slug: "update-target",
					title: "To Update",
					description: "Will be updated",
					sections: [{ heading: "H", content: "<p>C</p>" }],
				}),
			}, env);
			const created = await createRes.json() as any;

			const res = await app.request(`/api/blog/posts/${created.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({ title: "Updated Title" }),
			}, env);
			expect(res.status).toBe(200);
		});

		it("returns 404 for non-existent post", async () => {
			const res = await app.request("/api/blog/posts/9999", {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
				body: JSON.stringify({ title: "Nope" }),
			}, env);
			expect(res.status).toBe(404);
		});
	});
});
