import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { createBillingPortalSession } from "../../lib/stripe";
import { requirePermission } from "../../middleware/require-permission";

export const billingRoutes = new Hono<AppEnv>();

// Generate a Stripe Billing Portal link for the current tenant
billingRoutes.get("/portal", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get("tenant_id");

	const subscription = await c.env.DB
		.prepare("SELECT stripe_customer_id FROM subscriptions WHERE tenant_id = ? AND stripe_customer_id IS NOT NULL LIMIT 1")
		.bind(tenantId)
		.first<{ stripe_customer_id: string }>();

	if (!subscription?.stripe_customer_id) {
		return c.json({ error: "Nenhuma assinatura encontrada" }, 404);
	}

	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const tenant = c.get("tenant");
	const returnUrl = `https://${tenant?.slug}.${domain}/admin`;

	try {
		const session = await createBillingPortalSession(
			c.env.STRIPE_SECRET_KEY,
			subscription.stripe_customer_id,
			returnUrl,
		);
		return c.json({ url: session.url });
	} catch (err) {
		console.error("Billing portal error:", err);
		return c.json({ error: "Erro ao abrir portal de pagamento" }, 500);
	}
});

// Get current subscription status for the tenant
billingRoutes.get("/subscription", requirePermission("settings.manage"), async (c) => {
	const tenantId = c.get("tenant_id");

	const subscription = await c.env.DB
		.prepare(`
			SELECT plan, status, current_period_start, current_period_end, created_at
			FROM subscriptions
			WHERE tenant_id = ?
			ORDER BY created_at DESC LIMIT 1
		`)
		.bind(tenantId)
		.first<{
			plan: string;
			status: string;
			current_period_start: string | null;
			current_period_end: string | null;
			created_at: string;
		}>();

	if (!subscription) {
		return c.json({ subscription: null });
	}

	return c.json({ subscription });
});
