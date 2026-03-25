import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import type { Tenant } from "../db/schema";
import { setTimezone } from "../lib/timezone";

/**
 * Extract tenant slug from a host if it's a subdomain of the given domain.
 * Returns null if host is the bare domain (landing page) or not a match.
 */
function extractSlug(host: string, domain: string): string | null {
	if (host === domain || host === `www.${domain}`) return null;
	if (!host.endsWith(`.${domain}`)) return null;
	return host.replace(`.${domain}`, "");
}

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

	const appDomain = (c.env.APP_DOMAIN || "giro-kids.com").toLowerCase();
	const legacyDomain = (c.env.APP_DOMAIN_LEGACY || "").toLowerCase();

	// ── Legacy domain redirect ──
	// {slug}.dadosinteligentes.app.br → 301 → {slug}.giro-kids.com
	// dadosinteligentes.app.br → 301 → giro-kids.com
	if (legacyDomain && (host === legacyDomain || host === `www.${legacyDomain}` || host.endsWith(`.${legacyDomain}`))) {
		const slug = extractSlug(host, legacyDomain);
		const url = new URL(c.req.url);
		url.hostname = slug ? `${slug}.${appDomain}` : appDomain;
		url.port = "";
		return c.redirect(url.toString(), 301);
	}

	// ── Primary domain ──
	const slug = extractSlug(host, appDomain);

	// Bare domain (giro-kids.com) — no tenant needed, serves landing page
	if (!slug) {
		return next();
	}

	// Subdomain — resolve tenant by slug
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
