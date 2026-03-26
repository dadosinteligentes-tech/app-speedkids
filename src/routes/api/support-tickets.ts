import { Hono } from "hono";
import type { AppEnv } from "../../types";
import {
	getTicketsByTenant,
	getTicketById,
	createTicket,
	getTicketMessages,
	addMessage,
	markMessagesRead,
	updateTicketStatus,
	getTenantUnreadCount,
} from "../../db/queries/support-tickets";
import { tenantHasTickets } from "../../db/queries/platform";

export const supportTicketRoutes = new Hono<AppEnv>();

// Check plan access before all ticket routes
supportTicketRoutes.use("*", async (c, next) => {
	const tenantId = c.get("tenant_id");
	const path = c.req.path;
	// Allow attachment serving regardless of plan
	if (path.includes("/attachments/")) return next();
	const hasAccess = await tenantHasTickets(c.env.DB, tenantId);
	if (!hasAccess) {
		return c.json({ error: "Seu plano não inclui suporte por tickets. Faça upgrade para ter acesso.", noAccess: true }, 403);
	}
	return next();
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
	"image/jpeg", "image/png", "image/gif", "image/webp",
	"application/pdf",
	"application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"text/plain",
];

// List tickets for current tenant
supportTicketRoutes.get("/", async (c) => {
	const tenantId = c.get("tenant_id");
	const tickets = await getTicketsByTenant(c.env.DB, tenantId);
	return c.json(tickets);
});

// Unread count for badge
supportTicketRoutes.get("/unread", async (c) => {
	const tenantId = c.get("tenant_id");
	const count = await getTenantUnreadCount(c.env.DB, tenantId);
	return c.json({ count });
});

// Create a new ticket
supportTicketRoutes.post("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Não autenticado" }, 401);
	const tenantId = c.get("tenant_id");

	const body = await c.req.json<{ subject: string; message: string }>();
	if (!body.subject?.trim() || !body.message?.trim()) {
		return c.json({ error: "Assunto e mensagem são obrigatórios" }, 400);
	}

	const ticket = await createTicket(
		c.env.DB, tenantId, user.id, body.subject.trim(), body.message.trim(), user.name,
	);
	return c.json(ticket, 201);
});

// Get messages for a ticket (supports polling via ?after=lastId)
supportTicketRoutes.get("/:id/messages", async (c) => {
	const tenantId = c.get("tenant_id");
	const ticketId = parseInt(c.req.param("id"), 10);

	const ticket = await getTicketById(c.env.DB, ticketId, tenantId);
	if (!ticket) return c.json({ error: "Ticket não encontrado" }, 404);

	const afterId = c.req.query("after") ? parseInt(c.req.query("after")!, 10) : undefined;
	const messages = await getTicketMessages(c.env.DB, ticketId, afterId);

	// Add attachment URLs and mark as read
	const enriched = messages.map((m) => ({
		...m,
		attachment_url: m.attachment_key ? `/api/support-tickets/attachments/${m.attachment_key}` : null,
	}));
	await markMessagesRead(c.env.DB, ticketId, "tenant");

	return c.json({ messages: enriched, ticket: { status: ticket.status } });
});

// Send a message on a ticket (JSON or multipart with file)
supportTicketRoutes.post("/:id/messages", async (c) => {
	const user = c.get("user");
	if (!user) return c.json({ error: "Não autenticado" }, 401);
	const tenantId = c.get("tenant_id");
	const ticketId = parseInt(c.req.param("id"), 10);

	const ticket = await getTicketById(c.env.DB, ticketId, tenantId);
	if (!ticket) return c.json({ error: "Ticket não encontrado" }, 404);
	if (ticket.status === "closed") return c.json({ error: "Ticket fechado" }, 400);

	const contentType = c.req.header("content-type") || "";

	let message = "";
	let attachment: { key: string; name: string; type: string } | undefined;

	if (contentType.includes("multipart/form-data")) {
		const formData = await c.req.formData();
		message = (formData.get("message") as string)?.trim() || "";
		const file = formData.get("file") as File | null;

		if (file && file.size > 0) {
			if (file.size > MAX_FILE_SIZE) {
				return c.json({ error: "Arquivo muito grande (máx 10MB)" }, 400);
			}
			if (!ALLOWED_TYPES.includes(file.type)) {
				return c.json({ error: "Tipo de arquivo não permitido" }, 400);
			}

			const ext = file.name.split(".").pop() || "bin";
			const key = `tickets/${ticketId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

			await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
				httpMetadata: { contentType: file.type },
			});

			attachment = { key, name: file.name, type: file.type };
			if (!message) message = `📎 ${file.name}`;
		}
	} else {
		const body = await c.req.json<{ message: string }>();
		message = body.message?.trim() || "";
	}

	if (!message) return c.json({ error: "Mensagem é obrigatória" }, 400);

	const msg = await addMessage(c.env.DB, ticketId, "tenant", user.id, user.name, message, attachment);
	return c.json(msg, 201);
});

// Serve attachment files from R2
supportTicketRoutes.get("/attachments/:key{.+}", async (c) => {
	const key = c.req.param("key");
	const object = await c.env.B_BUCKET_SPEEDKIDS.get(key);
	if (!object) return c.text("Not found", 404);

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
	headers.set("Cache-Control", "private, max-age=3600");
	return new Response(object.body, { headers });
});

// Close/resolve ticket (tenant can resolve their own)
supportTicketRoutes.post("/:id/resolve", async (c) => {
	const tenantId = c.get("tenant_id");
	const ticketId = parseInt(c.req.param("id"), 10);

	const ticket = await getTicketById(c.env.DB, ticketId, tenantId);
	if (!ticket) return c.json({ error: "Ticket não encontrado" }, 404);

	await updateTicketStatus(c.env.DB, ticketId, "resolved");
	return c.json({ ok: true });
});
