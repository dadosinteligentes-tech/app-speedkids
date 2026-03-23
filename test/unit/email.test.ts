import { describe, it, expect, vi } from "vitest";
import { buildWelcomeEmail, sendEmail } from "../../src/lib/email";

describe("buildWelcomeEmail", () => {
	const params = {
		ownerName: "Joao Silva",
		businessName: "Parque Alegria",
		slug: "parque-alegria",
		domain: "speedkids.app",
		tempPassword: "Abc12345",
	};

	it("returns object with to, subject, and html", () => {
		const email = buildWelcomeEmail(params);
		expect(email).toHaveProperty("to");
		expect(email).toHaveProperty("subject");
		expect(email).toHaveProperty("html");
	});

	it("subject contains business name", () => {
		const email = buildWelcomeEmail(params);
		expect(email.subject).toContain("Parque Alegria");
	});

	it("html contains slug", () => {
		const email = buildWelcomeEmail(params);
		expect(email.html).toContain("parque-alegria");
	});

	it("html contains domain", () => {
		const email = buildWelcomeEmail(params);
		expect(email.html).toContain("speedkids.app");
	});

	it("html contains temporary password", () => {
		const email = buildWelcomeEmail(params);
		expect(email.html).toContain("Abc12345");
	});
});

describe("sendEmail", () => {
	it("returns false and logs when apiKey is empty", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const result = await sendEmail(undefined, "noreply@test.com", {
			to: "user@test.com",
			subject: "Test",
			html: "<p>Hello</p>",
		});

		expect(result).toBe(false);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("returns false and logs when apiKey is empty string", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const result = await sendEmail("", "noreply@test.com", {
			to: "user@test.com",
			subject: "Test",
			html: "<p>Hello</p>",
		});

		expect(result).toBe(false);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
