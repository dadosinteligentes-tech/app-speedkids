import type { Product } from "../schema";

export async function getActiveProducts(db: D1Database): Promise<Product[]> {
	const { results } = await db
		.prepare("SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, name ASC")
		.all<Product>();
	return results;
}

export async function getAllProducts(db: D1Database): Promise<Product[]> {
	const { results } = await db
		.prepare("SELECT * FROM products ORDER BY active DESC, sort_order ASC, name ASC")
		.all<Product>();
	return results;
}

export async function getProductById(db: D1Database, id: number): Promise<Product | null> {
	return db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first<Product>();
}

export async function createProduct(
	db: D1Database,
	params: { name: string; price_cents: number; description?: string; category?: string; photo_url?: string; sort_order?: number },
): Promise<Product | null> {
	return db
		.prepare(
			"INSERT INTO products (name, description, price_cents, category, photo_url, sort_order) VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
		)
		.bind(params.name, params.description ?? null, params.price_cents, params.category ?? null, params.photo_url ?? null, params.sort_order ?? 0)
		.first<Product>();
}

export async function updateProduct(
	db: D1Database,
	id: number,
	params: { name?: string; description?: string; price_cents?: number; category?: string; photo_url?: string | null; sort_order?: number },
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.description !== undefined) { sets.push("description = ?"); values.push(params.description); }
	if (params.price_cents !== undefined) { sets.push("price_cents = ?"); values.push(params.price_cents); }
	if (params.category !== undefined) { sets.push("category = ?"); values.push(params.category); }
	if (params.photo_url !== undefined) { sets.push("photo_url = ?"); values.push(params.photo_url); }
	if (params.sort_order !== undefined) { sets.push("sort_order = ?"); values.push(params.sort_order); }

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	values.push(id);

	await db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function toggleProductActive(db: D1Database, id: number): Promise<void> {
	await db
		.prepare("UPDATE products SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?")
		.bind(id)
		.run();
}
