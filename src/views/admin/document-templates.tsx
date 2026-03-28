import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant, DocumentTemplate } from "../../db/schema";
import { AdminLayout } from "./layout";

interface Props {
	templates: DocumentTemplate[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

const VARIABLES = [
	["empresa", "Nome do estabelecimento"],
	["cnpj", "CNPJ"],
	["endereco", "Endereço"],
	["telefone", "Telefone"],
	["cliente", "Nome do cliente"],
	["telefone_cliente", "Telefone do cliente"],
	["crianca", "Nome da criança"],
	["idade", "Idade da criança"],
	["brinquedo", "Nome do brinquedo"],
	["pacote", "Nome do pacote"],
	["duracao", "Duração (minutos)"],
	["valor", "Valor (R$)"],
	["inicio", "Hora de início"],
	["fim_previsto", "Fim previsto"],
	["operador", "Nome do operador"],
	["data_atual", "Data atual"],
	["hora_atual", "Hora atual"],
];

export const DocumentTemplatesPage: FC<Props> = ({ templates, user, tenant, isPlatformAdmin }) => {
	const script = html`<script>
${raw(`
function showModal(mode, id) {
	var modal = document.getElementById('template-modal');
	document.getElementById('modal-title').textContent = mode === 'edit' ? 'Editar Documento' : 'Novo Documento';
	document.getElementById('modal-mode').value = mode;
	document.getElementById('modal-id').value = id || '';
	if (mode === 'edit' && id) {
		fetch('/api/document-templates/' + id)
			.then(function(r) { return r.json(); })
			.then(function(t) {
				document.getElementById('tpl-name').value = t.name;
				document.getElementById('tpl-description').value = t.description || '';
				document.getElementById('tpl-content').value = t.content;
				document.getElementById('tpl-print-mode').value = t.print_mode;
				document.getElementById('tpl-active').checked = !!t.is_active;
				document.getElementById('tpl-sort').value = t.sort_order || 0;
			});
	} else {
		document.getElementById('tpl-name').value = '';
		document.getElementById('tpl-description').value = '';
		document.getElementById('tpl-content').value = '';
		document.getElementById('tpl-print-mode').value = 'optional';
		document.getElementById('tpl-active').checked = true;
		document.getElementById('tpl-sort').value = '0';
	}
	modal.classList.remove('hidden');
}
function hideModal() { document.getElementById('template-modal').classList.add('hidden'); }

function saveTemplate(e) {
	e.preventDefault();
	var mode = document.getElementById('modal-mode').value;
	var id = document.getElementById('modal-id').value;
	var data = {
		name: document.getElementById('tpl-name').value.trim(),
		description: document.getElementById('tpl-description').value.trim() || null,
		content: document.getElementById('tpl-content').value,
		print_mode: document.getElementById('tpl-print-mode').value,
		is_active: document.getElementById('tpl-active').checked,
		sort_order: parseInt(document.getElementById('tpl-sort').value, 10) || 0,
	};
	if (!data.name || !data.content) { showToast('Nome e conteúdo são obrigatórios', 'error'); return; }

	var url = mode === 'edit' ? '/api/document-templates/' + id : '/api/document-templates';
	var method = mode === 'edit' ? 'PUT' : 'POST';
	fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
		.then(function(r) {
			if (r.ok) { hideModal(); showToast(mode === 'edit' ? 'Documento atualizado' : 'Documento criado'); setTimeout(function(){ location.reload(); }, 800); }
			else { r.json().then(function(d) { showToast(d.error || 'Erro', 'error'); }); }
		});
}

function deleteTemplate(id, name) {
	if (!confirm('Excluir o documento "' + name + '"?')) return;
	fetch('/api/document-templates/' + id, { method: 'DELETE' })
		.then(function(r) {
			if (r.ok) { showToast('Documento excluído'); setTimeout(function(){ location.reload(); }, 600); }
		});
}

function previewTemplate(id) {
	window.open('/receipts/document/' + id + '/preview', '_blank');
}

function insertVar(v) {
	var ta = document.getElementById('tpl-content');
	var start = ta.selectionStart;
	var end = ta.selectionEnd;
	var text = ta.value;
	var insert = '{{' + v + '}}';
	ta.value = text.substring(0, start) + insert + text.substring(end);
	ta.selectionStart = ta.selectionEnd = start + insert.length;
	ta.focus();
}

/* ── Reorder ── */
function moveTemplate(id, direction) {
	var rows = Array.from(document.querySelectorAll('[data-tpl-id]'));
	var idx = rows.findIndex(function(r) { return r.getAttribute('data-tpl-id') === String(id); });
	if (idx < 0) return;
	var swapIdx = idx + direction;
	if (swapIdx < 0 || swapIdx >= rows.length) return;

	var myId = parseInt(rows[idx].getAttribute('data-tpl-id'));
	var otherId = parseInt(rows[swapIdx].getAttribute('data-tpl-id'));
	var myOrder = parseInt(rows[idx].getAttribute('data-tpl-order'));
	var otherOrder = parseInt(rows[swapIdx].getAttribute('data-tpl-order'));

	// If same order value, assign based on position
	if (myOrder === otherOrder) {
		myOrder = idx;
		otherOrder = swapIdx;
	}

	// Swap the sort_order values
	var btn = rows[idx].querySelector('.move-btn');
	if (btn) btn.disabled = true;

	Promise.all([
		fetch('/api/document-templates/' + myId, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sort_order: otherOrder })
		}),
		fetch('/api/document-templates/' + otherId, {
			method: 'PUT', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sort_order: myOrder })
		})
	]).then(function() {
		// Animate swap
		var parent = rows[idx].parentNode;
		if (direction === -1) {
			rows[idx].style.transform = 'translateY(-' + rows[swapIdx].offsetHeight + 'px)';
			rows[swapIdx].style.transform = 'translateY(' + rows[idx].offsetHeight + 'px)';
		} else {
			rows[idx].style.transform = 'translateY(' + rows[swapIdx].offsetHeight + 'px)';
			rows[swapIdx].style.transform = 'translateY(-' + rows[idx].offsetHeight + 'px)';
		}
		rows[idx].style.transition = 'transform 0.25s ease';
		rows[swapIdx].style.transition = 'transform 0.25s ease';
		setTimeout(function() { location.reload(); }, 300);
	});
}
`)}
</script>`;

	return (
		<AdminLayout title="Modelos de Documentos" user={user} activeTab="/admin/documents" tenant={tenant} isPlatformAdmin={isPlatformAdmin} bodyScripts={script}>
			<div class="max-w-4xl">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-xl font-display font-bold text-sk-text">Modelos de Documentos</h2>
						<p class="text-sm text-sk-muted font-body">Crie termos, recibos e autorizações para imprimir na térmica durante a locação.</p>
					</div>
					<button onclick="showModal('create')" class="btn-bounce bg-sk-orange hover:bg-sk-orange-dark text-white px-4 py-2 rounded-sk text-sm font-display font-bold shadow-sk-sm">
						+ Novo Documento
					</button>
				</div>

				{/* Templates list */}
				{templates.length > 0 ? (
					<div class="space-y-2" id="templates-list">
						{templates.map((t, idx) => (
							<div
								data-tpl-id={String(t.id)}
								data-tpl-order={String(t.sort_order)}
								class={`bg-sk-surface rounded-sk-lg shadow-sk-sm border-2 ${t.is_active ? "border-sk-border/50" : "border-sk-border/20 opacity-60"}`}
							>
								<div class="flex items-center gap-0">
									{/* Reorder arrows */}
									<div class="flex flex-col items-center justify-center px-2 py-2 border-r border-sk-border/30 self-stretch" style="min-width:44px">
										<button
											onclick={`moveTemplate(${t.id}, -1)`}
											disabled={idx === 0}
											class={`move-btn p-1 rounded transition-colors ${idx === 0 ? "text-gray-300 cursor-not-allowed" : "text-sk-muted hover:text-sk-orange hover:bg-sk-orange-light"}`}
											title="Mover para cima"
										>
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
										</button>
										<span class="text-xs font-mono text-sk-muted/60 leading-none my-0.5">{idx + 1}</span>
										<button
											onclick={`moveTemplate(${t.id}, 1)`}
											disabled={idx === templates.length - 1}
											class={`move-btn p-1 rounded transition-colors ${idx === templates.length - 1 ? "text-gray-300 cursor-not-allowed" : "text-sk-muted hover:text-sk-orange hover:bg-sk-orange-light"}`}
											title="Mover para baixo"
										>
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
										</button>
									</div>

									{/* Content */}
									<div class="flex-1 min-w-0 p-4">
										<div class="flex items-start justify-between gap-3">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													<h3 class="font-display font-bold text-base text-sk-text">{t.name}</h3>
													<span class={`px-2 py-0.5 rounded text-xs font-display font-medium ${t.print_mode === "mandatory" ? "bg-sk-danger-light text-sk-danger" : "bg-sk-blue-light text-sk-blue-dark"}`}>
														{t.print_mode === "mandatory" ? "Obrigatório" : "Opcional"}
													</span>
													{!t.is_active && <span class="px-2 py-0.5 rounded text-xs font-display font-medium bg-gray-100 text-gray-500">Inativo</span>}
												</div>
												{t.description && <p class="text-sm text-sk-muted font-body mb-1">{t.description}</p>}
												<p class="text-xs text-sk-muted font-body font-mono truncate">{t.content.slice(0, 80)}...</p>
											</div>
											<div class="flex gap-1 flex-shrink-0">
												<button onclick={`previewTemplate(${t.id})`} class="btn-touch px-2.5 py-1.5 bg-sk-green-light text-sk-green-dark rounded-sk text-xs font-display font-medium" title="Preview térmico">
													Preview
												</button>
												<button onclick={`showModal('edit',${t.id})`} class="btn-touch px-2.5 py-1.5 bg-sk-blue-light text-sk-blue-dark rounded-sk text-xs font-display font-medium">
													Editar
												</button>
												<button onclick={`deleteTemplate(${t.id},'${t.name.replace(/'/g, "\\'")}')`} class="btn-touch px-2.5 py-1.5 bg-sk-danger-light text-sk-danger rounded-sk text-xs font-display font-medium">
													Excluir
												</button>
											</div>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-12 text-center">
						<p class="text-3xl mb-2">📄</p>
						<p class="font-display font-bold text-sk-text mb-1">Nenhum modelo cadastrado</p>
						<p class="text-sm text-sk-muted font-body mb-4">Crie seu primeiro modelo de documento para imprimir durante as locações.</p>
						<button onclick="showModal('create')" class="btn-bounce bg-sk-orange hover:bg-sk-orange-dark text-white px-6 py-2.5 rounded-sk font-display font-bold text-sm">
							Criar primeiro documento
						</button>
					</div>
				)}
			</div>

			{/* Create/Edit Modal */}
			<div id="template-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-2xl p-6 fade-in max-h-[90vh] overflow-y-auto">
					<div class="flex items-center justify-between mb-4">
						<h3 id="modal-title" class="text-lg font-display font-bold text-sk-text">Novo Documento</h3>
						<button onclick="hideModal()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<input type="hidden" id="modal-mode" value="create" />
					<input type="hidden" id="modal-id" value="" />
					<form onsubmit="saveTemplate(event)" class="space-y-4">
						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Nome do documento *</label>
								<input id="tpl-name" type="text" required placeholder="Termo de Responsabilidade" class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Descrição</label>
								<input id="tpl-description" type="text" placeholder="Breve descrição" class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none" /></div>
						</div>

						{/* Variables reference */}
						<div>
							<label class="block text-xs font-display font-medium text-sk-text mb-1">Variáveis disponíveis <span class="text-sk-muted font-normal">(clique para inserir)</span></label>
							<div class="flex flex-wrap gap-1 mb-2">
								{VARIABLES.map(([key, label]) => (
									<button type="button" onclick={`insertVar('${key}')`}
										class="px-2 py-1 bg-sk-bg hover:bg-sk-blue-light text-xs font-mono text-sk-muted hover:text-sk-blue-dark rounded transition-colors"
										title={label as string}>
										{`{{${key}}}`}
									</button>
								))}
							</div>
						</div>

						{/* Content editor */}
						<div>
							<label class="block text-xs font-display font-medium text-sk-text mb-1">Conteúdo do documento *</label>
							<textarea id="tpl-content" required rows={12}
								placeholder={"[CENTRO]TERMO DE RESPONSABILIDADE\n---\nEu, {{cliente}}, responsável pela criança {{crianca}} de {{idade}} anos, declaro estar ciente das regras de uso do brinquedo {{brinquedo}}.\n---\nData: {{data_atual}} Hora: {{hora_atual}}\n\nAssinatura: ____________________"}
								class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-mono resize-y focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none"></textarea>
							<p class="text-xs text-sk-muted font-body mt-1">
								Use <code class="bg-sk-bg px-1 rounded">---</code> para separadores e <code class="bg-sk-bg px-1 rounded">[CENTRO]</code> para centralizar texto.
							</p>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div><label class="block text-xs font-display font-medium text-sk-text mb-1">Modo de impressão</label>
								<select id="tpl-print-mode" class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body">
									<option value="optional">Opcional</option>
									<option value="mandatory">Obrigatório</option>
								</select></div>
							<div class="flex items-end pb-1 gap-2">
								<input id="tpl-active" type="checkbox" checked class="w-4 h-4 rounded accent-sk-blue" />
								<label class="text-sm font-display font-medium text-sk-text">Ativo</label>
							</div>
						</div>

						<div class="flex gap-2 pt-2">
							<button type="submit" class="btn-bounce flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-sm">Salvar</button>
							<button type="button" onclick="hideModal()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
