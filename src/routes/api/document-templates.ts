import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import {
	listTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
} from "../../db/queries/document-templates";

export const documentTemplateRoutes = new Hono<AppEnv>();

documentTemplateRoutes.get("/", async (c) => {
	const tenantId = c.get("tenant_id");
	const templates = await listTemplates(c.env.DB, tenantId);
	return c.json(templates);
});

documentTemplateRoutes.get("/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const id = parseInt(c.req.param("id"), 10);
	const template = await getTemplateById(c.env.DB, tenantId, id);
	if (!template) return c.json({ error: "Template não encontrado" }, 404);
	return c.json(template);
});

documentTemplateRoutes.post("/", requirePermission("documents.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const body = await c.req.json<{ name: string; content: string; description?: string; print_mode?: string; is_active?: boolean; sort_order?: number }>();
	if (!body.name?.trim() || !body.content?.trim()) {
		return c.json({ error: "Nome e conteúdo são obrigatórios" }, 400);
	}
	const template = await createTemplate(c.env.DB, tenantId, {
		name: body.name.trim(),
		content: body.content,
		description: body.description?.trim(),
		print_mode: body.print_mode,
		is_active: body.is_active,
		sort_order: body.sort_order,
	});
	return c.json(template, 201);
});

documentTemplateRoutes.put("/:id", requirePermission("documents.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const id = parseInt(c.req.param("id"), 10);
	const existing = await getTemplateById(c.env.DB, tenantId, id);
	if (!existing) return c.json({ error: "Template não encontrado" }, 404);
	const body = await c.req.json();
	await updateTemplate(c.env.DB, tenantId, id, body);
	return c.json({ ok: true });
});

documentTemplateRoutes.delete("/:id", requirePermission("documents.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const id = parseInt(c.req.param("id"), 10);
	await deleteTemplate(c.env.DB, tenantId, id);
	return c.json({ ok: true });
});
