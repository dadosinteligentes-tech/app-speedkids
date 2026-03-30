import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getCustomers, getCustomerById, searchCustomers, searchByPhone, createCustomer, updateCustomer, getCustomerHistory } from "../../db/queries/customers";
import { getChildrenByCustomer, createChild } from "../../db/queries/children";
import { requirePermission } from "../../middleware/require-permission";
import { auditLog } from "../../lib/logger";

export const customerRoutes = new Hono<AppEnv>();

// Search endpoint (used by dashboard customer selector)
customerRoutes.get("/search", async (c) => {
	const tenantId = c.get('tenant_id');
	const q = c.req.query("q") ?? "";
	if (q.length < 2) return c.json([]);
	const customers = await searchCustomers(c.env.DB, tenantId, q);
	return c.json(customers);
});

// Phone lookup (used by identification form on dashboard)
customerRoutes.get("/phone/:phone", async (c) => {
	const tenantId = c.get('tenant_id');
	const phone = c.req.param("phone");
	if (!phone || phone.length < 10) return c.json(null);
	const customer = await searchByPhone(c.env.DB, tenantId, phone);
	if (!customer) return c.json(null);
	const children = await getChildrenByCustomer(c.env.DB, customer.id);
	return c.json({ customer, children });
});

customerRoutes.get("/", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get('tenant_id');
	const page = Number(c.req.query("page") ?? "1");
	const limit = 50;
	const offset = (page - 1) * limit;
	const result = await getCustomers(c.env.DB, tenantId, limit, offset);
	return c.json(result);
});

customerRoutes.get("/:id", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get('tenant_id');
	const customer = await getCustomerById(c.env.DB, tenantId, Number(c.req.param("id")));
	if (!customer) return c.json({ error: "Customer not found" }, 404);
	return c.json(customer);
});

customerRoutes.get("/:id/history", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const page = Number(c.req.query("page") ?? "1");
	const limit = 20;
	const offset = (page - 1) * limit;
	const result = await getCustomerHistory(c.env.DB, tenantId, id, limit, offset);
	return c.json(result);
});

customerRoutes.post("/", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await c.req.json<{ name: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string }>();
	if (!body.name?.trim()) return c.json({ error: "Nome é obrigatório" }, 400);

	const customer = await createCustomer(c.env.DB, { ...body, tenant_id: tenantId });
	await auditLog(c, "customer.create", "customer", customer?.id, { name: body.name });
	return c.json(customer, 201);
});

customerRoutes.put("/:id", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ name?: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string }>();

	const customer = await updateCustomer(c.env.DB, tenantId, id, body);
	if (!customer) return c.json({ error: "Customer not found" }, 404);

	await auditLog(c, "customer.update", "customer", id);
	return c.json(customer);
});

// Quick-update from dashboard (all operators — only email, cpf, instagram)
customerRoutes.put("/quick/:id", async (c) => {
	const tenantId = c.get('tenant_id');
	const id = Number(c.req.param("id"));
	const body = await c.req.json<{ name?: string; email?: string; cpf?: string; instagram?: string }>();

	const cpf = body.cpf?.replace(/\D/g, "") || undefined;
	const instagram = body.instagram?.replace(/^@/, "").trim() || undefined;
	const email = body.email?.trim() || undefined;

	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return c.json({ error: "Formato de email inválido" }, 400);
	}

	const customer = await updateCustomer(c.env.DB, tenantId, id, {
		name: body.name, email, cpf, instagram,
	});
	if (!customer) return c.json({ error: "Customer not found" }, 404);
	return c.json(customer);
});

// Quick-create from dashboard (all operators can do this)
customerRoutes.post("/quick", async (c) => {
	const tenantId = c.get('tenant_id');
	const body = await c.req.json<{ name: string; phone?: string; cpf?: string; instagram?: string; email?: string }>();
	if (!body.name?.trim()) return c.json({ error: "Nome é obrigatório" }, 400);

	// Strip mask characters from phone, store raw digits only
	const phone = body.phone?.replace(/\D/g, "") || undefined;
	const cpf = body.cpf?.replace(/\D/g, "") || undefined;
	const instagram = body.instagram?.replace(/^@/, "").trim() || undefined;
	const email = body.email?.trim() || undefined;

	const customer = await createCustomer(c.env.DB, { name: body.name, phone, cpf, instagram, email, tenant_id: tenantId });
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
