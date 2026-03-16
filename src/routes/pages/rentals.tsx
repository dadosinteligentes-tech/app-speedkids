import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets } from "../../db/queries/assets";
import { getActivePackages } from "../../db/queries/packages";
import { getActiveSessions } from "../../db/queries/rentals";
import { getCashStatus } from "../../lib/cash-status";
import { getInstalledBatteries } from "../../db/queries/batteries";
import { getBusinessConfig } from "../../db/queries/business-config";
import { Dashboard } from "../../views/dashboard";

export const rentalPages = new Hono<AppEnv>();

rentalPages.get("/", async (c) => {
	const user = c.get("user");
	const [assets, packages, sessions, cashStatus, batteries, bizConfig] = await Promise.all([
		getAssets(c.env.DB),
		getActivePackages(c.env.DB),
		getActiveSessions(c.env.DB),
		user ? getCashStatus(c.env.DB) : Promise.resolve(null),
		getInstalledBatteries(c.env.DB),
		getBusinessConfig(c.env.DB),
	]);
	return c.html(
		<Dashboard
			assets={assets}
			packages={packages}
			sessions={sessions}
			user={user}
			cashStatus={cashStatus}
			batteries={batteries}
			pageTitle="Controle de Locações"
			receiptEnabled={!!bizConfig?.name}
		/>,
	);
});
