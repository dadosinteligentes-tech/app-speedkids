import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { Tenant } from "../db/schema";
import { setTimezone } from "../lib/timezone";

export const tenantMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const host = c.req.header("host") || "";
	const slug = host.split(".")[0];

	// For local dev / test, fall back to tenant 1
	const isLocalDev = host.includes("localhost") || host.includes("127.0.0.1") || !host.includes(".");

	if (isLocalDev) {
		try {
			const tenant = await c.env.DB.prepare("SELECT * FROM tenants WHERE id = 1").first<Tenant>();
			if (tenant) {
				c.set("tenant", tenant);
				c.set("tenant_id", tenant.id);
				setTimezone(tenant.timezone);
			}
		} catch {
			// tenants table may not exist yet (e.g. during migration)
		}
		return next();
	}

	if (!slug) {
		return c.text("Tenant not found", 404);
	}

	const tenant = await c.env.DB.prepare(
		"SELECT * FROM tenants WHERE slug = ? AND status = 'active'",
	)
		.bind(slug)
		.first<Tenant>();

	if (!tenant) {
		return c.text("Tenant not found", 404);
	}

	c.set("tenant", tenant);
	c.set("tenant_id", tenant.id);
	setTimezone(tenant.timezone);
	return next();
});
