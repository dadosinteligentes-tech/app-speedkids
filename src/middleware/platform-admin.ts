import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Middleware that restricts access to platform admin routes.
 * Grants access if:
 * 1. User belongs to the _platform tenant (DB-driven, self-service), OR
 * 2. User's email is in PLATFORM_ADMIN_EMAILS env var (bootstrap fallback)
 */
export const platformAdminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		const path = new URL(c.req.url).pathname;
		if (path.startsWith("/api/")) return c.json({ error: "Unauthorized" }, 401);
		return c.redirect("/login");
	}

	// Check 1: user belongs to _platform tenant
	const platformTenant = await c.env.DB
		.prepare("SELECT id FROM tenants WHERE slug = '_platform'")
		.first<{ id: number }>();

	if (platformTenant && user.tenant_id === platformTenant.id) {
		return next();
	}

	// Check 2: email in env var (fallback for bootstrap)
	const adminEmails = (c.env.PLATFORM_ADMIN_EMAILS || "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);

	if (adminEmails.includes(user.email.toLowerCase())) {
		return next();
	}

	const path = new URL(c.req.url).pathname;
	if (path.startsWith("/api/")) return c.json({ error: "Forbidden" }, 403);
	return c.text("Acesso restrito", 403);
});
