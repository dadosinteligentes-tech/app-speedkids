import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { TicketWithMeta } from "../../db/queries/support-tickets";
import { PlatformLayout } from "./layout";

interface Props {
	tickets: TicketWithMeta[];
	user: { name: string; email: string } | null;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	open: { bg: "bg-sk-green-light", text: "text-sk-green-dark", label: "Aberto" },
	awaiting_reply: { bg: "bg-sk-orange-light", text: "text-sk-orange", label: "Aguardando resposta" },
	resolved: { bg: "bg-sk-bg", text: "text-sk-muted", label: "Resolvido" },
	closed: { bg: "bg-gray-100", text: "text-gray-400", label: "Fechado" },
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	low: { bg: "bg-sk-bg", text: "text-sk-muted", label: "Baixa" },
	normal: { bg: "bg-sk-blue-light", text: "text-sk-blue-dark", label: "Normal" },
	high: { bg: "bg-sk-orange-light", text: "text-sk-orange", label: "Alta" },
	urgent: { bg: "bg-sk-danger-light", text: "text-sk-danger", label: "Urgente" },
};

export const PlatformTickets: FC<Props> = ({ tickets, user }) => {
	const openCount = tickets.filter((t) => t.status === "open").length;
	const unreadTotal = tickets.reduce((acc, t) => acc + t.unread_count, 0);

	const script = html`<script>
${raw(`
var currentTicket = null;
var lastMsgId = 0;
var pollTimer = null;

function openTicket(id) {
	currentTicket = id;
	lastMsgId = 0;
	document.getElementById('ticket-list').style.display = 'none';
	document.getElementById('ticket-detail').style.display = 'flex';
	document.getElementById('ticket-messages').innerHTML = '<div class="text-center py-8 text-sk-muted text-sm">Carregando...</div>';
	fetchMessages(false);
	if (pollTimer) clearInterval(pollTimer);
	pollTimer = setInterval(function() { fetchMessages(true); }, 5000);
}

function closeDetail() {
	currentTicket = null;
	if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
	document.getElementById('ticket-list').style.display = 'block';
	document.getElementById('ticket-detail').style.display = 'none';
}

var platformPendingFile = null;

function renderAttachment(m) {
	if (!m.attachment_url) return '';
	var name = m.attachment_name || 'Anexo';
	var isImage = /\\.(jpg|jpeg|png|gif|webp)$/i.test(name);
	if (isImage) {
		return '<div class="mt-1"><img src="' + m.attachment_url + '" alt="' + name + '" style="max-width:200px;max-height:150px;border-radius:8px;cursor:pointer" onclick="window.open(this.src)" /></div>';
	}
	return '<div class="mt-1"><a href="' + m.attachment_url + '" target="_blank" style="text-decoration:underline;font-size:12px">📎 ' + name + '</a></div>';
}

function fetchMessages(isPolling) {
	var url = '/api/platform/tickets/' + currentTicket + '/messages';
	if (isPolling && lastMsgId > 0) url += '?after=' + lastMsgId;
	fetch(url)
		.then(function(r) { return r.json(); })
		.then(function(data) {
			var container = document.getElementById('ticket-messages');
			if (!isPolling || lastMsgId === 0) container.innerHTML = '';
			if (data.ticket) {
				document.getElementById('ticket-detail-title').textContent = data.ticket.tenant_name || 'Ticket #' + currentTicket;
			}
			data.messages.forEach(function(m) {
				lastMsgId = Math.max(lastMsgId, m.id);
				var isPlatform = m.sender_type === 'platform';
				var div = document.createElement('div');
				div.className = 'flex flex-col ' + (isPlatform ? 'items-end' : 'items-start') + ' px-4 py-1';
				var bg = isPlatform ? 'bg-sk-blue text-white' : 'bg-sk-bg text-sk-text';
				var time = m.created_at ? m.created_at.slice(11, 16) : '';
				var attachHtml = renderAttachment(m);
				div.innerHTML = '<div class="max-w-[80%] px-3 py-2 rounded-sk text-sm font-body ' + bg + '">' + m.message.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>') + attachHtml + '</div>'
					+ '<span class="text-xs text-sk-muted mt-1">' + (isPlatform ? 'Você' : m.sender_name) + ' · ' + time + '</span>';
				container.appendChild(div);
			});
			if (!isPolling || data.messages.length > 0) container.scrollTop = container.scrollHeight;
		});
}

function platformFileSelected(input) {
	if (input.files && input.files[0]) {
		platformPendingFile = input.files[0];
		document.getElementById('platform-attachment-name').textContent = platformPendingFile.name;
		document.getElementById('platform-attachment-preview').style.display = 'flex';
	}
}

function platformClearFile() {
	platformPendingFile = null;
	document.getElementById('platform-file-input').value = '';
	document.getElementById('platform-attachment-preview').style.display = 'none';
}

function sendReply(e) {
	e.preventDefault();
	var input = document.getElementById('reply-input');
	var msg = input.value.trim();
	if (!msg && !platformPendingFile) return;
	input.value = '';

	if (platformPendingFile) {
		var formData = new FormData();
		formData.append('message', msg || '📎 ' + platformPendingFile.name);
		formData.append('file', platformPendingFile);
		platformClearFile();
		fetch('/api/platform/tickets/' + currentTicket + '/messages', {
			method: 'POST', body: formData
		}).then(function() { fetchMessages(true); });
	} else {
		fetch('/api/platform/tickets/' + currentTicket + '/messages', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: msg })
		}).then(function() { fetchMessages(true); });
	}
}

function changeStatus(status) {
	fetch('/api/platform/tickets/' + currentTicket + '/status', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ status: status })
	}).then(function() { location.reload(); });
}
`)}
</script>`;

	return (
		<PlatformLayout
			title="Tickets de Suporte"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Tickets" }]}
			bodyScripts={script}
		>
			{/* Summary */}
			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Total</p>
					<p class="text-3xl font-bold font-display text-sk-text">{tickets.length}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">Abertos</p>
					<p class="text-3xl font-bold font-display text-sk-green-dark">{openCount}</p>
				</div>
				<div class={`bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 ${unreadTotal > 0 ? "border-sk-danger" : "border-sk-border/50"}`}>
					<p class="text-xs text-sk-danger font-display font-medium uppercase tracking-wider mb-1">Não lidos</p>
					<p class="text-3xl font-bold font-display text-sk-danger">{unreadTotal}</p>
				</div>
			</div>

			{/* Ticket List */}
			<div id="ticket-list" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30">
					<h2 class="font-semibold font-display text-sk-text">Chamados</h2>
				</div>
				<div class="divide-y divide-sk-border/20">
					{tickets.map((t) => {
						const sb = STATUS_BADGE[t.status] || STATUS_BADGE.open;
						const pb = PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.normal;
						return (
							<div onclick={`openTicket(${t.id})`} class="px-6 py-4 cursor-pointer hover:bg-sk-blue-light/20 transition-colors flex items-center gap-4">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2">
										<span class="font-display font-bold text-sm text-sk-text truncate">{t.subject}</span>
										{t.unread_count > 0 && (
											<span class="bg-sk-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">{t.unread_count}</span>
										)}
									</div>
									<p class="text-xs text-sk-muted font-body mt-1">{t.tenant_name} · {t.created_by_name} · {t.message_count} mensagens</p>
								</div>
								<span class={`${pb.bg} ${pb.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>{pb.label}</span>
								<span class={`${sb.bg} ${sb.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>{sb.label}</span>
								<span class="text-xs text-sk-muted tabular-nums">{t.updated_at?.slice(0, 10)}</span>
							</div>
						);
					})}
					{tickets.length === 0 && (
						<div class="text-center py-12 text-sk-muted text-sm font-body">Nenhum chamado de suporte</div>
					)}
				</div>
			</div>

			{/* Ticket Detail (hidden by default) */}
			<div id="ticket-detail" style="display:none" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden flex flex-col" >
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<button onclick="closeDetail()" class="text-sk-blue hover:text-sk-blue-dark font-display font-bold text-sm">&larr; Voltar</button>
						<h2 id="ticket-detail-title" class="font-semibold font-display text-sk-text">Ticket</h2>
					</div>
					<div class="flex items-center gap-2">
						<button onclick="changeStatus('resolved')" class="text-xs bg-sk-green-light text-sk-green-dark px-3 py-1.5 rounded-sk font-display font-medium hover:bg-sk-green/20 transition-colors">Resolver</button>
						<button onclick="changeStatus('closed')" class="text-xs bg-sk-bg text-sk-muted px-3 py-1.5 rounded-sk font-display font-medium hover:bg-sk-border/30 transition-colors">Fechar</button>
					</div>
				</div>
				<div id="ticket-messages" class="flex-1 overflow-y-auto" style="max-height:400px;min-height:200px">
				</div>
				<div class="p-4 border-t border-sk-border/30 bg-sk-bg">
					<div id="platform-attachment-preview" style="display:none" class="flex items-center gap-2 mb-2 px-2 py-1 bg-sk-orange-light border border-sk-orange rounded-sk text-xs font-body">
						<span>📎</span><span id="platform-attachment-name"></span>
						<button onclick="platformClearFile()" class="ml-auto text-sk-muted hover:text-sk-text">&times;</button>
					</div>
					<form onsubmit="sendReply(event)" class="flex gap-2 items-center">
						<label class="cursor-pointer text-lg flex-shrink-0" title="Anexar arquivo">
							📎
							<input id="platform-file-input" type="file" style="display:none" onchange="platformFileSelected(this)" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
						</label>
						<input id="reply-input" type="text" placeholder="Responder..." class="flex-1 px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" autocomplete="off" />
						<button type="submit" class="bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2.5 rounded-sk font-display font-bold text-sm transition-colors">Enviar</button>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
