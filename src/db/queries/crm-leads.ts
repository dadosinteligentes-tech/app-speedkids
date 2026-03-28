import type { CrmLead, CrmLeadNote } from "../schema";

// ── List / Search ──

export interface CrmLeadListParams {
	status?: string;
	search?: string;
	source?: string;
	potential?: string;
	page?: number;
	limit?: number;
}

export interface CrmLeadListResult {
	leads: CrmLead[];
	total: number;
	page: number;
	limit: number;
}

export async function listLeads(db: D1Database, params: CrmLeadListParams): Promise<CrmLeadListResult> {
	const limit = params.limit || 50;
	const page = params.page || 1;
	const offset = (page - 1) * limit;

	const conditions: string[] = [];
	const binds: (string | number)[] = [];

	if (params.status) {
		conditions.push("status = ?");
		binds.push(params.status);
	}
	if (params.source) {
		conditions.push("lead_source = ?");
		binds.push(params.source);
	}
	if (params.potential) {
		conditions.push("flow_potential = ?");
		binds.push(params.potential);
	}
	if (params.search) {
		conditions.push("(company_name LIKE ? ESCAPE '\\' OR contact_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
		const escaped = params.search.replace(/[%_\\]/g, "\\$&");
		const term = `%${escaped}%`;
		binds.push(term, term, term);
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

	const countRow = await db
		.prepare(`SELECT COUNT(*) as cnt FROM crm_leads ${where}`)
		.bind(...binds)
		.first<{ cnt: number }>();

	const { results } = await db
		.prepare(`SELECT * FROM crm_leads ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`)
		.bind(...binds, limit, offset)
		.all<CrmLead>();

	return { leads: results, total: countRow?.cnt ?? 0, page, limit };
}

// ── Single Lead ──

export async function getLeadById(db: D1Database, id: number): Promise<CrmLead | null> {
	return db.prepare("SELECT * FROM crm_leads WHERE id = ?").bind(id).first<CrmLead>();
}

// ── Create ──

export interface CreateLeadInput {
	company_name: string;
	contact_name: string;
	contact_role?: string;
	email?: string;
	whatsapp?: string;
	social_profile?: string;
	address?: string;
	latitude?: number;
	longitude?: number;
	location_type?: string;
	lead_source?: string;
	flow_potential?: string;
	has_competition?: boolean;
	next_followup_at?: string;
	map_embed?: string;
	estimated_value_cents?: number;
	tags?: string;
	temperature?: string;
}

export async function createLead(db: D1Database, input: CreateLeadInput): Promise<CrmLead> {
	const lead = await db
		.prepare(
			`INSERT INTO crm_leads (company_name, contact_name, contact_role, email, whatsapp, social_profile,
				address, latitude, longitude, location_type, lead_source, flow_potential, has_competition, next_followup_at, map_embed, estimated_value_cents, tags, temperature)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
		)
		.bind(
			input.company_name, input.contact_name, input.contact_role ?? null,
			input.email ?? null, input.whatsapp ?? null, input.social_profile ?? null,
			input.address ?? null, input.latitude ?? null, input.longitude ?? null,
			input.location_type ?? null, input.lead_source ?? "ativo",
			input.flow_potential ?? "medio", input.has_competition ? 1 : 0,
			input.next_followup_at ?? null, input.map_embed ?? null,
			input.estimated_value_cents ?? 0, input.tags ?? null,
			input.temperature ?? "morno",
		)
		.first<CrmLead>();

	if (!lead) throw new Error("Failed to create lead");
	return lead;
}

// ── Update ──

export async function updateLead(
	db: D1Database,
	id: number,
	input: Partial<CreateLeadInput> & { status?: string; loss_reason?: string },
): Promise<void> {
	const sets: string[] = [];
	const binds: (string | number | null)[] = [];

	const fields: Record<string, unknown> = {
		company_name: input.company_name,
		contact_name: input.contact_name,
		contact_role: input.contact_role,
		email: input.email,
		whatsapp: input.whatsapp,
		social_profile: input.social_profile,
		address: input.address,
		latitude: input.latitude,
		longitude: input.longitude,
		location_type: input.location_type,
		lead_source: input.lead_source,
		flow_potential: input.flow_potential,
		status: input.status,
		loss_reason: input.loss_reason,
		next_followup_at: input.next_followup_at,
		map_embed: input.map_embed,
		estimated_value_cents: input.estimated_value_cents,
		tags: input.tags,
		temperature: input.temperature,
	};

	if (input.has_competition !== undefined) {
		fields.has_competition = input.has_competition ? 1 : 0;
	}

	for (const [key, value] of Object.entries(fields)) {
		if (value !== undefined) {
			sets.push(`${key} = ?`);
			binds.push(value as string | number | null);
		}
	}

	if (sets.length === 0) return;

	sets.push("updated_at = datetime('now')");
	binds.push(id);

	await db.prepare(`UPDATE crm_leads SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
}

// ── Update Status ──

export async function updateLeadStatus(db: D1Database, id: number, status: string, lossReason?: string): Promise<void> {
	await db
		.prepare(
			`UPDATE crm_leads SET status = ?, loss_reason = ?, last_contact_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
		)
		.bind(status, lossReason ?? null, id)
		.run();
}

// ── Delete ──

export async function deleteLead(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM crm_leads WHERE id = ?").bind(id).run();
}

// ── Notes ──

export async function getLeadNotes(db: D1Database, leadId: number): Promise<CrmLeadNote[]> {
	const { results } = await db
		.prepare("SELECT * FROM crm_lead_notes WHERE lead_id = ? ORDER BY created_at DESC")
		.bind(leadId)
		.all<CrmLeadNote>();
	return results;
}

export async function addLeadNote(
	db: D1Database,
	leadId: number,
	userId: number,
	userName: string,
	note: string,
	nextStep: string,
): Promise<CrmLeadNote> {
	const row = await db
		.prepare(
			`INSERT INTO crm_lead_notes (lead_id, user_id, user_name, note, next_step)
			 VALUES (?, ?, ?, ?, ?) RETURNING *`,
		)
		.bind(leadId, userId, userName, note, nextStep)
		.first<CrmLeadNote>();

	if (!row) throw new Error("Failed to add note");

	// Update lead's last contact date
	await db
		.prepare("UPDATE crm_leads SET last_contact_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
		.bind(leadId)
		.run();

	return row;
}

// ── Overdue Follow-ups ──

export async function getOverdueLeads(db: D1Database): Promise<CrmLead[]> {
	const { results } = await db
		.prepare(
			`SELECT * FROM crm_leads
			 WHERE next_followup_at < datetime('now')
			   AND status NOT IN ('ganho', 'perdido')
			 ORDER BY next_followup_at ASC`,
		)
		.all<CrmLead>();
	return results;
}

// ── Dashboard Stats ──

export interface CrmDashboardStats {
	total: number;
	by_status: Record<string, number>;
	overdue_count: number;
	this_week_contacts: number;
	pipeline_value_cents: number;
	conversion_rate: number;
	loss_reasons: Record<string, number>;
	today_followups: number;
}

export async function getCrmStats(db: D1Database): Promise<CrmDashboardStats> {
	const total = await db
		.prepare("SELECT COUNT(*) as cnt FROM crm_leads")
		.first<{ cnt: number }>();

	const { results: statusRows } = await db
		.prepare("SELECT status, COUNT(*) as cnt FROM crm_leads GROUP BY status")
		.all<{ status: string; cnt: number }>();

	const by_status: Record<string, number> = {};
	for (const row of statusRows) {
		by_status[row.status] = row.cnt;
	}

	const overdue = await db
		.prepare(
			`SELECT COUNT(*) as cnt FROM crm_leads
			 WHERE next_followup_at < datetime('now')
			   AND status NOT IN ('ganho', 'perdido')`,
		)
		.first<{ cnt: number }>();

	const weekContacts = await db
		.prepare(
			`SELECT COUNT(*) as cnt FROM crm_leads
			 WHERE last_contact_at >= datetime('now', '-7 days')`,
		)
		.first<{ cnt: number }>();

	const pipeline = await db
		.prepare(
			"SELECT COALESCE(SUM(estimated_value_cents), 0) as val FROM crm_leads WHERE status NOT IN ('ganho', 'perdido')",
		)
		.first<{ val: number }>();

	const totalCount = total?.cnt ?? 0;
	const wonCount = by_status.ganho ?? 0;
	const closedCount = wonCount + (by_status.perdido ?? 0);

	const { results: lossRows } = await db
		.prepare("SELECT loss_reason, COUNT(*) as cnt FROM crm_leads WHERE status = 'perdido' AND loss_reason IS NOT NULL GROUP BY loss_reason")
		.all<{ loss_reason: string; cnt: number }>();
	const loss_reasons: Record<string, number> = {};
	for (const row of lossRows) loss_reasons[row.loss_reason] = row.cnt;

	const todayFollowups = await db
		.prepare("SELECT COUNT(*) as cnt FROM crm_leads WHERE next_followup_at <= datetime('now', '+1 day') AND next_followup_at IS NOT NULL AND status NOT IN ('ganho', 'perdido')")
		.first<{ cnt: number }>();

	return {
		total: totalCount,
		by_status,
		overdue_count: overdue?.cnt ?? 0,
		this_week_contacts: weekContacts?.cnt ?? 0,
		pipeline_value_cents: pipeline?.val ?? 0,
		conversion_rate: closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0,
		loss_reasons,
		today_followups: todayFollowups?.cnt ?? 0,
	};
}

// ── Kanban ──

export async function getLeadsByStatus(db: D1Database): Promise<Record<string, CrmLead[]>> {
	const { results } = await db
		.prepare("SELECT * FROM crm_leads ORDER BY next_followup_at ASC NULLS LAST, updated_at DESC")
		.all<CrmLead>();

	const grouped: Record<string, CrmLead[]> = {
		novo: [], contatado: [], proposta_enviada: [], negociacao: [], ganho: [], perdido: [],
	};
	for (const lead of results) {
		if (!grouped[lead.status]) grouped[lead.status] = [];
		grouped[lead.status].push(lead);
	}
	return grouped;
}

// ── Convert to Tenant ──

export async function markLeadConverted(db: D1Database, leadId: number, tenantId: number): Promise<void> {
	await db
		.prepare(
			"UPDATE crm_leads SET status = 'ganho', converted_tenant_id = ?, updated_at = datetime('now') WHERE id = ?",
		)
		.bind(tenantId, leadId)
		.run();
}

// ── Agenda do dia (follow-ups de hoje e atrasados) ──

export interface AgendaItem extends CrmLead {
	is_overdue: number;
}

export async function getTodayAgenda(db: D1Database): Promise<AgendaItem[]> {
	const { results } = await db
		.prepare(`
			SELECT *,
				CASE WHEN next_followup_at < datetime('now') THEN 1 ELSE 0 END as is_overdue
			FROM crm_leads
			WHERE next_followup_at IS NOT NULL
				AND next_followup_at <= datetime('now', '+1 day')
				AND status NOT IN ('ganho', 'perdido')
			ORDER BY is_overdue DESC, next_followup_at ASC
		`)
		.all<AgendaItem>();
	return results;
}

// ── Velocidade do funil (tempo médio por etapa em dias) ──

export interface FunnelVelocity {
	avg_novo_to_contatado: number | null;
	avg_contatado_to_proposta: number | null;
	avg_proposta_to_negociacao: number | null;
	avg_negociacao_to_ganho: number | null;
	avg_total_days: number | null;
	total_ganhos: number;
}

export async function getFunnelVelocity(db: D1Database): Promise<FunnelVelocity> {
	// Average total cycle: created_at to updated_at for 'ganho' leads
	const avgTotal = await db
		.prepare(`
			SELECT
				AVG(JULIANDAY(updated_at) - JULIANDAY(created_at)) as avg_days,
				COUNT(*) as cnt
			FROM crm_leads WHERE status = 'ganho'
		`)
		.first<{ avg_days: number | null; cnt: number }>();

	// Average time from creation to first note (novo → contatado proxy)
	const avgFirstContact = await db
		.prepare(`
			SELECT AVG(days) as avg_days FROM (
				SELECT MIN(JULIANDAY(n.created_at) - JULIANDAY(l.created_at)) as days
				FROM crm_leads l
				JOIN crm_lead_notes n ON n.lead_id = l.id
				WHERE l.status NOT IN ('novo')
				GROUP BY l.id
			)
		`)
		.first<{ avg_days: number | null }>();

	return {
		avg_novo_to_contatado: avgFirstContact?.avg_days ? Math.round(avgFirstContact.avg_days * 10) / 10 : null,
		avg_contatado_to_proposta: null,
		avg_proposta_to_negociacao: null,
		avg_negociacao_to_ganho: null,
		avg_total_days: avgTotal?.avg_days ? Math.round(avgTotal.avg_days * 10) / 10 : null,
		total_ganhos: avgTotal?.cnt ?? 0,
	};
}

// ── Duplicidade (busca por email ou nome similar) ──

export async function findDuplicateLeads(db: D1Database, companyName: string, email?: string): Promise<CrmLead[]> {
	const conditions: string[] = [];
	const binds: string[] = [];

	conditions.push("company_name LIKE ? ESCAPE '\\'");
	const escaped = companyName.replace(/[%_\\]/g, "\\$&");
	binds.push(`%${escaped}%`);

	if (email) {
		conditions.push("email = ?");
		binds.push(email);
	}

	const { results } = await db
		.prepare(`SELECT * FROM crm_leads WHERE ${conditions.join(" OR ")} LIMIT 5`)
		.bind(...binds)
		.all<CrmLead>();
	return results;
}

// ── Motivos de perda padronizados ──

export const LOSS_REASONS = [
	"preco",
	"ja_tem_fornecedor",
	"sem_interesse",
	"sem_espaco",
	"timing_ruim",
	"sem_orcamento",
	"concorrencia",
	"outro",
] as const;

export const LOSS_REASON_LABELS: Record<string, string> = {
	preco: "Preço alto",
	ja_tem_fornecedor: "Já tem fornecedor",
	sem_interesse: "Sem interesse",
	sem_espaco: "Sem espaço disponível",
	timing_ruim: "Timing ruim / volta depois",
	sem_orcamento: "Sem orçamento no momento",
	concorrencia: "Escolheu concorrente",
	outro: "Outro motivo",
};
