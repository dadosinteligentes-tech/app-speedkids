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
import { daysAgoBrazilISO, todayBrazilISO } from "../../lib/timezone";

export const platformPages = new Hono<AppEnv>();

// Login page — public, before admin middleware
platformPages.get("/login", (c) => {
	return c.html(<PlatformLoginPage />);
});

platformPages.use("*", platformAdminMiddleware);

// Dashboard
platformPages.get("/", async (c) => {
	const db = c.env.DB;
	const [stats, tenants, expiringTrials, engagement, delinquent, abandoned] = await Promise.all([
		getPlatformStats(db),
		getAllTenants(db),
		getExpiringTrials(db, 7),
		getTenantEngagement(db),
		getDelinquentSubscriptions(db),
		getAbandonedCheckouts(db),
	]);
	const user = c.get("user");
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	return c.html(<PlatformDashboard stats={stats} tenants={tenants} user={user} domain={domain}
		expiringTrials={expiringTrials} engagement={engagement} delinquent={delinquent} abandoned={abandoned} />);
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
