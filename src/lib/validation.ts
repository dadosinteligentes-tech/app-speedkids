/**
 * Centralized input validation schemas using Zod.
 * Validates request bodies at the API boundary — internal code can trust types.
 */
import { z } from "zod";

// ── Reusable primitives ──

const denomMapSchema = z.record(z.string(), z.number().int().min(0)).optional();

const paymentItemSchema = z.object({
	method: z.enum(["cash", "credit", "debit", "pix", "courtesy"]),
	amount_cents: z.number().int().min(0),
	payment_denominations: denomMapSchema,
	change_denominations: denomMapSchema,
});

// ── Auth ──

export const loginSchema = z.object({
	email: z.string().email().max(255),
	password: z.string().min(1).max(255),
});

// ── Rentals ──

export const rentalStartSchema = z.object({
	asset_id: z.number().int().positive(),
	package_id: z.number().int().positive(),
	id: z.string().uuid().optional(),
	customer_id: z.number().int().positive().optional(),
	child_id: z.number().int().positive().optional(),
	payment_method: z.enum(["cash", "credit", "debit", "pix", "courtesy", "mixed"]).optional(),
	paid: z.boolean().optional(),
	discount_cents: z.number().int().min(0).optional(),
	payment_denominations: denomMapSchema,
	change_denominations: denomMapSchema,
	payments: z.array(paymentItemSchema).min(2).optional(),
});

export const rentalPaySchema = z.object({
	payment_method: z.enum(["cash", "credit", "debit", "pix", "courtesy", "mixed"]),
	discount_cents: z.number().int().min(0).optional(),
	notes: z.string().max(500).optional(),
	payment_denominations: denomMapSchema,
	change_denominations: denomMapSchema,
	payments: z.array(paymentItemSchema).min(2).optional(),
});

export const rentalExtendSchema = z.object({
	package_id: z.number().int().positive().optional(),
	additional_minutes: z.number().int().positive().optional(),
}).refine(
	(d) => d.package_id !== undefined || d.additional_minutes !== undefined,
	{ message: "Provide package_id or additional_minutes" },
);

export const rentalEditSchema = z.object({
	package_id: z.number().int().positive().optional(),
	duration_minutes: z.number().int().positive().optional(),
});

// ── Cash Register ──

export const cashOpenSchema = z.object({
	opening_balance_cents: z.number().int().min(0).optional(),
	denominations: denomMapSchema,
});

export const cashCloseSchema = z.object({
	closing_balance_cents: z.number().int().min(0).optional(),
	denominations: denomMapSchema,
});

export const cashTransactionSchema = z.object({
	type: z.enum(["adjustment", "withdrawal", "deposit"]),
	amount_cents: z.number().int().min(0).optional(),
	description: z.string().max(500).optional(),
	denominations: denomMapSchema,
});

export const calculateChangeSchema = z.object({
	amount_due_cents: z.number().int().min(0),
	payment_denominations: z.record(z.string(), z.number().int().min(0)),
});

// ── Product Sales ──

export const productSaleSchema = z.object({
	items: z.array(z.object({
		product_id: z.number().int().positive(),
		quantity: z.number().int().positive(),
	})).min(1, "Nenhum item na venda"),
	payment_method: z.enum(["cash", "credit", "debit", "pix", "courtesy", "mixed"]),
	customer_id: z.number().int().positive().optional(),
	notes: z.string().max(500).optional(),
	discount_cents: z.number().int().min(0).optional(),
	payment_denominations: denomMapSchema,
	change_denominations: denomMapSchema,
	payments: z.array(paymentItemSchema).min(2).optional(),
});

// ── Users ──

export const createUserSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.string().email().max(255),
	password: z.string().min(6).max(255),
	role: z.enum(["operator", "manager", "owner"]),
});

export const updateUserSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	email: z.string().email().max(255).optional(),
	password: z.string().min(6).max(255).optional(),
	role: z.enum(["operator", "manager", "owner"]).optional(),
});

// ── Packages ──

export const packageSchema = z.object({
	name: z.string().min(1).max(100),
	duration_minutes: z.number().int().positive(),
	price_cents: z.number().int().min(0),
	overtime_block_minutes: z.number().int().min(0).optional(),
	overtime_block_price_cents: z.number().int().min(0).optional(),
	grace_period_minutes: z.number().int().min(0).optional(),
	sort_order: z.number().int().min(0).optional(),
});

// ── Assets ──

export const assetSchema = z.object({
	name: z.string().min(1).max(100),
	asset_type: z.string().min(1).max(50),
	model: z.string().max(100).optional().nullable(),
	uses_battery: z.boolean().optional(),
	max_weight_kg: z.number().positive().optional().nullable(),
	min_age: z.number().int().min(0).optional().nullable(),
	max_age: z.number().int().min(0).optional().nullable(),
	sort_order: z.number().int().min(0).optional(),
	notes: z.string().max(500).optional().nullable(),
});

// ── Batteries ──

export const batterySchema = z.object({
	label: z.string().min(1).max(50),
	full_charge_minutes: z.number().int().positive().optional(),
	charge_time_minutes: z.number().int().positive().optional(),
	notes: z.string().max(500).optional().nullable(),
});

// ── Customers ──

export const customerSchema = z.object({
	name: z.string().min(1).max(100),
	phone: z.string().max(20).optional().nullable(),
	email: z.string().email().max(255).optional().nullable(),
	cpf: z.string().max(14).optional().nullable(),
	instagram: z.string().max(100).optional().nullable(),
	notes: z.string().max(500).optional().nullable(),
});

// ── Sales Goals ──

export const salesGoalSchema = z.object({
	title: z.string().min(1).max(100),
	goal_type: z.enum(["revenue", "rental_count", "product_sale_count"]),
	period_type: z.enum(["daily", "weekly", "monthly", "custom"]),
	target_value: z.number().int().positive(),
	user_id: z.number().int().positive().optional().nullable(),
	start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const salesGoalUpdateSchema = z.object({
	title: z.string().min(1).max(100).optional(),
	target_value: z.number().int().positive().optional(),
	active: z.boolean().optional(),
	start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Helper: parse with nice error ──

export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	const message = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
	return { success: false, error: message };
}
