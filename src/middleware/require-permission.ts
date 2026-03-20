import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { getPermissionsForRole } from "../db/queries/permissions";

export function requirePermission(...keys: string[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const user = c.get("user");
		if (!user) {
			if (c.req.path.startsWith("/api/")) {
				return c.json({ error: "Unauthorized" }, 401);
			}
			return c.redirect("/login");
		}

		// Load role permissions once per request (cached in context)
		let perms = c.get("_rolePermissions");
		if (!perms) {
			perms = await getPermissionsForRole(c.env.DB, user.role);
			c.set("_rolePermissions", perms);
		}

		const hasAny = keys.some((key) => perms!.includes(key));

		if (!hasAny) {
			if (c.req.path.startsWith("/api/")) {
				return c.json({ error: "Forbidden" }, 403);
			}
			return c.redirect("/");
		}

		return next();
	});
}
