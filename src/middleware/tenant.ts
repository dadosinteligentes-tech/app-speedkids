import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { Tenant } from "../db/schema";
import { setTimezone } from "../lib/timezone";

export const tenantMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const host = (c.req.header("host") || "").toLowerCase();

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

	const appDomain = (c.env.APP_DOMAIN || "dadosinteligentes.app.br").toLowerCase();
	const isSubdomain = host.endsWith(`.${appDomain}`);

	let tenant: Tenant | null = null;

	if (isSubdomain) {
		// Extract slug from subdomain (e.g. speedykids.dadosinteligentes.app.br → speedykids)
		const slug = host.replace(`.${appDomain}`, "");

		tenant = await c.env.DB.prepare(
			"SELECT * FROM tenants WHERE slug = ? AND status = 'active'",
		)
			.bind(slug)
			.first<Tenant>();

		// If tenant has a custom domain, redirect to it
		if (tenant?.custom_domain) {
			const url = new URL(c.req.url);
			url.hostname = tenant.custom_domain;
			url.port = "";
			return c.redirect(url.toString(), 301);
		}
	} else {
		// Not a subdomain — try to resolve by custom domain
		tenant = await c.env.DB.prepare(
			"SELECT * FROM tenants WHERE custom_domain = ? AND status = 'active'",
		)
			.bind(host)
			.first<Tenant>();
	}

	if (!tenant) {
		return c.text("Tenant not found", 404);
	}

	c.set("tenant", tenant);
	c.set("tenant_id", tenant.id);
	setTimezone(tenant.timezone);
	return next();
});
