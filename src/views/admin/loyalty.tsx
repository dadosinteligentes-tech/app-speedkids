import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import { AdminLayout } from "./layout";
import type { Tenant, LoyaltyTransaction } from "../../db/schema";
import type { LoyaltyConfigView } from "../../db/queries/loyalty";
import { toBrazilDateTime } from "../../lib/timezone";

interface LoyaltyPageProps {
	config: LoyaltyConfigView;
	stats: {
		totalEarned: number; totalRedeemed: number; activeCustomers: number;
		verifiedCustomers: number; totalCustomersWithEmail: number;
		earnedThisMonth: number; redeemedThisMonth: number;
	};
	ranking: { id: number; name: string; email: string | null; phone: string | null; loyalty_points: number; total_spent_cents: number; email_verified: number }[];
	transactions: (LoyaltyTransaction & { customer_name: string })[];
	user: { name: string; role: string } | null;
	tenant: Tenant | null;
	isPlatformAdmin: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
	canConfigure: boolean;
}

export const LoyaltyPage: FC<LoyaltyPageProps> = ({ config, stats, ranking, transactions, user, tenant, isPlatformAdmin, planFeatures, canConfigure }) => {
	const fmtBRL = (cents: number) => {
		const r = Math.floor(cents / 100);
		const c = cents % 100;
		return `R$ ${r.toLocaleString("pt-BR")},${c.toString().padStart(2, "0")}`;
	};

	const isOwner = user?.role === "owner";

	const script = html`<script>${raw(`
function showTab(tab) {
	document.querySelectorAll('[data-tab-content]').forEach(function(el) { el.classList.add('hidden'); });
	document.querySelectorAll('[data-tab-btn]').forEach(function(el) {
		el.className = el.className.replace(/bg-sk-orange-light text-sk-orange-dark/g, 'text-sk-muted hover:bg-sk-yellow-light');
	});
	var content = document.getElementById('tab-' + tab);
	var btn = document.getElementById('btn-' + tab);
	if (content) content.classList.remove('hidden');
	if (btn) {
		btn.className = btn.className.replace(/text-sk-muted hover:bg-sk-yellow-light/g, 'bg-sk-orange-light text-sk-orange-dark');
	}
}

function saveConfig(e) {
	e.preventDefault();
	var btn = document.getElementById('save-btn');
	btn.disabled = true;
	btn.textContent = 'Salvando...';

	var data = {
		enabled: document.getElementById('cfg-enabled').checked,
		points_per_real: parseInt(document.getElementById('cfg-ppr').value) || 1,
		min_redemption_points: parseInt(document.getElementById('cfg-min').value) || 100,
		points_value_cents: parseInt(document.getElementById('cfg-value').value) || 1,
		expiry_months: parseInt(document.getElementById('cfg-expiry').value) || 0,
		bonus_first_purchase: parseInt(document.getElementById('cfg-bonus-first').value) || 0,
		bonus_birthday: parseInt(document.getElementById('cfg-bonus-birthday').value) || 0,
		bonus_referral: parseInt(document.getElementById('cfg-bonus-referral').value) || 0,
		double_points_weekends: document.getElementById('cfg-double-weekends').checked
	};

	// Collect tiers
	var tierEls = document.querySelectorAll('[data-tier-row]');
	var tiers = [];
	tierEls.forEach(function(el) {
		var name = el.querySelector('[data-tier-name]').value.trim();
		var pts = parseInt(el.querySelector('[data-tier-pts]').value) || 0;
		if (name) tiers.push({ name: name, min_points: pts });
	});
	data.tiers = tiers;

	// Collect redemption options
	var optEls = document.querySelectorAll('[data-opt-row]');
	var options = [];
	optEls.forEach(function(el) {
		var label = el.querySelector('[data-opt-label]').value.trim();
		var type = el.querySelector('[data-opt-type]').value;
		var cost = parseInt(el.querySelector('[data-opt-cost]').value) || 0;
		var value = el.querySelector('[data-opt-value]').value.trim();
		var active = el.querySelector('[data-opt-active]').checked;
		if (label && cost > 0) options.push({ type: type, label: label, points_cost: cost, value: value, active: active });
	});
	data.redemption_options = options;

	fetch('/api/loyalty/config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	}).then(function(r) {
		if (r.ok) { showToast('Configuração salva'); location.reload(); }
		else { r.json().then(function(d) { alert(d.error || 'Erro'); }); }
	}).finally(function() { btn.disabled = false; btn.textContent = 'Salvar configurações'; });
}

function addTierRow() {
	var container = document.getElementById('tiers-container');
	var idx = container.children.length;
	var div = document.createElement('div');
	div.setAttribute('data-tier-row', '');
	div.className = 'flex items-center gap-2';
	div.innerHTML = '<input data-tier-name placeholder="Nome (ex: Ouro)" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm" />' +
		'<input data-tier-pts type="number" min="0" placeholder="Pontos mín." class="w-28 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm" />' +
		'<button type="button" onclick="this.parentElement.remove()" class="text-sk-danger text-xs">✕</button>';
	container.appendChild(div);
}

function addOptionRow() {
	var container = document.getElementById('options-container');
	var div = document.createElement('div');
	div.setAttribute('data-opt-row', '');
	div.className = 'bg-sk-bg rounded-sk p-3 space-y-2';
	div.innerHTML = '<div class="flex gap-2">' +
		'<input data-opt-label placeholder="Nome (ex: +10 min grátis)" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm" />' +
		'<select data-opt-type class="px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm"><option value="discount">Desconto</option><option value="extra_time">Tempo extra</option><option value="gift">Brinde</option><option value="cashback">Cashback</option></select>' +
		'<button type="button" onclick="this.closest(\\x27[data-opt-row]\\x27).remove()" class="text-sk-danger text-xs">✕</button>' +
		'</div>' +
		'<div class="flex gap-2">' +
		'<input data-opt-cost type="number" min="1" placeholder="Custo em pontos" class="w-32 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm" />' +
		'<input data-opt-value placeholder="Valor (ex: R$ 5,00 ou 10 min)" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm" />' +
		'<label class="flex items-center gap-1 text-xs font-body"><input data-opt-active type="checkbox" checked class="w-4 h-4" /> Ativo</label>' +
		'</div>';
	container.appendChild(div);
}

function sendVerification(customerId) {
	if (!confirm('Enviar email de verificação para este cliente?')) return;
	fetch('/api/loyalty/send-verification', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ customer_id: customerId })
	}).then(function(r) { return r.json(); })
	.then(function(d) {
		if (d.ok) showToast('Email enviado');
		else alert(d.error || 'Erro');
	});
}

function showAdjust(customerId, name) {
	document.getElementById('adj-customer-id').value = customerId;
	document.getElementById('adj-customer-name').textContent = name;
	document.getElementById('adjust-modal').classList.remove('hidden');
}
function hideAdjust() { document.getElementById('adjust-modal').classList.add('hidden'); }

function submitAdjust(e) {
	e.preventDefault();
	var data = {
		customer_id: parseInt(document.getElementById('adj-customer-id').value),
		points: parseInt(document.getElementById('adj-points').value),
		description: document.getElementById('adj-description').value.trim()
	};
	if (!data.description) { alert('Descrição obrigatória'); return; }
	fetch('/api/loyalty/adjust-points', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	}).then(function(r) { return r.json(); })
	.then(function(d) {
		if (d.ok) { showToast('Pontos ajustados'); location.reload(); }
		else alert(d.error || 'Erro');
	});
}
`)}</script>`;

	const typeLabels: Record<string, string> = { earned: "Ganho", redeemed: "Resgate", adjusted: "Ajuste", expired: "Expirado" };
	const typeColors: Record<string, string> = {
		earned: "bg-sk-green-light text-sk-green-dark",
		redeemed: "bg-sk-blue-light text-sk-blue-dark",
		adjusted: "bg-sk-purple-light text-sk-purple",
		expired: "bg-sk-danger-light text-sk-danger",
	};
	const optTypeLabels: Record<string, string> = { discount: "Desconto", extra_time: "Tempo extra", gift: "Brinde", cashback: "Cashback" };

	return (
		<AdminLayout title="Fidelidade" user={user} activeTab="/admin/loyalty" bodyScripts={script} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			{/* Stats row */}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-orange">{stats.totalEarned.toLocaleString("pt-BR")}</p>
					<p class="text-xs font-body text-sk-muted">Pontos emitidos</p>
					<p class="text-xs font-body text-sk-green mt-1">+{stats.earnedThisMonth.toLocaleString("pt-BR")} este mês</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-green">{stats.totalRedeemed.toLocaleString("pt-BR")}</p>
					<p class="text-xs font-body text-sk-muted">Pontos resgatados</p>
					<p class="text-xs font-body text-sk-blue mt-1">+{stats.redeemedThisMonth.toLocaleString("pt-BR")} este mês</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-blue">{stats.verifiedCustomers}</p>
					<p class="text-xs font-body text-sk-muted">Clientes verificados</p>
					<p class="text-xs font-body text-sk-muted mt-1">de {stats.totalCustomersWithEmail} com email</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-4 border border-sk-border/50 shadow-sk-sm">
					<p class="text-2xl font-display font-bold text-sk-text">{stats.activeCustomers}</p>
					<p class="text-xs font-body text-sk-muted">Clientes com pontos</p>
					{stats.totalEarned > 0 && (
						<p class="text-xs font-body text-sk-muted mt-1">{Math.round((stats.totalRedeemed / stats.totalEarned) * 100)}% taxa resgate</p>
					)}
				</div>
			</div>

			{/* Tabs */}
			<div class="bg-sk-surface rounded-sk-lg shadow-sk-sm border border-sk-border/50 overflow-hidden">
				<div class="flex border-b border-sk-border/30 overflow-x-auto">
					<button id="btn-config" data-tab-btn onclick="showTab('config')" class="px-5 py-3 text-sm font-display font-medium whitespace-nowrap bg-sk-orange-light text-sk-orange-dark">Configuração</button>
					<button id="btn-redemptions" data-tab-btn onclick="showTab('redemptions')" class="px-5 py-3 text-sm font-display font-medium whitespace-nowrap text-sk-muted hover:bg-sk-yellow-light">Opções de Resgate</button>
					<button id="btn-ranking" data-tab-btn onclick="showTab('ranking')" class="px-5 py-3 text-sm font-display font-medium whitespace-nowrap text-sk-muted hover:bg-sk-yellow-light">Ranking</button>
					<button id="btn-transactions" data-tab-btn onclick="showTab('transactions')" class="px-5 py-3 text-sm font-display font-medium whitespace-nowrap text-sk-muted hover:bg-sk-yellow-light">Movimentações</button>
				</div>

				{/* ── Tab: Config ── */}
				<div id="tab-config" data-tab-content class="p-5">
					<form onsubmit="saveConfig(event)">
						<div class="grid md:grid-cols-2 gap-6">
							{/* Left: Core settings */}
							<div class="space-y-4">
								<h3 class="font-display font-bold text-sk-text">Acúmulo de Pontos</h3>

								<label class="flex items-center gap-3 cursor-pointer p-3 bg-sk-bg rounded-sk">
									<input id="cfg-enabled" type="checkbox" checked={!!config.enabled} class="w-5 h-5 rounded" />
									<div>
										<span class="font-body text-sm text-sk-text font-medium">Programa ativo</span>
										<p class="text-xs text-sk-muted">Clientes com email verificado acumulam pontos</p>
									</div>
								</label>

								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Pontos por R$ 1,00</label>
										<input id="cfg-ppr" type="number" min="1" max="100" value={config.points_per_real} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
									</div>
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Valor do ponto (centavos)</label>
										<input id="cfg-value" type="number" min="1" value={config.points_value_cents} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
										<p class="text-xs text-sk-muted mt-1">1 ponto = R$ {(config.points_value_cents / 100).toFixed(2).replace(".", ",")}</p>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Mínimo para resgate</label>
										<input id="cfg-min" type="number" min="1" value={config.min_redemption_points} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
									</div>
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Expiração (meses)</label>
										<input id="cfg-expiry" type="number" min="0" value={config.expiry_months ?? 0} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
										<p class="text-xs text-sk-muted mt-1">0 = sem expiração</p>
									</div>
								</div>

								{!canConfigure && (
									<p class="text-xs text-sk-orange bg-sk-orange-light/50 px-3 py-2 rounded-sk font-body">
										Upgrade para o plano Pro para personalizar taxas, bônus e tiers
									</p>
								)}
							</div>

							{/* Right: Bonuses + Promos */}
							<div class="space-y-4">
								<h3 class="font-display font-bold text-sk-text">Bônus Especiais</h3>

								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">1ª compra (pontos)</label>
										<input id="cfg-bonus-first" type="number" min="0" value={config.bonus_first_purchase} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
									</div>
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Aniversário (pontos)</label>
										<input id="cfg-bonus-birthday" type="number" min="0" value={config.bonus_birthday} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
									</div>
								</div>

								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="block text-xs font-display font-medium text-sk-text mb-1">Indicação (pontos)</label>
										<input id="cfg-bonus-referral" type="number" min="0" value={config.bonus_referral} disabled={!canConfigure}
											class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg disabled:text-sk-muted" />
									</div>
									<div class="flex items-end pb-1">
										<label class="flex items-center gap-2 cursor-pointer">
											<input id="cfg-double-weekends" type="checkbox" checked={!!config.double_points_weekends} disabled={!canConfigure} class="w-4 h-4 rounded" />
											<span class="text-xs font-display font-medium text-sk-text">Dobrar pontos nos fins de semana</span>
										</label>
									</div>
								</div>

								<h3 class="font-display font-bold text-sk-text pt-2">Níveis (Tiers)</h3>
								<div id="tiers-container" class="space-y-2">
									{config.tiers.map((tier) => (
										<div data-tier-row class="flex items-center gap-2">
											<input data-tier-name value={tier.name} disabled={!canConfigure} placeholder="Nome" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg" />
											<input data-tier-pts type="number" min="0" value={tier.min_points} disabled={!canConfigure} placeholder="Pts mín." class="w-28 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-sk-bg" />
											{canConfigure && <button type="button" onclick="this.parentElement.remove()" class="text-sk-danger text-xs">✕</button>}
										</div>
									))}
								</div>
								{canConfigure && (
									<button type="button" onclick="addTierRow()" class="text-xs text-sk-blue font-display font-medium hover:underline">+ Adicionar nível</button>
								)}
							</div>
						</div>

						{isOwner && (
							<div class="mt-6 pt-4 border-t border-sk-border/30">
								<button id="save-btn" type="submit" class="bg-sk-orange hover:bg-sk-orange-dark text-white px-8 py-2.5 rounded-sk font-display font-bold text-sm transition-colors shadow-sk-sm">
									Salvar configurações
								</button>
							</div>
						)}
					</form>
				</div>

				{/* ── Tab: Redemption Options ── */}
				<div id="tab-redemptions" data-tab-content class="hidden p-5">
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="font-display font-bold text-sk-text">Opções de Resgate</h3>
							<p class="text-xs text-sk-muted font-body">Configure como os clientes podem usar seus pontos</p>
						</div>
						{canConfigure && (
							<button type="button" onclick="addOptionRow()" class="bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2 rounded-sk text-sm font-display font-medium transition-colors">
								+ Nova opção
							</button>
						)}
					</div>

					<form onsubmit="saveConfig(event)">
						{/* Hidden fields needed by saveConfig */}
						<input type="hidden" id="cfg-enabled-r" />
						<div id="options-container" class="space-y-3">
							{config.redemption_options.length === 0 && !canConfigure && (
								<p class="text-sm text-sk-muted py-4 text-center">Nenhuma opção de resgate configurada</p>
							)}
							{config.redemption_options.map((opt) => (
								<div data-opt-row class="bg-sk-bg rounded-sk p-3 space-y-2">
									<div class="flex gap-2">
										<input data-opt-label value={opt.label} disabled={!canConfigure} placeholder="Nome" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-white" />
										<select data-opt-type disabled={!canConfigure} class="px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-white">
											<option value="discount" selected={opt.type === "discount"}>Desconto</option>
											<option value="extra_time" selected={opt.type === "extra_time"}>Tempo extra</option>
											<option value="gift" selected={opt.type === "gift"}>Brinde</option>
											<option value="cashback" selected={opt.type === "cashback"}>Cashback</option>
										</select>
										{canConfigure && <button type="button" onclick="this.closest('[data-opt-row]').remove()" class="text-sk-danger text-xs">✕</button>}
									</div>
									<div class="flex gap-2">
										<input data-opt-cost type="number" min="1" value={opt.points_cost} disabled={!canConfigure} placeholder="Custo (pts)" class="w-32 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-white" />
										<input data-opt-value value={opt.value} disabled={!canConfigure} placeholder="Valor (ex: R$ 5,00)" class="flex-1 px-2 py-1.5 border border-sk-border rounded-sk font-body text-sm disabled:bg-white" />
										<label class="flex items-center gap-1 text-xs font-body whitespace-nowrap">
											<input data-opt-active type="checkbox" checked={opt.active} disabled={!canConfigure} class="w-4 h-4" /> Ativo
										</label>
									</div>
								</div>
							))}
						</div>

						{canConfigure && config.redemption_options.length === 0 && (
							<div class="text-center py-6 text-sk-muted">
								<p class="text-3xl mb-2">🎁</p>
								<p class="font-body text-sm">Crie opções como desconto, tempo extra ou brindes</p>
								<button type="button" onclick="addOptionRow()" class="mt-3 text-sk-blue font-display font-medium text-sm hover:underline">+ Criar primeira opção</button>
							</div>
						)}

						{isOwner && canConfigure && (
							<div class="mt-4 pt-4 border-t border-sk-border/30">
								<button type="submit" class="bg-sk-orange hover:bg-sk-orange-dark text-white px-8 py-2.5 rounded-sk font-display font-bold text-sm transition-colors">
									Salvar opções
								</button>
							</div>
						)}
					</form>
				</div>

				{/* ── Tab: Ranking ── */}
				<div id="tab-ranking" data-tab-content class="hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg text-left">
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">#</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Cliente</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Pontos</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Total gasto</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Verificado</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right">Ações</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-sk-border/30">
								{ranking.length === 0 && (
									<tr><td colspan={6} class="px-4 py-8 text-center text-sk-muted">Nenhum cliente com pontos ainda</td></tr>
								)}
								{ranking.map((c, i) => (
									<tr class="hover:bg-sk-orange-light/20 transition-colors">
										<td class="px-4 py-3 font-display font-bold text-sk-muted">{i + 1}</td>
										<td class="px-4 py-3">
											<a href={`/admin/customers/${c.id}`} class="font-display font-bold text-sk-text hover:text-sk-orange text-sm">{c.name}</a>
											<p class="text-xs text-sk-muted">{c.email || c.phone || "—"}</p>
										</td>
										<td class="px-4 py-3">
											<span class="font-display font-bold text-sk-orange">{c.loyalty_points.toLocaleString("pt-BR")}</span>
										</td>
										<td class="px-4 py-3 hidden md:table-cell text-sk-muted">{fmtBRL(c.total_spent_cents)}</td>
										<td class="px-4 py-3 hidden md:table-cell">
											{c.email_verified ? (
												<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-green-light text-sk-green-dark">Sim</span>
											) : (
												<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-yellow-light text-sk-yellow-dark">Não</span>
											)}
										</td>
										<td class="px-4 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												{!c.email_verified && c.email && (
													<button onclick={`sendVerification(${c.id})`} class="text-sk-blue text-xs font-display font-medium hover:underline">Verificar</button>
												)}
												{isOwner && (
													<button onclick={`showAdjust(${c.id},'${c.name.replace(/'/g, "\\'")}')`} class="text-sk-purple text-xs font-display font-medium hover:underline">Ajustar</button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* ── Tab: Transactions ── */}
				<div id="tab-transactions" data-tab-content class="hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg text-left">
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Data</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Cliente</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase">Tipo</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right">Pontos</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase text-right hidden md:table-cell">Saldo</th>
									<th class="px-4 py-3 font-display font-bold text-sk-muted text-xs uppercase hidden md:table-cell">Descrição</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-sk-border/30">
								{transactions.length === 0 && (
									<tr><td colspan={6} class="px-4 py-8 text-center text-sk-muted">Nenhuma movimentação registrada</td></tr>
								)}
								{transactions.map((t) => (
									<tr class="hover:bg-sk-blue-light/10 transition-colors">
										<td class="px-4 py-3 text-xs text-sk-muted whitespace-nowrap">{toBrazilDateTime(t.created_at)}</td>
										<td class="px-4 py-3 font-display font-medium text-sk-text text-sm">{t.customer_name}</td>
										<td class="px-4 py-3">
											<span class={`px-2 py-0.5 rounded text-xs font-medium font-display ${typeColors[t.type] ?? "bg-sk-bg text-sk-muted"}`}>
												{typeLabels[t.type] ?? t.type}
											</span>
										</td>
										<td class="px-4 py-3 text-right">
											<span class={`font-display font-bold ${t.points >= 0 ? "text-sk-green" : "text-sk-danger"}`}>
												{t.points >= 0 ? "+" : ""}{t.points.toLocaleString("pt-BR")}
											</span>
										</td>
										<td class="px-4 py-3 text-right hidden md:table-cell text-sk-muted">{t.balance_after.toLocaleString("pt-BR")}</td>
										<td class="px-4 py-3 hidden md:table-cell text-xs text-sk-muted truncate max-w-xs">{t.description ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{/* Adjust modal */}
			<div id="adjust-modal" class="hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
				<div class="bg-sk-surface rounded-t-sk-xl sm:rounded-sk-xl w-full sm:max-w-md shadow-sk-xl">
					<div class="flex items-center justify-between p-5 border-b border-sk-border/30">
						<h2 class="font-display font-bold text-lg text-sk-text">Ajustar pontos</h2>
						<button onclick="hideAdjust()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<form onsubmit="submitAdjust(event)" class="p-5 space-y-4">
						<input type="hidden" id="adj-customer-id" />
						<p class="font-body text-sm text-sk-text">Cliente: <strong id="adj-customer-name"></strong></p>
						<div>
							<label class="block text-xs font-display font-medium text-sk-text mb-1">Pontos (positivo ou negativo)</label>
							<input id="adj-points" type="number" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="Ex: 50 ou -20" />
						</div>
						<div>
							<label class="block text-xs font-display font-medium text-sk-text mb-1">Motivo</label>
							<input id="adj-description" type="text" required class="w-full px-3 py-2 border border-sk-border rounded-sk font-body text-sm" placeholder="Ex: Bonificação, estorno, cortesia" />
						</div>
						<div class="flex justify-end gap-3">
							<button type="button" onclick="hideAdjust()" class="px-4 py-2.5 rounded-sk text-sm font-display font-medium text-sk-muted">Cancelar</button>
							<button type="submit" class="bg-sk-purple hover:bg-sk-purple-dark text-white px-6 py-2.5 rounded-sk text-sm font-display font-bold transition-colors">Ajustar</button>
						</div>
					</form>
				</div>
			</div>
		</AdminLayout>
	);
};
