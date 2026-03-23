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
	// Simplified: count active subs by plan
	const mrr = await db
		.prepare(`
			SELECT
				COALESCE(SUM(CASE
					WHEN plan = 'starter' THEN 9700
					WHEN plan = 'pro' THEN 19700
					WHEN plan = 'enterprise' THEN 39700
					ELSE 0
				END), 0) as mrr_cents
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
