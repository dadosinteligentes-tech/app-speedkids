import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { getCustomers, getCustomerById, getCustomerHistory } from "../../db/queries/customers";
import { CustomerList } from "../../views/customers/customer-list";
import { CustomerDetail } from "../../views/customers/customer-detail";
import { getPlanDefinitions } from "../../db/queries/platform";

export const customerPages = new Hono<AppEnv>();

customerPages.use("*", async (c, next) => {
	const tenant = c.get("tenant");
	if (tenant) {
		const plans = await getPlanDefinitions(c.env.DB);
		const cfg = plans[tenant.plan];
		c.set("_planFeatures", { hasLoyalty: cfg?.hasLoyalty ?? false, hasTickets: cfg?.hasTickets ?? false });
	}
	return next();
});

customerPages.get("/", requirePermission("customers.view"), async (c) => {
	const user = c.get("user");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const planFeatures = c.get("_planFeatures");
	const tenantId = c.get("tenant_id");
	const page = Number(c.req.query("page") ?? "1");
	const { customers, total } = await getCustomers(c.env.DB, tenantId, 50, (page - 1) * 50);
	return c.html(<CustomerList customers={customers} total={total} page={page} user={user ?? null} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures} />);
});

customerPages.get("/:id", requirePermission("customers.view"), async (c) => {
	const user = c.get("user");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const planFeatures = c.get("_planFeatures");
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));
	const customer = await getCustomerById(c.env.DB, tenantId, id);
	if (!customer) return c.redirect("/admin/customers");

	const { sessions, total } = await getCustomerHistory(c.env.DB, tenantId, id);
	return c.html(<CustomerDetail customer={customer} sessions={sessions} totalSessions={total} user={user ?? null} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures} />);
});
