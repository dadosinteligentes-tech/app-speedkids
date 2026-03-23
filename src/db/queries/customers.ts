import type { Customer, RentalSessionView } from "../schema";

export async function getCustomers(
	db: D1Database,
	tenantId: number,
	limit = 50,
	offset = 0,
): Promise<{ customers: Customer[]; total: number }> {
	const countResult = await db
		.prepare("SELECT COUNT(*) as total FROM customers WHERE tenant_id = ?")
		.bind(tenantId)
		.first<{ total: number }>();

	const { results } = await db
		.prepare("SELECT * FROM customers WHERE tenant_id = ? ORDER BY name ASC LIMIT ? OFFSET ?")
		.bind(tenantId, limit, offset)
		.all<Customer>();

	return { customers: results, total: countResult?.total ?? 0 };
}

export async function getCustomerById(db: D1Database, tenantId: number, id: number): Promise<Customer | null> {
	return db.prepare("SELECT * FROM customers WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first<Customer>();
}

export async function searchCustomers(db: D1Database, tenantId: number, query: string, limit = 10): Promise<Customer[]> {
	const pattern = `%${query}%`;
	const { results } = await db
		.prepare("SELECT * FROM customers WHERE (name LIKE ? OR phone LIKE ? OR email LIKE ? OR cpf LIKE ?) AND tenant_id = ? ORDER BY name ASC LIMIT ?")
		.bind(pattern, pattern, pattern, pattern, tenantId, limit)
		.all<Customer>();
	return results;
}

export async function createCustomer(
	db: D1Database,
	params: { tenant_id: number; name: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string },
): Promise<Customer | null> {
	return db
		.prepare(`
			INSERT INTO customers (tenant_id, name, phone, email, cpf, instagram, notes)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(params.tenant_id, params.name, params.phone ?? null, params.email ?? null, params.cpf ?? null, params.instagram ?? null, params.notes ?? null)
		.first<Customer>();
}

export async function updateCustomer(
	db: D1Database,
	tenantId: number,
	id: number,
	params: { name?: string; phone?: string; email?: string; cpf?: string; instagram?: string; notes?: string },
): Promise<Customer | null> {
	const current = await getCustomerById(db, tenantId, id);
	if (!current) return null;

	return db
		.prepare(`
			UPDATE customers
			SET name = ?, phone = ?, email = ?, cpf = ?, instagram = ?, notes = ?, updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
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
			tenantId,
		)
		.first<Customer>();
}

export async function searchByPhone(db: D1Database, tenantId: number, phone: string): Promise<Customer | null> {
	return db.prepare("SELECT * FROM customers WHERE phone = ? AND tenant_id = ?").bind(phone, tenantId).first<Customer>();
}

export async function updateCustomerStats(db: D1Database, tenantId: number, id: number, amountCents: number): Promise<void> {
	await db
		.prepare(`
			UPDATE customers
			SET total_rentals = total_rentals + 1,
			    total_spent_cents = total_spent_cents + ?,
			    updated_at = datetime('now')
			WHERE id = ? AND tenant_id = ?
		`)
		.bind(amountCents, id, tenantId)
		.run();
}

export async function getCustomerHistory(
	db: D1Database,
	tenantId: number,
	customerId: number,
	limit = 20,
	offset = 0,
): Promise<{ sessions: RentalSessionView[]; total: number }> {
	const countResult = await db
		.prepare("SELECT COUNT(*) as total FROM rental_sessions WHERE customer_id = ? AND tenant_id = ?")
		.bind(customerId, tenantId)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(`
			SELECT rs.*, a.name as asset_name, a.asset_type, p.name as package_name
			FROM rental_sessions rs
			JOIN assets a ON rs.asset_id = a.id
			JOIN packages p ON rs.package_id = p.id
			WHERE rs.customer_id = ? AND rs.tenant_id = ?
			ORDER BY rs.start_time DESC
			LIMIT ? OFFSET ?
		`)
		.bind(customerId, tenantId, limit, offset)
		.all<RentalSessionView>();

	return { sessions: results, total: countResult?.total ?? 0 };
}
