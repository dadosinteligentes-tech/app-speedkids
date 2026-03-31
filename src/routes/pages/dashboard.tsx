import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets } from "../../db/queries/assets";
import { getActivePackages } from "../../db/queries/packages";
import { getActiveSessions } from "../../db/queries/rentals";
import { getCashStatus } from "../../lib/cash-status";
import { getInstalledBatteries } from "../../db/queries/batteries";
import { getPermissionsForRole } from "../../db/queries/permissions";
import { Dashboard } from "../../views/dashboard";
import { SetupWizard } from "../../views/setup/wizard";

export const dashboardPages = new Hono<AppEnv>();

dashboardPages.get("/", async (c) => {
	const user = c.get("user");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const tenantId = c.get("tenant_id");

	// Redirect new tenants to setup wizard
	if (tenant && !tenant.setup_completed && user?.role === "owner") {
		const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";
		return c.html(<SetupWizard tenant={tenant} domain={domain} />);
	}
	const [assets, packages, sessions, cashStatus, batteries, userPermissions] = await Promise.all([
		getAssets(c.env.DB, tenantId),
		getActivePackages(c.env.DB, tenantId),
		getActiveSessions(c.env.DB, tenantId),
		user ? getCashStatus(c.env.DB, tenantId) : Promise.resolve(null),
		getInstalledBatteries(c.env.DB, tenantId),
		user ? getPermissionsForRole(c.env.DB, user.role) : Promise.resolve([]),
	]);
	return c.html(<Dashboard assets={assets} packages={packages} sessions={sessions} user={user} cashStatus={cashStatus} batteries={batteries} tenant={tenant} isPlatformAdmin={isPlatformAdmin} userPermissions={userPermissions} />);
});
