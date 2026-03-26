import type { Tenant, Subscription } from "../schema";

export interface TenantWithStats extends Tenant {
	user_count: number;
	asset_count: number;
	rental_count: number;
	revenue_cents: number;
	subscription_status: string | null;
	subscription_plan: string | null;
	stripe_subscription_id: string | null;
}

export interface PlatformStats {
	total_tenants: number;
	active_tenants: number;
	suspended_tenants: number;
	total_users: number;
	total_rentals: number;
	total_revenue_cents: number;
	mrr_cents: number;
}

export async function getPlatformStats(db: D1Database): Promise<PlatformStats> {
	const tenantStats = await db
		.prepare(`
			SELECT
				COUNT(*) as total_tenants,
				SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tenants,
				SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_tenants
			FROM tenants
			WHERE slug != '_platform'
		`)
		.first<{ total_tenants: number; active_tenants: number; suspended_tenants: number }>();

	const userCount = await db
		.prepare("SELECT COUNT(*) as total FROM users WHERE active = 1")
		.first<{ total: number }>();

	const rentalStats = await db
		.prepare(`
			SELECT COUNT(*) as total_rentals,
				COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) as total_revenue_cents
			FROM rental_sessions
		`)
		.first<{ total_rentals: number; total_revenue_cents: number }>();

	// MRR = sum of active subscriptions price
	// Read plan prices from platform_config, fall back to hardcoded defaults
	const defaultPrices: Record<string, number> = { starter: 9700, pro: 19700, enterprise: 39700 };
	let planPrices = defaultPrices;
	try {
		const configRow = await db
			.prepare("SELECT value FROM platform_config WHERE key = 'plan_limits'")
			.first<{ value: string }>();
		if (configRow) {
			const parsed = JSON.parse(configRow.value) as Record<string, { priceCents?: number }>;
			planPrices = {};
			for (const [key, val] of Object.entries(parsed)) {
				planPrices[key] = val.priceCents ?? defaultPrices[key] ?? 0;
			}
		}
	} catch {
		// Fall back to hardcoded defaults
	}

	const caseParts = Object.entries(planPrices)
		.map(([plan, price]) => `WHEN plan = '${plan}' THEN ${price}`)
		.join(" ");

	const mrr = await db
		.prepare(`
			SELECT
				COALESCE(SUM(CASE ${caseParts} ELSE 0 END), 0) as mrr_cents
			FROM subscriptions
			WHERE status = 'active'
		`)
		.first<{ mrr_cents: number }>();

	return {
		total_tenants: tenantStats?.total_tenants ?? 0,
		active_tenants: tenantStats?.active_tenants ?? 0,
		suspended_tenants: tenantStats?.suspended_tenants ?? 0,
		total_users: userCount?.total ?? 0,
		total_rentals: rentalStats?.total_rentals ?? 0,
		total_revenue_cents: rentalStats?.total_revenue_cents ?? 0,
		mrr_cents: mrr?.mrr_cents ?? 0,
	};
}

export async function getAllTenants(db: D1Database): Promise<TenantWithStats[]> {
	const { results } = await db
		.prepare(`
			SELECT
				t.*,
				COALESCE(u.user_count, 0) as user_count,
				COALESCE(a.asset_count, 0) as asset_count,
				COALESCE(r.rental_count, 0) as rental_count,
				COALESCE(r.revenue_cents, 0) as revenue_cents,
				s.status as subscription_status,
				s.plan as subscription_plan,
				s.stripe_subscription_id
			FROM tenants t
			LEFT JOIN (SELECT tenant_id, COUNT(*) as user_count FROM users WHERE active = 1 GROUP BY tenant_id) u ON u.tenant_id = t.id
			LEFT JOIN (SELECT tenant_id, COUNT(*) as asset_count FROM assets WHERE status != 'retired' GROUP BY tenant_id) a ON a.tenant_id = t.id
			LEFT JOIN (SELECT tenant_id, COUNT(*) as rental_count, SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END) as revenue_cents FROM rental_sessions GROUP BY tenant_id) r ON r.tenant_id = t.id
			LEFT JOIN subscriptions s ON s.tenant_id = t.id
			WHERE t.slug != '_platform'
			ORDER BY t.created_at DESC
		`)
		.all<TenantWithStats>();
	return results;
}

export async function getTenantDetail(db: D1Database, tenantId: number): Promise<TenantWithStats | null> {
	return db
		.prepare(`
			SELECT
				t.*,
				COALESCE(u.user_count, 0) as user_count,
				COALESCE(a.asset_count, 0) as asset_count,
				COALESCE(r.rental_count, 0) as rental_count,
				COALESCE(r.revenue_cents, 0) as revenue_cents,
				s.status as subscription_status,
				s.plan as subscription_plan,
				s.stripe_subscription_id
			FROM tenants t
			LEFT JOIN (SELECT tenant_id, COUNT(*) as user_count FROM users WHERE active = 1 GROUP BY tenant_id) u ON u.tenant_id = t.id
			LEFT JOIN (SELECT tenant_id, COUNT(*) as asset_count FROM assets WHERE status != 'retired' GROUP BY tenant_id) a ON a.tenant_id = t.id
			LEFT JOIN (SELECT tenant_id, COUNT(*) as rental_count, SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END) as revenue_cents FROM rental_sessions GROUP BY tenant_id) r ON r.tenant_id = t.id
			LEFT JOIN subscriptions s ON s.tenant_id = t.id
			WHERE t.id = ?
		`)
		.bind(tenantId)
		.first<TenantWithStats>();
}

export async function getTenantRecentActivity(
	db: D1Database,
	tenantId: number,
): Promise<{ rentals_today: number; rentals_week: number; revenue_today_cents: number; last_login: string | null }> {
	const today = await db
		.prepare(`
			SELECT COUNT(*) as cnt,
				COALESCE(SUM(CASE WHEN paid = 1 THEN amount_cents ELSE 0 END), 0) as rev
			FROM rental_sessions
			WHERE tenant_id = ? AND created_at >= date('now')
		`)
		.bind(tenantId)
		.first<{ cnt: number; rev: number }>();

	const week = await db
		.prepare("SELECT COUNT(*) as cnt FROM rental_sessions WHERE tenant_id = ? AND created_at >= date('now', '-7 days')")
		.bind(tenantId)
		.first<{ cnt: number }>();

	const lastLogin = await db
		.prepare(`
			SELECT MAX(s.created_at) as last_login
			FROM auth_sessions s
			JOIN users u ON s.user_id = u.id
			WHERE u.tenant_id = ?
		`)
		.bind(tenantId)
		.first<{ last_login: string | null }>();

	return {
		rentals_today: today?.cnt ?? 0,
		revenue_today_cents: today?.rev ?? 0,
		rentals_week: week?.cnt ?? 0,
		last_login: lastLogin?.last_login ?? null,
	};
}

export async function updateTenantStatus(db: D1Database, tenantId: number, status: string): Promise<void> {
	await db
		.prepare("UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(status, tenantId)
		.run();
}

// Get all users for a tenant
export async function getTenantUsers(
	db: D1Database,
	tenantId: number,
): Promise<
	Array<{
		id: number;
		name: string;
		email: string;
		role: string;
		active: number;
		created_at: string;
		last_login: string | null;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
				(SELECT MAX(s.created_at) FROM auth_sessions s WHERE s.user_id = u.id) as last_login
			FROM users u WHERE u.tenant_id = ? ORDER BY u.name`,
		)
		.bind(tenantId)
		.all();
	return results as any;
}

// Get active/stuck rental sessions for a tenant
export async function getTenantActiveSessions(
	db: D1Database,
	tenantId: number,
): Promise<
	Array<{
		id: string;
		asset_name: string;
		package_name: string;
		customer_name: string | null;
		status: string;
		start_time: string;
		duration_minutes: number;
		amount_cents: number;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT rs.id, a.name as asset_name, p.name as package_name, c.name as customer_name,
				rs.status, rs.start_time, rs.duration_minutes, rs.amount_cents
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			LEFT JOIN customers c ON rs.customer_id = c.id
			WHERE rs.tenant_id = ? AND rs.status IN ('running', 'paused')
			ORDER BY rs.start_time DESC`,
		)
		.bind(tenantId)
		.all();
	return results as any;
}

// Get business config for a tenant
export async function getTenantConfig(
	db: D1Database,
	tenantId: number,
): Promise<{
	name: string;
	cnpj: string | null;
	address: string | null;
	phone: string | null;
	receipt_footer: string | null;
} | null> {
	return db
		.prepare(
			`SELECT name, cnpj, address, phone, receipt_footer FROM business_config WHERE tenant_id = ?`,
		)
		.bind(tenantId)
		.first();
}

// Get recent logs for a tenant
export async function getTenantLogs(
	db: D1Database,
	tenantId: number,
	limit = 50,
): Promise<
	Array<{
		id: number;
		user_name: string | null;
		action: string;
		entity_type: string;
		entity_id: string | null;
		created_at: string;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT l.id, u.name as user_name, l.action, l.entity_type, l.entity_id, l.created_at
			FROM operation_logs l
			LEFT JOIN users u ON l.user_id = u.id
			WHERE l.tenant_id = ?
			ORDER BY l.created_at DESC LIMIT ?`,
		)
		.bind(tenantId, limit)
		.all();
	return results as any;
}

// Get cross-tenant logs (all tenants)
export async function getCrossTenantLogs(
	db: D1Database,
	limit = 100,
): Promise<
	Array<{
		id: number;
		tenant_name: string;
		user_name: string | null;
		action: string;
		entity_type: string;
		entity_id: string | null;
		created_at: string;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT l.id, t.name as tenant_name, u.name as user_name, l.action, l.entity_type, l.entity_id, l.created_at
			FROM operation_logs l
			JOIN tenants t ON l.tenant_id = t.id
			LEFT JOIN users u ON l.user_id = u.id
			WHERE t.slug != '_platform'
			ORDER BY l.created_at DESC LIMIT ?`,
		)
		.bind(limit)
		.all();
	return results as any;
}

// Update tenant plan and limits
export async function updateTenantPlan(
	db: D1Database,
	tenantId: number,
	plan: string,
	maxUsers: number,
	maxAssets: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE tenants SET plan = ?, max_users = ?, max_assets = ?, updated_at = datetime('now') WHERE id = ?`,
		)
		.bind(plan, maxUsers, maxAssets, tenantId)
		.run();
}

// Update tenant business config
export async function updateTenantConfig(
	db: D1Database,
	tenantId: number,
	params: {
		name?: string;
		cnpj?: string | null;
		address?: string | null;
		phone?: string | null;
		receipt_footer?: string | null;
	},
): Promise<void> {
	const sets: string[] = [];
	const values: any[] = [];

	if (params.name !== undefined) {
		sets.push("name = ?");
		values.push(params.name);
	}
	if (params.cnpj !== undefined) {
		sets.push("cnpj = ?");
		values.push(params.cnpj);
	}
	if (params.address !== undefined) {
		sets.push("address = ?");
		values.push(params.address);
	}
	if (params.phone !== undefined) {
		sets.push("phone = ?");
		values.push(params.phone);
	}
	if (params.receipt_footer !== undefined) {
		sets.push("receipt_footer = ?");
		values.push(params.receipt_footer);
	}

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(tenantId);

	await db
		.prepare(`UPDATE business_config SET ${sets.join(", ")} WHERE tenant_id = ?`)
		.bind(...values)
		.run();
}

// ── Superadmin queries ──────────────────────────────────────────────

export async function getSuperadminUsers(
	db: D1Database,
): Promise<
	Array<{
		id: number;
		name: string;
		email: string;
		role: string;
		active: number;
		created_at: string;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT id, name, email, role, active, created_at
			FROM users
			WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '_platform')
			ORDER BY name`,
		)
		.all();
	return results as any;
}

export async function createSuperadminUser(
	db: D1Database,
	params: { name: string; email: string; passwordHash: string; salt: string },
): Promise<Record<string, unknown>> {
	const row = await db
		.prepare(
			`INSERT INTO users (tenant_id, name, email, password_hash, salt, role)
			VALUES ((SELECT id FROM tenants WHERE slug = '_platform'), ?, ?, ?, ?, 'owner')
			RETURNING *`,
		)
		.bind(params.name, params.email, params.passwordHash, params.salt)
		.first();
	return row as Record<string, unknown>;
}

export async function toggleSuperadminActive(
	db: D1Database,
	userId: number,
	active: boolean,
): Promise<void> {
	await db
		.prepare(
			`UPDATE users SET active = ?, updated_at = datetime('now')
			WHERE id = ? AND tenant_id = (SELECT id FROM tenants WHERE slug = '_platform')`,
		)
		.bind(active ? 1 : 0, userId)
		.run();
}

export async function resetSuperadminPassword(
	db: D1Database,
	userId: number,
	passwordHash: string,
	salt: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now')
			WHERE id = ? AND tenant_id = (SELECT id FROM tenants WHERE slug = '_platform')`,
		)
		.bind(passwordHash, salt, userId)
		.run();
}

// ── Plan config queries ─────────────────────────────────────────────

export interface PlanConfig {
	label: string;
	maxUsers: number;
	maxAssets: number;
	priceCents: number;
}

export async function getPlanDefinitions(db: D1Database): Promise<Record<string, PlanConfig>> {
	const row = await db
		.prepare("SELECT value FROM platform_config WHERE key = 'plan_limits'")
		.first<{ value: string }>();

	if (row) return JSON.parse(row.value);

	// Hardcoded defaults
	return {
		starter: { label: "Starter", maxUsers: 3, maxAssets: 10, priceCents: 9700 },
		pro: { label: "Pro", maxUsers: 10, maxAssets: 50, priceCents: 19700 },
		enterprise: { label: "Enterprise", maxUsers: 50, maxAssets: 200, priceCents: 39700 },
	};
}

export async function updatePlanDefinitions(
	db: D1Database,
	plans: Record<string, PlanConfig>,
): Promise<void> {
	await db
		.prepare(
			`INSERT OR REPLACE INTO platform_config (key, value, updated_at)
			VALUES ('plan_limits', ?, datetime('now'))`,
		)
		.bind(JSON.stringify(plans))
		.run();
}

// ── Report queries ──────────────────────────────────────────────────

export async function getRevenueOverTime(
	db: D1Database,
	period: "daily" | "weekly" | "monthly",
	startDate: string,
	endDate: string,
): Promise<Array<{ period: string; revenue_cents: number; rental_count: number }>> {
	const bucketExpr =
		period === "daily"
			? "date(created_at)"
			: period === "weekly"
				? "strftime('%Y-W%W', created_at)"
				: "strftime('%Y-%m', created_at)";

	const { results } = await db
		.prepare(
			`SELECT
				${bucketExpr} as period,
				SUM(revenue_cents) as revenue_cents,
				SUM(cnt) as rental_count
			FROM (
				SELECT created_at, amount_cents as revenue_cents, 1 as cnt
				FROM rental_sessions
				WHERE paid = 1 AND status = 'completed'
					AND created_at BETWEEN ? AND ?
				UNION ALL
				SELECT created_at, total_cents as revenue_cents, 0 as cnt
				FROM product_sales
				WHERE created_at BETWEEN ? AND ?
			)
			GROUP BY period
			ORDER BY period`,
		)
		.bind(startDate, endDate, startDate, endDate)
		.all();

	return results as any;
}

export async function getTenantGrowth(
	db: D1Database,
): Promise<Array<{ date: string; count: number }>> {
	const { results } = await db
		.prepare(
			`SELECT date(created_at) as date, COUNT(*) as count
			FROM tenants
			WHERE slug != '_platform'
			GROUP BY date(created_at)
			ORDER BY date`,
		)
		.all();
	return results as any;
}

export async function getActiveTenants(
	db: D1Database,
	days: number,
): Promise<
	Array<{
		id: number;
		name: string;
		slug: string;
		last_activity: string;
		login_count: number;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug,
				MAX(s.created_at) as last_activity,
				COUNT(s.id) as login_count
			FROM tenants t
			JOIN users u ON u.tenant_id = t.id
			JOIN auth_sessions s ON s.user_id = u.id
			WHERE t.slug != '_platform'
				AND s.created_at >= datetime('now', '-' || ? || ' days')
			GROUP BY t.id
			ORDER BY last_activity DESC`,
		)
		.bind(days)
		.all();
	return results as any;
}

export async function getInactiveTenants(
	db: D1Database,
	days: number,
): Promise<
	Array<{
		id: number;
		name: string;
		slug: string;
		last_activity: string | null;
		days_inactive: number;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug,
				activity.last_activity,
				CAST(JULIANDAY('now') - JULIANDAY(COALESCE(activity.last_activity, t.created_at)) AS INTEGER) as days_inactive
			FROM tenants t
			LEFT JOIN (
				SELECT u.tenant_id, MAX(s.created_at) as last_activity
				FROM users u
				JOIN auth_sessions s ON s.user_id = u.id
				GROUP BY u.tenant_id
			) activity ON activity.tenant_id = t.id
			WHERE t.slug != '_platform'
				AND (activity.last_activity IS NULL
					OR activity.last_activity < datetime('now', '-' || ? || ' days'))
			ORDER BY days_inactive DESC`,
		)
		.bind(days)
		.all();
	return results as any;
}

export async function getTopTenantsByRevenue(
	db: D1Database,
	limit: number,
	startDate?: string,
	endDate?: string,
): Promise<
	Array<{
		id: number;
		name: string;
		slug: string;
		plan: string;
		revenue_cents: number;
		rental_count: number;
	}>
> {
	const dateFilter =
		startDate && endDate ? "AND rs.created_at BETWEEN ? AND ?" : "";
	const binds: (string | number)[] = [];
	if (startDate && endDate) {
		binds.push(startDate, endDate);
	}
	binds.push(limit);

	const { results } = await db
		.prepare(
			`SELECT t.id, t.name, t.slug, t.plan,
				COALESCE(SUM(CASE WHEN rs.paid = 1 THEN rs.amount_cents ELSE 0 END), 0) as revenue_cents,
				COUNT(rs.id) as rental_count
			FROM tenants t
			LEFT JOIN rental_sessions rs ON rs.tenant_id = t.id ${dateFilter}
			WHERE t.slug != '_platform'
			GROUP BY t.id
			ORDER BY revenue_cents DESC
			LIMIT ?`,
		)
		.bind(...binds)
		.all();
	return results as any;
}

export async function getAllUsersAcrossTenants(
	db: D1Database,
): Promise<
	Array<{
		id: number;
		name: string;
		email: string;
		role: string;
		active: number;
		created_at: string;
		tenant_name: string;
		tenant_slug: string;
		last_login: string | null;
	}>
> {
	const { results } = await db
		.prepare(
			`SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
				t.name as tenant_name, t.slug as tenant_slug,
				(SELECT MAX(s.created_at) FROM auth_sessions s WHERE s.user_id = u.id) as last_login
			FROM users u
			JOIN tenants t ON u.tenant_id = t.id
			WHERE t.slug != '_platform'
			ORDER BY u.name`,
		)
		.all();
	return results as any;
}

// ── Sales Intelligence Queries ───────────────────────────────────────

export interface TrialExpiring {
	tenant_id: number;
	tenant_name: string;
	tenant_slug: string;
	owner_email: string;
	plan: string;
	trial_end: string;
	days_remaining: number;
	rental_count: number;
	last_login: string | null;
}

export async function getExpiringTrials(db: D1Database, withinDays: number = 7): Promise<TrialExpiring[]> {
	const { results } = await db
		.prepare(`
			SELECT
				t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
				t.owner_email, s.plan, s.current_period_end as trial_end,
				CAST(JULIANDAY(s.current_period_end) - JULIANDAY('now') AS INTEGER) as days_remaining,
				COALESCE(r.rental_count, 0) as rental_count,
				activity.last_login
			FROM subscriptions s
			JOIN tenants t ON t.id = s.tenant_id
			LEFT JOIN (
				SELECT tenant_id, COUNT(*) as rental_count FROM rental_sessions GROUP BY tenant_id
			) r ON r.tenant_id = t.id
			LEFT JOIN (
				SELECT u.tenant_id, MAX(sess.created_at) as last_login
				FROM users u JOIN auth_sessions sess ON sess.user_id = u.id
				GROUP BY u.tenant_id
			) activity ON activity.tenant_id = t.id
			WHERE s.status = 'trialing'
				AND s.current_period_end <= datetime('now', '+' || ? || ' days')
			ORDER BY days_remaining ASC
		`)
		.bind(withinDays)
		.all<TrialExpiring>();
	return results;
}

export interface TenantEngagement {
	tenant_id: number;
	tenant_name: string;
	tenant_slug: string;
	owner_email: string;
	plan: string;
	status: string;
	created_at: string;
	days_since_creation: number;
	rentals_7d: number;
	rentals_30d: number;
	product_sales_7d: number;
	last_login: string | null;
	days_since_login: number | null;
	health: "healthy" | "warning" | "critical";
}

export async function getTenantEngagement(db: D1Database): Promise<TenantEngagement[]> {
	const { results } = await db
		.prepare(`
			SELECT
				t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
				t.owner_email, t.plan, t.status, t.created_at,
				CAST(JULIANDAY('now') - JULIANDAY(t.created_at) AS INTEGER) as days_since_creation,
				COALESCE(r7.cnt, 0) as rentals_7d,
				COALESCE(r30.cnt, 0) as rentals_30d,
				COALESCE(ps7.cnt, 0) as product_sales_7d,
				activity.last_login,
				CASE WHEN activity.last_login IS NOT NULL
					THEN CAST(JULIANDAY('now') - JULIANDAY(activity.last_login) AS INTEGER)
					ELSE NULL END as days_since_login
			FROM tenants t
			LEFT JOIN (
				SELECT tenant_id, COUNT(*) as cnt FROM rental_sessions
				WHERE created_at >= datetime('now', '-7 days') GROUP BY tenant_id
			) r7 ON r7.tenant_id = t.id
			LEFT JOIN (
				SELECT tenant_id, COUNT(*) as cnt FROM rental_sessions
				WHERE created_at >= datetime('now', '-30 days') GROUP BY tenant_id
			) r30 ON r30.tenant_id = t.id
			LEFT JOIN (
				SELECT tenant_id, COUNT(*) as cnt FROM product_sales
				WHERE created_at >= datetime('now', '-7 days') GROUP BY tenant_id
			) ps7 ON ps7.tenant_id = t.id
			LEFT JOIN (
				SELECT u.tenant_id, MAX(sess.created_at) as last_login
				FROM users u JOIN auth_sessions sess ON sess.user_id = u.id
				GROUP BY u.tenant_id
			) activity ON activity.tenant_id = t.id
			WHERE t.slug != '_platform' AND t.status = 'active'
			ORDER BY rentals_7d ASC, days_since_login DESC NULLS FIRST
		`)
		.all<Omit<TenantEngagement, "health">>();

	return results.map((t) => {
		let health: TenantEngagement["health"] = "healthy";
		if (t.days_since_creation > 3 && t.rentals_7d === 0 && t.product_sales_7d === 0) {
			health = t.days_since_login === null || t.days_since_login > 7 ? "critical" : "warning";
		} else if (t.rentals_7d === 0 && t.days_since_login !== null && t.days_since_login > 3) {
			health = "warning";
		}
		return { ...t, health };
	});
}

export interface DelinquentSubscription {
	tenant_id: number;
	tenant_name: string;
	tenant_slug: string;
	owner_email: string;
	plan: string;
	status: string;
	stripe_subscription_id: string | null;
	updated_at: string;
	days_overdue: number;
}

export async function getDelinquentSubscriptions(db: D1Database): Promise<DelinquentSubscription[]> {
	const { results } = await db
		.prepare(`
			SELECT
				t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
				t.owner_email, s.plan, s.status, s.stripe_subscription_id, s.updated_at,
				CAST(JULIANDAY('now') - JULIANDAY(s.updated_at) AS INTEGER) as days_overdue
			FROM subscriptions s
			JOIN tenants t ON t.id = s.tenant_id
			WHERE s.status IN ('past_due', 'unpaid', 'incomplete')
			ORDER BY s.updated_at ASC
		`)
		.all<DelinquentSubscription>();
	return results;
}

export interface AbandonedCheckout {
	id: number;
	slug: string;
	business_name: string;
	owner_name: string;
	owner_email: string;
	plan: string;
	created_at: string;
	hours_ago: number;
}

export async function getAbandonedCheckouts(db: D1Database): Promise<AbandonedCheckout[]> {
	const { results } = await db
		.prepare(`
			SELECT id, slug, business_name, owner_name, owner_email, plan, created_at,
				CAST((JULIANDAY('now') - JULIANDAY(created_at)) * 24 AS INTEGER) as hours_ago
			FROM abandoned_checkouts
			WHERE converted = 0
				AND created_at >= datetime('now', '-30 days')
			ORDER BY created_at DESC
		`)
		.all<AbandonedCheckout>();
	return results;
}

export async function recordAbandonedCheckout(
	db: D1Database,
	data: { slug: string; businessName: string; ownerName: string; ownerEmail: string; plan: string },
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO abandoned_checkouts (slug, business_name, owner_name, owner_email, plan)
			 VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(data.slug, data.businessName, data.ownerName, data.ownerEmail, data.plan)
		.run();
}

export async function markCheckoutConverted(db: D1Database, slug: string): Promise<void> {
	await db
		.prepare("UPDATE abandoned_checkouts SET converted = 1, updated_at = datetime('now') WHERE slug = ? AND converted = 0")
		.bind(slug)
		.run();
}

export async function getSubscriptionDetails(
	db: D1Database,
): Promise<
	Array<
		Subscription & {
			tenant_name: string;
			tenant_slug: string;
		}
	>
> {
	const { results } = await db
		.prepare(
			`SELECT s.*, t.name as tenant_name, t.slug as tenant_slug
			FROM subscriptions s
			JOIN tenants t ON s.tenant_id = t.id
			ORDER BY s.created_at DESC`,
		)
		.all();
	return results as any;
}
