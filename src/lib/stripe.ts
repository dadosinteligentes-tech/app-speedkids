/**
 * Minimal Stripe API client using fetch (no SDK dependency).
 * Cloudflare Workers don't support Node.js SDKs natively.
 */

const STRIPE_API = "https://api.stripe.com/v1";

function encode(params: Record<string, string | number | undefined>): string {
	return Object.entries(params)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
		.join("&");
}

async function stripeRequest<T>(
	secretKey: string,
	method: string,
	path: string,
	body?: Record<string, string | number | undefined>,
): Promise<T> {
	const res = await fetch(`${STRIPE_API}${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body ? encode(body) : undefined,
	});

	const data = await res.json() as T & { error?: { message: string } };
	if (!res.ok) {
		throw new Error((data as { error?: { message: string } }).error?.message || `Stripe error ${res.status}`);
	}
	return data;
}

export interface StripeCheckoutSession {
	id: string;
	url: string;
	payment_status: string;
	metadata: Record<string, string>;
	customer: string;
	subscription: string;
}

export interface StripeEvent {
	id: string;
	type: string;
	data: { object: Record<string, unknown> };
}

export async function createCheckoutSession(
	secretKey: string,
	params: {
		priceId: string;
		successUrl: string;
		cancelUrl: string;
		customerEmail: string;
		metadata: Record<string, string>;
	},
): Promise<StripeCheckoutSession> {
	const body: Record<string, string | number | undefined> = {
		mode: "subscription",
		"line_items[0][price]": params.priceId,
		"line_items[0][quantity]": 1,
		success_url: params.successUrl,
		cancel_url: params.cancelUrl,
		customer_email: params.customerEmail,
		"subscription_data[metadata][tenant_slug]": params.metadata.tenant_slug,
		"subscription_data[metadata][tenant_name]": params.metadata.tenant_name,
		"subscription_data[metadata][owner_name]": params.metadata.owner_name,
		"subscription_data[metadata][owner_email]": params.metadata.owner_email,
	};

	return stripeRequest<StripeCheckoutSession>(secretKey, "POST", "/checkout/sessions", body);
}

export async function constructWebhookEvent(
	payload: string,
	signature: string,
	secret: string,
): Promise<StripeEvent> {
	// Verify Stripe webhook signature using Web Crypto API
	const elements = signature.split(",");
	const timestampStr = elements.find((e) => e.startsWith("t="))?.slice(2);
	const sig = elements.find((e) => e.startsWith("v1="))?.slice(3);

	if (!timestampStr || !sig) {
		throw new Error("Invalid Stripe signature");
	}

	// Check timestamp tolerance (5 minutes)
	const timestamp = parseInt(timestampStr, 10);
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - timestamp) > 300) {
		throw new Error("Stripe webhook timestamp too old");
	}

	const signedPayload = `${timestampStr}.${payload}`;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
	const expected = Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	if (expected !== sig) {
		throw new Error("Invalid Stripe signature");
	}

	return JSON.parse(payload) as StripeEvent;
}
