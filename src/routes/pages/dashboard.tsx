import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets } from "../../db/queries/assets";
import { getActivePackages } from "../../db/queries/packages";
import { getActiveSessions } from "../../db/queries/rentals";
import { getCashStatus } from "../../lib/cash-status";
import { getInstalledBatteries } from "../../db/queries/batteries";
import { Dashboard } from "../../views/dashboard";

export const dashboardPages = new Hono<AppEnv>();

dashboardPages.get("/", async (c) => {
	const user = c.get("user");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const tenantId = c.get("tenant_id");
	const [assets, packages, sessions, cashStatus, batteries] = await Promise.all([
		getAssets(c.env.DB, tenantId),
		getActivePackages(c.env.DB, tenantId),
		getActiveSessions(c.env.DB, tenantId),
		user ? getCashStatus(c.env.DB, tenantId) : Promise.resolve(null),
		getInstalledBatteries(c.env.DB, tenantId),
	]);
	return c.html(<Dashboard assets={assets} packages={packages} sessions={sessions} user={user} cashStatus={cashStatus} batteries={batteries} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});
