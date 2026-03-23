import { describe, it, expect } from "vitest";
import { constructWebhookEvent } from "../../src/lib/stripe";

describe("constructWebhookEvent", () => {
	const validPayload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed", data: { object: {} } });
	const secret = "whsec_test_secret";

	it("throws on missing signature (no t= component)", async () => {
		await expect(
			constructWebhookEvent(validPayload, "v1=abc123", secret),
		).rejects.toThrow("Invalid Stripe signature");
	});

	it("throws on missing v1= component", async () => {
		const timestamp = Math.floor(Date.now() / 1000).toString();
		await expect(
			constructWebhookEvent(validPayload, `t=${timestamp}`, secret),
		).rejects.toThrow("Invalid Stripe signature");
	});

	it("throws on invalid signature format (empty string)", async () => {
		await expect(
			constructWebhookEvent(validPayload, "", secret),
		).rejects.toThrow("Invalid Stripe signature");
	});

	it("throws on expired timestamp", async () => {
		const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
		await expect(
			constructWebhookEvent(validPayload, `t=${oldTimestamp},v1=fakesig`, secret),
		).rejects.toThrow("Stripe webhook timestamp too old");
	});

	it("throws on invalid signature value (wrong HMAC)", async () => {
		const timestamp = Math.floor(Date.now() / 1000).toString();
		await expect(
			constructWebhookEvent(validPayload, `t=${timestamp},v1=0000000000000000000000000000000000000000000000000000000000000000`, secret),
		).rejects.toThrow("Invalid Stripe signature");
	});
});
