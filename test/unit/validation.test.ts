import { describe, it, expect } from "vitest";
import {
	loginSchema,
	rentalStartSchema,
	rentalPaySchema,
	productSaleSchema,
	cashOpenSchema,
	cashTransactionSchema,
	parseBody,
} from "../../src/lib/validation";

describe("parseBody", () => {
	it("returns success for valid data", () => {
		const result = parseBody(loginSchema, { email: "a@b.com", password: "123456" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe("a@b.com");
		}
	});

	it("returns error for invalid data", () => {
		const result = parseBody(loginSchema, { email: "not-an-email", password: "" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toContain("email");
		}
	});
});

describe("loginSchema", () => {
	it("accepts valid credentials", () => {
		const result = loginSchema.safeParse({ email: "admin@speedkids.com", password: "secret123" });
		expect(result.success).toBe(true);
	});

	it("rejects missing email", () => {
		const result = loginSchema.safeParse({ password: "secret123" });
		expect(result.success).toBe(false);
	});

	it("rejects invalid email format", () => {
		const result = loginSchema.safeParse({ email: "not-email", password: "secret123" });
		expect(result.success).toBe(false);
	});

	it("rejects empty password", () => {
		const result = loginSchema.safeParse({ email: "a@b.com", password: "" });
		expect(result.success).toBe(false);
	});
});

describe("rentalStartSchema", () => {
	it("accepts minimal valid rental start", () => {
		const result = rentalStartSchema.safeParse({ asset_id: 1, package_id: 2 });
		expect(result.success).toBe(true);
	});

	it("accepts full rental start with prepayment", () => {
		const result = rentalStartSchema.safeParse({
			asset_id: 1,
			package_id: 2,
			customer_id: 5,
			child_id: 3,
			payment_method: "cash",
			paid: true,
			discount_cents: 500,
			payment_denominations: { "10000": 1 },
			change_denominations: { "5000": 1 },
		});
		expect(result.success).toBe(true);
	});

	it("accepts split payment with 2+ items", () => {
		const result = rentalStartSchema.safeParse({
			asset_id: 1,
			package_id: 2,
			paid: true,
			payments: [
				{ method: "cash", amount_cents: 3000 },
				{ method: "pix", amount_cents: 2000 },
			],
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing asset_id", () => {
		const result = rentalStartSchema.safeParse({ package_id: 2 });
		expect(result.success).toBe(false);
	});

	it("rejects negative discount", () => {
		const result = rentalStartSchema.safeParse({ asset_id: 1, package_id: 2, discount_cents: -100 });
		expect(result.success).toBe(false);
	});

	it("rejects single-item payments array (must be 2+)", () => {
		const result = rentalStartSchema.safeParse({
			asset_id: 1,
			package_id: 2,
			payments: [{ method: "cash", amount_cents: 5000 }],
		});
		expect(result.success).toBe(false);
	});
});

describe("rentalPaySchema", () => {
	it("accepts single payment", () => {
		const result = rentalPaySchema.safeParse({ payment_method: "pix" });
		expect(result.success).toBe(true);
	});

	it("rejects invalid payment method", () => {
		const result = rentalPaySchema.safeParse({ payment_method: "bitcoin" });
		expect(result.success).toBe(false);
	});
});

describe("productSaleSchema", () => {
	it("accepts valid product sale", () => {
		const result = productSaleSchema.safeParse({
			items: [{ product_id: 1, quantity: 2 }],
			payment_method: "cash",
		});
		expect(result.success).toBe(true);
	});

	it("rejects empty items array", () => {
		const result = productSaleSchema.safeParse({
			items: [],
			payment_method: "cash",
		});
		expect(result.success).toBe(false);
	});

	it("rejects zero quantity", () => {
		const result = productSaleSchema.safeParse({
			items: [{ product_id: 1, quantity: 0 }],
			payment_method: "cash",
		});
		expect(result.success).toBe(false);
	});
});

describe("cashOpenSchema", () => {
	it("accepts empty body (defaults)", () => {
		const result = cashOpenSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("accepts denominations", () => {
		const result = cashOpenSchema.safeParse({
			denominations: { "10000": 5, "5000": 10 },
		});
		expect(result.success).toBe(true);
	});
});

describe("cashTransactionSchema", () => {
	it("accepts withdrawal with description", () => {
		const result = cashTransactionSchema.safeParse({
			type: "withdrawal",
			amount_cents: 5000,
			description: "Compra de troco",
		});
		expect(result.success).toBe(true);
	});

	it("rejects invalid type", () => {
		const result = cashTransactionSchema.safeParse({ type: "refund" });
		expect(result.success).toBe(false);
	});
});
