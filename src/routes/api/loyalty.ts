import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { requirePermission } from "../../middleware/require-permission";
import { getLoyaltyConfig, upsertLoyaltyConfig, getLoyaltyStats, getLoyaltyRanking, getCustomerTransactions, getRecentTransactions, addLoyaltyTransaction, getCustomerLoyaltyBalance, markEmailVerified } from "../../db/queries/loyalty";
import { getLimitsForPlan } from "../../lib/plan-limits";
import { generateVerificationToken } from "../../lib/email-verification";
import { sendEmail, buildEmailVerificationEmail } from "../../lib/email";

export const loyaltyRoutes = new Hono<AppEnv>();

// Get loyalty config for tenant
loyaltyRoutes.get("/config", requirePermission("loyalty.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await getLoyaltyConfig(c.env.DB, tenantId);
	return c.json(config);
});

// Update loyalty config
loyaltyRoutes.put("/config", requirePermission("loyalty.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const plan = tenant?.plan ?? "starter";
	const limits = getLimitsForPlan(plan);

	if (!limits.loyalty.enabled) {
		return c.json({ error: "Programa de fidelidade não disponível no seu plano" }, 403);
	}

	const body = await c.req.json<{
		enabled?: boolean;
		points_per_real?: number;
		min_redemption_points?: number;
		points_value_cents?: number;
		tiers?: { name: string; min_points: number }[];
		expiry_months?: number;
		bonus_first_purchase?: number;
		bonus_birthday?: number;
		bonus_referral?: number;
		double_points_weekends?: boolean;
		redemption_options?: { type: "discount" | "extra_time" | "gift" | "cashback"; label: string; points_cost: number; value: string; active: boolean }[];
	}>();

	// Starter plans can only toggle enabled, not customize rates
	if (!limits.loyalty.configurable) {
		await upsertLoyaltyConfig(c.env.DB, tenantId, { enabled: body.enabled });
	} else {
		await upsertLoyaltyConfig(c.env.DB, tenantId, body);
	}

	return c.json({ ok: true });
});

// Get loyalty stats
loyaltyRoutes.get("/stats", requirePermission("loyalty.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const stats = await getLoyaltyStats(c.env.DB, tenantId);
	return c.json(stats);
});

// Get loyalty ranking
loyaltyRoutes.get("/ranking", requirePermission("loyalty.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const limit = parseInt(c.req.query("limit") || "20", 10);
	const ranking = await getLoyaltyRanking(c.env.DB, tenantId, limit);
	return c.json(ranking);
});

// Get recent transactions (all customers)
loyaltyRoutes.get("/transactions", requirePermission("loyalty.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const limit = parseInt(c.req.query("limit") || "50", 10);
	const transactions = await getRecentTransactions(c.env.DB, tenantId, limit);
	return c.json(transactions);
});

// Get customer transactions
loyaltyRoutes.get("/customers/:id/transactions", requirePermission("loyalty.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const customerId = parseInt(c.req.param("id"), 10);
	const transactions = await getCustomerTransactions(c.env.DB, tenantId, customerId);
	return c.json(transactions);
});

// Send email verification
loyaltyRoutes.post("/send-verification", requirePermission("customers.view"), async (c) => {
	const tenantId = c.get("tenant_id");
	const tenant = c.get("tenant");
	const body = await c.req.json<{ customer_id: number }>();

	if (!body.customer_id) return c.json({ error: "customer_id obrigatório" }, 400);

	const customer = await c.env.DB
		.prepare("SELECT id, name, email, email_verified FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(body.customer_id, tenantId)
		.first<{ id: number; name: string; email: string | null; email_verified: number }>();

	if (!customer) return c.json({ error: "Cliente não encontrado" }, 404);
	if (!customer.email) return c.json({ error: "Cliente não possui email cadastrado" }, 400);
	if (customer.email_verified) return c.json({ error: "Email já verificado" }, 400);

	const secret = c.env.LOYALTY_HMAC_SECRET;
	if (!secret) return c.json({ error: "LOYALTY_HMAC_SECRET não configurado" }, 500);

	const token = await generateVerificationToken(secret, tenantId, customer.id, customer.email);
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const slug = tenant?.slug ?? "app";
	const verificationUrl = `https://${slug}.${domain}/loyalty/verify?token=${encodeURIComponent(token)}`;

	const emailParams = buildEmailVerificationEmail({
		customerName: customer.name,
		businessName: tenant?.name ?? "Giro Kids",
		verificationUrl,
	});
	emailParams.to = customer.email;

	const result = await sendEmail(c.env.RESEND_API_KEY, `${tenant?.name ?? "Giro Kids"} <contato@${domain}>`, emailParams);

	if (!result.ok) {
		return c.json({ error: `Falha ao enviar email: ${result.error}` }, 500);
	}

	return c.json({ ok: true, message: "Email de verificação enviado" });
});

// Manual point adjustment
loyaltyRoutes.post("/adjust-points", requirePermission("loyalty.manage"), async (c) => {
	const tenantId = c.get("tenant_id");
	const user = c.get("user");
	const body = await c.req.json<{ customer_id: number; points: number; description: string }>();

	if (!body.customer_id || body.points === undefined || !body.description) {
		return c.json({ error: "customer_id, points e description são obrigatórios" }, 400);
	}

	const customer = await c.env.DB
		.prepare("SELECT id, email_verified FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(body.customer_id, tenantId)
		.first<{ id: number; email_verified: number }>();

	if (!customer) return c.json({ error: "Cliente não encontrado" }, 404);

	// Check balance won't go negative
	if (body.points < 0) {
		const balance = await getCustomerLoyaltyBalance(c.env.DB, tenantId, body.customer_id);
		if (balance + body.points < 0) {
			return c.json({ error: `Saldo insuficiente: ${balance} pontos` }, 400);
		}
	}

	const { balanceAfter } = await addLoyaltyTransaction(
		c.env.DB, tenantId, body.customer_id,
		"adjusted", body.points,
		"manual", null,
		body.description,
		user?.id ?? null,
	);

	return c.json({ ok: true, balance: balanceAfter });
});
