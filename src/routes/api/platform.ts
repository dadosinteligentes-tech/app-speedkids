import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { platformAdminMiddleware } from "../../middleware/platform-admin";
import {
	getPlatformStats,
	getAllTenants,
	getTenantDetail,
	getTenantRecentActivity,
	updateTenantStatus,
	getTenantUsers,
	getTenantActiveSessions,
	getTenantConfig,
	getTenantLogs,
	getCrossTenantLogs,
	updateTenantPlan,
	updateTenantConfig,
	getSuperadminUsers,
	createSuperadminUser,
	toggleSuperadminActive,
	resetSuperadminPassword,
	getPlanDefinitions,
	updatePlanDefinitions,
	getRevenueOverTime,
	getTenantGrowth,
	getActiveTenants,
	getInactiveTenants,
	getTopTenantsByRevenue,
	getAllUsersAcrossTenants,
	getSubscriptionDetails,
} from "../../db/queries/platform";
import { isSlugAvailable, provisionTenant } from "../../services/provisioning";
import { generateSalt, hashPassword } from "../../lib/crypto";
import { createAuthSession } from "../../db/queries/auth";
import { getLimitsForPlan } from "../../lib/plan-limits";

export const platformApiRoutes = new Hono<AppEnv>();

platformApiRoutes.use("*", platformAdminMiddleware);

platformApiRoutes.get("/stats", async (c) => {
	const stats = await getPlatformStats(c.env.DB);
	return c.json(stats);
});

platformApiRoutes.get("/tenants", async (c) => {
	const tenants = await getAllTenants(c.env.DB);
	return c.json(tenants);
});

platformApiRoutes.get("/tenants/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const tenant = await getTenantDetail(c.env.DB, id);
	if (!tenant) return c.json({ error: "Tenant not found" }, 404);

	const activity = await getTenantRecentActivity(c.env.DB, id);
	return c.json({ ...tenant, ...activity });
});

platformApiRoutes.post("/tenants/:id/suspend", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "suspended");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants/:id/activate", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await updateTenantStatus(c.env.DB, id, "active");
	return c.json({ ok: true });
});

platformApiRoutes.post("/tenants", async (c) => {
	const body = await c.req.json<{
		slug: string;
		businessName: string;
		ownerName: string;
		ownerEmail: string;
		ownerPassword: string;
		plan: string;
	}>();

	if (!body.slug || !body.businessName || !body.ownerName || !body.ownerEmail || !body.ownerPassword) {
		return c.json({ error: "Campos obrigatorios faltando" }, 400);
	}

	const slug = body.slug.toLowerCase().trim();
	const available = await isSlugAvailable(c.env.DB, slug);
	if (!available) return c.json({ error: "Slug indisponivel" }, 400);

	const tenant = await provisionTenant(c.env.DB, {
		slug,
		name: body.businessName,
		ownerName: body.ownerName,
		ownerEmail: body.ownerEmail,
		ownerPassword: body.ownerPassword,
		plan: body.plan || "starter",
	});

	return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug } }, 201);
});

// List tenant users
platformApiRoutes.get("/tenants/:id/users", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const users = await getTenantUsers(c.env.DB, id);
	return c.json(users);
});

// Reset user password
platformApiRoutes.post("/tenants/:id/users/:userId/reset-password", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const userId = parseInt(c.req.param("userId"), 10);
	const body = await c.req.json<{ new_password: string }>();

	if (!body.new_password) {
		return c.json({ error: "new_password is required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.new_password, salt);

	await c.env.DB.prepare(
		"UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
	)
		.bind(passwordHash, salt, userId, tenantId)
		.run();

	return c.json({ ok: true });
});

// Send/resend welcome email with new credentials
platformApiRoutes.post("/tenants/:id/send-credentials", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const tenant = await getTenantDetail(c.env.DB, tenantId);
	if (!tenant) return c.json({ error: "Tenant não encontrado" }, 404);

	// Get the owner user (fallback to any active user if no owner role)
	let owner = await c.env.DB
		.prepare("SELECT id, name, email FROM users WHERE tenant_id = ? AND role = 'owner' AND active = 1 LIMIT 1")
		.bind(tenantId)
		.first<{ id: number; name: string; email: string }>();
	if (!owner) {
		owner = await c.env.DB
			.prepare("SELECT id, name, email FROM users WHERE tenant_id = ? AND active = 1 ORDER BY id ASC LIMIT 1")
			.bind(tenantId)
			.first<{ id: number; name: string; email: string }>();
	}
	if (!owner) return c.json({ error: "Nenhum usuário ativo encontrado neste tenant" }, 404);

	// Generate new temp password and reset
	const tempPassword = crypto.randomUUID().slice(0, 12);
	const salt = generateSalt();
	const passwordHash = await hashPassword(tempPassword, salt);
	await c.env.DB.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(passwordHash, salt, owner.id).run();

	// Send welcome email
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const plans = await getPlanDefinitions(c.env.DB);
	const planCfg = plans[tenant.plan];
	const { buildWelcomeEmail, sendAndLogEmail } = await import("../../lib/email");
	const welcomeEmail = buildWelcomeEmail({
		ownerName: owner.name, businessName: tenant.name, slug: tenant.slug, domain,
		tempPassword, plan: tenant.plan,
		planLabel: planCfg?.label || tenant.plan, priceCents: planCfg?.priceCents || 0, trialDays: 30,
	});
	welcomeEmail.to = owner.email;
	const sent = await sendAndLogEmail(c.env.DB, c.env.RESEND_API_KEY, `Giro Kids <contato@${domain}>`, welcomeEmail,
		{ tenantId, recipient: owner.email, subject: welcomeEmail.subject, eventType: "welcome_manual" });

	return c.json({ ok: true, sent, email: owner.email });
});

// Impersonate a tenant user
platformApiRoutes.post("/tenants/:id/impersonate/:userId", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const userId = parseInt(c.req.param("userId"), 10);

	// Verify user belongs to this tenant
	const user = await c.env.DB.prepare(
		"SELECT id FROM users WHERE id = ? AND tenant_id = ? AND active = 1",
	)
		.bind(userId, tenantId)
		.first<{ id: number }>();

	if (!user) {
		return c.json({ error: "User not found or inactive" }, 404);
	}

	const session = await createAuthSession(c.env.DB, userId);
	if (!session) {
		return c.json({ error: "Failed to create session" }, 500);
	}

	return c.json({ ok: true, session_id: session.id });
});

// Get active/stuck sessions
platformApiRoutes.get("/tenants/:id/sessions", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const sessions = await getTenantActiveSessions(c.env.DB, id);
	return c.json(sessions);
});

// Force complete a stuck session
platformApiRoutes.post("/tenants/:id/sessions/:sessionId/force-complete", async (c) => {
	const tenantId = parseInt(c.req.param("id"), 10);
	const sessionId = c.req.param("sessionId");

	const result = await c.env.DB.prepare(
		`UPDATE rental_sessions SET status = 'completed', end_time = datetime('now'), updated_at = datetime('now')
		WHERE id = ? AND tenant_id = ? AND status IN ('running', 'paused')`,
	)
		.bind(sessionId, tenantId)
		.run();

	if (!result.meta.changes) {
		return c.json({ error: "Session not found or already completed" }, 404);
	}

	return c.json({ ok: true });
});

// Get tenant config
platformApiRoutes.get("/tenants/:id/config", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const config = await getTenantConfig(c.env.DB, id);
	if (!config) return c.json({ error: "Tenant not found" }, 404);
	return c.json(config);
});

// Update tenant config
platformApiRoutes.put("/tenants/:id/config", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{
		name?: string;
		cnpj?: string | null;
		address?: string | null;
		phone?: string | null;
		receipt_footer?: string | null;
	}>();

	await updateTenantConfig(c.env.DB, id, body);
	return c.json({ ok: true });
});

// Update tenant plan
platformApiRoutes.put("/tenants/:id/plan", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{
		plan: string;
		max_users?: number;
		max_assets?: number;
	}>();

	if (!body.plan) {
		return c.json({ error: "plan is required" }, 400);
	}

	const defaults = getLimitsForPlan(body.plan);
	const maxUsers = body.max_users ?? defaults.maxUsers;
	const maxAssets = body.max_assets ?? defaults.maxAssets;

	// Get current plan before updating to detect changes
	const tenant = await getTenantDetail(c.env.DB, id);
	const oldPlan = tenant?.plan || "unknown";

	await updateTenantPlan(c.env.DB, id, body.plan, maxUsers, maxAssets);

	// Notify superadmins if plan changed
	if (tenant && oldPlan !== body.plan) {
		try {
			const { notifySuperadmins, buildPlanChangeNotification } = await import("../../lib/email");
			const domain = c.env.APP_DOMAIN || "giro-kids.com";
			const notification = buildPlanChangeNotification({
				tenantName: tenant.name,
				tenantSlug: tenant.slug,
				oldPlan,
				newPlan: body.plan,
				domain,
			});
			await notifySuperadmins(c.env.DB, c.env.RESEND_API_KEY, domain, notification.subject, notification.html, "admin_plan_change", { tenant_id: String(id), old_plan: oldPlan, new_plan: body.plan });
		} catch { /* non-critical */ }
	}

	return c.json({ ok: true });
});

// Get tenant logs
platformApiRoutes.get("/tenants/:id/logs", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const logs = await getTenantLogs(c.env.DB, id);
	return c.json(logs);
});

// Get cross-tenant logs
platformApiRoutes.get("/logs", async (c) => {
	const logs = await getCrossTenantLogs(c.env.DB);
	return c.json(logs);
});

// --- Superadmin routes ---

// List all superadmin users
platformApiRoutes.get("/superadmins", async (c) => {
	const users = await getSuperadminUsers(c.env.DB);
	return c.json(users);
});

// Create superadmin
platformApiRoutes.post("/superadmins", async (c) => {
	const body = await c.req.json<{ name: string; email: string; password: string }>();

	if (!body.name || !body.email || !body.password) {
		return c.json({ error: "name, email, and password are required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.password, salt);

	const user = await createSuperadminUser(c.env.DB, {
		name: body.name,
		email: body.email,
		passwordHash,
		salt,
	});

	return c.json(user, 201);
});

// Toggle superadmin active status
platformApiRoutes.post("/superadmins/:id/toggle-active", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{ active: boolean }>();

	await toggleSuperadminActive(c.env.DB, id, body.active);
	return c.json({ ok: true });
});

// Reset superadmin password
platformApiRoutes.post("/superadmins/:id/reset-password", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{ new_password: string }>();

	if (!body.new_password) {
		return c.json({ error: "new_password is required" }, 400);
	}

	const salt = generateSalt();
	const passwordHash = await hashPassword(body.new_password, salt);

	await resetSuperadminPassword(c.env.DB, id, passwordHash, salt);
	return c.json({ ok: true });
});

// --- Plans routes ---

// Get plan definitions
platformApiRoutes.get("/plans", async (c) => {
	const plans = await getPlanDefinitions(c.env.DB);
	return c.json(plans);
});

// Update plan definitions
platformApiRoutes.put("/plans", async (c) => {
	const body = await c.req.json();
	await updatePlanDefinitions(c.env.DB, body);
	return c.json({ ok: true });
});

// --- Report routes ---

// Revenue over time
platformApiRoutes.get("/reports/revenue", async (c) => {
	const period = (c.req.query("period") || "daily") as "daily" | "weekly" | "monthly";
	const start = c.req.query("start") || "";
	const end = c.req.query("end") || "";
	const data = await getRevenueOverTime(c.env.DB, period, start, end);
	return c.json(data);
});

// Tenant growth
platformApiRoutes.get("/reports/tenant-growth", async (c) => {
	const data = await getTenantGrowth(c.env.DB);
	return c.json(data);
});

// Active tenants
platformApiRoutes.get("/reports/active-tenants", async (c) => {
	const days = parseInt(c.req.query("days") || "7", 10);
	const data = await getActiveTenants(c.env.DB, days);
	return c.json(data);
});

// Inactive tenants
platformApiRoutes.get("/reports/inactive-tenants", async (c) => {
	const days = parseInt(c.req.query("days") || "30", 10);
	const data = await getInactiveTenants(c.env.DB, days);
	return c.json(data);
});

// Top tenants by revenue
platformApiRoutes.get("/reports/top-tenants", async (c) => {
	const limit = parseInt(c.req.query("limit") || "10", 10);
	const start = c.req.query("start");
	const end = c.req.query("end");
	const data = await getTopTenantsByRevenue(c.env.DB, limit, start, end);
	return c.json(data);
});

// --- Cross-tenant views ---

// All users across tenants
platformApiRoutes.get("/users", async (c) => {
	const users = await getAllUsersAcrossTenants(c.env.DB);
	return c.json(users);
});

// Subscription details
platformApiRoutes.get("/subscriptions", async (c) => {
	const subs = await getSubscriptionDetails(c.env.DB);
	return c.json(subs);
});

// --- Support tickets (platform side) ---

import {
	getAllTickets,
	getTicketById,
	getTicketMessages,
	addMessage as addTicketMessage,
	markMessagesRead,
	updateTicketStatus,
	getUnreadTicketCount,
} from "../../db/queries/support-tickets";

platformApiRoutes.get("/tickets", async (c) => {
	const tickets = await getAllTickets(c.env.DB);
	return c.json(tickets);
});

platformApiRoutes.get("/tickets/unread", async (c) => {
	const count = await getUnreadTicketCount(c.env.DB);
	return c.json({ count });
});

platformApiRoutes.get("/tickets/:id/messages", async (c) => {
	const ticketId = parseInt(c.req.param("id"), 10);
	const afterId = c.req.query("after") ? parseInt(c.req.query("after")!, 10) : undefined;
	const messages = await getTicketMessages(c.env.DB, ticketId, afterId);
	await markMessagesRead(c.env.DB, ticketId, "platform");
	const ticket = await getTicketById(c.env.DB, ticketId, null);
	const enriched = messages.map((m) => ({
		...m,
		attachment_url: m.attachment_key ? `/api/support-tickets/attachments/${m.attachment_key}` : null,
	}));
	return c.json({ messages: enriched, ticket: ticket ? { status: ticket.status, tenant_name: ticket.tenant_name } : null });
});

platformApiRoutes.post("/tickets/:id/messages", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Não autenticado" }, 401);
	const ticketId = parseInt(c.req.param("id"), 10);

	const contentType = c.req.header("content-type") || "";
	let message = "";
	let attachment: { key: string; name: string; type: string } | undefined;

	if (contentType.includes("multipart/form-data")) {
		const formData = await c.req.formData();
		message = (formData.get("message") as string)?.trim() || "";
		const file = formData.get("file") as File | null;
		if (file && file.size > 0 && file.size <= 10 * 1024 * 1024) {
			const ext = file.name.split(".").pop() || "bin";
			const key = `tickets/${ticketId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
			await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
				httpMetadata: { contentType: file.type },
			});
			attachment = { key, name: file.name, type: file.type };
			if (!message) message = `📎 ${file.name}`;
		}
	} else {
		const body = await c.req.json<{ message: string }>();
		message = body.message?.trim() || "";
	}

	if (!message) return c.json({ error: "Mensagem obrigatória" }, 400);
	const msg = await addTicketMessage(c.env.DB, ticketId, "platform", user.id, user.name, message, attachment);
	return c.json(msg, 201);
});

platformApiRoutes.post("/tickets/:id/status", async (c) => {
	const ticketId = parseInt(c.req.param("id"), 10);
	const body = await c.req.json<{ status: string }>();
	if (!["open", "awaiting_reply", "resolved", "closed"].includes(body.status)) {
		return c.json({ error: "Status inválido" }, 400);
	}
	await updateTicketStatus(c.env.DB, ticketId, body.status as any);
	return c.json({ ok: true });
});

// --- CRM Leads ---

import {
	listLeads, getLeadById, createLead, updateLead, updateLeadStatus,
	deleteLead, getLeadNotes, addLeadNote, getOverdueLeads, getCrmStats,
	getLeadsByStatus, markLeadConverted, getTodayAgenda, getFunnelVelocity,
	findDuplicateLeads, LOSS_REASONS,
} from "../../db/queries/crm-leads";
import { buildPresentationEmail, buildWelcomeEmail, sendAndLogEmail } from "../../lib/email";

const CRM_VALID_STATUSES = ["novo", "contatado", "proposta_enviada", "negociacao", "ganho", "perdido"];
const CRM_MAX_LENGTHS: Record<string, number> = {
	company_name: 200, contact_name: 200, contact_role: 100, email: 254,
	whatsapp: 30, social_profile: 200, address: 500, loss_reason: 500, map_embed: 1000,
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAP_EMBED_REGEX = /^https:\/\/(www\.)?google\.com\/maps\/embed/;

function validateCrmFields(body: Record<string, unknown>): string | null {
	for (const [field, max] of Object.entries(CRM_MAX_LENGTHS)) {
		const val = body[field];
		if (val && typeof val === "string" && val.length > max) {
			return `${field} excede o limite de ${max} caracteres`;
		}
	}
	if (body.email && typeof body.email === "string" && !EMAIL_REGEX.test(body.email)) {
		return "Formato de email inválido";
	}
	if (body.status && typeof body.status === "string" && !CRM_VALID_STATUSES.includes(body.status)) {
		return "Status inválido";
	}
	if (body.map_embed && typeof body.map_embed === "string") {
		// Extract src from pasted iframe
		let src = body.map_embed;
		const match = src.match(/src="([^"]+)"/);
		if (match) src = match[1];
		if (!MAP_EMBED_REGEX.test(src)) {
			return "URL do mapa inválida. Use o iframe do Google Maps.";
		}
		body.map_embed = src;
	}
	return null;
}

platformApiRoutes.get("/crm/stats", async (c) => {
	const stats = await getCrmStats(c.env.DB);
	return c.json(stats);
});

platformApiRoutes.get("/crm/leads", async (c) => {
	const params = {
		status: c.req.query("status"),
		search: c.req.query("search"),
		source: c.req.query("source"),
		potential: c.req.query("potential"),
		page: c.req.query("page") ? parseInt(c.req.query("page")!, 10) : undefined,
		limit: c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined,
	};
	const result = await listLeads(c.env.DB, params);
	return c.json(result);
});

platformApiRoutes.get("/crm/leads/kanban", async (c) => {
	const data = await getLeadsByStatus(c.env.DB);
	return c.json(data);
});

platformApiRoutes.get("/crm/leads/overdue", async (c) => {
	const leads = await getOverdueLeads(c.env.DB);
	return c.json(leads);
});

platformApiRoutes.get("/crm/leads/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const lead = await getLeadById(c.env.DB, id);
	if (!lead) return c.json({ error: "Lead não encontrado" }, 404);
	return c.json(lead);
});

platformApiRoutes.post("/crm/leads", async (c) => {
	const body = await c.req.json<Record<string, unknown>>();
	if (!body.company_name || !body.contact_name) {
		return c.json({ error: "Nome da empresa e nome do contato são obrigatórios" }, 400);
	}
	const fieldErr = validateCrmFields(body);
	if (fieldErr) return c.json({ error: fieldErr }, 400);
	const lead = await createLead(c.env.DB, body as any);
	return c.json(lead, 201);
});

platformApiRoutes.put("/crm/leads/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const existing = await getLeadById(c.env.DB, id);
	if (!existing) return c.json({ error: "Lead não encontrado" }, 404);
	const body = await c.req.json<Record<string, unknown>>();
	const fieldErr = validateCrmFields(body);
	if (fieldErr) return c.json({ error: fieldErr }, 400);
	await updateLead(c.env.DB, id, body as any);
	return c.json({ ok: true });
});

platformApiRoutes.put("/crm/leads/:id/status", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const existing = await getLeadById(c.env.DB, id);
	if (!existing) return c.json({ error: "Lead não encontrado" }, 404);
	const body = await c.req.json<{ status: string; loss_reason?: string }>();
	if (!CRM_VALID_STATUSES.includes(body.status)) {
		return c.json({ error: "Status inválido" }, 400);
	}
	await updateLeadStatus(c.env.DB, id, body.status, body.loss_reason);
	return c.json({ ok: true });
});

platformApiRoutes.delete("/crm/leads/:id", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	await deleteLead(c.env.DB, id);
	return c.json({ ok: true });
});

platformApiRoutes.get("/crm/leads/:id/notes", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const notes = await getLeadNotes(c.env.DB, id);
	return c.json(notes);
});

platformApiRoutes.post("/crm/leads/:id/notes", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const user = c.get("user");
	if (!user) return c.json({ error: "Não autenticado" }, 401);
	const body = await c.req.json<{ note: string; next_step: string }>();
	if (!body.note?.trim()) return c.json({ error: "Nota é obrigatória" }, 400);
	if (!body.next_step?.trim()) return c.json({ error: "Próximo passo é obrigatório" }, 400);
	const note = await addLeadNote(c.env.DB, id, user.id, user.name, body.note.trim(), body.next_step.trim());
	return c.json(note, 201);
});

platformApiRoutes.post("/crm/leads/:id/send-presentation", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const lead = await getLeadById(c.env.DB, id);
	if (!lead) return c.json({ error: "Lead não encontrado" }, 404);
	if (!lead.email) return c.json({ error: "Lead não possui email cadastrado" }, 400);
	if (!EMAIL_REGEX.test(lead.email)) return c.json({ error: "Email do lead é inválido" }, 400);

	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const body = await c.req.json<{ customMessage?: string }>().catch(() => ({} as { customMessage?: string }));

	const emailParams = buildPresentationEmail({
		contactName: lead.contact_name,
		companyName: lead.company_name,
		domain,
		customMessage: body.customMessage,
	});
	emailParams.to = lead.email;

	const sent = await sendAndLogEmail(
		c.env.DB, c.env.RESEND_API_KEY, `Giro Kids <contato@${domain}>`, emailParams,
		{ tenantId: null, recipient: lead.email, subject: emailParams.subject, eventType: "crm_presentation", metadata: { lead_id: String(id) } },
	);

	if (lead.status === "novo") {
		await updateLeadStatus(c.env.DB, id, "contatado");
	} else {
		await c.env.DB.prepare("UPDATE crm_leads SET last_contact_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();
	}

	return c.json({ ok: true, sent });
});

platformApiRoutes.post("/crm/leads/:id/convert", async (c) => {
	const id = parseInt(c.req.param("id"), 10);
	const lead = await getLeadById(c.env.DB, id);
	if (!lead) return c.json({ error: "Lead não encontrado" }, 404);
	if (lead.status === "ganho") return c.json({ error: "Lead já foi convertido" }, 400);
	if (!lead.email) return c.json({ error: "Lead precisa ter email cadastrado para ser convertido" }, 400);
	if (!EMAIL_REGEX.test(lead.email)) return c.json({ error: "Email do lead é inválido" }, 400);

	const body = await c.req.json<{ slug: string; ownerPassword: string; plan: string }>();
	if (!body.slug || !body.ownerPassword) {
		return c.json({ error: "Slug e senha são obrigatórios" }, 400);
	}

	const { isSlugAvailable, provisionTenant } = await import("../../services/provisioning");
	const slug = body.slug.toLowerCase().trim();
	const available = await isSlugAvailable(c.env.DB, slug);
	if (!available) return c.json({ error: "Este subdomínio não está disponível" }, 400);

	const plan = body.plan || "starter";
	const tenant = await provisionTenant(c.env.DB, {
		slug,
		name: lead.company_name,
		ownerName: lead.contact_name,
		ownerEmail: lead.email,
		ownerPassword: body.ownerPassword,
		plan,
	});

	await markLeadConverted(c.env.DB, id, tenant.id);

	// Preserve lead notes as operation logs in the new tenant
	const notes = await getLeadNotes(c.env.DB, id);
	for (const note of notes) {
		await c.env.DB.prepare(
			"INSERT INTO operation_logs (tenant_id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, NULL, 'crm.note', 'lead', ?, ?, ?)",
		).bind(tenant.id, String(id), JSON.stringify({ note: note.note, next_step: note.next_step, by: note.user_name }), note.created_at).run();
	}

	// Send welcome email with credentials
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const plans = await getPlanDefinitions(c.env.DB);
	const planCfg = plans[plan];
	const welcomeEmail = buildWelcomeEmail({
		ownerName: lead.contact_name,
		businessName: lead.company_name,
		slug,
		domain,
		tempPassword: body.ownerPassword,
		plan,
		planLabel: planCfg?.label || plan,
		priceCents: planCfg?.priceCents || 0,
		trialDays: 30,
	});
	welcomeEmail.to = lead.email;
	await sendAndLogEmail(
		c.env.DB, c.env.RESEND_API_KEY, `Giro Kids <contato@${domain}>`, welcomeEmail,
		{ tenantId: tenant.id, recipient: lead.email, subject: welcomeEmail.subject, eventType: "welcome_conversion", metadata: { lead_id: String(id), plan } },
	);

	return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug } }, 201);
});

// Agenda do dia
platformApiRoutes.get("/crm/agenda", async (c) => {
	const agenda = await getTodayAgenda(c.env.DB);
	return c.json(agenda);
});

// Velocidade do funil
platformApiRoutes.get("/crm/funnel-velocity", async (c) => {
	const velocity = await getFunnelVelocity(c.env.DB);
	return c.json(velocity);
});

// ── Reprocessar checkout Stripe (recuperação manual) ──
platformApiRoutes.post("/recover-checkout", async (c) => {
	const body = await c.req.json<{ session_id: string }>();
	if (!body.session_id) return c.json({ error: "session_id é obrigatório" }, 400);
	if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "STRIPE_SECRET_KEY não configurada" }, 500);

	const { getCheckoutSession } = await import("../../lib/stripe");
	const { isSlugAvailable, provisionTenant } = await import("../../services/provisioning");
	const { buildWelcomeEmail, sendAndLogEmail } = await import("../../lib/email");
	const { markCheckoutConverted } = await import("../../db/queries/platform");

	// Fetch session from Stripe
	const session = await getCheckoutSession(c.env.STRIPE_SECRET_KEY, body.session_id);
	const sub = session.subscription as unknown as Record<string, unknown>;
	const meta = (sub?.metadata ?? session.metadata ?? {}) as Record<string, string>;

	// Try metadata, then fallback to abandoned_checkouts
	let slug = meta.tenant_slug;
	let tenantName = meta.tenant_name;
	let ownerName = meta.owner_name;
	let ownerEmail = meta.owner_email;
	let plan = meta.plan || "starter";

	if (!slug) {
		const email = ownerEmail || (session as any).customer_details?.email;
		if (email) {
			const abandoned = await c.env.DB
				.prepare("SELECT slug, business_name, owner_name, owner_email, plan FROM abandoned_checkouts WHERE owner_email = ? AND converted = 0 ORDER BY created_at DESC LIMIT 1")
				.bind(email)
				.first<{ slug: string; business_name: string; owner_name: string; owner_email: string; plan: string }>();
			if (abandoned) {
				slug = abandoned.slug;
				tenantName = abandoned.business_name;
				ownerName = abandoned.owner_name;
				ownerEmail = abandoned.owner_email;
				plan = abandoned.plan;
			}
		}
	}

	if (!slug || !ownerEmail) {
		return c.json({ error: `Dados insuficientes: slug=${slug}, email=${ownerEmail}` }, 400);
	}

	// Check if tenant already exists
	const existing = await c.env.DB.prepare("SELECT id, slug FROM tenants WHERE slug = ?").bind(slug).first();
	if (existing) return c.json({ error: `Tenant ${slug} já existe`, tenant: existing }, 409);

	// Provision
	const tempPassword = crypto.randomUUID().slice(0, 12);
	const tenant = await provisionTenant(c.env.DB, {
		slug, name: tenantName || slug, ownerName: ownerName || "Administrador",
		ownerEmail, ownerPassword: tempPassword, plan,
		stripeCustomerId: session.customer as string,
		stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
	});

	try { await markCheckoutConverted(c.env.DB, slug); } catch { /* non-critical */ }

	// Send welcome email
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const plans = await getPlanDefinitions(c.env.DB);
	const planCfg = plans[plan];
	const welcomeEmail = buildWelcomeEmail({
		ownerName: ownerName || "Administrador", businessName: tenantName || slug,
		slug, domain, tempPassword, plan,
		planLabel: planCfg?.label || plan, priceCents: planCfg?.priceCents || 0, trialDays: 30,
	});
	welcomeEmail.to = ownerEmail;
	await sendAndLogEmail(c.env.DB, c.env.RESEND_API_KEY, `Giro Kids <contato@${domain}>`, welcomeEmail,
		{ tenantId: tenant.id, recipient: ownerEmail, subject: welcomeEmail.subject, eventType: "welcome_recovery", metadata: { slug, plan } });

	return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug }, emailSent: true });
});

// Verificar duplicidade
platformApiRoutes.get("/crm/check-duplicate", async (c) => {
	const name = c.req.query("name") || "";
	const email = c.req.query("email");
	if (!name) return c.json([]);
	const duplicates = await findDuplicateLeads(c.env.DB, name, email || undefined);
	return c.json(duplicates);
});
