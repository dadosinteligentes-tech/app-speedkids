import type { BusinessConfig } from "../schema";

export async function getBusinessConfig(db: D1Database): Promise<BusinessConfig | null> {
	try {
		return await db.prepare("SELECT * FROM business_config WHERE id = 1").first<BusinessConfig>();
	} catch {
		return null;
	}
}

export async function updateBusinessConfig(
	db: D1Database,
	params: { name?: string; cnpj?: string | null; address?: string | null; phone?: string | null; receipt_footer?: string | null },
): Promise<void> {
	const sets: string[] = [];
	const values: unknown[] = [];

	if (params.name !== undefined) { sets.push("name = ?"); values.push(params.name); }
	if (params.cnpj !== undefined) { sets.push("cnpj = ?"); values.push(params.cnpj); }
	if (params.address !== undefined) { sets.push("address = ?"); values.push(params.address); }
	if (params.phone !== undefined) { sets.push("phone = ?"); values.push(params.phone); }
	if (params.receipt_footer !== undefined) { sets.push("receipt_footer = ?"); values.push(params.receipt_footer); }

	if (sets.length === 0) return;
	sets.push("updated_at = datetime('now')");
	values.push(1);

	await db.prepare(`UPDATE business_config SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
}
