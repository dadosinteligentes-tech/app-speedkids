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
	active: "bg-green-500",
	suspended: "bg-red-500",
	cancelled: "bg-gray-400",
};

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-gray-100 text-gray-600",
	pro: "bg-blue-100 text-blue-700",
	enterprise: "bg-purple-100 text-purple-700",
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
		<button onclick="showCreateForm()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
			+ Novo Tenant
		</button>
	`;

	return (
		<PlatformLayout title="Visao Geral" user={user} actions={createButton} bodyScripts={script}>
			{/* KPIs — clickable cards */}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
				<a href="#tenants-table" class="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md hover:border-blue-200 transition-all cursor-pointer block">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Tenants</p>
					<p class="text-3xl font-bold text-gray-900">{stats.total_tenants}</p>
					<p class="text-xs text-gray-400 mt-1">
						<span class="text-green-600">{stats.active_tenants} ativos</span>
						{stats.suspended_tenants > 0 && <span> · <span class="text-red-600">{stats.suspended_tenants} suspensos</span></span>}
					</p>
				</a>
				<a href="/platform/users" class="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md hover:border-blue-200 transition-all cursor-pointer block">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Usuarios</p>
					<p class="text-3xl font-bold text-gray-900">{stats.total_users}</p>
					<p class="text-xs text-gray-400 mt-1">em todos os tenants</p>
				</a>
				<a href="/platform/reports" class="bg-white rounded-xl p-5 shadow-sm border hover:shadow-md hover:border-blue-200 transition-all cursor-pointer block">
					<p class="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Receita Total</p>
					<p class="text-2xl font-bold text-gray-900">{fmtBRL(stats.total_revenue_cents)}</p>
					<p class="text-xs text-gray-400 mt-1">{stats.total_rentals} locacoes</p>
				</a>
				<a href="/platform/subscriptions" class="bg-white rounded-xl p-5 shadow-sm border border-green-100 hover:shadow-md hover:border-green-300 transition-all cursor-pointer block">
					<p class="text-xs text-green-600 font-medium uppercase tracking-wider mb-1">MRR</p>
					<p class="text-2xl font-bold text-green-700">{fmtBRL(stats.mrr_cents)}</p>
					<p class="text-xs text-gray-400 mt-1">receita mensal recorrente</p>
				</a>
			</div>

			{/* Tenants Table */}
			<div id="tenants-table" class="bg-white rounded-xl shadow-sm border overflow-hidden">
				<div class="px-6 py-4 border-b flex items-center justify-between">
					<h2 class="font-semibold text-gray-900">Tenants</h2>
					<span class="text-xs text-gray-400">{tenants.length} registros</span>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
								<th class="px-5 py-3 font-medium w-8"></th>
								<th class="px-5 py-3 font-medium">Tenant</th>
								<th class="px-5 py-3 font-medium">Plano</th>
								<th class="px-5 py-3 font-medium text-center">Usuarios</th>
								<th class="px-5 py-3 font-medium text-center">Ativos</th>
								<th class="px-5 py-3 font-medium text-right">Faturamento</th>
								<th class="px-5 py-3 font-medium text-center">Atividade</th>
								<th class="px-5 py-3 font-medium text-right">Acoes</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{tenants.map((t) => {
								const statusColor = STATUS_COLORS[t.status] || "bg-gray-400";
								const planColor = PLAN_COLORS[t.subscription_plan || t.plan] || PLAN_COLORS.starter;
								const plan = t.subscription_plan || t.plan;
								return (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3">
											<span class={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} title={t.status}></span>
										</td>
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${t.id}`} class="font-medium text-gray-900 hover:text-blue-600 transition-colors">
												{t.name}
											</a>
											<p class="text-xs text-gray-400">{t.slug}.{domain}</p>
										</td>
										<td class="px-5 py-3">
											<span class={`${planColor} px-2 py-0.5 rounded text-xs font-medium`}>
												{plan.charAt(0).toUpperCase() + plan.slice(1)}
											</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-medium">{t.user_count}</span>
											<span class="text-gray-400">/{t.max_users}</span>
										</td>
										<td class="px-5 py-3 text-center">
											<span class="font-medium">{t.asset_count}</span>
											<span class="text-gray-400">/{t.max_assets}</span>
										</td>
										<td class="px-5 py-3 text-right font-medium">{fmtBRL(t.revenue_cents)}</td>
										<td class="px-5 py-3 text-center text-xs text-gray-500">
											{t.rental_count > 0 ? `${t.rental_count} loc.` : <span class="text-gray-300">—</span>}
										</td>
										<td class="px-5 py-3 text-right">
											<div class="flex items-center justify-end gap-2">
												<a href={`/platform/tenants/${t.id}`} class="text-blue-600 hover:text-blue-800 text-xs font-medium">Detalhes</a>
												{t.status === "active" ? (
													<button onclick={`toggleTenant(${t.id},'suspend')`} class="text-red-500 hover:text-red-700 text-xs">Suspender</button>
												) : (
													<button onclick={`toggleTenant(${t.id},'activate')`} class="text-green-600 hover:text-green-800 text-xs">Ativar</button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{tenants.length === 0 && (
						<div class="text-center py-12 text-gray-400">
							<p class="text-lg mb-2">Nenhum tenant cadastrado</p>
							<p class="text-sm">Crie o primeiro tenant clicando em "+ Novo Tenant"</p>
						</div>
					)}
				</div>
			</div>

			{/* Create Tenant Modal */}
			<div id="create-modal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
				<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-bold">Novo Tenant</h3>
						<button onclick="hideCreateForm()" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
					</div>
					<div id="create-error" class="hidden mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm"></div>
					<form onsubmit="createTenant(event)" class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Subdominio</label>
							<div class="flex items-center gap-1">
								<input id="new-slug" type="text" required class="flex-1 px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="meu-parque" />
								<span class="text-gray-400 text-xs flex-shrink-0">.{domain}</span>
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Nome do estabelecimento</label>
							<input id="new-name" type="text" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Nome do dono</label>
								<input id="new-owner" type="text" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
							</div>
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Plano</label>
								<select id="new-plan" class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
									<option value="starter">Starter</option>
									<option value="pro" selected>Pro</option>
									<option value="enterprise">Enterprise</option>
								</select>
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
							<input id="new-email" type="email" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
							<input id="new-password" type="text" required class="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Gere uma senha segura" />
						</div>
						<div class="flex gap-2 pt-2">
							<button type="submit" id="create-btn" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">Criar Tenant</button>
							<button type="button" onclick="hideCreateForm()" class="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors">Cancelar</button>
						</div>
					</form>
				</div>
			</div>
		</PlatformLayout>
	);
};
