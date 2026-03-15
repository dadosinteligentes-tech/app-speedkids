import type { Customer, RentalSessionView } from "../schema";

export async function getCustomers(
	db: D1Database,
	limit = 50,
	offset = 0,
): Promise<{ customers: Customer[]; total: number }> {
	const countResult = await db
		.prepare("SELECT COUNT(*) as total FROM customers")
		.first<{ total: number }>();

	const { results } = await db
		.prepare("SELECT * FROM customers ORDER BY name ASC LIMIT ? OFFSET ?")
		.bind(limit, offset)
		.all<Customer>();

	return { customers: results, total: countResult?.total ?? 0 };
}

export async function getCustomerById(db: D1Database, id: number): Promise<Customer | null> {
	return db.prepare("SELECT * FROM customers WHERE id = ?").bind(id).first<Customer>();
}

export async function searchCustomers(db: D1Database, query: string, limit = 10): Promise<Customer[]> {
	const pattern = `%${query}%`;
	const { results } = await db
		.prepare("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR cpf LIKE ? ORDER BY name ASC LIMIT ?")
		.bind(pattern, pattern, pattern, pattern, limit)
		.all<Customer>();
	return results;
}

export async function createCustomer(
	db: D1Database,
	params: { name: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string },
): Promise<Customer | null> {
	return db
		.prepare(`
			INSERT INTO customers (name, phone, email, cpf, instagram, notes)
			VALUES (?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.name, params.phone ?? null, params.email ?? null, params.cpf ?? null, params.instagram ?? null, params.notes ?? null)
		.first<Customer>();
}

export async function updateCustomer(
	db: D1Database,
	id: number,
	params: { name?: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string },
): Promise<Customer | null> {
	const current = await getCustomerById(db, id);
	if (!current) return null;

	return db
		.prepare(`
			UPDATE customers
			SET name = ?, phone = ?, email = ?, cpf = ?, instagram = ?, notes = ?, updated_at = datetime('now')
			WHERE id = ?
			RETURNING *
		`)
		.bind(
			params.name ?? current.name,
			params.phone ?? current.phone,
			params.email ?? current.email,
			params.cpf ?? current.cpf,
			params.instagram ?? current.instagram,
			params.notes ?? current.notes,
			id,
		)
		.first<Customer>();
}

export async function searchByPhone(db: D1Database, phone: string): Promise<Customer | null> {
	return db.prepare("SELECT * FROM customers WHERE phone = ?").bind(phone).first<Customer>();
}

export async function updateCustomerStats(db: D1Database, id: number, amountCents: number): Promise<void> {
	await db
		.prepare(`
			UPDATE customers
			SET total_rentals = total_rentals + 1,
			    total_spent_cents = total_spent_cents + ?,
			    updated_at = datetime('now')
			WHERE id = ?
		`)
		.bind(amountCents, id)
		.run();
}

export async function getCustomerHistory(
	db: D1Database,
	customerId: number,
	limit = 20,
	offset = 0,
): Promise<{ sessions: RentalSessionView[]; total: number }> {
	const countResult = await db
		.prepare("SELECT COUNT(*) as total FROM rental_sessions WHERE customer_id = ?")
		.bind(customerId)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(`
			SELECT rs.*, a.name as asset_name, a.asset_type, p.name as package_name
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			WHERE rs.customer_id = ?
			ORDER BY rs.start_time DESC
			LIMIT ? OFFSET ?
		`)
		.bind(customerId, limit, offset)
		.all<RentalSessionView>();

	return { sessions: results, total: countResult?.total ?? 0 };
}
