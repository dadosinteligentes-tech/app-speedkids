import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { PlatformStats, TenantWithStats } from "../../db/queries/platform";
import { PlatformLayout } from "./layout";

interface PlatformDashboardProps {
	stats: PlatformStats;
	tenants: TenantWithStats[];
	user: { name: string; email: string } | null;
	domain: string;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function daysAgo(dateStr: string | null): string {
	if (!dateStr) return "—";
	const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
	if (diff === 0) return "Hoje";
	if (diff === 1) return "Ontem";
	return `${diff}d`;
}

const STATUS_COLORS: Record<string, string> = {
	active: "bg-sk-green",
	suspended: "bg-sk-danger",
	cancelled: "bg-gray-400",
};

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-sk-yellow-light text-sk-yellow-dark",
	pro: "bg-sk-blue-light text-sk-blue-dark",
	enterprise: "bg-sk-purple-light text-sk-purple",
};

export const PlatformDashboard: FC<PlatformDashboardProps> = ({ stats, tenants, user, domain }) => {
	const script = html`<script>
${raw(`
function toggleTenant(id, action) {
	if (!confirm(action === 'suspend' ? 'Suspender este tenant?' : 'Reativar este tenant?')) return;
	fetch('/api/platform/tenants/' + id + '/' + action, { method: 'POST' })
		.then(function(r) { if (r.ok) { showToast(action === 'suspend' ? 'Tenant suspenso' : 'Tenant ativado'); setTimeout(function(){location.reload()},800); } else alert('Erro'); });
}

function showCreateForm() { document.getElementById('create-modal').classList.remove('hidden'); }
function hideCreateForm() { document.getElementById('create-modal').classList.add('hidden'); }

function createTenant(e) {
	e.preventDefault();
	var btn = document.getElementById('create-btn');
	var errEl = document.getElementById('create-error');
	btn.disabled = true;
	errEl.classList.add('hidden');

	var data = {
		slug: document.getElementById('new-slug').value.toLowerCase().trim(),
		businessName: document.getElementById('new-name').value.trim(),
		ownerName: document.getElementById('new-owner').value.trim(),
		ownerEmail: document.getElementById('new-email').value.trim(),
		ownerPassword: document.getElementById('new-password').value,
		plan: document.getElementById('new-plan').value
	};

	fetch('/api/platform/tenants', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) { showToast('Tenant criado com sucesso'); setTimeout(function(){location.reload()},800); }
		else { errEl.textContent = res.data.error || 'Erro'; errEl.classList.remove('hidden'); btn.disabled = false; }
	});
}
`)}
</script>`;

	const createButton = html`
		<button onclick="showCreateForm()" class="btn-bounce bg-sk-blue hover:bg-sk-blue-dark text-white px-4 py-2 rounded-sk text-sm font-display font-bold transition-colors shadow-sk-sm">
			+ Novo Tenant
		</button>
	`;

	return (
		<PlatformLayout title="Visão Geral" user={user} actions={createButton} bodyScripts={script}>
			{/* KPIs */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
				<a href="#tenants-table" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md hover:border-sk-blue-light transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Tenants</p>
					<p class="text-3xl font-display font-bold text-sk-text">{stats.total_tenants}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">
						<span class="text-sk-green">{stats.active_tenants} ativos</span>
						{stats.suspended_tenants > 0 && <span> · <span class="text-sk-danger">{stats.suspended_tenants} suspensos</span></span>}
					</p>
				</a>
				<a href="/platform/users" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md hover:border-sk-blue-light transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Usuários</p>
					<p class="text-3xl font-display font-bold text-sk-text">{stats.total_users}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">em todos os tenants</p>
				</a>
				<a href="/platform/reports" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md hover:border-sk-blue-light transition-all cursor-pointer block">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Receita Total</p>
					<p class="text-2xl font-display font-bold text-sk-text">{fmtBRL(stats.total_revenue_cents)}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">{stats.total_rentals} locações</p>
				</a>
				<a href="/platform/subscriptions" class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-green-light hover:shadow-sk-md hover:border-sk-green transition-all cursor-pointer block">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">MRR</p>
					<p class="text-2xl font-display font-bold text-sk-green-dark">{fmtBRL(stats.mrr_cents)}</p>
					<p class="text-xs text-sk-muted mt-1 font-body">receita mensal recorrente</p>
				</a>
			</div>

			{/* Tenants Table */}
			<div id="tenants-table" class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
					<h2 class="font-display font-bold text-sk-text">Tenants</h2>
					<span class="text-xs text-sk-muted font-body">{tenants.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-display font-medium w-8"></th>
								<th class="px-5 py-3 font-display font-medium">Tenant</th>
								<th class="px-5 py-3 font-display font-medium">Plano</th>
								<th class="px-5 py-3 font-display font-medium text-center">Usuários</th>
								<th class="px-5 py-3 font-display font-medium text-center">Ativos</th>
								<th class="px-5 py-3 font-display font-medium text-right">Faturamento</th>
								<th class="px-5 py-3 font-display font-medium text-center">Atividade</th>
								<th class="px-5 py-3 font-display font-medium text-right">Ações</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-sk-border/30">
							{tenants.map((t) => {
								const statusColor = STATUS_COLORS[t.status] || "bg-gray-400";
								const planColor = PLAN_COLORS[t.subscription_plan || t.plan] || PLAN_COLORS.starter;
								const plan = t.subscription_plan || t.plan;
								return (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3">
											<span class={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} title={t.status}></span>
										</td>
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${t.id}`} class="font-display font-medium text-sk-text hover:text-sk-blue transition-colors">
												{t.name}
											</a>
											<p class="text-xs text-sk-muted">{t.slug}.{domain}</p>
										</td>
										<td class="px-5 py-3">
											<span class={`${planColor} px-2.5 py-0.5 rounded-sk text-xs font-display font-medium`}>
												{plan.charAt(0).toUpperCase() + plan.slice(1)}
											</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-display font-medium">{t.user_count}</span>
											<span class="text-sk-muted">/{t.max_users}</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-display font-medium">{t.asset_count}</span>
											<span class="text-sk-muted">/{t.max_assets}</span>
										</td>
										<td class="px-5 py-3 text-right font-display font-medium">{fmtBRL(t.revenue_cents)}</td>
										<td class="px-5 py-3 text-center text-xs text-sk-muted">
											{t.rental_count > 0 ? `${t.rental_count} loc.` : <span class="text-sk-border">—</span>}
										</td>
										<td class="px-5 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<a href={`/platform/tenants/${t.id}`} class="text-sk-blue hover:text-sk-blue-dark text-xs font-display font-medium">Detalhes</a>
												{t.status === "active" ? (
													<button onclick={`toggleTenant(${t.id},'suspend')`} class="text-sk-danger hover:text-sk-danger/80 text-xs font-display">Suspender</button>
												) : (
													<button onclick={`toggleTenant(${t.id},'activate')`} class="text-sk-green hover:text-sk-green-dark text-xs font-display">Ativar</button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{tenants.length === 0 && (
						<div class="text-center py-12 text-sk-muted">
							<p class="text-lg mb-2 font-display">Nenhum tenant cadastrado</p>
							<p class="text-sm font-body">Crie o primeiro tenant clicando em "+ Novo Tenant"</p>
						</div>
					)}
				</div>
			</div>

			{/* Create Tenant Modal */}
			<div id="create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-sk-surface rounded-sk-lg shadow-sk-xl w-full max-w-md p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-display font-bold text-sk-text">Novo Tenant</h3>
						<button onclick="hideCreateForm()" class="text-sk-muted hover:text-sk-text text-xl">&times;</button>
					</div>
					<div id="create-error" class="hidden mb-3 p-3 bg-sk-danger-light text-sk-danger rounded-sk text-sm font-body"></div>
					<form onsubmit="createTenant(event)" class="space-y-3">
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Subdomínio</label>
							<div class="flex items-center gap-1">
								<input id="new-slug" type="text" required class="flex-1 px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" placeholder="meu-parque" />
								<span class="text-sk-muted text-xs flex-shrink-0 font-body">.{domain}</span>
							</div>
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome do estabelecimento</label>
							<input id="new-name" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome do dono</label>
								<input id="new-owner" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
							</div>
							<div>
								<label class="block text-sm font-display font-medium text-sk-text mb-1">Plano</label>
								<select id="new-plan" class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors">
									<option value="starter">Starter</option>
									<option value="pro" selected>Pro</option>
									<option value="enterprise">Enterprise</option>
								</select>
							</div>
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Email</label>
							<input id="new-email" type="email" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" />
						</div>
						<div>
							<label class="block text-sm font-display font-medium text-sk-text mb-1">Senha inicial</label>
							<input id="new-password" type="text" required class="w-full px-3 py-2.5 border-2 border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue outline-none transition-colors" placeholder="Gere uma senha segura" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" id="create-btn" class="btn-bounce flex-1 py-2.5 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-sm transition-colors">Criar Tenant</button>
							<button type="button" onclick="hideCreateForm()" class="flex-1 py-2.5 bg-sk-bg hover:bg-sk-border/30 text-sk-text rounded-sk font-display font-medium text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
