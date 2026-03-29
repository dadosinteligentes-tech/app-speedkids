import type { SalesGoal, SalesGoalProgress, GoalAchievement } from "../schema";

/**
 * SQL fragments to convert tenant-date query params (YYYY-MM-DD) to UTC boundaries.
 * Uses fixed BRT offset (-3h, no DST since 2019).
 * from='2026-03-22' BRT → '2026-03-22 03:00:00' UTC
 * to  ='2026-03-22' BRT → '2026-03-23 03:00:00' UTC (exclusive upper bound)
 */
const DT_FROM = "datetime(?, '+3 hours')";
const DT_TO = "datetime(date(?, '+1 day'), '+3 hours')";

// ── CRUD ──

export async function createSalesGoal(
	db: D1Database,
	goal: Omit<SalesGoal, "id" | "created_at" | "updated_at" | "active">,
): Promise<SalesGoal> {
	const { results } = await db
		.prepare(
			`INSERT INTO sales_goals (tenant_id, title, goal_type, period_type, target_value, user_id, start_date, end_date, celebration_message, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`,
		)
		.bind(
			goal.tenant_id,
			goal.title,
			goal.goal_type,
			goal.period_type,
			goal.target_value,
			goal.user_id,
			goal.start_date,
			goal.end_date,
			goal.celebration_message ?? null,
			goal.created_by,
		)
		.all<SalesGoal>();
	return results[0];
}

export async function updateSalesGoal(
	db: D1Database,
	id: number,
	tenantId: number,
	updates: { title?: string; target_value?: number; active?: number; start_date?: string; end_date?: string; celebration_message?: string | null },
): Promise<SalesGoal | null> {
	const sets: string[] = [];
	const vals: unknown[] = [];
	if (updates.title !== undefined) { sets.push("title = ?"); vals.push(updates.title); }
	if (updates.target_value !== undefined) { sets.push("target_value = ?"); vals.push(updates.target_value); }
	if (updates.active !== undefined) { sets.push("active = ?"); vals.push(updates.active); }
	if (updates.start_date !== undefined) { sets.push("start_date = ?"); vals.push(updates.start_date); }
	if (updates.end_date !== undefined) { sets.push("end_date = ?"); vals.push(updates.end_date); }
	if (updates.celebration_message !== undefined) { sets.push("celebration_message = ?"); vals.push(updates.celebration_message); }
	if (sets.length === 0) return getSalesGoalById(db, id, tenantId);

	sets.push("updated_at = datetime('now')");
	vals.push(id, tenantId);

	const { results } = await db
		.prepare(`UPDATE sales_goals SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ? RETURNING *`)
		.bind(...vals)
		.all<SalesGoal>();
	return results[0] ?? null;
}

export async function deleteSalesGoal(db: D1Database, id: number, tenantId: number): Promise<boolean> {
	const result = await db
		.prepare("DELETE FROM sales_goals WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

export async function getSalesGoalById(db: D1Database, id: number, tenantId: number): Promise<SalesGoal | null> {
	return db
		.prepare("SELECT * FROM sales_goals WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.first<SalesGoal>();
}

export async function listSalesGoals(db: D1Database, tenantId: number, activeOnly = false): Promise<SalesGoal[]> {
	const where = activeOnly ? "AND sg.active = 1" : "";
	const { results } = await db
		.prepare(
			`SELECT sg.* FROM sales_goals sg
			 WHERE sg.tenant_id = ? ${where}
			 ORDER BY sg.active DESC, sg.end_date DESC, sg.created_at DESC`,
		)
		.bind(tenantId)
		.all<SalesGoal>();
	return results;
}

// ── Progress Calculation ──

/**
 * Get all active goals with their current progress for a tenant.
 * Calculates revenue/count from rental_sessions and product_sales
 * within the goal's date range, using UTC conversion.
 */
export async function getGoalsWithProgress(
	db: D1Database,
	tenantId: number,
	opts?: { userId?: number; activeOnly?: boolean },
): Promise<SalesGoalProgress[]> {
	const activeFilter = opts?.activeOnly !== false ? "AND sg.active = 1" : "";
	const userFilter = opts?.userId ? "AND (sg.user_id IS NULL OR sg.user_id = ?)" : "";

	const binds: unknown[] = [tenantId, tenantId, tenantId];
	if (opts?.userId) binds.push(opts.userId);

	const { results } = await db
		.prepare(
			`SELECT
				sg.*,
				u.name AS user_name,
				cb.name AS created_by_name,
				COALESCE(
					CASE sg.goal_type
						WHEN 'revenue' THEN (
							SELECT COALESCE(SUM(rs.amount_cents + rs.overtime_cents), 0)
							FROM rental_sessions rs
							WHERE rs.tenant_id = ?
							  AND rs.status = 'completed'
							  AND rs.paid = 1
							  AND rs.created_at >= ${DT_FROM}
							  AND rs.created_at < ${DT_TO}
							  AND (sg.user_id IS NULL OR rs.attendant_id = sg.user_id)
						) + (
							SELECT COALESCE(SUM(ps.total_cents), 0)
							FROM product_sales ps
							WHERE ps.tenant_id = ?
							  AND ps.paid = 1
							  AND ps.created_at >= ${DT_FROM}
							  AND ps.created_at < ${DT_TO}
							  AND (sg.user_id IS NULL OR ps.attendant_id = sg.user_id)
						)
						WHEN 'rental_count' THEN (
							SELECT COUNT(*)
							FROM rental_sessions rs
							WHERE rs.tenant_id = ?
							  AND rs.status = 'completed'
							  AND rs.paid = 1
							  AND rs.created_at >= ${DT_FROM}
							  AND rs.created_at < ${DT_TO}
							  AND (sg.user_id IS NULL OR rs.attendant_id = sg.user_id)
						)
						WHEN 'product_sale_count' THEN (
							SELECT COUNT(*)
							FROM product_sales ps
							WHERE ps.tenant_id = ?
							  AND ps.paid = 1
							  AND ps.created_at >= ${DT_FROM}
							  AND ps.created_at < ${DT_TO}
							  AND (sg.user_id IS NULL OR ps.attendant_id = sg.user_id)
						)
					END,
					0
				) AS current_value
			FROM sales_goals sg
			LEFT JOIN users u ON u.id = sg.user_id
			LEFT JOIN users cb ON cb.id = sg.created_by
			WHERE sg.tenant_id = ?
			  ${activeFilter}
			  ${userFilter}
			ORDER BY sg.end_date DESC, sg.created_at DESC`,
		)
		.bind(...binds, ...Array(8).fill(null))
		.all();

	// D1 doesn't support correlated subqueries with dynamic binds well,
	// so we'll use a simpler approach: fetch goals then compute progress
	return [] as SalesGoalProgress[];
}

/**
 * Simpler, reliable approach: fetch goals then compute progress individually.
 */
export async function getGoalsProgress(
	db: D1Database,
	tenantId: number,
	opts?: { userId?: number; activeOnly?: boolean },
): Promise<SalesGoalProgress[]> {
	const activeFilter = opts?.activeOnly !== false ? "AND sg.active = 1" : "";
	const userFilter = opts?.userId ? "AND (sg.user_id IS NULL OR sg.user_id = ?)" : "";
	const binds: unknown[] = [tenantId];
	if (opts?.userId) binds.push(opts.userId);

	const { results: goals } = await db
		.prepare(
			`SELECT sg.*, u.name AS user_name, cb.name AS created_by_name
			 FROM sales_goals sg
			 LEFT JOIN users u ON u.id = sg.user_id
			 LEFT JOIN users cb ON cb.id = sg.created_by
			 WHERE sg.tenant_id = ? ${activeFilter} ${userFilter}
			 ORDER BY sg.active DESC, sg.end_date DESC`,
		)
		.bind(...binds)
		.all<SalesGoal & { user_name: string | null; created_by_name: string }>();

	const progressList: SalesGoalProgress[] = [];

	for (const goal of goals) {
		const currentValue = await computeGoalProgress(db, tenantId, goal);
		const percentage = goal.target_value > 0
			? Math.min(Math.round((currentValue / goal.target_value) * 100), 100)
			: 0;
		progressList.push({
			...goal,
			current_value: currentValue,
			percentage,
			achieved: currentValue >= goal.target_value,
		});
	}

	return progressList;
}

/**
 * Compute current progress value for a single goal.
 * Uses UTC conversion: dates in the goal are in tenant timezone (BRT),
 * converted to UTC for querying.
 */
export async function computeGoalProgress(
	db: D1Database,
	tenantId: number,
	goal: SalesGoal,
): Promise<number> {
	const from = goal.start_date;
	const to = goal.end_date;

	if (goal.goal_type === "revenue") {
		const [rental, product] = await Promise.all([
			db
				.prepare(
					`SELECT COALESCE(SUM(amount_cents + overtime_cents), 0) AS total
					 FROM rental_sessions
					 WHERE tenant_id = ? AND status = 'completed' AND paid = 1
					   AND created_at >= ${DT_FROM} AND created_at < ${DT_TO}
					   ${goal.user_id ? "AND attendant_id = ?" : ""}`,
				)
				.bind(tenantId, from, to, ...(goal.user_id ? [goal.user_id] : []))
				.first<{ total: number }>(),
			db
				.prepare(
					`SELECT COALESCE(SUM(total_cents), 0) AS total
					 FROM product_sales
					 WHERE tenant_id = ? AND paid = 1
					   AND created_at >= ${DT_FROM} AND created_at < ${DT_TO}
					   ${goal.user_id ? "AND attendant_id = ?" : ""}`,
				)
				.bind(tenantId, from, to, ...(goal.user_id ? [goal.user_id] : []))
				.first<{ total: number }>(),
		]);
		return (rental?.total ?? 0) + (product?.total ?? 0);
	}

	if (goal.goal_type === "rental_count") {
		const row = await db
			.prepare(
				`SELECT COUNT(*) AS cnt
				 FROM rental_sessions
				 WHERE tenant_id = ? AND status = 'completed' AND paid = 1
				   AND created_at >= ${DT_FROM} AND created_at < ${DT_TO}
				   ${goal.user_id ? "AND attendant_id = ?" : ""}`,
			)
			.bind(tenantId, from, to, ...(goal.user_id ? [goal.user_id] : []))
			.first<{ cnt: number }>();
		return row?.cnt ?? 0;
	}

	if (goal.goal_type === "product_sale_count") {
		const row = await db
			.prepare(
				`SELECT COUNT(*) AS cnt
				 FROM product_sales
				 WHERE tenant_id = ? AND paid = 1
				   AND created_at >= ${DT_FROM} AND created_at < ${DT_TO}
				   ${goal.user_id ? "AND attendant_id = ?" : ""}`,
			)
			.bind(tenantId, from, to, ...(goal.user_id ? [goal.user_id] : []))
			.first<{ cnt: number }>();
		return row?.cnt ?? 0;
	}

	return 0;
}

// ── Goal Achievement Check (called after payment) ──

/**
 * Check if any active goals have been newly achieved by this user.
 * Returns goals that were just reached (for celebration).
 */
export async function checkGoalAchievements(
	db: D1Database,
	tenantId: number,
	userId: number,
): Promise<Array<{ goal_id: number; title: string; target_value: number; current_value: number; goal_type: string }>> {
	// Get active goals for this user (or team-wide)
	const { results: goals } = await db
		.prepare(
			`SELECT sg.*
			 FROM sales_goals sg
			 WHERE sg.tenant_id = ? AND sg.active = 1
			   AND (sg.user_id IS NULL OR sg.user_id = ?)
			   AND date('now') >= sg.start_date AND date('now') <= sg.end_date`,
		)
		.bind(tenantId, userId)
		.all<SalesGoal>();

	const achieved: Array<{ goal_id: number; title: string; target_value: number; current_value: number; goal_type: string }> = [];

	for (const goal of goals) {
		// Check if already marked as achieved
		const existing = await db
			.prepare("SELECT id FROM goal_achievements WHERE goal_id = ? AND user_id = ?")
			.bind(goal.id, userId)
			.first();
		if (existing) continue;

		const currentValue = await computeGoalProgress(db, tenantId, goal);

		if (currentValue >= goal.target_value) {
			// Record achievement
			await db
				.prepare(
					"INSERT INTO goal_achievements (goal_id, user_id, achieved_value) VALUES (?, ?, ?)",
				)
				.bind(goal.id, userId, currentValue)
				.run();

			achieved.push({
				goal_id: goal.id,
				title: goal.title,
				target_value: goal.target_value,
				current_value: currentValue,
				goal_type: goal.goal_type,
			});
		}
	}

	return achieved;
}

// ── Recent Achievements (for frontend celebration) ──

/**
 * Return goals achieved by this user in the last 30 seconds.
 * Used by the frontend to trigger celebrations after payment,
 * since checkGoalAchievements() already recorded them.
 */
export async function getRecentAchievements(
	db: D1Database,
	tenantId: number,
	userId: number,
): Promise<Array<{ goal_id: number; title: string; target_value: number; current_value: number; goal_type: string; celebration_message: string | null }>> {
	const { results } = await db
		.prepare(
			`SELECT sg.id AS goal_id, sg.title, sg.target_value, ga.achieved_value AS current_value, sg.goal_type, sg.celebration_message
			 FROM goal_achievements ga
			 JOIN sales_goals sg ON sg.id = ga.goal_id
			 WHERE sg.tenant_id = ? AND ga.user_id = ?
			   AND ga.achieved_at >= datetime('now', '-30 seconds')
			 ORDER BY ga.achieved_at DESC`,
		)
		.bind(tenantId, userId)
		.all<{ goal_id: number; title: string; target_value: number; current_value: number; goal_type: string; celebration_message: string | null }>();

	return results;
}

// ── Report: Goal Performance Summary ──

export interface GoalReportRow {
	id: number;
	title: string;
	goal_type: string;
	period_type: string;
	target_value: number;
	current_value: number;
	percentage: number;
	achieved: boolean;
	user_name: string | null;
	start_date: string;
	end_date: string;
	achieved_at: string | null;
}

export async function getGoalsReport(
	db: D1Database,
	tenantId: number,
	from: string,
	to: string,
): Promise<GoalReportRow[]> {
	const { results: goals } = await db
		.prepare(
			`SELECT sg.*, u.name AS user_name, ga.achieved_at
			 FROM sales_goals sg
			 LEFT JOIN users u ON u.id = sg.user_id
			 LEFT JOIN goal_achievements ga ON ga.goal_id = sg.id AND (sg.user_id IS NULL OR ga.user_id = sg.user_id)
			 WHERE sg.tenant_id = ?
			   AND sg.start_date >= ? AND sg.end_date <= ?
			 ORDER BY sg.start_date DESC, sg.created_at DESC`,
		)
		.bind(tenantId, from, to)
		.all<SalesGoal & { user_name: string | null; achieved_at: string | null }>();

	const rows: GoalReportRow[] = [];

	for (const goal of goals) {
		const currentValue = await computeGoalProgress(db, tenantId, goal);
		const percentage = goal.target_value > 0
			? Math.min(Math.round((currentValue / goal.target_value) * 100), 100)
			: 0;
		rows.push({
			id: goal.id,
			title: goal.title,
			goal_type: goal.goal_type,
			period_type: goal.period_type,
			target_value: goal.target_value,
			current_value: currentValue,
			percentage,
			achieved: currentValue >= goal.target_value,
			user_name: goal.user_name,
			start_date: goal.start_date,
			end_date: goal.end_date,
			achieved_at: goal.achieved_at,
		});
	}

	return rows;
}
