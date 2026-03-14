import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requireRole } from "../../middleware/require-role";
import { getCustomers, getCustomerById, getCustomerHistory } from "../../db/queries/customers";
import { CustomerList } from "../../views/customers/customer-list";
import { CustomerDetail } from "../../views/customers/customer-detail";

export const customerPages = new Hono<AppEnv>();

customerPages.get("/", requireRole("manager", "owner"), async (c) => {
	const user = c.get("user");
	const page = Number(c.req.query("page") ?? "1");
	const { customers, total } = await getCustomers(c.env.DB, 50, (page - 1) * 50);
	return c.html(<CustomerList customers={customers} total={total} page={page} user={user ?? null} />);
});

customerPages.get("/:id", requireRole("manager", "owner"), async (c) => {
	const user = c.get("user");
	const id = Number(c.req.param("id"));
	const customer = await getCustomerById(c.env.DB, id);
	if (!customer) return c.redirect("/admin/customers");

	const { sessions, total } = await getCustomerHistory(c.env.DB, id);
	return c.html(<CustomerDetail customer={customer} sessions={sessions} totalSessions={total} user={user ?? null} />);
});
