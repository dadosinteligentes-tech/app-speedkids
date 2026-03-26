import type { SupportTicket, TicketMessage } from "../schema";

// ── Ticket with metadata ──

export interface TicketWithMeta extends SupportTicket {
	tenant_name: string;
	tenant_slug: string;
	created_by_name: string;
	message_count: number;
	unread_count: number;
	last_message_at: string | null;
}

// ── Tenant-side queries ──

export async function getTicketsByTenant(
	db: D1Database,
	tenantId: number,
): Promise<TicketWithMeta[]> {
	const { results } = await db
		.prepare(`
			SELECT st.*,
				t.name as tenant_name, t.slug as tenant_slug,
				u.name as created_by_name,
				COALESCE(m.msg_count, 0) as message_count,
				COALESCE(m.unread_tenant, 0) as unread_count,
				m.last_message_at
			FROM support_tickets st
			JOIN tenants t ON t.id = st.tenant_id
			JOIN users u ON u.id = st.created_by
			LEFT JOIN (
				SELECT ticket_id,
					COUNT(*) as msg_count,
					SUM(CASE WHEN sender_type = 'platform' AND read = 0 THEN 1 ELSE 0 END) as unread_tenant,
					MAX(created_at) as last_message_at
				FROM ticket_messages GROUP BY ticket_id
			) m ON m.ticket_id = st.id
			WHERE st.tenant_id = ?
			ORDER BY st.updated_at DESC
		`)
		.bind(tenantId)
		.all<TicketWithMeta>();
	return results;
}

export async function getTicketById(
	db: D1Database,
	ticketId: number,
	tenantId: number | null,
): Promise<TicketWithMeta | null> {
	const sql = `
		SELECT st.*,
			t.name as tenant_name, t.slug as tenant_slug,
			u.name as created_by_name,
			COALESCE(m.msg_count, 0) as message_count,
			COALESCE(m.unread_platform, 0) as unread_count,
			m.last_message_at
		FROM support_tickets st
		JOIN tenants t ON t.id = st.tenant_id
		JOIN users u ON u.id = st.created_by
		LEFT JOIN (
			SELECT ticket_id,
				COUNT(*) as msg_count,
				SUM(CASE WHEN sender_type = 'tenant' AND read = 0 THEN 1 ELSE 0 END) as unread_platform,
				MAX(created_at) as last_message_at
			FROM ticket_messages GROUP BY ticket_id
		) m ON m.ticket_id = st.id
		WHERE st.id = ?${tenantId ? " AND st.tenant_id = ?" : ""}
	`;
	const stmt = tenantId
		? db.prepare(sql).bind(ticketId, tenantId)
		: db.prepare(sql).bind(ticketId);
	return stmt.first<TicketWithMeta>();
}

export async function createTicket(
	db: D1Database,
	tenantId: number,
	userId: number,
	subject: string,
	firstMessage: string,
	senderName: string,
): Promise<SupportTicket> {
	const ticket = await db
		.prepare(
			`INSERT INTO support_tickets (tenant_id, subject, created_by)
			 VALUES (?, ?, ?) RETURNING *`,
		)
		.bind(tenantId, subject, userId)
		.first<SupportTicket>();

	if (!ticket) throw new Error("Failed to create ticket");

	// Add the first message
	await db
		.prepare(
			`INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message)
			 VALUES (?, 'tenant', ?, ?, ?)`,
		)
		.bind(ticket.id, userId, senderName, firstMessage)
		.run();

	return ticket;
}

// ── Messages ──

export async function getTicketMessages(
	db: D1Database,
	ticketId: number,
	afterId?: number,
): Promise<TicketMessage[]> {
	const sql = afterId
		? "SELECT * FROM ticket_messages WHERE ticket_id = ? AND id > ? ORDER BY created_at ASC"
		: "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC";
	const stmt = afterId
		? db.prepare(sql).bind(ticketId, afterId)
		: db.prepare(sql).bind(ticketId);
	const { results } = await stmt.all<TicketMessage>();
	return results;
}

export async function addMessage(
	db: D1Database,
	ticketId: number,
	senderType: "tenant" | "platform",
	senderId: number,
	senderName: string,
	message: string,
	attachment?: { key: string; name: string; type: string },
): Promise<TicketMessage> {
	const msg = await db
		.prepare(
			`INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, sender_name, message, attachment_key, attachment_name, attachment_type)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
		)
		.bind(ticketId, senderType, senderId, senderName, message,
			attachment?.key ?? null, attachment?.name ?? null, attachment?.type ?? null)
		.first<TicketMessage>();

	if (!msg) throw new Error("Failed to add message");

	// Update ticket timestamp and status
	const newStatus = senderType === "platform" ? "awaiting_reply" : "open";
	await db
		.prepare("UPDATE support_tickets SET updated_at = datetime('now'), status = ? WHERE id = ? AND status != 'resolved' AND status != 'closed'")
		.bind(newStatus, ticketId)
		.run();

	return msg;
}

export async function markMessagesRead(
	db: D1Database,
	ticketId: number,
	readerType: "tenant" | "platform",
): Promise<void> {
	// Mark messages from the OTHER side as read
	const senderType = readerType === "tenant" ? "platform" : "tenant";
	await db
		.prepare("UPDATE ticket_messages SET read = 1 WHERE ticket_id = ? AND sender_type = ? AND read = 0")
		.bind(ticketId, senderType)
		.run();
}

export async function updateTicketStatus(
	db: D1Database,
	ticketId: number,
	status: SupportTicket["status"],
): Promise<void> {
	await db
		.prepare("UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(status, ticketId)
		.run();
}

// ── Platform-side queries ──

export async function getAllTickets(db: D1Database): Promise<TicketWithMeta[]> {
	const { results } = await db
		.prepare(`
			SELECT st.*,
				t.name as tenant_name, t.slug as tenant_slug,
				u.name as created_by_name,
				COALESCE(m.msg_count, 0) as message_count,
				COALESCE(m.unread_platform, 0) as unread_count,
				m.last_message_at
			FROM support_tickets st
			JOIN tenants t ON t.id = st.tenant_id
			JOIN users u ON u.id = st.created_by
			LEFT JOIN (
				SELECT ticket_id,
					COUNT(*) as msg_count,
					SUM(CASE WHEN sender_type = 'tenant' AND read = 0 THEN 1 ELSE 0 END) as unread_platform,
					MAX(created_at) as last_message_at
				FROM ticket_messages GROUP BY ticket_id
			) m ON m.ticket_id = st.id
			ORDER BY
				CASE st.status WHEN 'open' THEN 0 WHEN 'awaiting_reply' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
				CASE st.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
				st.updated_at DESC
		`)
		.all<TicketWithMeta>();
	return results;
}

export async function getUnreadTicketCount(db: D1Database): Promise<number> {
	const row = await db
		.prepare(`
			SELECT COUNT(DISTINCT st.id) as cnt
			FROM support_tickets st
			JOIN ticket_messages tm ON tm.ticket_id = st.id
			WHERE tm.sender_type = 'tenant' AND tm.read = 0
				AND st.status NOT IN ('resolved', 'closed')
		`)
		.first<{ cnt: number }>();
	return row?.cnt ?? 0;
}

export async function getTenantUnreadCount(db: D1Database, tenantId: number): Promise<number> {
	const row = await db
		.prepare(`
			SELECT COUNT(*) as cnt
			FROM ticket_messages tm
			JOIN support_tickets st ON st.id = tm.ticket_id
			WHERE st.tenant_id = ? AND tm.sender_type = 'platform' AND tm.read = 0
		`)
		.bind(tenantId)
		.first<{ cnt: number }>();
	return row?.cnt ?? 0;
}
