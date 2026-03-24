import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { validateJson } from "../../lib/request";
import { salesGoalSchema, salesGoalUpdateSchema } from "../../lib/validation";
import { auditLog } from "../../lib/logger";
import {
	createSalesGoal,
	updateSalesGoal,
	deleteSalesGoal,
	getSalesGoalById,
	getGoalsProgress,
	getRecentAchievements,
} from "../../db/queries/sales-goals";

export const salesGoalRoutes = new Hono<AppEnv>();

// View progress — all authenticated users with goals.view
salesGoalRoutes.get("/progress", requirePermission("goals.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const user = c.get("user");
	const goals = await getGoalsProgress(c.env.DB, tenantId, {
		userId: user?.id,
		activeOnly: true,
	});
	return c.json(goals);
});

// Return recently achieved goals (called by frontend after payment for celebration)
salesGoalRoutes.get("/check-achievements", requirePermission("goals.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const user = c.get("user");
	if (!user) return c.json({ achievements: [] });
	const achievements = await getRecentAchievements(c.env.DB, tenantId, user.id);
	return c.json({ achievements });
});

// Management endpoints — owner/manager only
salesGoalRoutes.use("/manage/*", requirePermission("goals.manage"));

salesGoalRoutes.get("/manage/list", async (c) => {
	const tenantId = c.get("tenant_id");
	const goals = await getGoalsProgress(c.env.DB, tenantId, { activeOnly: false });
	return c.json(goals);
});

salesGoalRoutes.post("/manage", async (c) => {
	const tenantId = c.get("tenant_id");
	const user = c.get("user");
	if (!user) return c.json({ error: "Nao autorizado" }, 401);

	const body = await validateJson(c, salesGoalSchema);

	if (body.start_date > body.end_date) {
		return c.json({ error: "Data inicio deve ser anterior a data fim" }, 400);
	}

	const goal = await createSalesGoal(c.env.DB, {
		tenant_id: tenantId,
		title: body.title,
		goal_type: body.goal_type,
		period_type: body.period_type,
		target_value: body.target_value,
		user_id: body.user_id ?? null,
		start_date: body.start_date,
		end_date: body.end_date,
		created_by: user.id,
	});

	await auditLog(c, "goal.create", "sales_goal", String(goal.id), {
		title: goal.title,
		goal_type: goal.goal_type,
		target_value: goal.target_value,
	});

	return c.json(goal, 201);
});

salesGoalRoutes.put("/manage/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));
	const body = await validateJson(c, salesGoalUpdateSchema);

	const updates: Record<string, unknown> = {};
	if (body.title !== undefined) updates.title = body.title;
	if (body.target_value !== undefined) updates.target_value = body.target_value;
	if (body.active !== undefined) updates.active = body.active ? 1 : 0;
	if (body.start_date !== undefined) updates.start_date = body.start_date;
	if (body.end_date !== undefined) updates.end_date = body.end_date;

	const goal = await updateSalesGoal(c.env.DB, id, tenantId, updates);
	if (!goal) return c.json({ error: "Meta nao encontrada" }, 404);

	await auditLog(c, "goal.update", "sales_goal", String(id), updates);
	return c.json(goal);
});

salesGoalRoutes.delete("/manage/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const id = Number(c.req.param("id"));

	const goal = await getSalesGoalById(c.env.DB, id, tenantId);
	if (!goal) return c.json({ error: "Meta nao encontrada" }, 404);

	await deleteSalesGoal(c.env.DB, id, tenantId);
	await auditLog(c, "goal.delete", "sales_goal", String(id), { title: goal.title });
	return c.json({ ok: true });
});
