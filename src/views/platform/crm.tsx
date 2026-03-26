import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { CrmLead } from "../../db/schema";
import type { CrmDashboardStats } from "../../db/queries/crm-leads";
import { PlatformLayout } from "./layout";

interface Props {
	leads: CrmLead[];
	stats: CrmDashboardStats;
	kanbanData: Record<string, CrmLead[]>;
	overdueLeads: CrmLead[];
	user: { name: string; email: string } | null;
}

const STATUS_CFG: Record<string, { bg: string; text: string; label: string; color: string }> = {
	novo:              { bg: "bg-sk-blue-light",   text: "text-sk-blue-dark",  label: "Novo",              color: "#3B82F6" },
	contatado:         { bg: "bg-sk-yellow-light", text: "text-sk-yellow-dark", label: "Contatado",         color: "#F59E0B" },
	proposta_enviada:  { bg: "bg-sk-orange-light", text: "text-sk-orange",     label: "Proposta Enviada",  color: "#F97316" },
	negociacao:        { bg: "bg-sk-purple-light", text: "text-sk-purple",     label: "Negociação",        color: "#8B5CF6" },
	ganho:             { bg: "bg-sk-green-light",  text: "text-sk-green-dark", label: "Ganho",             color: "#22C55E" },
	perdido:           { bg: "bg-sk-danger-light", text: "text-sk-danger",     label: "Perdido",           color: "#EF4444" },
};

const POTENTIAL_CFG: Record<string, { bg: string; text: string; label: string }> = {
	baixo: { bg: "bg-gray-100", text: "text-gray-500", label: "Baixo" },
	medio: { bg: "bg-sk-yellow-light", text: "text-sk-yellow-dark", label: "Médio" },
	alto:  { bg: "bg-sk-green-light", text: "text-sk-green-dark", label: "Alto" },
};

const STATUS_ORDER = ["novo", "contatado", "proposta_enviada", "negociacao", "ganho", "perdido"];

export const CrmPage: FC<Props> = ({ leads, stats, kanbanData, overdueLeads, user }) => {
	const script = html`<script>
${raw(`
var crmView = 'list';
var currentLeadId = null;
var currentLeadData = null;
var draggedLeadId = null;
var draggedLeadStatus = null;
var dropPending = false;

// ── View toggle ──
function showView(view) {
	crmView = view;
	document.getElementById('crm-list').style.display = view === 'list' ? 'block' : 'none';
	document.getElementById('crm-kanban').style.display = view === 'kanban' ? 'block' : 'none';
	document.getElementById('crm-detail').style.display = 'none';
	document.getElementById('btn-list').className = view === 'list' ? 'px-4 py-2 rounded-sk text-sm font-display font-bold bg-sk-blue text-white' : 'px-4 py-2 rounded-sk text-sm font-display font-medium bg-sk-bg text-sk-muted hover:bg-sk-border/30';
	document.getElementById('btn-kanban').className = view === 'kanban' ? 'px-4 py-2 rounded-sk text-sm font-display font-bold bg-sk-blue text-white' : 'px-4 py-2 rounded-sk text-sm font-display font-medium bg-sk-bg text-sk-muted hover:bg-sk-border/30';
}

// ── Drag & Drop (Kanban) ──
function onDragStart(e, leadId, leadStatus) {
	draggedLeadId = leadId;
	draggedLeadStatus = leadStatus;
	e.dataTransfer.effectAllowed = 'move';
	e.target.style.opacity = '0.5';
}
function onDragEnd(e) { e.target.style.opacity = '1'; draggedLeadId = null; draggedLeadStatus = null; }
function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onDragEnter(e) { e.currentTarget.style.background = 'rgba(59,130,246,0.08)'; }
function onDragLeave(e) { e.currentTarget.style.background = ''; }
function onDrop(e, newStatus) {
	e.preventDefault();
	e.currentTarget.style.background = '';
	if (!draggedLeadId || dropPending) return;
	if (newStatus === draggedLeadStatus) { draggedLeadId = null; return; }
	var lossReason = '';
	if (newStatus === 'perdido') {
		lossReason = prompt('Motivo da perda:');
		if (lossReason === null) { draggedLeadId = null; return; }
	}
	dropPending = true;
	var lid = draggedLeadId;
	draggedLeadId = null;
	fetch('/api/platform/crm/leads/' + lid + '/status', {
		method: 'PUT', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status: newStatus, loss_reason: lossReason })
	}).then(function(r) {
		if (r.ok) { showToast('Status atualizado'); setTimeout(function(){ location.reload(); }, 600); }
		else { showToast('Erro ao atualizar status', 'error'); }
	}).catch(function() { showToast('Erro de conexão', 'error'); })
	.finally(function() { dropPending = false; });
}

// ── Detail ──
function openLead(id) {
	currentLeadId = id;
	document.getElementById('crm-list').style.display = 'none';
	document.getElementById('crm-kanban').style.display = 'none';
	var detail = document.getElementById('crm-detail');
	detail.style.display = 'block';
	detail.innerHTML = '<div class="text-center py-12 text-sk-muted text-sm">Carregando...</div>';
	fetch('/api/platform/crm/leads/' + id)
		.then(function(r) { if (!r.ok) throw new Error('Lead não encontrado'); return r.json(); })
		.then(function(lead) { currentLeadData = lead; renderDetail(lead); })
		.catch(function(err) { document.getElementById('crm-detail').innerHTML = '<div class="p-6 text-center text-sk-danger text-sm font-body">' + err.message + '</div>'; });
}

function closeLead() {
	currentLeadId = null;
	currentLeadData = null;
	document.getElementById('crm-detail').style.display = 'none';
	showView(crmView);
}

function renderDetail(lead) {
	var statusOpts = ${JSON.stringify(STATUS_ORDER)};
	var statusLabels = ${JSON.stringify(Object.fromEntries(Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label])))};

	var statusBtns = statusOpts.map(function(s) {
		var active = s === lead.status;
		var cls = active ? 'bg-sk-blue text-white' : 'bg-sk-bg text-sk-muted hover:bg-sk-border/30';
		return '<button onclick="changeLeadStatus(\\'' + s + '\\')" class="px-2 py-1 rounded text-xs font-display font-medium ' + cls + '">' + statusLabels[s] + '</button>';
	}).join('');

	var mapEmbed = '';
	if (lead.map_embed && /^https:\\/\\/(www\\.)?google\\.com\\/maps\\/embed/.test(lead.map_embed)) {
		mapEmbed = '<div class="mt-3 rounded-sk overflow-hidden border border-sk-border/30"><iframe src="' + lead.map_embed + '" width="100%" height="200" style="border:0" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>';
	}

	var whatsappLink = lead.whatsapp ? '<a href="https://wa.me/' + lead.whatsapp.replace(/\\D/g,'') + '" target="_blank" class="text-sk-green hover:underline">' + lead.whatsapp + '</a>' : '—';

	var h = '<div class="p-4 md:p-6">'
		+ '<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">'
		+ '<button onclick="closeLead()" class="text-sk-blue hover:text-sk-blue-dark font-display font-bold text-sm">&larr; Voltar</button>'
		+ '<div class="flex flex-wrap gap-2">'
		+ '<button onclick="showEditModal()" class="btn-touch px-3 py-2 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk text-xs font-display font-bold">Editar Lead</button>'
		+ (lead.email ? '<button onclick="sendPresentation()" class="btn-touch px-3 py-2 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk text-xs font-display font-bold">Enviar Apresentação</button>' : '')
		+ (lead.status !== 'ganho' ? '<button onclick="showConvertModal()" class="btn-touch px-3 py-2 bg-sk-green hover:bg-sk-green-dark text-white rounded-sk text-xs font-display font-bold">Converter em Cliente</button>' : '')
		+ '</div></div>'
		+ '<div class="grid md:grid-cols-2 gap-6">'
		// Left column — info
		+ '<div>'
		+ '<h3 class="font-display font-bold text-lg text-sk-text mb-3">' + lead.company_name + '</h3>'
		+ '<div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-body">'
		+ '<div><span class="text-sk-muted block text-xs">Contato</span>' + lead.contact_name + (lead.contact_role ? ' (' + lead.contact_role + ')' : '') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Email</span>' + (lead.email || '—') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">WhatsApp</span>' + whatsappLink + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Rede social</span>' + (lead.social_profile || '—') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Endereço</span>' + (lead.address || '—') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Tipo de local</span>' + (lead.location_type || '—') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Potencial</span>' + (lead.flow_potential || 'medio') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Concorrência</span>' + (lead.has_competition ? 'Sim' : 'Não') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Origem</span>' + (lead.lead_source || 'ativo') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Próx. follow-up</span>' + (lead.next_followup_at ? lead.next_followup_at.slice(0, 10) : '—') + '</div>'
		+ '<div><span class="text-sk-muted block text-xs">Valor estimado</span><span class="font-display font-bold">' + (lead.estimated_value_cents > 0 ? 'R$ ' + (lead.estimated_value_cents / 100).toFixed(2).replace('.', ',') : '—') + '</span></div>'
		+ '</div>'
		+ mapEmbed
		+ '<div class="mt-3"><span class="text-sk-muted text-xs font-body block mb-2">Status</span><div class="flex flex-wrap gap-1">' + statusBtns + '</div></div>'
		+ '</div>'
		// Right column — notes timeline
		+ '<div>'
		+ '<h4 class="font-display font-bold text-sm text-sk-text mb-3">Histórico de Interações</h4>'
		+ '<div id="lead-notes" class="space-y-2 max-h-[250px] overflow-y-auto mb-3"><div class="text-sk-muted text-xs text-center py-4">Carregando...</div></div>'
		+ '<form onsubmit="addNote(event)" class="space-y-2 border-t border-sk-border/30 pt-3">'
		+ '<textarea id="note-text" placeholder="O que foi conversado..." class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body resize-none h-14 focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none"></textarea>'
		+ '<input id="note-next-step" type="text" placeholder="Próximo passo (obrigatório)" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" required />'
		+ '<button type="submit" class="btn-touch w-full py-2 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk text-sm font-display font-bold">Registrar Interação</button>'
		+ '</form>'
		+ '</div></div></div>';

	document.getElementById('crm-detail').innerHTML = h;
	fetchNotes();
}

function fetchNotes() {
	fetch('/api/platform/crm/leads/' + currentLeadId + '/notes')
		.then(function(r) { return r.json(); })
		.then(function(notes) {
			var c = document.getElementById('lead-notes');
			if (!notes.length) { c.innerHTML = '<p class="text-sk-muted text-xs text-center py-4">Nenhuma interação registrada</p>'; return; }
			c.innerHTML = notes.map(function(n) {
				return '<div class="bg-sk-bg rounded-sk p-2.5">'
					+ '<div class="flex justify-between text-xs text-sk-muted mb-1"><span>' + n.user_name + '</span><span>' + (n.created_at ? n.created_at.slice(0,16).replace('T',' ') : '') + '</span></div>'
					+ '<p class="text-sm font-body text-sk-text">' + n.note.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>'
					+ '<p class="text-xs text-sk-blue mt-1 font-display font-medium">Próximo: ' + n.next_step.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>'
					+ '</div>';
			}).join('');
		});
}

function addNote(e) {
	e.preventDefault();
	var note = document.getElementById('note-text').value.trim();
	var nextStep = document.getElementById('note-next-step').value.trim();
	if (!note || !nextStep) { showToast('Preencha a nota e o próximo passo', 'error'); return; }
	fetch('/api/platform/crm/leads/' + currentLeadId + '/notes', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ note: note, next_step: nextStep })
	}).then(function(r) {
		if (r.ok) { document.getElementById('note-text').value = ''; document.getElementById('note-next-step').value = ''; fetchNotes(); showToast('Interação registrada'); }
		else { r.json().then(function(d) { showToast(d.error || 'Erro', 'error'); }); }
	});
}

function changeLeadStatus(status) {
	var lossReason = '';
	if (status === 'perdido') { lossReason = prompt('Motivo da perda:'); if (lossReason === null) return; }
	fetch('/api/platform/crm/leads/' + currentLeadId + '/status', {
		method: 'PUT', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status: status, loss_reason: lossReason })
	}).then(function(r) { if (r.ok) { showToast('Status atualizado'); openLead(currentLeadId); } });
}

function sendPresentation() {
	var customMsg = prompt('Mensagem personalizada (opcional — deixe vazio para usar o template padrão):');
	if (customMsg === null) return;
	fetch('/api/platform/crm/leads/' + currentLeadId + '/send-presentation', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ customMessage: customMsg || undefined })
	}).then(function(r) { return r.json(); }).then(function(d) {
		if (d.ok) showToast('Apresentação enviada!');
		else showToast(d.error || 'Erro ao enviar', 'error');
	}).catch(function() { showToast('Erro de conexão', 'error'); });
}

// ── Edit modal ──
function showEditModal() {
	if (!currentLeadData) return;
	var l = currentLeadData;
	document.getElementById('crm-edit-modal').classList.remove('hidden');
	// Populate fields
	['company_name','contact_name','contact_role','email','whatsapp','social_profile','address','next_followup_at'].forEach(function(f) {
		var el = document.getElementById('edit-' + f);
		if (el) el.value = l[f] || '';
	});
	document.getElementById('edit-location_type').value = l.location_type || '';
	document.getElementById('edit-lead_source').value = l.lead_source || 'ativo';
	document.getElementById('edit-flow_potential').value = l.flow_potential || 'medio';
	document.getElementById('edit-has_competition').checked = !!l.has_competition;
	document.getElementById('edit-map_embed').value = l.map_embed || '';
	document.getElementById('edit-estimated_value').value = l.estimated_value_cents > 0 ? (l.estimated_value_cents / 100).toFixed(2) : '';
	if (l.next_followup_at) document.getElementById('edit-next_followup_at').value = l.next_followup_at.slice(0, 10);
}
function hideEditModal() { document.getElementById('crm-edit-modal').classList.add('hidden'); }

function saveEdit(e) {
	e.preventDefault();
	var data = {};
	['company_name','contact_name','contact_role','email','whatsapp','social_profile','address','location_type','lead_source','flow_potential','next_followup_at','map_embed'].forEach(function(f) {
		var el = document.getElementById('edit-' + f);
		if (el) data[f] = el.value.trim() || null;
	});
	data.has_competition = document.getElementById('edit-has_competition').checked;
	var valStr = document.getElementById('edit-estimated_value').value.trim();
	data.estimated_value_cents = valStr ? Math.round(parseFloat(valStr.replace(',', '.')) * 100) : 0;

	// Extract Google Maps embed src from pasted iframe
	if (data.map_embed && data.map_embed.indexOf('<iframe') !== -1) {
		var match = data.map_embed.match(/src="([^"]+)"/);
		if (match) data.map_embed = match[1];
	}

	fetch('/api/platform/crm/leads/' + currentLeadId, {
		method: 'PUT', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	}).then(function(r) {
		if (r.ok) { hideEditModal(); showToast('Lead atualizado'); openLead(currentLeadId); }
		else { r.json().then(function(d) { showToast(d.error || 'Erro', 'error'); }); }
	});
}

// ── Create modal ──
function showCreateModal() { document.getElementById('crm-create-modal').classList.remove('hidden'); }
function hideCreateModal() { document.getElementById('crm-create-modal').classList.add('hidden'); }

function createLead(e) {
	e.preventDefault();
	var data = {};
	['company_name','contact_name','contact_role','email','whatsapp','social_profile','address','location_type','lead_source','flow_potential','next_followup_at','map_embed'].forEach(function(f) {
		var el = document.getElementById('new-' + f);
		if (el && el.value.trim()) data[f] = el.value.trim();
	});
	data.has_competition = document.getElementById('new-has_competition').checked;
	var newVal = document.getElementById('new-estimated_value').value.trim();
	if (newVal) data.estimated_value_cents = Math.round(parseFloat(newVal.replace(',', '.')) * 100);
	// Extract src from iframe paste
	if (data.map_embed && data.map_embed.indexOf('<iframe') !== -1) {
		var match = data.map_embed.match(/src="([^"]+)"/);
		if (match) data.map_embed = match[1];
	}
	fetch('/api/platform/crm/leads', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	}).then(function(r) {
		if (r.ok) { showToast('Lead criado!'); setTimeout(function(){ location.reload(); }, 800); }
		else { r.json().then(function(d) { showToast(d.error || 'Erro', 'error'); }); }
	});
}

// ── Convert modal ──
function showConvertModal() { document.getElementById('crm-convert-modal').classList.remove('hidden'); }
function hideConvertModal() { document.getElementById('crm-convert-modal').classList.add('hidden'); }

function convertLead(e) {
	e.preventDefault();
	var slug = document.getElementById('convert-slug').value.trim().toLowerCase();
	var pw = document.getElementById('convert-password').value;
	var plan = document.getElementById('convert-plan').value;
	if (!slug || !pw) { showToast('Preencha slug e senha', 'error'); return; }
	fetch('/api/platform/crm/leads/' + currentLeadId + '/convert', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ slug: slug, ownerPassword: pw, plan: plan })
	}).then(function(r) { return r.json(); }).then(function(d) {
		if (d.ok) { hideConvertModal(); showToast('Lead convertido em cliente!'); setTimeout(function(){ location.reload(); }, 1000); }
		else showToast(d.error || 'Erro na conversão', 'error');
	});
}

// ── Filter ──
function applyFilters() {
	var search = document.getElementById('filter-search').value.trim();
	var status = document.getElementById('filter-status').value;
	var source = document.getElementById('filter-source').value;
	var potential = document.getElementById('filter-potential').value;
	var params = [];
	if (search) params.push('search=' + encodeURIComponent(search));
	if (status) params.push('status=' + status);
	if (source) params.push('source=' + source);
	if (potential) params.push('potential=' + potential);
	var url = '/api/platform/crm/leads' + (params.length ? '?' + params.join('&') : '');

	fetch(url).then(function(r) { return r.json(); }).then(function(data) {
		var tbody = document.getElementById('leads-tbody');
		if (!data.leads.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-sk-muted text-sm">Nenhum lead encontrado</td></tr>'; return; }
		var statusLabels = ${JSON.stringify(Object.fromEntries(Object.entries(STATUS_CFG).map(([k, v]) => [k, v.label])))};
		var potentialLabels = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
		tbody.innerHTML = data.leads.map(function(l) {
			var overdue = l.next_followup_at && new Date(l.next_followup_at) < new Date();
			return '<tr onclick="openLead(' + l.id + ')" class="cursor-pointer hover:bg-sk-blue-light/20 transition-colors' + (overdue ? ' border-l-4 border-sk-danger' : '') + '">'
				+ '<td class="px-4 py-3 font-display font-medium text-sm">' + l.company_name + '</td>'
				+ '<td class="px-4 py-3 text-sm text-sk-muted">' + l.contact_name + '</td>'
				+ '<td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs font-medium font-display">' + (statusLabels[l.status] || l.status) + '</span></td>'
				+ '<td class="px-4 py-3 text-xs">' + (potentialLabels[l.flow_potential] || 'Médio') + '</td>'
				+ '<td class="px-4 py-3 text-xs text-sk-muted">' + (l.lead_source || '—') + '</td>'
				+ '<td class="px-4 py-3 text-xs tabular-nums' + (overdue ? ' text-sk-danger font-bold' : ' text-sk-muted') + '">' + (l.next_followup_at ? l.next_followup_at.slice(0, 10) : '—') + '</td>'
				+ '<td class="px-4 py-3 text-xs text-sk-muted tabular-nums">' + (l.updated_at ? l.updated_at.slice(0, 10) : '') + '</td>'
				+ '</tr>';
		}).join('');
	});
}
var searchTimer;
function debounceSearch() { clearTimeout(searchTimer); searchTimer = setTimeout(applyFilters, 400); }
`)}
</script>`;

	const createButton = html`
		<button onclick="showCreateModal()" class="btn-bounce bg-sk-orange hover:bg-sk-orange-dark text-white px-4 py-2 rounded-sk text-sm font-display font-bold transition-colors shadow-sk-sm">
			+ Novo Lead
		</button>
	`;

	return (
		<PlatformLayout title="CRM — Prospecção" user={user} actions={createButton} bodyScripts={script}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "CRM" }]}>

			{/* Stats */}
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
				<div class="bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Leads</p>
					<p class="text-2xl font-bold font-display text-sk-text">{stats.total}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Funil</p>
					<div class="flex gap-0.5 mt-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
						{STATUS_ORDER.filter((s) => s !== "perdido").map((s) => {
							const count = stats.by_status[s] || 0;
							const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
							const cfg = STATUS_CFG[s];
							return pct > 0 ? <div style={`width:${pct}%;background:${cfg.color}`} title={`${cfg.label}: ${count}`}></div> : null;
						})}
					</div>
					<div class="flex gap-2 mt-1 flex-wrap">
						{STATUS_ORDER.map((s) => {
							const count = stats.by_status[s] || 0;
							if (!count) return null;
							const cfg = STATUS_CFG[s];
							return <span class="text-xs font-body text-sk-muted"><span style={`color:${cfg.color}`}>{count}</span> {cfg.label}</span>;
						})}
					</div>
				</div>
				<div class={`bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 ${stats.overdue_count > 0 ? "border-sk-danger" : "border-sk-border/50"}`}>
					<p class="text-xs text-sk-danger font-display font-medium uppercase tracking-wider mb-1">Atrasados</p>
					<p class="text-2xl font-bold font-display text-sk-danger">{stats.overdue_count}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Contatos (7d)</p>
					<p class="text-2xl font-bold font-display text-sk-text">{stats.this_week_contacts}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Pipeline</p>
					<p class="text-xl font-bold font-display text-sk-text">R$ {(stats.pipeline_value_cents / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">Conversão</p>
					<p class="text-2xl font-bold font-display text-sk-green-dark">{stats.conversion_rate}%</p>
				</div>
			</div>

			{/* View toggle + filters */}
			<div class="flex flex-col sm:flex-row gap-2 mb-3">
				<div class="flex gap-1">
					<button id="btn-list" onclick="showView('list')" class="px-4 py-2 rounded-sk text-sm font-display font-bold bg-sk-blue text-white">Lista</button>
					<button id="btn-kanban" onclick="showView('kanban')" class="px-4 py-2 rounded-sk text-sm font-display font-medium bg-sk-bg text-sk-muted hover:bg-sk-border/30">Kanban</button>
				</div>
				<div class="flex flex-1 gap-2 flex-wrap">
					<input id="filter-search" type="text" placeholder="Buscar..." oninput="debounceSearch()"
						class="flex-1 min-w-[150px] px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" />
					<select id="filter-status" onchange="applyFilters()" class="px-2 py-2 border-2 border-sk-border rounded-sk text-xs font-body">
						<option value="">Status</option>
						{STATUS_ORDER.map((s) => <option value={s}>{STATUS_CFG[s].label}</option>)}
					</select>
					<select id="filter-source" onchange="applyFilters()" class="px-2 py-2 border-2 border-sk-border rounded-sk text-xs font-body">
						<option value="">Origem</option>
						<option value="maps">Maps</option><option value="indicacao">Indicação</option><option value="ativo">Ativo</option>
					</select>
					<select id="filter-potential" onchange="applyFilters()" class="px-2 py-2 border-2 border-sk-border rounded-sk text-xs font-body">
						<option value="">Potencial</option>
						<option value="alto">Alto</option><option value="medio">Médio</option><option value="baixo">Baixo</option>
					</select>
				</div>
			</div>

			{/* List view */}
			<div id="crm-list" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-4 py-2 font-display font-medium">Empresa</th>
								<th class="px-4 py-2 font-display font-medium">Contato</th>
								<th class="px-4 py-2 font-display font-medium">Status</th>
								<th class="px-4 py-2 font-display font-medium">Potencial</th>
								<th class="px-4 py-2 font-display font-medium">Origem</th>
								<th class="px-4 py-2 font-display font-medium">Follow-up</th>
								<th class="px-4 py-2 font-display font-medium">Atualizado</th>
							</tr>
						</thead>
						<tbody id="leads-tbody" class="divide-y divide-sk-border/20">
							{leads.map((l) => {
								const sc = STATUS_CFG[l.status] || STATUS_CFG.novo;
								const pc = POTENTIAL_CFG[l.flow_potential] || POTENTIAL_CFG.medio;
								const isOverdue = l.next_followup_at && new Date(l.next_followup_at) < new Date();
								return (
									<tr onclick={`openLead(${l.id})`} class={`cursor-pointer hover:bg-sk-blue-light/20 transition-colors ${isOverdue ? "border-l-4 border-sk-danger" : ""}`}>
										<td class="px-4 py-2.5 font-display font-medium text-sm text-sk-text">{l.company_name}</td>
										<td class="px-4 py-2.5 text-sm text-sk-muted">{l.contact_name}</td>
										<td class="px-4 py-2.5"><span class={`${sc.bg} ${sc.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>{sc.label}</span></td>
										<td class="px-4 py-2.5"><span class={`${pc.bg} ${pc.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>{pc.label}</span></td>
										<td class="px-4 py-2.5 text-xs text-sk-muted">{l.lead_source}</td>
										<td class={`px-4 py-2.5 text-xs tabular-nums ${isOverdue ? "text-sk-danger font-bold" : "text-sk-muted"}`}>
											{l.next_followup_at ? l.next_followup_at.slice(0, 10) : "—"}
										</td>
										<td class="px-4 py-2.5 text-xs text-sk-muted tabular-nums">{l.updated_at?.slice(0, 10)}</td>
									</tr>
								);
							})}
							{leads.length === 0 && (
								<tr><td colspan={7} class="text-center py-8 text-sk-muted text-sm">Nenhum lead cadastrado</td></tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Kanban view — drag & drop enabled */}
			<div id="crm-kanban" style="display:none" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
				{STATUS_ORDER.map((status) => {
					const cfg = STATUS_CFG[status];
					const items = kanbanData[status] || [];
					return (
						<div class="min-h-[200px]"
							ondragover="onDragOver(event)"
							ondragenter="onDragEnter(event)"
							ondragleave="onDragLeave(event)"
							ondrop={`onDrop(event,'${status}')`}>
							<div class="flex items-center gap-1.5 mb-2 sticky top-0 bg-sk-bg py-1 z-10">
								<span style={`background:${cfg.color}`} class="w-2.5 h-2.5 rounded-full flex-shrink-0"></span>
								<span class="font-display font-bold text-xs text-sk-text truncate">{cfg.label}</span>
								<span class="text-xs text-sk-muted font-body">({items.length})</span>
							</div>
							<div class="space-y-2 min-h-[100px]">
								{items.map((l) => {
									const pc = POTENTIAL_CFG[l.flow_potential] || POTENTIAL_CFG.medio;
									const isOverdue = l.next_followup_at && new Date(l.next_followup_at) < new Date();
									return (
										<div draggable="true"
											ondragstart={`onDragStart(event,${l.id},'${status}')`}
											ondragend="onDragEnd(event)"
											onclick={`openLead(${l.id})`}
											class={`bg-sk-surface rounded-sk p-2.5 shadow-sk-sm border border-sk-border/30 cursor-grab hover:shadow-sk-md transition-shadow ${isOverdue ? "border-l-4 border-sk-danger" : ""}`}>
											<p class="font-display font-bold text-xs text-sk-text truncate">{l.company_name}</p>
											<p class="text-xs text-sk-muted font-body truncate">{l.contact_name}</p>
											<div class="flex items-center justify-between mt-1.5">
												<span class={`${pc.bg} ${pc.text} px-1.5 py-0.5 rounded text-xs font-display`}>{pc.label}</span>
												{isOverdue && <span class="text-xs text-sk-danger font-bold">!</span>}
												{l.has_competition === 1 && <span class="text-xs" title="Concorrência">⚔️</span>}
											</div>
										</div>
									);
								})}
								{items.length === 0 && (
									<div class="text-center py-4 text-sk-muted text-xs font-body border border-dashed border-sk-border rounded-sk">
										Arraste aqui
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Detail panel */}
			<div id="crm-detail" style="display:none" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50"></div>

			{/* ── Edit Modal ── */}
			<div id="crm-edit-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-lg p-6 fade-in max-h-[90vh] overflow-y-auto">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-display font-bold text-sk-text">Editar Lead</h3>
						<button onclick="hideEditModal()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<form onsubmit="saveEdit(event)" class="space-y-3">
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Empresa *</label>
								<input id="edit-company_name" type="text" required class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Contato *</label>
								<input id="edit-contact_name" type="text" required class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Cargo</label>
								<input id="edit-contact_role" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Email</label>
								<input id="edit-email" type="email" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">WhatsApp</label>
								<input id="edit-whatsapp" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Rede Social</label>
								<input id="edit-social_profile" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Endereço</label>
							<input id="edit-address" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						<div class="grid grid-cols-3 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Tipo de Local</label>
								<select id="edit-location_type" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="">—</option><option value="shopping">Shopping</option><option value="condominio">Condomínio</option>
									<option value="praca">Praça</option><option value="evento">Evento</option></select></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Origem</label>
								<select id="edit-lead_source" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="ativo">Prospecção Ativa</option><option value="maps">Google Maps</option><option value="indicacao">Indicação</option></select></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Potencial</label>
								<select id="edit-flow_potential" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option></select></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Próximo Follow-up</label>
								<input id="edit-next_followup_at" type="date" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div class="flex items-end pb-1 gap-2">
								<input id="edit-has_competition" type="checkbox" class="w-4 h-4 rounded accent-sk-blue" />
								<label class="text-sm font-display font-medium text-sk-text">Concorrência</label>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Valor estimado (R$)</label>
								<input id="edit-estimated_value" type="number" step="0.01" min="0" placeholder="0,00" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div></div>
						</div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Mapa (cole o iframe do Google Maps)</label>
							<textarea id="edit-map_embed" placeholder='Cole o <iframe> do Google Maps aqui...' class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body resize-none h-16 focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none"></textarea></div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-bounce flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-sm">Salvar</button>
							<button type="button" onclick="hideEditModal()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm">Cancelar</button>
						</div>
					</form>
				</div>
			</div>

			{/* ── Create Modal ── */}
			<div id="crm-create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-lg p-6 fade-in max-h-[90vh] overflow-y-auto">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-display font-bold text-sk-text">Novo Lead</h3>
						<button onclick="hideCreateModal()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<form onsubmit="createLead(event)" class="space-y-3">
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Empresa *</label>
								<input id="new-company_name" type="text" required class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Contato *</label>
								<input id="new-contact_name" type="text" required class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Cargo</label>
								<input id="new-contact_role" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Email</label>
								<input id="new-email" type="email" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">WhatsApp</label>
								<input id="new-whatsapp" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" placeholder="55119999..." /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Rede Social</label>
								<input id="new-social_profile" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" placeholder="@perfil" /></div>
						</div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Endereço</label>
							<input id="new-address" type="text" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						<div class="grid grid-cols-3 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Tipo de Local</label>
								<select id="new-location_type" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="">—</option><option value="shopping">Shopping</option><option value="condominio">Condomínio</option>
									<option value="praca">Praça</option><option value="evento">Evento</option></select></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Origem</label>
								<select id="new-lead_source" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="ativo">Prospecção Ativa</option><option value="maps">Google Maps</option><option value="indicacao">Indicação</option></select></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Potencial</label>
								<select id="new-flow_potential" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="baixo">Baixo</option><option value="medio" selected>Médio</option><option value="alto">Alto</option></select></div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Próximo Follow-up</label>
								<input id="new-next_followup_at" type="date" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div class="flex items-end pb-1 gap-2">
								<input id="new-has_competition" type="checkbox" class="w-4 h-4 rounded accent-sk-blue" />
								<label class="text-sm font-display font-medium text-sk-text">Concorrência</label>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Valor estimado (R$)</label>
								<input id="new-estimated_value" type="number" step="0.01" min="0" placeholder="0,00" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div></div>
						</div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Mapa (cole o iframe do Google Maps)</label>
							<textarea id="new-map_embed" placeholder='Cole o <iframe> do Google Maps aqui...' class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body resize-none h-14 focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none"></textarea></div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-bounce flex-1 py-2.5 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk font-display font-bold text-sm">Criar Lead</button>
							<button type="button" onclick="hideCreateModal()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm">Cancelar</button>
						</div>
					</form>
				</div>
			</div>

			{/* ── Convert Modal ── */}
			<div id="crm-convert-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-sm p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-display font-bold text-sk-text">Converter em Cliente</h3>
						<button onclick="hideConvertModal()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<form onsubmit="convertLead(event)" class="space-y-3">
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Subdomínio</label>
							<input id="convert-slug" type="text" required placeholder="nome-do-parque" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Senha inicial</label>
							<input id="convert-password" type="text" required class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Plano</label>
							<select id="convert-plan" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk text-sm font-body">
								<option value="starter">Starter</option><option value="pro" selected>Pro</option><option value="enterprise">Enterprise</option></select></div>
						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-bounce flex-1 py-2.5 bg-sk-green hover:bg-sk-green-dark text-white rounded-sk font-display font-bold text-sm">Converter</button>
							<button type="button" onclick="hideConvertModal()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
