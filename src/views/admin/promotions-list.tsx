import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Tenant } from "../../db/schema";
import type { Promotion } from "../../db/schema";
import type { PromotionUsage } from "../../db/queries/promotions";
import { AdminLayout } from "./layout";

interface Props {
	promotions: PromotionUsage[];
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

function fmtDiscount(type: string, value: number): string {
	if (type === "percentage") return `${value}%`;
	return `R$ ${(value / 100).toFixed(2).replace(".", ",")}`;
}

function fmtBRL(cents: number): string {
	return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export const PromotionsList: FC<Props> = ({ promotions, user, tenant, isPlatformAdmin, planFeatures }) => {
	const script = html`<script>
${raw(`
function showModal() {
	document.getElementById('promo-modal').classList.remove('hidden');
	document.getElementById('modal-title').textContent = 'Nova Promoção';
	document.getElementById('promo-id').value = '';
	document.getElementById('promo-name').value = '';
	document.getElementById('promo-desc').value = '';
	document.getElementById('promo-type').value = 'percentage';
	document.getElementById('promo-value').value = '';
	document.getElementById('promo-name').focus();
}

function editPromo(id, name, desc, type, value) {
	document.getElementById('promo-modal').classList.remove('hidden');
	document.getElementById('modal-title').textContent = 'Editar Promoção';
	document.getElementById('promo-id').value = id;
	document.getElementById('promo-name').value = name;
	document.getElementById('promo-desc').value = desc || '';
	document.getElementById('promo-type').value = type;
	document.getElementById('promo-value').value = type === 'fixed' ? (value / 100).toFixed(2) : value;
	document.getElementById('promo-name').focus();
}

function closeModal() {
	document.getElementById('promo-modal').classList.add('hidden');
}

function savePromo() {
	var id = document.getElementById('promo-id').value;
	var name = document.getElementById('promo-name').value.trim();
	var desc = document.getElementById('promo-desc').value.trim();
	var type = document.getElementById('promo-type').value;
	var rawVal = parseFloat(document.getElementById('promo-value').value) || 0;
	if (!name || rawVal <= 0) { alert('Preencha nome e valor do desconto'); return; }
	if (type === 'percentage' && rawVal > 100) { alert('Percentual máximo é 100%'); return; }

	var value = type === 'fixed' ? Math.round(rawVal * 100) : Math.round(rawVal);

	var url = id ? '/api/promotions/' + id : '/api/promotions';
	var method = id ? 'PUT' : 'POST';

	fetch(url, {
		method: method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: name, description: desc || null, discount_type: type, discount_value: value })
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) { location.reload(); }
		else { alert(res.data.error || 'Erro ao salvar'); }
	});
}

function togglePromo(id) {
	fetch('/api/promotions/' + id + '/toggle', { method: 'POST' })
		.then(function(r) { if (r.ok) location.reload(); else alert('Erro'); });
}

function deletePromo(id, name) {
	if (!confirm('Excluir promoção "' + name + '"?')) return;
	fetch('/api/promotions/' + id, { method: 'DELETE' })
		.then(function(r) { if (r.ok) location.reload(); else alert('Erro ao excluir'); });
}
`)}
</script>`;

	return (
		<AdminLayout title="Promoções" user={user} activeTab="/admin/promotions" tenant={tenant} isPlatformAdmin={isPlatformAdmin} bodyScripts={script}>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-xl font-display font-bold text-sk-text">Promoções e Cortesias</h2>
				<button onclick="showModal()" class="btn-touch btn-bounce px-4 py-2 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk font-display font-bold text-sm shadow-sk-sm">
					+ Nova Promoção
				</button>
			</div>

			{promotions.length === 0 ? (
				<div class="text-center py-12 bg-sk-surface rounded-sk-xl shadow-sk-sm">
					<span class="text-4xl mb-3 block">🏷️</span>
					<p class="font-display font-bold text-sk-text mb-1">Nenhuma promoção cadastrada</p>
					<p class="font-body text-sm text-sk-muted">Crie promoções para aplicar descontos rastreáveis nas locações e vendas.</p>
				</div>
			) : (
				<div class="grid gap-4">
					{promotions.map((p) => (
						<div class={`bg-sk-surface rounded-sk-lg shadow-sk-sm border-2 p-4 flex flex-col md:flex-row md:items-center gap-4 ${p.active ? "border-sk-border/50" : "border-gray-200 opacity-60"}`}>
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<span class={`inline-block w-2 h-2 rounded-full ${p.active ? "bg-sk-green" : "bg-gray-400"}`}></span>
									<h3 class="font-display font-bold text-sk-text truncate">{p.name}</h3>
									<span class="bg-sk-blue-light text-sk-blue-dark px-2 py-0.5 rounded-full text-xs font-display font-medium">
										{fmtDiscount(p.discount_type, p.discount_value)}
									</span>
								</div>
								{p.description && <p class="font-body text-sm text-sk-muted truncate">{p.description}</p>}
								<div class="flex gap-4 mt-2 text-xs font-body text-sk-muted">
									<span>Locações: <strong class="text-sk-text">{p.rental_count}</strong></span>
									<span>Vendas: <strong class="text-sk-text">{p.product_count}</strong></span>
									<span>Desconto total: <strong class="text-sk-text">{fmtBRL(p.total_discount_cents)}</strong></span>
								</div>
							</div>
							<div class="flex gap-2 flex-shrink-0">
								<button
									onclick={`editPromo(${p.id}, ${JSON.stringify(p.name)}, ${JSON.stringify(p.description || "")}, '${p.discount_type}', ${p.discount_value})`}
									class="px-3 py-2 bg-sk-blue-light text-sk-blue-dark rounded-sk text-xs font-display font-medium hover:bg-sk-blue/20"
								>
									Editar
								</button>
								<button
									onclick={`togglePromo(${p.id})`}
									class={`px-3 py-2 rounded-sk text-xs font-display font-medium ${p.active ? "bg-sk-yellow-light text-sk-yellow-dark hover:bg-sk-yellow/20" : "bg-sk-green-light text-sk-green-dark hover:bg-sk-green/20"}`}
								>
									{p.active ? "Desativar" : "Ativar"}
								</button>
								<button
									onclick={`deletePromo(${p.id}, ${JSON.stringify(p.name)})`}
									class="px-3 py-2 bg-sk-danger-light text-sk-danger rounded-sk text-xs font-display font-medium hover:bg-sk-danger/20"
								>
									Excluir
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Modal */}
			<div id="promo-modal" class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
				<div class="bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl shadow-sk-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
					<h3 id="modal-title" class="text-lg font-display font-bold text-sk-text mb-4">Nova Promoção</h3>
					<input type="hidden" id="promo-id" />
					<div class="space-y-4">
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome *</label>
							<input id="promo-name" type="text" class="w-full px-4 py-2 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" placeholder="Ex: Aniversariante, Black Friday" />
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Descrição</label>
							<input id="promo-desc" type="text" class="w-full px-4 py-2 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" placeholder="Descrição opcional" />
						</div>
						<div class="flex gap-3">
							<div class="w-1/3">
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Tipo</label>
								<select id="promo-type" class="w-full px-3 py-2 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none">
									<option value="percentage">%</option>
									<option value="fixed">R$</option>
								</select>
							</div>
							<div class="flex-1">
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Valor *</label>
								<input id="promo-value" type="number" min="0" step="0.01" class="w-full px-4 py-2 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" placeholder="Ex: 20" />
							</div>
						</div>
					</div>
					<div class="flex gap-3 mt-6">
						<button onclick="savePromo()" class="btn-touch btn-bounce flex-1 py-3 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk font-display font-bold shadow-sk-sm">
							Salvar
						</button>
						<button onclick="closeModal()" class="btn-touch flex-1 py-3 bg-gray-200 rounded-sk font-display font-bold text-sk-muted">
							Cancelar
						</button>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
};
