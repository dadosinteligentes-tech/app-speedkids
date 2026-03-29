import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { constructWebhookEvent } from "../../lib/stripe";
import { provisionTenant } from "../../services/provisioning";
import { sendAndLogEmail, buildWelcomeEmail, notifySuperadmins, buildNewPurchaseNotification } from "../../lib/email";
import { getPlanDefinitions, markCheckoutConverted } from "../../db/queries/platform";

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
				customer_details?: { email?: string; name?: string };
			};

			// Try to get metadata from subscription (primary source)
			let sub: { metadata: Record<string, string> } | null = null;
			if (session.subscription && c.env.STRIPE_SECRET_KEY) {
				sub = await fetchSubscription(c.env.STRIPE_SECRET_KEY, session.subscription as string);
			} else if (!c.env.STRIPE_SECRET_KEY) {
				console.error("STRIPE_SECRET_KEY not configured — cannot fetch subscription metadata");
			}

			let metadata = sub?.metadata || session.metadata || {};
			let slug = metadata.tenant_slug;
			let tenantName = metadata.tenant_name;
			let ownerName = metadata.owner_name;
			let ownerEmail = metadata.owner_email || session.customer_details?.email;
			let plan = metadata.plan || "starter";

			// Fallback: if metadata is empty, try to recover from abandoned_checkouts
			if (!slug && ownerEmail) {
				console.log(`No metadata found, trying to recover from abandoned_checkouts for ${ownerEmail}`);
				const abandoned = await c.env.DB
					.prepare("SELECT slug, business_name, owner_name, owner_email, plan FROM abandoned_checkouts WHERE owner_email = ? AND converted = 0 ORDER BY created_at DESC LIMIT 1")
					.bind(ownerEmail)
					.first<{ slug: string; business_name: string; owner_name: string; owner_email: string; plan: string }>();
				if (abandoned) {
					slug = abandoned.slug;
					tenantName = abandoned.business_name;
					ownerName = abandoned.owner_name;
					ownerEmail = abandoned.owner_email;
					plan = abandoned.plan;
					console.log(`Recovered from abandoned_checkouts: slug=${slug}, email=${ownerEmail}`);
				}
			}

			// Last resort: try customer_details from the checkout event itself
			if (!slug && session.customer_details?.email) {
				const abandoned = await c.env.DB
					.prepare("SELECT slug, business_name, owner_name, owner_email, plan FROM abandoned_checkouts WHERE owner_email = ? AND converted = 0 ORDER BY created_at DESC LIMIT 1")
					.bind(session.customer_details.email)
					.first<{ slug: string; business_name: string; owner_name: string; owner_email: string; plan: string }>();
				if (abandoned) {
					slug = abandoned.slug;
					tenantName = abandoned.business_name;
					ownerName = abandoned.owner_name;
					ownerEmail = abandoned.owner_email;
					plan = abandoned.plan;
					console.log(`Recovered from abandoned_checkouts via customer_details: slug=${slug}`);
				}
			}

			if (!slug || !ownerEmail) {
				console.error(`FAILED to provision — missing data in checkout ${event.id}: slug=${slug}, email=${ownerEmail}, metadata=${JSON.stringify(metadata)}, customer_details=${JSON.stringify(session.customer_details)}`);
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

			// Generate a random password
			const tempPassword = crypto.randomUUID().slice(0, 12);

			try {
				const tenant = await provisionTenant(c.env.DB, {
					slug,
					name: tenantName || slug,
					ownerName: ownerName || "Administrador",
					ownerEmail,
					ownerPassword: tempPassword,
					plan,
					stripeCustomerId: session.customer as string,
					stripeSubscriptionId: session.subscription as string,
				});

				console.log(`Provisioned tenant ${tenant.slug} (id=${tenant.id}) for ${ownerEmail} [plan=${plan}]`);

				// Mark abandoned checkout as converted
				try { await markCheckoutConverted(c.env.DB, slug); } catch { /* non-critical */ }

				// Get plan details for the email
				const plans = await getPlanDefinitions(c.env.DB);
				const planConfig = plans[plan];
				const planLabel = planConfig?.label || plan.charAt(0).toUpperCase() + plan.slice(1);
				const priceCents = planConfig?.priceCents || 0;

				// Send welcome email with purchase details
				const domain = c.env.APP_DOMAIN || "giro-kids.com";
				const welcomeEmail = buildWelcomeEmail({
					ownerName: ownerName || "Administrador",
					businessName: tenantName || slug,
					slug,
					domain,
					tempPassword,
					plan,
					planLabel,
					priceCents,
					trialDays: 30,
				});
				welcomeEmail.to = ownerEmail;

				const emailSent = await sendAndLogEmail(
					c.env.DB,
					c.env.RESEND_API_KEY,
					`Giro Kids <contato@${domain}>`,
					welcomeEmail,
					{
						tenantId: tenant.id,
						recipient: ownerEmail,
						subject: welcomeEmail.subject,
						eventType: "welcome",
						metadata: { plan, slug, stripe_customer_id: session.customer as string },
					},
				);
				console.log(`Welcome email for ${ownerEmail}: ${emailSent ? "SENT" : "FAILED"} (RESEND_API_KEY ${c.env.RESEND_API_KEY ? "configured" : "MISSING"})`);

					// Notify superadmins about new purchase
					try {
						const notification = buildNewPurchaseNotification({
							businessName: tenantName || slug,
							ownerName: ownerName || "Administrador",
							ownerEmail,
							plan,
							planLabel,
							slug,
							domain,
						});
						await notifySuperadmins(c.env.DB, c.env.RESEND_API_KEY, domain, notification.subject, notification.html, "admin_new_purchase", { plan, slug, owner_email: ownerEmail });
					} catch { /* non-critical */ }
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

		case "invoice.paid":
		case "invoice.payment_succeeded": {
			const invoice = event.data.object as {
				subscription: string;
				customer: string;
			};

			if (invoice.subscription) {
				const subscription = await c.env.DB
					.prepare("SELECT tenant_id FROM subscriptions WHERE stripe_subscription_id = ?")
					.bind(invoice.subscription)
					.first<{ tenant_id: number }>();

				if (subscription) {
					await c.env.DB
						.prepare("UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ? AND status = 'suspended'")
						.bind(subscription.tenant_id)
						.run();
					await c.env.DB
						.prepare("UPDATE subscriptions SET status = 'active', updated_at = datetime('now') WHERE stripe_subscription_id = ? AND status != 'active'")
						.bind(invoice.subscription)
						.run();
				}
			}
			break;
		}

		case "invoice.payment_failed": {
			const invoice = event.data.object as {
				subscription: string;
				customer: string;
				attempt_count: number;
			};

			if (invoice.subscription) {
				await c.env.DB
					.prepare("UPDATE subscriptions SET status = 'past_due', updated_at = datetime('now') WHERE stripe_subscription_id = ?")
					.bind(invoice.subscription)
					.run();

				// Notify tenant owner about failed payment
				const tenantInfo = await c.env.DB
					.prepare(`
						SELECT t.id as tenant_id, t.owner_email, t.name as tenant_name
						FROM subscriptions s
						JOIN tenants t ON t.id = s.tenant_id
						WHERE s.stripe_subscription_id = ?
					`)
					.bind(invoice.subscription)
					.first<{ tenant_id: number; owner_email: string; tenant_name: string }>();

				if (tenantInfo) {
					const domain = c.env.APP_DOMAIN || "giro-kids.com";
					await sendAndLogEmail(
						c.env.DB,
						c.env.RESEND_API_KEY,
						`Giro Kids <contato@${domain}>`,
						{
							to: tenantInfo.owner_email,
							subject: `Problema no pagamento — ${tenantInfo.tenant_name}`,
							html: buildPaymentFailedEmail(tenantInfo.tenant_name, invoice.attempt_count),
						},
						{
							tenantId: tenantInfo.tenant_id,
							recipient: tenantInfo.owner_email,
							subject: `Problema no pagamento — ${tenantInfo.tenant_name}`,
							eventType: "payment_failed",
							metadata: { attempt_count: String(invoice.attempt_count) },
						},
					);
				}

				console.warn(`Payment failed for subscription ${invoice.subscription} (attempt ${invoice.attempt_count})`);
			}
			break;
		}

		case "customer.subscription.deleted": {
			const sub = event.data.object as { id: string };

			await c.env.DB
				.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = datetime('now') WHERE stripe_subscription_id = ?")
				.bind(sub.id)
				.run();

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

function buildPaymentFailedEmail(tenantName: string, attemptCount: number): string {
	return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #DC2626, #B91C1C); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 20px;">Problema no pagamento</h1>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Não conseguimos processar o pagamento da assinatura de <strong>${tenantName}</strong>.
        Esta é a tentativa nº ${attemptCount}.
      </p>
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Por favor, atualize seu método de pagamento para evitar a suspensão do serviço.
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 20px;">
        Acesse seu painel e vá em Configurações &rarr; Meu Plano para gerenciar seu pagamento.
      </p>
    </div>
    <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #9CA3AF;">Giro Kids — DADOS INTELIGENTES LTDA — CNPJ: 47.773.826/0001-57</p>
      <p style="margin: 0; font-size: 10px; color: #C0C4CC;"><a href="https://giro-kids.com/legal/terms" style="color:#C0C4CC">Termos</a> · <a href="https://giro-kids.com/legal/privacy" style="color:#C0C4CC">Privacidade</a></p>
    </div>
  </div>
</body>
</html>`;
}
