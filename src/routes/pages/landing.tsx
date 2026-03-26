import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { LandingPage } from "../../views/landing/landing-page";
import { SignupSuccess } from "../../views/landing/signup-success";
import { getPlanDefinitions } from "../../db/queries/platform";
import { getCheckoutSession } from "../../lib/stripe";

export const landingPages = new Hono<AppEnv>();

landingPages.get("/", async (c) => {
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const plans = await getPlanDefinitions(c.env.DB);
	return c.html(<LandingPage domain={domain} stripePublishableKey={c.env.STRIPE_PUBLISHABLE_KEY || ""} plans={plans} />);
});

landingPages.get("/signup/success", async (c) => {
	const domain = c.env.APP_DOMAIN || "giro-kids.com";
	const sessionId = c.req.query("session_id");

	let tenantSlug = "seu-parque";
	if (sessionId && c.env.STRIPE_SECRET_KEY) {
		try {
			const session = await getCheckoutSession(c.env.STRIPE_SECRET_KEY, sessionId);
			// metadata lives on the subscription (subscription_data.metadata)
			const sub = session.subscription as unknown as Record<string, unknown>;
			const meta = (sub?.metadata ?? session.metadata ?? {}) as Record<string, string>;
			if (meta.tenant_slug) {
				tenantSlug = meta.tenant_slug;
			}
		} catch (err) {
			console.error("Failed to retrieve Stripe session:", err);
		}
	}

	return c.html(<SignupSuccess tenantSlug={tenantSlug} domain={domain} />);
});

landingPages.get("/signup/cancelled", (c) => {
	return c.redirect("/#cadastro");
});
