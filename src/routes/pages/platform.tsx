import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { platformAdminMiddleware } from "../../middleware/platform-admin";
import { getPlatformStats, getAllTenants } from "../../db/queries/platform";
import { PlatformDashboard } from "../../views/platform/dashboard";

export const platformPages = new Hono<AppEnv>();

platformPages.use("*", platformAdminMiddleware);

platformPages.get("/", async (c) => {
	const [stats, tenants] = await Promise.all([
		getPlatformStats(c.env.DB),
		getAllTenants(c.env.DB),
	]);

	const user = c.get("user");
	const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";

	return c.html(
		<PlatformDashboard stats={stats} tenants={tenants} user={user} domain={domain} />
	);
});
