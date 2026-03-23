import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { platformAdminMiddleware } from "../../middleware/platform-admin";
import {
	getPlatformStats,
	getAllTenants,
	getTenantDetail,
	getTenantRecentActivity,
	updateTenantStatus,
	getTenantUsers,
	getTenantActiveSessions,
	getTenantConfig,
	getTenantLogs,
	getCrossTenantLogs,
	updateTenantPlan,
	updateTenantConfig,
	getSuperadminUsers,
	createSuperadminUser,
	toggleSuperadminActive,
	resetSuperadminPassword,
	getPlanDefinitions,
	updatePlanDefinitions,
	getRevenueOverTime,
	getTenantGrowth,
	getActiveTenants,
	getInactiveTenants,
	getTopTenantsByRevenue,
	getAllUsersAcrossTenants,
	getSubscriptionDetails,
} from "../../db/queries/platform";
import { isSlugAvailable, provisionTenant } from "../../services/provisioning";
import { generateSalt, hashPassword } from "../../lib/crypto";
import { createAuthSession } from "../../db/queries/auth";
import { getLimitsForPlan } from "../../lib/plan-limits";

export const platformApiRoutes = new Hono<AppEnv>();

platformApiRoutes.use("*", platformAdminMiddleware);

platformApiRoutes.get("/stats", async (c) => {
	const stats = await getPlatformStats(c.env.DB);
	return c.json(stats);
});

platformApiRoutes.get("/tenants", async (c) => {
	const tenants = await getAllTenants(c.env.DB);
	return c.json(tenants);
});

platformApiRoutes.get("/tenants/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const tenant = await getTenantDetail(c.env.DB, id);
	if (!tenant) return c.json({ error: "Tenant not found" }, 404);

	const activity = await getTenantRecentActivity(c.env.DB, id);
	return c.json({ ...tenant, ...activity });
});

platformApiRoutes.post("/tenants/:id/suspend", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "suspended");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants/:id/activate", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "active");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants", async (c) => {
	const body = await c.req.json<{
		slug: string;
		businessName: string;
		ownerName: string;
		ownerEmail: string;
		ownerPassword: string;
		plan: string;
	}>();

	if (!body.slug || !body.businessName || !body.ownerName || !body.ownerEmail || !body.ownerPassword) {
		return c.json({ error: "Campos obrigatorios faltando" }, 400);
	}

	const slug = body.slug.toLowerCase().trim();
	const available = await isSlugAvailable(c.env.DB, slug);
	if (!available) return c.json({ error: "Slug indisponivel" }, 400);

	const tenant = await provisionTenant(c.env.DB, {
		slug,
		name: body.businessName,
		ownerName: body.ownerName,
		ownerEmail: body.ownerEmail,
		ownerPassword: body.ownerPassword,
		plan: body.plan || "starter",
	});

	return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug } }, 201);
});

// List tenant users
platformApiRoutes.get("/tenants/:id/users", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const users = await getTenantUsers(c.env.DB, id);
	return c.json(users);
});

// Reset user password
platformApiRoutes.post("/tenants/:id/users/:userId/reset-password", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const userId = parseInt(c.req.param("userId"), 10);
	const body = await c.req.json<{ new_password: string }>();

	if (!body.new_password) {
		return c.json({ error: "new_password is required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.new_password, salt);

	await c.env.DB.prepare(
		"UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
	)
		.bind(passwordHash, salt, userId, tenantId)
		.run();

	return c.json({ ok: true });
});

// Impersonate a tenant user
platformApiRoutes.post("/tenants/:id/impersonate/:userId", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const userId = parseInt(c.req.param("userId"), 10);

	// Verify user belongs to this tenant
	const user = await c.env.DB.prepare(
		"SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1",
	)
		.bind(userId, tenantId)
		.first<{ id: number }>();

	if (!user) {
		return c.json({ error: "User not found or inactive" }, 404);
	}

	const session = await createAuthSession(c.env.DB, userId);
	if (!session) {
		return c.json({ error: "Failed to create session" }, 500);
	}

	return c.json({ ok: true, session_id: session.id });
});

// Get active/stuck sessions
platformApiRoutes.get("/tenants/:id/sessions", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const sessions = await getTenantActiveSessions(c.env.DB, id);
	return c.json(sessions);
});

// Force complete a stuck session
platformApiRoutes.post("/tenants/:id/sessions/:sessionId/force-complete", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const sessionId = c.req.param("sessionId");

	const result = await c.env.DB.prepare(
		`UPDATE rental_sessions SET status = 'completed', end_time = datetime('now'), updated_at = datetime('now')
		WHERE id = ? AND tenant_id = ? AND status IN ('running', 'paused')`,
	)
		.bind(sessionId, tenantId)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: "Session not found or already completed" }, 404);
	}

	return c.json({ ok: true });
});

// Get tenant config
platformApiRoutes.get("/tenants/:id/config", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const config = await getTenantConfig(c.env.DB, id);
	if (!config) return c.json({ error: "Tenant not found" }, 404);
	return c.json(config);
});

// Update tenant config
platformApiRoutes.put("/tenants/:id/config", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{
		name?: string;
		cnpj?: string | null;
		address?: string | null;
		phone?: string | null;
		receipt_footer?: string | null;
	}>();

	await updateTenantConfig(c.env.DB, id, body);
	return c.json({ ok: true });
});

// Update tenant plan
platformApiRoutes.put("/tenants/:id/plan", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{
		plan: string;
		max_users?: number;
		max_assets?: number;
	}>();

	if (!body.plan) {
		return c.json({ error: "plan is required" }, 400);
	}

	const defaults = getLimitsForPlan(body.plan);
	const maxUsers = body.max_users ?? defaults.maxUsers;
	const maxAssets = body.max_assets ?? defaults.maxAssets;

	await updateTenantPlan(c.env.DB, id, body.plan, maxUsers, maxAssets);
	return c.json({ ok: true });
});

// Get tenant logs
platformApiRoutes.get("/tenants/:id/logs", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const logs = await getTenantLogs(c.env.DB, id);
	return c.json(logs);
});

// Get cross-tenant logs
platformApiRoutes.get("/logs", async (c) => {
	const logs = await getCrossTenantLogs(c.env.DB);
	return c.json(logs);
});

// --- Superadmin routes ---

// List all superadmin users
platformApiRoutes.get("/superadmins", async (c) => {
	const users = await getSuperadminUsers(c.env.DB);
	return c.json(users);
});

// Create superadmin
platformApiRoutes.post("/superadmins", async (c) => {
	const body = await c.req.json<{ name: string; email: string; password: string }>();

	if (!body.name || !body.email || !body.password) {
		return c.json({ error: "name, email, and password are required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.password, salt);

	const user = await createSuperadminUser(c.env.DB, {
		name: body.name,
		email: body.email,
		passwordHash,
		salt,
	});

	return c.json(user, 201);
});

// Toggle superadmin active status
platformApiRoutes.post("/superadmins/:id/toggle-active", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{ active: boolean }>();

	await toggleSuperadminActive(c.env.DB, id, body.active);
	return c.json({ ok: true });
});

// Reset superadmin password
platformApiRoutes.post("/superadmins/:id/reset-password", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{ new_password: string }>();

	if (!body.new_password) {
		return c.json({ error: "new_password is required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.new_password, salt);

	await resetSuperadminPassword(c.env.DB, id, passwordHash, salt);
	return c.json({ ok: true });
});

// --- Plans routes ---

// Get plan definitions
platformApiRoutes.get("/plans", async (c) => {
	const plans = await getPlanDefinitions(c.env.DB);
	return c.json(plans);
});

// Update plan definitions
platformApiRoutes.put("/plans", async (c) => {
	const body = await c.req.json();
	await updatePlanDefinitions(c.env.DB, body);
	return c.json({ ok: true });
});

// --- Report routes ---

// Revenue over time
platformApiRoutes.get("/reports/revenue", async (c) => {
	const period = (c.req.query("period") || "daily") as "daily" | "weekly" | "monthly";
	const start = c.req.query("start") || "";
	const end = c.req.query("end") || "";
	const data = await getRevenueOverTime(c.env.DB, period, start, end);
	return c.json(data);
});

// Tenant growth
platformApiRoutes.get("/reports/tenant-growth", async (c) => {
	const data = await getTenantGrowth(c.env.DB);
	return c.json(data);
});

// Active tenants
platformApiRoutes.get("/reports/active-tenants", async (c) => {
	const days = parseInt(c.req.query("days") || "7", 10);
	const data = await getActiveTenants(c.env.DB, days);
	return c.json(data);
});

// Inactive tenants
platformApiRoutes.get("/reports/inactive-tenants", async (c) => {
	const days = parseInt(c.req.query("days") || "30", 10);
	const data = await getInactiveTenants(c.env.DB, days);
	return c.json(data);
});

// Top tenants by revenue
platformApiRoutes.get("/reports/top-tenants", async (c) => {
	const limit = parseInt(c.req.query("limit") || "10", 10);
	const start = c.req.query("start");
	const end = c.req.query("end");
	const data = await getTopTenantsByRevenue(c.env.DB, limit, start, end);
	return c.json(data);
});

// --- Cross-tenant views ---

// All users across tenants
platformApiRoutes.get("/users", async (c) => {
	const users = await getAllUsersAcrossTenants(c.env.DB);
	return c.json(users);
});

// Subscription details
platformApiRoutes.get("/subscriptions", async (c) => {
	const subs = await getSubscriptionDetails(c.env.DB);
	return c.json(subs);
});
