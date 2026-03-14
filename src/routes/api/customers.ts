import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getCustomers, getCustomerById, searchCustomers, searchByPhone, createCustomer, updateCustomer, getCustomerHistory } from "../../db/queries/customers";
import { getChildrenByCustomer, createChild } from "../../db/queries/children";
import { requireRole } from "../../middleware/require-role";
import { auditLog } from "../../lib/logger";

export const customerRoutes = new Hono<AppEnv>();

// Search endpoint (used by dashboard customer selector)
customerRoutes.get("/search", async (c) => {
	const q = c.req.query("q") ?? "";
	if (q.length < 2) return c.json([]);
	const customers = await searchCustomers(c.env.DB, q);
	return c.json(customers);
});

// Phone lookup (used by identification form on dashboard)
customerRoutes.get("/phone/:phone", async (c) => {
	const phone = c.req.param("phone");
	if (!phone || phone.length < 10) return c.json(null);
	const customer = await searchByPhone(c.env.DB, phone);
	if (!customer) return c.json(null);
	const children = await getChildrenByCustomer(c.env.DB, customer.id);
	return c.json({ customer, children });
});

customerRoutes.get("/", requireRole("manager", "owner"), async (c) => {
	const page = Number(c.req.query("page") ?? "1");
	const limit = 50;
	const offset = (page - 1) * limit;
	const result = await getCustomers(c.env.DB, limit, offset);
	return c.json(result);
});

customerRoutes.get("/:id", requireRole("manager", "owner"), async (c) => {
	const customer = await getCustomerById(c.env.DB, Number(c.req.param("id")));
	if (!customer) return c.json({ error: "Customer not found" }, 404);
	return c.json(customer);
});

customerRoutes.get("/:id/history", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const page = Number(c.req.query("page") ?? "1");
	const limit = 20;
	const offset = (page - 1) * limit;
	const result = await getCustomerHistory(c.env.DB, id, limit, offset);
	return c.json(result);
});

customerRoutes.post("/", requireRole("manager", "owner"), async (c) => {
	const body = await c.req.json<{ name: string; phone?: string; email?: string; notes?: string }>();
	if (!body.name?.trim()) return c.json({ error: "Nome é obrigatório" }, 400);

	const customer = await createCustomer(c.env.DB, body);
	await auditLog(c, "customer.create", "customer", customer?.id, { name: body.name });
	return c.json(customer, 201);
});

customerRoutes.put("/:id", requireRole("manager", "owner"), async (c) => {
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ name?: string; phone?: string; email?: string; notes?: string }>();

	const customer = await updateCustomer(c.env.DB, id, body);
	if (!customer) return c.json({ error: "Customer not found" }, 404);

	await auditLog(c, "customer.update", "customer", id);
	return c.json(customer);
});

// Quick-create from dashboard (all operators can do this)
customerRoutes.post("/quick", async (c) => {
	const body = await c.req.json<{ name: string; phone?: string }>();
	if (!body.name?.trim()) return c.json({ error: "Nome é obrigatório" }, 400);

	// Strip mask characters from phone, store raw digits only
	const phone = body.phone?.replace(/\D/g, "") || undefined;

	const customer = await createCustomer(c.env.DB, { name: body.name, phone });
	await auditLog(c, "customer.create", "customer", customer?.id, { name: body.name });
	return c.json(customer, 201);
});

// Add child to existing customer
customerRoutes.post("/:id/children", async (c) => {
	const customerId = Number(c.req.param("id"));
	const body = await c.req.json<{ name: string; age: number; birth_date?: string }>();
	if (!body.name?.trim()) return c.json({ error: "Nome da criança é obrigatório" }, 400);
	if (!body.age || body.age < 0) return c.json({ error: "Idade é obrigatória" }, 400);

	const child = await createChild(c.env.DB, {
		customer_id: customerId,
		name: body.name,
		age: body.age,
		birth_date: body.birth_date,
	});
	await auditLog(c, "child.create", "child", child?.id, { customer_id: customerId, name: body.name });
	return c.json(child, 201);
});
