import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Middleware that restricts access to platform admin routes.
 * Checks if the authenticated user's email is in the PLATFORM_ADMIN_EMAILS env var.
 */
export const platformAdminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		const path = new URL(c.req.url).pathname;
		if (path.startsWith("/api/")) return c.json({ error: "Unauthorized" }, 401);
		return c.redirect("/login");
	}

	const adminEmails = (c.env.PLATFORM_ADMIN_EMAILS || "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean);

	if (!adminEmails.includes(user.email.toLowerCase())) {
		const path = new URL(c.req.url).pathname;
		if (path.startsWith("/api/")) return c.json({ error: "Forbidden" }, 403);
		return c.text("Acesso restrito", 403);
	}

	return next();
});
