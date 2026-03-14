import type { OperationLog } from "../schema";

export async function createLog(
	db: D1Database,
	params: {
		user_id: number | null;
		action: string;
		entity_type: string;
		entity_id?: string | null;
		details?: string | null;
		ip_address?: string | null;
	},
): Promise<void> {
	await db
		.prepare(`
			INSERT INTO operation_logs (user_id, action, entity_type, entity_id, details, ip_address)
			VALUES (?, ?, ?, ?, ?, ?)
		`)
		.bind(
			params.user_id,
			params.action,
			params.entity_type,
			params.entity_id ?? null,
			params.details ?? null,
			params.ip_address ?? null,
		)
		.run();
}

export async function getLogs(
	db: D1Database,
	filters: { entity_type?: string; entity_id?: string; user_id?: number; limit?: number; offset?: number },
): Promise<{ logs: OperationLogView[]; total: number }> {
	const where: string[] = [];
	const values: unknown[] = [];

	if (filters.entity_type) { where.push("l.entity_type = ?"); values.push(filters.entity_type); }
	if (filters.entity_id) { where.push("l.entity_id = ?"); values.push(filters.entity_id); }
	if (filters.user_id) { where.push("l.user_id = ?"); values.push(filters.user_id); }

	const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
	const limit = filters.limit ?? 50;
	const offset = filters.offset ?? 0;

	const countResult = await db
		.prepare(`SELECT COUNT(*) as total FROM operation_logs l ${whereClause}`)
		.bind(...values)
		.first<{ total: number }>();

	const { results } = await db
		.prepare(`
			SELECT l.*, u.name as user_name
			FROM operation_logs l
			LEFT JOIN users u ON l.user_id = u.id
			${whereClause}
			ORDER BY l.created_at DESC
			LIMIT ? OFFSET ?
		`)
		.bind(...values, limit, offset)
		.all<OperationLogView>();

	return { logs: results, total: countResult?.total ?? 0 };
}

export interface OperationLogView extends OperationLog {
	user_name: string | null;
}
