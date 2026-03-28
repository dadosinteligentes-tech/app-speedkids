import type { DocumentTemplate, RentalSignedDocument } from "../schema";
import { toBrazilDateTime, toBrazilDate, toBrazilTime } from "../../lib/timezone";

// ── CRUD ──

export async function listTemplates(db: D1Database, tenantId: number): Promise<DocumentTemplate[]> {
	const { results } = await db
		.prepare("SELECT * FROM document_templates WHERE tenant_id = ? ORDER BY is_active DESC, sort_order ASC, name ASC")
		.bind(tenantId)
		.all<DocumentTemplate>();
	return results;
}

export async function getTemplateById(db: D1Database, tenantId: number, id: number): Promise<DocumentTemplate | null> {
	return db
		.prepare("SELECT * FROM document_templates WHERE id = ? AND tenant_id = ?")
		.bind(id, tenantId)
		.first<DocumentTemplate>();
}

export interface CreateTemplateInput {
	name: string;
	description?: string;
	content: string;
	print_mode?: string;
	is_active?: boolean;
	sort_order?: number;
}

export async function createTemplate(db: D1Database, tenantId: number, input: CreateTemplateInput): Promise<DocumentTemplate> {
	const row = await db
		.prepare(
			`INSERT INTO document_templates (tenant_id, name, description, content, print_mode, is_active, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
		)
		.bind(
			tenantId, input.name, input.description ?? null, input.content,
			input.print_mode ?? "optional", input.is_active === false ? 0 : 1,
			input.sort_order ?? 0,
		)
		.first<DocumentTemplate>();
	if (!row) throw new Error("Failed to create template");
	return row;
}

export async function updateTemplate(
	db: D1Database, tenantId: number, id: number,
	input: Partial<CreateTemplateInput>,
): Promise<void> {
	const sets: string[] = [];
	const binds: (string | number | null)[] = [];

	if (input.name !== undefined) { sets.push("name = ?"); binds.push(input.name); }
	if (input.description !== undefined) { sets.push("description = ?"); binds.push(input.description ?? null); }
	if (input.content !== undefined) { sets.push("content = ?"); binds.push(input.content); }
	if (input.print_mode !== undefined) { sets.push("print_mode = ?"); binds.push(input.print_mode); }
	if (input.is_active !== undefined) { sets.push("is_active = ?"); binds.push(input.is_active ? 1 : 0); }
	if (input.sort_order !== undefined) { sets.push("sort_order = ?"); binds.push(input.sort_order); }

	if (sets.length === 0) return;
	sets.push("updated_at = datetime('now')");
	binds.push(id, tenantId);

	await db.prepare(`UPDATE document_templates SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`).bind(...binds).run();
}

export async function deleteTemplate(db: D1Database, tenantId: number, id: number): Promise<void> {
	await db.prepare("DELETE FROM document_templates WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
}

// ── Active / Mandatory queries ──

export async function getActiveTemplates(db: D1Database, tenantId: number): Promise<DocumentTemplate[]> {
	const { results } = await db
		.prepare("SELECT * FROM document_templates WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC")
		.bind(tenantId)
		.all<DocumentTemplate>();
	return results;
}

export async function getMandatoryTemplates(db: D1Database, tenantId: number): Promise<DocumentTemplate[]> {
	const { results } = await db
		.prepare("SELECT * FROM document_templates WHERE tenant_id = ? AND is_active = 1 AND print_mode = 'mandatory' ORDER BY sort_order ASC")
		.bind(tenantId)
		.all<DocumentTemplate>();
	return results;
}

// ── Print tracking ──

export async function recordPrint(
	db: D1Database, sessionId: string, templateId: number, tenantId: number, userId: number,
): Promise<void> {
	await db
		.prepare("INSERT INTO rental_signed_documents (rental_session_id, template_id, tenant_id, printed_by) VALUES (?, ?, ?, ?)")
		.bind(sessionId, templateId, tenantId, userId)
		.run();
}

export async function getSessionPrintedDocs(db: D1Database, sessionId: string): Promise<Array<RentalSignedDocument & { template_name: string }>> {
	const { results } = await db
		.prepare(`
			SELECT rsd.*, dt.name as template_name
			FROM rental_signed_documents rsd
			JOIN document_templates dt ON dt.id = rsd.template_id
			WHERE rsd.rental_session_id = ?
			ORDER BY rsd.printed_at ASC
		`)
		.bind(sessionId)
		.all<RentalSignedDocument & { template_name: string }>();
	return results;
}

// ── Template variable substitution ──

export interface TemplateVariables {
	empresa?: string;
	cnpj?: string;
	endereco?: string;
	telefone?: string;
	cliente?: string;
	telefone_cliente?: string;
	crianca?: string;
	idade?: string;
	brinquedo?: string;
	pacote?: string;
	duracao?: string;
	valor?: string;
	inicio?: string;
	fim_previsto?: string;
	operador?: string;
	data_atual?: string;
	hora_atual?: string;
}

export function renderTemplate(content: string, vars: TemplateVariables): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		const value = vars[key as keyof TemplateVariables];
		return value !== undefined && value !== null ? value : match;
	});
}

export function buildVariablesFromSession(
	session: {
		asset_name?: string; package_name?: string; duration_minutes?: number;
		amount_cents?: number; start_time?: string;
		customer_name?: string | null; customer_phone?: string | null;
		child_name?: string | null; child_age?: number | null;
	},
	config: { name?: string; cnpj?: string | null; address?: string | null; phone?: string | null },
	attendantName?: string,
): TemplateVariables {
	const now = new Date().toISOString();
	const startTime = session.start_time || now;
	const endMs = new Date(startTime).getTime() + (session.duration_minutes || 0) * 60000;

	return {
		empresa: config.name || "",
		cnpj: config.cnpj || "",
		endereco: config.address || "",
		telefone: config.phone || "",
		cliente: session.customer_name || "",
		telefone_cliente: session.customer_phone || "",
		crianca: session.child_name || "",
		idade: session.child_age != null ? String(session.child_age) : "",
		brinquedo: session.asset_name || "",
		pacote: session.package_name || "",
		duracao: session.duration_minutes != null ? String(session.duration_minutes) : "",
		valor: session.amount_cents != null ? "R$ " + (session.amount_cents / 100).toFixed(2).replace(".", ",") : "",
		inicio: toBrazilDateTime(startTime),
		fim_previsto: toBrazilDateTime(new Date(endMs).toISOString()),
		operador: attendantName || "",
		data_atual: toBrazilDate(now),
		hora_atual: toBrazilTime(now),
	};
}

/** Preview variables with sample data */
export function getSampleVariables(): TemplateVariables {
	return {
		empresa: "Giro Kids Exemplo",
		cnpj: "00.000.000/0001-00",
		endereco: "Av. Principal, 123",
		telefone: "(98) 99999-0000",
		cliente: "Maria Silva",
		telefone_cliente: "(98) 98888-0000",
		crianca: "Pedro",
		idade: "7",
		brinquedo: "Kart Vermelho",
		pacote: "30 Minutos",
		duracao: "30",
		valor: "R$ 25,00",
		inicio: "27/03/2026 10:30",
		fim_previsto: "27/03/2026 11:00",
		operador: "Carlos",
		data_atual: "27/03/2026",
		hora_atual: "10:30",
	};
}
