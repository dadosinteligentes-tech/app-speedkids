import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { createProductSale, createSaleItems, getProductSaleById, getRecentSales } from "../../db/queries/product-sales";
import { getProductById } from "../../db/queries/products";
import { getOpenRegister } from "../../db/queries/cash-registers";
import { auditLog } from "../../lib/logger";
import { recordPayment } from "../../services/payment";
import { validateJson } from "../../lib/request";
import { productSaleSchema } from "../../lib/validation";

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

productSaleRoutes.post("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Nao autorizado" }, 401);

	const body = await validateJson(c, productSaleSchema);

	const register = await getOpenRegister(c.env.DB);
	if (!register) {
		return c.json({ error: "Abra o caixa antes de registrar uma venda", code: "NO_REGISTER" }, 400);
	}

	// Resolve products and calculate total
	const resolvedItems: Array<{ product_id: number; product_name: string; quantity: number; unit_price_cents: number }> = [];
	let totalCents = 0;

	for (const item of body.items) {
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

	// Record payment (handles single, split, zero-amount, and customer stats)
	await recordPayment({
		db: c.env.DB,
		registerId: register.id,
		recordedBy: user.id,
		productSaleId: sale.id,
		transactionType: "product_sale",
		amountCents: totalCents,
		paymentMethod,
		paymentDenominations: body.payment_denominations,
		changeDenominations: body.change_denominations,
		payments: body.payments,
		customerId: body.customer_id,
	});

	await auditLog(c, "product_sale.create", "product_sale", sale.id, {
		total_cents: totalCents,
		payment_method: paymentMethod,
		item_count: resolvedItems.length,
	});

	const fullSale = await getProductSaleById(c.env.DB, sale.id);
	return c.json(fullSale, 201);
});
