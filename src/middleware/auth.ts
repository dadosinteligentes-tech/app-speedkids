import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../types";
import { getAuthSession } from "../db/queries/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/platform-login", "/api/signup", "/api/stripe/webhook", "/api/blog", "/api/media", "/landing", "/signup", "/platform/login", "/legal", "/blog", "/loyalty"];

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const path = new URL(c.req.url).pathname;

	// Skip auth for public paths
	if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
		return next();
	}

	const tenant = c.get("tenant");
	const sessionId = getCookie(c, "sk_session");

	// No tenant = bare domain (e.g. giro-kids.com)
	if (!tenant) {
		if (path === "/" || path === "") {
			// If logged in as platform admin, go to dashboard; otherwise landing
			if (sessionId) {
				const session = await getAuthSession(c.env.DB, sessionId);
				if (session) {
					return c.redirect("/platform");
				}
			}
			return c.redirect("/landing");
		}
	}

	if (!sessionId) {
		if (path.startsWith("/api/")) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		return c.redirect("/login");
	}

	const session = await getAuthSession(c.env.DB, sessionId);

	if (!session) {
		// Clear invalid cookie
		setCookie(c, "sk_session", "", { path: "/", maxAge: 0 });
		if (path.startsWith("/api/")) {
			return c.json({ error: "Session expired" }, 401);
		}
		return c.redirect("/login");
	}

	c.set("user", {
		id: session.user_id,
		name: session.user_name,
		email: session.user_email,
		role: session.user_role,
		tenant_id: session.user_tenant_id,
	});

	const adminEmails = (c.env.PLATFORM_ADMIN_EMAILS || "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);
	c.set("isPlatformAdmin", adminEmails.includes(session.user_email.toLowerCase()));

	return next();
});
