import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { requirePermission } from "../../middleware/require-permission";
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
import { getAllPermissions, getAllRolePermissions } from "../../db/queries/permissions";
import { PermissionsMatrix } from "../../views/admin/permissions-matrix";
import { MyPlan } from "../../views/admin/my-plan";
import { getLimitsForPlan, getTenantUsage } from "../../lib/plan-limits";
import { getPlanDefinitions } from "../../db/queries/platform";
import { getPromotionUsageStats } from "../../db/queries/promotions";
import { PromotionsList } from "../../views/admin/promotions-list";
import { listTemplates } from "../../db/queries/document-templates";
import { DocumentTemplatesPage } from "../../views/admin/document-templates";

export const adminPages = new Hono<AppEnv>();

// All admin pages require manager+ role
adminPages.use("*", requireRole("manager", "owner"));

// Redirect /admin to /admin/assets
adminPages.get("/", (c) => c.redirect("/admin/assets"));

adminPages.get("/assets", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const [assets, assetTypes] = await Promise.all([
		getAllAssets(c.env.DB, tenantId),
		getAssetTypes(c.env.DB, tenantId),
	]);
	const user = c.get("user");
	return c.html(<AssetsList assets={assets} assetTypes={assetTypes} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

adminPages.get("/packages", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const packages = await getAllPackages(c.env.DB, tenantId);
	const user = c.get("user");
	return c.html(<PackagesList packages={packages} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

adminPages.get("/logs", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const page = Number(c.req.query("page")) || 1;
	const entityType = c.req.query("entity_type") || undefined;
	const perPage = 50;
	const { logs, total } = await getLogs(c.env.DB, tenantId, { entity_type: entityType, limit: perPage, offset: (page - 1) * perPage });
	const user = c.get("user");
	return c.html(<OperationLogs logs={logs} total={total} page={page} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

adminPages.get("/customers", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const page = Number(c.req.query("page") ?? "1");
	const { customers, total } = await getCustomers(c.env.DB, tenantId, 50, (page - 1) * 50);
	const user = c.get("user");
	return c.html(<CustomerList customers={customers} total={total} page={page} user={user ?? null} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

adminPages.get("/batteries", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const [batteries, assets] = await Promise.all([
		getBatteries(c.env.DB, tenantId),
		getAllAssets(c.env.DB, tenantId),
	]);
	const user = c.get("user");
	const batteryAssets = assets.filter((a) => a.uses_battery && a.status !== "retired");
	return c.html(<BatteriesList batteries={batteries} assets={batteryAssets} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

// Users page requires users.manage permission
adminPages.get("/users", requirePermission("users.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const users = await listUsers(c.env.DB, tenantId);
	const user = c.get("user");
	const safeUsers = users.map(({ password_hash, salt, ...rest }) => rest);
	return c.html(<UsersList users={safeUsers} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

// Permissions matrix requires owner role (hardcoded to prevent lock-out)
adminPages.get("/permissions", requireRole("owner"), async (c) => {
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const [permissions, rolePermissions] = await Promise.all([
		getAllPermissions(c.env.DB),
		getAllRolePermissions(c.env.DB),
	]);
	const user = c.get("user");
	return c.html(<PermissionsMatrix permissions={permissions} rolePermissions={rolePermissions} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

// Promotions management
adminPages.get("/promotions", requirePermission("promotions.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const promotions = await getPromotionUsageStats(c.env.DB, tenantId);
	const user = c.get("user");
	return c.html(<PromotionsList promotions={promotions} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

// Document templates
adminPages.get("/documents", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const user = c.get("user");
	const templates = await listTemplates(c.env.DB, tenantId);
	return c.html(<DocumentTemplatesPage templates={templates} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});

// My plan page
adminPages.get("/plan", async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const limits = getLimitsForPlan(tenant?.plan || "starter");
	const [usage, plans, subscription] = await Promise.all([
		getTenantUsage(c.env.DB, tenantId),
		getPlanDefinitions(c.env.DB),
		c.env.DB.prepare("SELECT stripe_customer_id, plan, status FROM subscriptions WHERE tenant_id = ? LIMIT 1")
			.bind(tenantId).first<{ stripe_customer_id: string | null; plan: string; status: string }>(),
	]);
	const user = c.get("user");
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	return c.html(<MyPlan tenant={tenant} limits={limits} usage={usage} user={user} isPlatformAdmin={isPlatformAdmin}
		plans={plans} hasStripeSubscription={!!subscription?.stripe_customer_id} domain={domain} />);
});

// Business settings requires settings.manage permission
adminPages.get("/settings", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const config = await getBusinessConfig(c.env.DB, tenantId);
	const user = c.get("user");
	return c.html(<BusinessSettings config={config} user={user} tenant={tenant} isPlatformAdmin={isPlatformAdmin} />);
});
