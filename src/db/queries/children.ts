import type { Child } from "../schema";

export async function getChildrenByCustomer(db: D1Database, customerId: number): Promise<Child[]> {
	const { results } = await db
		.prepare("SELECT * FROM children WHERE customer_id = ? ORDER BY name ASC")
		.bind(customerId)
		.all<Child>();
	return results;
}

export async function getChildById(db: D1Database, id: number): Promise<Child | null> {
	return db.prepare("SELECT * FROM children WHERE id = ?").bind(id).first<Child>();
}

export async function createChild(
	db: D1Database,
	params: { customer_id: number; name: string; age: number; birth_date?: string },
): Promise<Child | null> {
	return db
		.prepare(`
			INSERT INTO children (customer_id, name, age, birth_date)
			VALUES (?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.customer_id, params.name, params.age, params.birth_date ?? null)
		.first<Child>();
}
