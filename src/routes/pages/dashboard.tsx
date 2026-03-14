import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAssets } from "../../db/queries/assets";
import { getActivePackages } from "../../db/queries/packages";
import { getActiveSessions } from "../../db/queries/rentals";
import { getCashStatus } from "../../lib/cash-status";
import { Dashboard } from "../../views/dashboard";

export const dashboardPages = new Hono<AppEnv>();

dashboardPages.get("/", async (c) => {
	const user = c.get("user");
	const [assets, packages, sessions, cashStatus] = await Promise.all([
		getAssets(c.env.DB),
		getActivePackages(c.env.DB),
		getActiveSessions(c.env.DB),
		user ? getCashStatus(c.env.DB) : Promise.resolve(null),
	]);
	return c.html(<Dashboard assets={assets} packages={packages} sessions={sessions} user={user} cashStatus={cashStatus} />);
});
