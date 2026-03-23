import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { constructWebhookEvent } from "../../lib/stripe";
import { provisionTenant } from "../../services/provisioning";
import { sendEmail, buildWelcomeEmail } from "../../lib/email";

export const stripeWebhookRoutes = new Hono<AppEnv>();

stripeWebhookRoutes.post("/", async (c) => {
	const signature = c.req.header("stripe-signature");
	if (!signature) {
		return c.json({ error: "Missing signature" }, 400);
	}

	const payload = await c.req.text();

	let event;
	try {
		event = await constructWebhookEvent(payload, signature, c.env.STRIPE_WEBHOOK_SECRET);
	} catch (err) {
		console.error("Webhook signature verification failed:", err);
		return c.json({ error: "Invalid signature" }, 400);
	}

	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as {
				customer: string;
				subscription: string;
				metadata: Record<string, string>;
				customer_details?: { email?: string };
			};

			// The metadata is on the subscription, not the checkout session
			// Fetch it from the subscription's metadata
			const sub = session.subscription
				? await fetchSubscription(c.env.STRIPE_SECRET_KEY, session.subscription as string)
				: null;

			const metadata = sub?.metadata || session.metadata || {};
			const slug = metadata.tenant_slug;
			const tenantName = metadata.tenant_name;
			const ownerName = metadata.owner_name;
			const ownerEmail = metadata.owner_email || session.customer_details?.email;

			if (!slug || !ownerEmail) {
				console.error("Missing metadata in checkout session:", event.id);
				return c.json({ received: true });
			}

			// Check if tenant already exists (idempotency)
			const existing = await c.env.DB
				.prepare("SELECT id FROM tenants WHERE slug = ?")
				.bind(slug)
				.first();

			if (existing) {
				console.log(`Tenant ${slug} already exists, skipping provisioning`);
				return c.json({ received: true });
			}

			// Generate a random password — user will need to reset it or we send it via email
			const tempPassword = crypto.randomUUID().slice(0, 12);

			try {
				const tenant = await provisionTenant(c.env.DB, {
					slug,
					name: tenantName || slug,
					ownerName: ownerName || "Administrador",
					ownerEmail,
					ownerPassword: tempPassword,
					plan: "pro",
					stripeCustomerId: session.customer as string,
					stripeSubscriptionId: session.subscription as string,
				});

				console.log(`Provisioned tenant ${tenant.slug} (id=${tenant.id}) for ${ownerEmail}`);

				// Send welcome email
				const domain = c.env.APP_DOMAIN || "dadosinteligentes.app.br";
				const welcomeEmail = buildWelcomeEmail({
					ownerName: ownerName || "Administrador",
					businessName: tenantName || slug,
					slug,
					domain,
					tempPassword,
				});
				welcomeEmail.to = ownerEmail;
				await sendEmail(
					c.env.RESEND_API_KEY,
					`Dados Inteligentes <noreply@${domain}>`,
					welcomeEmail,
				);
			} catch (err) {
				console.error(`Failed to provision tenant ${slug}:`, err);
			}
			break;
		}

		case "customer.subscription.updated": {
			const sub = event.data.object as {
				id: string;
				status: string;
				current_period_start: number;
				current_period_end: number;
			};

			await c.env.DB
				.prepare(`
					UPDATE subscriptions
					SET status = ?, current_period_start = ?, current_period_end = ?, updated_at = datetime('now')
					WHERE stripe_subscription_id = ?
				`)
				.bind(
					sub.status,
					new Date(sub.current_period_start * 1000).toISOString(),
					new Date(sub.current_period_end * 1000).toISOString(),
					sub.id,
				)
				.run();
			break;
		}

		case "customer.subscription.deleted": {
			const sub = event.data.object as { id: string };

			// Mark subscription cancelled
			await c.env.DB
				.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE stripe_subscription_id = ?")
				.bind(sub.id)
				.run();

			// Suspend tenant
			const subscription = await c.env.DB
				.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
				.bind(sub.id)
				.first<{ tenant_id: number }>();

			if (subscription) {
				await c.env.DB
					.prepare("UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?")
					.bind(subscription.tenant_id)
					.run();
			}
			break;
		}

		default:
			console.log(`Unhandled webhook event: ${event.type}`);
	}

	return c.json({ received: true });
});

// Helper to fetch subscription metadata from Stripe
async function fetchSubscription(
	secretKey: string,
	subscriptionId: string,
): Promise<{ metadata: Record<string, string> } | null> {
	try {
		const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
			headers: { Authorization: `Bearer ${secretKey}` },
		});
		if (!res.ok) return null;
		return await res.json() as { metadata: Record<string, string> };
	} catch {
		return null;
	}
}
