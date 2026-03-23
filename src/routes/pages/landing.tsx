import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { LandingPage } from "../../views/landing/landing-page";
import { SignupSuccess } from "../../views/landing/signup-success";

export const landingPages = new Hono<AppEnv>();

landingPages.get("/", (c) => {
	const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";
	return c.html(<LandingPage domain={domain} stripePublishableKey={c.env.STRIPE_PUBLISHABLE_KEY || ""} />);
});

landingPages.get("/signup/success", async (c) => {
	const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";
	// Try to get tenant slug from Stripe session (simplified: from query param)
	const sessionId = c.req.query("session_id");
	// For now, show a generic success page
	return c.html(<SignupSuccess tenantSlug="seu-parque" domain={domain} />);
});

landingPages.get("/signup/cancelled", (c) => {
	return c.redirect("/#cadastro");
});
