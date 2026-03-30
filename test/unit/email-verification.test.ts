import { describe, it, expect } from "vitest";
import { generateVerificationToken, verifyVerificationToken } from "../../src/lib/email-verification";

const SECRET = "test-secret-key-12345";

describe("email verification tokens", () => {
	it("generates and verifies a valid token", async () => {
		const token = await generateVerificationToken(SECRET, 1, 42, "user@test.com");
		expect(token).toContain(".");

		const result = await verifyVerificationToken(SECRET, token);
		expect(result.valid).toBe(true);
		expect(result.tenantId).toBe(1);
		expect(result.customerId).toBe(42);
		expect(result.email).toBe("user@test.com");
	});

	it("rejects token with wrong secret", async () => {
		const token = await generateVerificationToken(SECRET, 1, 42, "user@test.com");
		const result = await verifyVerificationToken("wrong-secret", token);
		expect(result.valid).toBe(false);
		expect(result.error).toBe("Assinatura inválida");
	});

	it("rejects malformed token (no dot separator)", async () => {
		const result = await verifyVerificationToken(SECRET, "not-a-valid-token");
		expect(result.valid).toBe(false);
	});

	it("rejects empty string", async () => {
		const result = await verifyVerificationToken(SECRET, "");
		expect(result.valid).toBe(false);
	});

	it("handles email with special characters", async () => {
		const token = await generateVerificationToken(SECRET, 5, 99, "test+special@domain.co.uk");
		const result = await verifyVerificationToken(SECRET, token);
		expect(result.valid).toBe(true);
		expect(result.email).toBe("test+special@domain.co.uk");
	});

	it("handles large tenant and customer IDs", async () => {
		const token = await generateVerificationToken(SECRET, 99999, 88888, "big@ids.com");
		const result = await verifyVerificationToken(SECRET, token);
		expect(result.valid).toBe(true);
		expect(result.tenantId).toBe(99999);
		expect(result.customerId).toBe(88888);
	});

	it("rejects tampered payload", async () => {
		const token = await generateVerificationToken(SECRET, 1, 42, "user@test.com");
		const [payload, sig] = token.split(".");
		// Tamper with first char of payload
		const tampered = (payload[0] === "a" ? "b" : "a") + payload.slice(1) + "." + sig;
		const result = await verifyVerificationToken(SECRET, tampered);
		expect(result.valid).toBe(false);
	});

	it("two tokens for different data produce different signatures", async () => {
		const t1 = await generateVerificationToken(SECRET, 1, 1, "a@b.com");
		const t2 = await generateVerificationToken(SECRET, 1, 2, "a@b.com");
		expect(t1).not.toBe(t2);
	});
});
