import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { isSlugAvailable, provisionTenant } from "../../services/provisioning";
import { createCheckoutSession } from "../../lib/stripe";

export const signupRoutes = new Hono<AppEnv>();

// Plan → Stripe Price ID mapping (set these in Cloudflare dashboard)
const PLAN_PRICES: Record<string, string> = {
	starter: "price_starter", // Replace with actual Stripe Price IDs
	pro: "price_pro",
	enterprise: "price_enterprise",
};

// Check slug availability
signupRoutes.get("/check-slug/:slug", async (c) => {
	const slug = c.req.param("slug").toLowerCase().trim();
	const available = await isSlugAvailable(c.env.DB, slug);
	return c.json({ slug, available });
});

// Create Stripe Checkout session for new tenant
signupRoutes.post("/checkout", async (c) => {
	const body = await c.req.json<{
		slug: string;
		businessName: string;
		ownerName: string;
		ownerEmail: string;
		plan: string;
	}>();

	// Validate
	if (!body.slug || !body.businessName || !body.ownerName || !body.ownerEmail || !body.plan) {
		return c.json({ error: "Todos os campos sao obrigatorios" }, 400);
	}

	const slug = body.slug.toLowerCase().trim();

	const available = await isSlugAvailable(c.env.DB, slug);
	if (!available) {
		return c.json({ error: "Este subdominio nao esta disponivel" }, 400);
	}

	const priceId = PLAN_PRICES[body.plan];
	if (!priceId) {
		return c.json({ error: "Plano invalido" }, 400);
	}

	const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";

	try {
		const session = await createCheckoutSession(c.env.STRIPE_SECRET_KEY, {
			priceId,
			successUrl: `https://www.${domain}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `https://www.${domain}/signup/cancelled`,
			customerEmail: body.ownerEmail,
			metadata: {
				tenant_slug: slug,
				tenant_name: body.businessName,
				owner_name: body.ownerName,
				owner_email: body.ownerEmail,
			},
		});

		return c.json({ checkoutUrl: session.url });
	} catch (err) {
		console.error("Stripe checkout error:", err);
		return c.json({ error: "Erro ao criar sessao de pagamento" }, 500);
	}
});

// Direct provisioning (for testing or manual setup)
signupRoutes.post("/provision", async (c) => {
	// Only allow in dev mode or with a special header
	const isLocal = (c.req.header("host") || "").includes("localhost");
	if (!isLocal) {
		return c.json({ error: "Not allowed" }, 403);
	}

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

	const available = await isSlugAvailable(c.env.DB, body.slug.toLowerCase());
	if (!available) {
		return c.json({ error: "Slug indisponivel" }, 400);
	}

	try {
		const tenant = await provisionTenant(c.env.DB, {
			slug: body.slug.toLowerCase(),
			name: body.businessName,
			ownerName: body.ownerName,
			ownerEmail: body.ownerEmail,
			ownerPassword: body.ownerPassword,
			plan: body.plan || "starter",
		});

		return c.json({ ok: true, tenant: { id: tenant.id, slug: tenant.slug } });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("Provision error:", msg);
		return c.json({ error: `Erro ao provisionar: ${msg}` }, 500);
	}
});
