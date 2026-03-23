import type { ProductSale, ProductSaleItem } from "../schema";

export interface ProductSaleView extends ProductSale {
	customer_name: string | null;
	attendant_name: string | null;
	items: ProductSaleItem[];
}

export async function createProductSale(
	db: D1Database,
	params: {
		tenant_id: number;
		cash_register_id: number | null;
		customer_id: number | null;
		attendant_id: number | null;
		total_cents: number;
		discount_cents: number;
		payment_method: string;
		notes?: string;
	},
): Promise<ProductSale | null> {
	return db
		.prepare(
			"INSERT INTO product_sales (tenant_id, cash_register_id, customer_id, attendant_id, total_cents, discount_cents, payment_method, paid, notes) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?) RETURNING *",
		)
		.bind(
			params.tenant_id,
			params.cash_register_id,
			params.customer_id,
			params.attendant_id,
			params.total_cents,
			params.discount_cents,
			params.payment_method,
			params.notes ?? null,
		)
		.first<ProductSale>();
}

export async function createSaleItems(
	db: D1Database,
	saleId: number,
	items: Array<{ product_id: number; product_name: string; quantity: number; unit_price_cents: number }>,
): Promise<void> {
	const stmts = items.map((item) =>
		db
			.prepare(
				"INSERT INTO product_sale_items (product_sale_id, product_id, product_name, quantity, unit_price_cents, total_cents) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.bind(saleId, item.product_id, item.product_name, item.quantity, item.unit_price_cents, item.quantity * item.unit_price_cents),
	);
	await db.batch(stmts);
}

export async function getProductSaleById(db: D1Database, id: number, tenantId: number): Promise<ProductSaleView | null> {
	const sale = await db
		.prepare(
			`SELECT ps.*, c.name as customer_name, u.name as attendant_name
			 FROM product_sales ps
			 LEFT JOIN customers c ON ps.customer_id = c.id
			 LEFT JOIN users u ON ps.attendant_id = u.id
			 WHERE ps.id = ? AND ps.tenant_id = ?`,
		)
		.bind(id, tenantId)
		.first<Omit<ProductSaleView, "items">>();

	if (!sale) return null;

	const { results: items } = await db
		.prepare("SELECT * FROM product_sale_items WHERE product_sale_id = ? ORDER BY id ASC")
		.bind(id)
		.all<ProductSaleItem>();

	return { ...sale, items };
}

export async function getRecentSales(db: D1Database, tenantId: number, limit = 20): Promise<ProductSaleView[]> {
	const { results } = await db
		.prepare(
			`SELECT ps.*, c.name as customer_name, u.name as attendant_name
			 FROM product_sales ps
			 LEFT JOIN customers c ON ps.customer_id = c.id
			 LEFT JOIN users u ON ps.attendant_id = u.id
			 WHERE ps.tenant_id = ?
			 ORDER BY ps.created_at DESC
			 LIMIT ?`,
		)
		.bind(tenantId, limit)
		.all<Omit<ProductSaleView, "items">>();

	const sales: ProductSaleView[] = [];
	for (const sale of results) {
		const { results: items } = await db
			.prepare("SELECT * FROM product_sale_items WHERE product_sale_id = ?")
			.bind(sale.id)
			.all<ProductSaleItem>();
		sales.push({ ...sale, items });
	}
	return sales;
}
