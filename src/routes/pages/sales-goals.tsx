import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { getGoalsProgress } from "../../db/queries/sales-goals";
import { getGoalsReport } from "../../db/queries/sales-goals";
import { listUsers } from "../../db/queries/users";
import { SalesGoalsManage } from "../../views/admin/sales-goals";
import { SalesGoalsReportView } from "../../views/reports/sales-goals-report";
import { todayISO, daysAgoISO } from "../../lib/report-utils";

export const salesGoalPages = new Hono<AppEnv>();

// Management page
salesGoalPages.get("/", requirePermission("goals.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const user = c.get("user");

	const [goals, users] = await Promise.all([
		getGoalsProgress(c.env.DB, tenantId, { activeOnly: false }),
		listUsers(c.env.DB, tenantId),
	]);

	const safeUsers = users.map(({ password_hash, salt, ...rest }) => rest);

	return c.html(
		<SalesGoalsManage
			goals={goals}
			users={safeUsers}
			user={user}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin}
		/>,
	);
});

// Report page (inside reports section)
salesGoalPages.get("/report", requirePermission("goals.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const isPlatformAdmin = c.get("isPlatformAdmin");
	const user = c.get("user");
	const from = c.req.query("from") ?? daysAgoISO(30);
	const to = c.req.query("to") ?? todayISO();

	const goals = await getGoalsReport(c.env.DB, tenantId, from, to);

	return c.html(
		<SalesGoalsReportView
			goals={goals}
			from={from}
			to={to}
			user={user}
			tenant={tenant}
			isPlatformAdmin={isPlatformAdmin}
		/>,
	);
});
