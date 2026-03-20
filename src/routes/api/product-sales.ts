import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { createProductSale, createSaleItems, getProductSaleById, getRecentSales } from "../../db/queries/product-sales";
import { getProductById } from "../../db/queries/products";
import { getOpenRegister, addTransaction, saveDenominations } from "../../db/queries/cash-registers";
import { updateCustomerStats } from "../../db/queries/customers";
import { auditLog } from "../../lib/logger";
import type { DenominationMap } from "../../lib/denominations";

export const productSaleRoutes = new Hono<AppEnv>();

productSaleRoutes.get("/recent", async (c) => {
	const sales = await getRecentSales(c.env.DB);
	return c.json(sales);
});

productSaleRoutes.get("/:id", async (c) => {
	const sale = await getProductSaleById(c.env.DB, Number(c.req.param("id")));
	if (!sale) return c.json({ error: "Venda nao encontrada" }, 404);
	return c.json(sale);
});

function toDenomMap(obj: Record<string, number> | undefined): DenominationMap | null {
	if (!obj) return null;
	const map: DenominationMap = {};
	for (const [k, v] of Object.entries(obj)) {
		if (v > 0) map[Number(k)] = v;
	}
	return Object.keys(map).length > 0 ? map : null;
}

productSaleRoutes.post("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Nao autorizado" }, 401);

	const body = await c.req.json<{
		items: Array<{ product_id: number; quantity: number }>;
		payment_method: string;
		customer_id?: number;
		notes?: string;
		discount_cents?: number;
		payment_denominations?: Record<string, number>;
		change_denominations?: Record<string, number>;
		payments?: Array<{
			method: string;
			amount_cents: number;
			payment_denominations?: Record<string, number>;
			change_denominations?: Record<string, number>;
		}>;
	}>();

	if (!body.items || body.items.length === 0) {
		return c.json({ error: "Nenhum item na venda" }, 400);
	}

	const register = await getOpenRegister(c.env.DB);
	if (!register) {
		return c.json({ error: "Abra o caixa antes de registrar uma venda", code: "NO_REGISTER" }, 400);
	}

	// Resolve products and calculate total
	const resolvedItems: Array<{ product_id: number; product_name: string; quantity: number; unit_price_cents: number }> = [];
	let totalCents = 0;

	for (const item of body.items) {
		if (item.quantity <= 0) continue;
		const product = await getProductById(c.env.DB, item.product_id);
		if (!product) return c.json({ error: `Produto ${item.product_id} nao encontrado` }, 404);
		if (!product.active) return c.json({ error: `Produto "${product.name}" esta inativo` }, 400);

		resolvedItems.push({
			product_id: product.id,
			product_name: product.name,
			quantity: item.quantity,
			unit_price_cents: product.price_cents,
		});
		totalCents += product.price_cents * item.quantity;
	}

	if (totalCents <= 0) {
		return c.json({ error: "Valor total deve ser maior que zero" }, 400);
	}

	// Apply discount
	const subtotalCents = totalCents;
	const discountCents = Math.min(Math.max(body.discount_cents ?? 0, 0), subtotalCents);
	totalCents = subtotalCents - discountCents;

	const isMixed = body.payments && body.payments.length >= 2;
	const paymentMethod = isMixed ? "mixed" : body.payment_method;

	// Validate split payment totals
	if (isMixed && body.payments) {
		const paymentsTotal = body.payments.reduce((sum, p) => sum + p.amount_cents, 0);
		if (paymentsTotal !== totalCents) {
			return c.json({ error: "Soma dos pagamentos nao confere com o total" }, 400);
		}
	}

	// Create sale
	const sale = await createProductSale(c.env.DB, {
		cash_register_id: register.id,
		customer_id: body.customer_id ?? null,
		attendant_id: user.id,
		total_cents: totalCents,
		discount_cents: discountCents,
		payment_method: paymentMethod,
		notes: body.notes,
	});
	if (!sale) return c.json({ error: "Erro ao criar venda" }, 500);

	await createSaleItems(c.env.DB, sale.id, resolvedItems);

	// Skip cash transactions for zero-value sales (100% discount)
	if (totalCents <= 0) {
		// No cash transaction needed — sale is fully discounted
	} else if (isMixed && body.payments) {
		for (const payment of body.payments) {
			if (payment.amount_cents <= 0) continue;
			const tx = await addTransaction(c.env.DB, {
				cash_register_id: register.id,
				product_sale_id: sale.id,
				type: "product_sale",
				amount_cents: payment.amount_cents,
				payment_method: payment.method,
				recorded_by: user.id,
			});

			if (tx && payment.method === "cash") {
				const payDenoms = toDenomMap(payment.payment_denominations);
				if (payDenoms) {
					await saveDenominations(c.env.DB, {
						cash_register_id: register.id,
						cash_transaction_id: tx.id,
						event_type: "payment_in",
						denominations: payDenoms,
					});
				}
				const changeDenoms = toDenomMap(payment.change_denominations);
				if (changeDenoms) {
					await saveDenominations(c.env.DB, {
						cash_register_id: register.id,
						cash_transaction_id: tx.id,
						event_type: "change_out",
						denominations: changeDenoms,
					});
				}
			}
		}
	} else {
		const tx = await addTransaction(c.env.DB, {
			cash_register_id: register.id,
			product_sale_id: sale.id,
			type: "product_sale",
			amount_cents: totalCents,
			payment_method: body.payment_method,
			recorded_by: user.id,
		});

		if (tx && body.payment_method === "cash") {
			const payDenoms = toDenomMap(body.payment_denominations);
			if (payDenoms) {
				await saveDenominations(c.env.DB, {
					cash_register_id: register.id,
					cash_transaction_id: tx.id,
					event_type: "payment_in",
					denominations: payDenoms,
				});
			}
			const changeDenoms = toDenomMap(body.change_denominations);
			if (changeDenoms) {
				await saveDenominations(c.env.DB, {
					cash_register_id: register.id,
					cash_transaction_id: tx.id,
					event_type: "change_out",
					denominations: changeDenoms,
				});
			}
		}
	}

	// Update customer stats
	if (body.customer_id) {
		await updateCustomerStats(c.env.DB, body.customer_id, totalCents);
	}

	await auditLog(c, "product_sale.create", "product_sale", sale.id, {
		total_cents: totalCents,
		payment_method: paymentMethod,
		item_count: resolvedItems.length,
	});

	const fullSale = await getProductSaleById(c.env.DB, sale.id);
	return c.json(fullSale, 201);
});
