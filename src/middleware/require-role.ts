import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

export function requireRole(...roles: string[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const user = c.get("user");
		if (!user) {
			if (c.req.path.startsWith("/api/")) {
				return c.json({ error: "Unauthorized" }, 401);
			}
			return c.redirect("/login");
		}

		if (!roles.includes(user.role)) {
			if (c.req.path.startsWith("/api/")) {
				return c.json({ error: "Forbidden" }, 403);
			}
			return c.redirect("/");
		}

		return next();
	});
}
