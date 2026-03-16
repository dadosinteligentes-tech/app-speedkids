import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { getAllAssets } from "../../db/queries/assets";
import { getAssetTypes } from "../../db/queries/asset-types";
import { getAllPackages } from "../../db/queries/packages";
import { listUsers } from "../../db/queries/users";
import { AssetsList } from "../../views/admin/assets-list";
import { PackagesList } from "../../views/admin/packages-list";
import { UsersList } from "../../views/admin/users-list";
import { OperationLogs } from "../../views/admin/operation-logs";
import { getLogs } from "../../db/queries/logs";
import { getCustomers } from "../../db/queries/customers";
import { CustomerList } from "../../views/customers/customer-list";
import { getBatteries } from "../../db/queries/batteries";
import { BatteriesList } from "../../views/admin/batteries-list";
import { getBusinessConfig } from "../../db/queries/business-config";
import { BusinessSettings } from "../../views/admin/business-settings";

export const adminPages = new Hono<AppEnv>();

// All admin pages require manager+ role
adminPages.use("*", requireRole("manager", "owner"));

// Redirect /admin to /admin/assets
adminPages.get("/", (c) => c.redirect("/admin/assets"));

adminPages.get("/assets", async (c) => {
	const [assets, assetTypes] = await Promise.all([
		getAllAssets(c.env.DB),
		getAssetTypes(c.env.DB),
	]);
	const user = c.get("user");
	return c.html(<AssetsList assets={assets} assetTypes={assetTypes} user={user} />);
});

adminPages.get("/packages", async (c) => {
	const packages = await getAllPackages(c.env.DB);
	const user = c.get("user");
	return c.html(<PackagesList packages={packages} user={user} />);
});

adminPages.get("/logs", async (c) => {
	const page = Number(c.req.query("page")) || 1;
	const entityType = c.req.query("entity_type") || undefined;
	const perPage = 50;
	const { logs, total } = await getLogs(c.env.DB, { entity_type: entityType, limit: perPage, offset: (page - 1) * perPage });
	const user = c.get("user");
	return c.html(<OperationLogs logs={logs} total={total} page={page} user={user} />);
});

adminPages.get("/customers", async (c) => {
	const page = Number(c.req.query("page") ?? "1");
	const { customers, total } = await getCustomers(c.env.DB, 50, (page - 1) * 50);
	const user = c.get("user");
	return c.html(<CustomerList customers={customers} total={total} page={page} user={user ?? null} />);
});

adminPages.get("/batteries", async (c) => {
	const [batteries, assets] = await Promise.all([
		getBatteries(c.env.DB),
		getAllAssets(c.env.DB),
	]);
	const user = c.get("user");
	const batteryAssets = assets.filter((a) => a.uses_battery && a.status !== "retired");
	return c.html(<BatteriesList batteries={batteries} assets={batteryAssets} user={user} />);
});

// Users page requires owner role
adminPages.get("/users", requireRole("owner"), async (c) => {
	const users = await listUsers(c.env.DB);
	const user = c.get("user");
	const safeUsers = users.map(({ password_hash, salt, ...rest }) => rest);
	return c.html(<UsersList users={safeUsers} user={user} />);
});

// Business settings requires owner role
adminPages.get("/settings", requireRole("owner"), async (c) => {
	const config = await getBusinessConfig(c.env.DB);
	const user = c.get("user");
	return c.html(<BusinessSettings config={config} user={user} />);
});
