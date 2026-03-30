import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { platformAdminMiddleware } from "../../middleware/platform-admin";
import {
	getPlatformStats, getAllTenants, getTenantDetail, getTenantRecentActivity,
	getTenantUsers, getTenantActiveSessions, getTenantConfig, getTenantLogs,
	getSuperadminUsers, getPlanDefinitions,
	getRevenueOverTime, getTenantGrowth, getActiveTenants, getInactiveTenants, getTopTenantsByRevenue,
	getAllUsersAcrossTenants, getSubscriptionDetails,
	getExpiringTrials, getTenantEngagement, getDelinquentSubscriptions, getAbandonedCheckouts,
} from "../../db/queries/platform";
import { PlatformDashboard } from "../../views/platform/dashboard";
import { PlatformLoginPage } from "../../views/platform/login";
import { TenantDetail } from "../../views/platform/tenant-detail";
import { Superadmins } from "../../views/platform/superadmins";
import { Plans } from "../../views/platform/plans";
import { PlatformReports } from "../../views/platform/reports";
import { PlatformUsersList } from "../../views/platform/users-list";
import { PlatformSubscriptions } from "../../views/platform/subscriptions";
import { PlatformEmailLogs } from "../../views/platform/email-logs";
import { PlatformTickets } from "../../views/platform/tickets";
import { getAllTickets } from "../../db/queries/support-tickets";
import { CrmPage } from "../../views/platform/crm";
import { listLeads, getCrmStats, getLeadsByStatus, getOverdueLeads, getTodayAgenda, getFunnelVelocity } from "../../db/queries/crm-leads";
import { daysAgoBrazilISO, todayBrazilISO } from "../../lib/timezone";
import { PlatformBlog } from "../../views/platform/blog";
import { getAllPosts } from "../../db/queries/blog";
import { PlatformLoyalty } from "../../views/platform/loyalty";

export const platformPages = new Hono<AppEnv>();

// Login page — public, before admin middleware
platformPages.get("/login", (c) => {
	return c.html(<PlatformLoginPage />);
});

platformPages.use("*", platformAdminMiddleware);

// Dashboard
platformPages.get("/", async (c) => {
	const db = c.env.DB;
	const [stats, tenants, expiringTrials, engagement, delinquent, abandoned, crmStats] = await Promise.all([
		getPlatformStats(db),
		getAllTenants(db),
		getExpiringTrials(db, 7),
		getTenantEngagement(db),
		getDelinquentSubscriptions(db),
		getAbandonedCheckouts(db),
		getCrmStats(db),
	]);
	const user = c.get("user");
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	return c.html(<PlatformDashboard stats={stats} tenants={tenants} user={user} domain={domain}
		expiringTrials={expiringTrials} engagement={engagement} delinquent={delinquent} abandoned={abandoned} crmStats={crmStats} />);
});

// Tenant detail
platformPages.get("/tenants/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const db = c.env.DB;
	const [tenantBase, activity, users, sessions, config, logs] = await Promise.all([
		getTenantDetail(db, id),
		getTenantRecentActivity(db, id),
		getTenantUsers(db, id),
		getTenantActiveSessions(db, id),
		getTenantConfig(db, id),
		getTenantLogs(db, id, 20),
	]);
	if (!tenantBase) return c.text("Tenant not found", 404);
	const tenant = { ...tenantBase, ...activity };
	const user = c.get("user");
	const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";
	return c.html(<TenantDetail tenant={tenant} users={users} sessions={sessions} config={config} logs={logs} domain={domain} user={user} />);
});

// Superadmins
platformPages.get("/superadmins", async (c) => {
	const admins = await getSuperadminUsers(c.env.DB);
	const user = c.get("user");
	return c.html(<Superadmins admins={admins} user={user} />);
});

// Plans
platformPages.get("/plans", async (c) => {
	const plans = await getPlanDefinitions(c.env.DB);
	const user = c.get("user");
	return c.html(<Plans plans={plans} user={user} />);
});

// Reports
platformPages.get("/reports", async (c) => {
	const db = c.env.DB;
	const endDate = todayBrazilISO();
	const startDate = daysAgoBrazilISO(30);

	const [revenue, tenantGrowth, activeTenants, inactiveTenants, topTenants] = await Promise.all([
		getRevenueOverTime(db, "daily", startDate, endDate),
		getTenantGrowth(db),
		getActiveTenants(db, 7),
		getInactiveTenants(db, 30),
		getTopTenantsByRevenue(db, 10),
	]);

	const user = c.get("user");
	return c.html(<PlatformReports revenue={revenue} tenantGrowth={tenantGrowth} activeTenants={activeTenants} inactiveTenants={inactiveTenants} topTenants={topTenants} user={user} />);
});

// All users
platformPages.get("/users", async (c) => {
	const users = await getAllUsersAcrossTenants(c.env.DB);
	const user = c.get("user");
	return c.html(<PlatformUsersList users={users} user={user} />);
});

// Subscriptions
platformPages.get("/subscriptions", async (c) => {
	const [subscriptions, stats, plans] = await Promise.all([
		getSubscriptionDetails(c.env.DB),
		getPlatformStats(c.env.DB),
		getPlanDefinitions(c.env.DB),
	]);
	const user = c.get("user");
	return c.html(<PlatformSubscriptions subscriptions={subscriptions} user={user} mrr_cents={stats.mrr_cents} plans={plans} />);
});

// Email logs
platformPages.get("/emails", async (c) => {
	const db = c.env.DB;
	const { results } = await db
		.prepare(`
			SELECT el.*, t.name as tenant_name, t.slug as tenant_slug
			FROM email_logs el
			LEFT JOIN tenants t ON t.id = el.tenant_id
			ORDER BY el.created_at DESC
			LIMIT 100
		`)
		.all<{
			id: number; tenant_id: number | null; recipient: string; subject: string;
			event_type: string; status: string; error_message: string | null;
			metadata: string | null; created_at: string;
			tenant_name: string | null; tenant_slug: string | null;
		}>();
	const user = c.get("user");
	return c.html(<PlatformEmailLogs logs={results} user={user} />);
});

// Tickets
platformPages.get("/tickets", async (c) => {
	const tickets = await getAllTickets(c.env.DB);
	const user = c.get("user");
	return c.html(<PlatformTickets tickets={tickets} user={user} />);
});

// CRM
platformPages.get("/crm", async (c) => {
	const db = c.env.DB;
	const [leadResult, stats, kanbanData, overdueLeadsList, agenda, funnelVelocity] = await Promise.all([
		listLeads(db, { limit: 100 }),
		getCrmStats(db),
		getLeadsByStatus(db),
		getOverdueLeads(db),
		getTodayAgenda(db),
		getFunnelVelocity(db),
	]);
	const user = c.get("user");
	return c.html(<CrmPage leads={leadResult.leads} stats={stats} kanbanData={kanbanData} overdueLeads={overdueLeadsList}
		agenda={agenda} funnelVelocity={funnelVelocity} user={user} />);
});

// Loyalty program adoption
platformPages.get("/loyalty", async (c) => {
	const db = c.env.DB;
	const user = c.get("user");

	// Cross-tenant loyalty stats
	const [tenantsWithLoyalty, totalVerified, totalIssued, totalRedeemed] = await Promise.all([
		db.prepare("SELECT COUNT(*) as cnt FROM loyalty_config WHERE enabled = 1").first<{ cnt: number }>(),
		db.prepare("SELECT COUNT(*) as cnt FROM customers WHERE email_verified = 1").first<{ cnt: number }>(),
		db.prepare("SELECT COALESCE(SUM(points), 0) as total FROM loyalty_transactions WHERE type = 'earned'").first<{ total: number }>(),
		db.prepare("SELECT COALESCE(SUM(ABS(points)), 0) as total FROM loyalty_transactions WHERE type = 'redeemed'").first<{ total: number }>(),
	]);

	// Per-tenant breakdown
	const { results: tenants } = await db.prepare(`
		SELECT t.id, t.name, t.slug, t.plan,
			COALESCE(lc.enabled, 0) as loyalty_enabled,
			(SELECT COUNT(*) FROM customers c WHERE c.tenant_id = t.id AND c.email_verified = 1) as verified_customers,
			COALESCE((SELECT SUM(lt.points) FROM loyalty_transactions lt WHERE lt.tenant_id = t.id AND lt.type = 'earned'), 0) as points_issued,
			COALESCE((SELECT SUM(ABS(lt.points)) FROM loyalty_transactions lt WHERE lt.tenant_id = t.id AND lt.type = 'redeemed'), 0) as points_redeemed
		FROM tenants t
		LEFT JOIN loyalty_config lc ON lc.tenant_id = t.id
		WHERE t.slug != '_platform' AND t.status = 'active'
		ORDER BY verified_customers DESC
	`).all();

	return c.html(<PlatformLoyalty
		stats={{
			tenantsWithLoyalty: tenantsWithLoyalty?.cnt ?? 0,
			totalVerifiedCustomers: totalVerified?.cnt ?? 0,
			totalPointsIssued: totalIssued?.total ?? 0,
			totalPointsRedeemed: totalRedeemed?.total ?? 0,
		}}
		tenants={tenants as any[]}
		user={user}
	/>);
});

// Blog management
platformPages.get("/blog", async (c) => {
	const posts = await getAllPosts(c.env.DB);
	const user = c.get("user");
	return c.html(<PlatformBlog posts={posts} user={user} />);
});
