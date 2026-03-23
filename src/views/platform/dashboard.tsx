import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { PlatformStats, TenantWithStats } from "../../db/queries/platform";

interface PlatformDashboardProps {
	stats: PlatformStats;
	tenants: TenantWithStats[];
	user: { name: string; email: string } | null;
	domain: string;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	active: { bg: "bg-green-100", text: "text-green-700", label: "Ativo" },
	suspended: { bg: "bg-red-100", text: "text-red-700", label: "Suspenso" },
	cancelled: { bg: "bg-gray-100", text: "text-gray-600", label: "Cancelado" },
};

const PLAN_LABELS: Record<string, string> = {
	starter: "Starter",
	pro: "Pro",
	enterprise: "Enterprise",
};

export const PlatformDashboard: FC<PlatformDashboardProps> = ({ stats, tenants, user, domain }) => {
	const script = html`<script>
${raw(`
function toggleTenant(id, action) {
	if (!confirm(action === 'suspend' ? 'Suspender este tenant?' : 'Reativar este tenant?')) return;
	fetch('/api/platform/tenants/' + id + '/' + action, { method: 'POST' })
		.then(function(r) { if (r.ok) location.reload(); else alert('Erro'); });
}

function showCreateForm() {
	document.getElementById('create-modal').classList.remove('hidden');
}
function hideCreateForm() {
	document.getElementById('create-modal').classList.add('hidden');
}

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
		if (res.ok) {
			location.reload();
		} else {
			errEl.textContent = res.data.error || 'Erro';
			errEl.classList.remove('hidden');
			btn.disabled = false;
		}
	});
}
`)}
</script>`;

	return (
		<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Platform Admin — Dados Inteligentes</title>
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
				<script src="https://cdn.tailwindcss.com"></script>
				<style>{`body { font-family: 'Inter', sans-serif; }`}</style>
			</head>
			<body class="bg-gray-50 min-h-screen">
				{/* Navbar */}
				<nav class="bg-gray-900 text-white">
					<div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<span class="font-bold text-lg">Dados Inteligentes</span>
							<span class="text-xs bg-blue-600 px-2 py-0.5 rounded-full font-medium">Platform Admin</span>
						</div>
						<div class="flex items-center gap-4 text-sm">
							<span class="text-gray-400">{user?.email}</span>
							<a href="/" class="text-gray-300 hover:text-white">Voltar ao app</a>
							<button onclick="fetch('/api/auth/logout',{method:'POST'}).then(function(){location.href='/login'})" class="text-gray-300 hover:text-white">Sair</button>
						</div>
					</div>
				</nav>

				<main class="max-w-7xl mx-auto px-6 py-8">
					<div class="flex items-center justify-between mb-6">
						<h1 class="text-2xl font-bold text-gray-900">Visao Geral da Plataforma</h1>
						<button onclick="showCreateForm()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
							+ Novo Tenant
						</button>
					</div>

					{/* KPIs */}
					<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Tenants</p>
							<p class="text-2xl font-bold">{stats.total_tenants}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Ativos</p>
							<p class="text-2xl font-bold text-green-600">{stats.active_tenants}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Suspensos</p>
							<p class="text-2xl font-bold text-red-600">{stats.suspended_tenants}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Usuarios</p>
							<p class="text-2xl font-bold">{stats.total_users}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Locacoes</p>
							<p class="text-2xl font-bold">{stats.total_rentals}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">Faturamento total</p>
							<p class="text-xl font-bold text-blue-600">{fmtBRL(stats.total_revenue_cents)}</p>
						</div>
						<div class="bg-white rounded-xl p-4 shadow-sm border">
							<p class="text-xs text-gray-500 mb-1">MRR</p>
							<p class="text-xl font-bold text-green-600">{fmtBRL(stats.mrr_cents)}</p>
						</div>
					</div>

					{/* Tenants Table */}
					<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
						<div class="px-6 py-4 border-b bg-gray-50">
							<h2 class="font-semibold text-gray-900">Tenants ({tenants.length})</h2>
						</div>
						<div class="overflow-x-auto">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b text-left text-gray-500">
										<th class="px-6 py-3 font-medium">ID</th>
										<th class="px-6 py-3 font-medium">Nome</th>
										<th class="px-6 py-3 font-medium">Subdominio</th>
										<th class="px-6 py-3 font-medium">Plano</th>
										<th class="px-6 py-3 font-medium">Status</th>
										<th class="px-6 py-3 font-medium text-right">Usuarios</th>
										<th class="px-6 py-3 font-medium text-right">Ativos</th>
										<th class="px-6 py-3 font-medium text-right">Locacoes</th>
										<th class="px-6 py-3 font-medium text-right">Faturamento</th>
										<th class="px-6 py-3 font-medium">Criado em</th>
										<th class="px-6 py-3 font-medium">Acoes</th>
									</tr>
								</thead>
								<tbody class="divide-y">
									{tenants.map((t) => {
										const badge = STATUS_BADGE[t.status] || STATUS_BADGE.active;
										return (
											<tr class="hover:bg-gray-50">
												<td class="px-6 py-3 text-gray-500">{t.id}</td>
												<td class="px-6 py-3 font-medium">{t.name}</td>
												<td class="px-6 py-3">
													<a href={`https://${t.slug}.${domain}`} target="_blank" class="text-blue-600 hover:underline">
														{t.slug}.{domain}
													</a>
												</td>
												<td class="px-6 py-3">
													<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
														{PLAN_LABELS[t.subscription_plan || t.plan] || t.plan}
													</span>
												</td>
												<td class="px-6 py-3">
													<span class={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium`}>
														{badge.label}
													</span>
												</td>
												<td class="px-6 py-3 text-right">{t.user_count}/{t.max_users}</td>
												<td class="px-6 py-3 text-right">{t.asset_count}/{t.max_assets}</td>
												<td class="px-6 py-3 text-right">{t.rental_count}</td>
												<td class="px-6 py-3 text-right font-medium">{fmtBRL(t.revenue_cents)}</td>
												<td class="px-6 py-3 text-gray-500">{t.created_at?.slice(0, 10)}</td>
												<td class="px-6 py-3">
													{t.status === "active" ? (
														<button onclick={`toggleTenant(${t.id},'suspend')`} class="text-red-600 hover:underline text-xs">
															Suspender
														</button>
													) : (
														<button onclick={`toggleTenant(${t.id},'activate')`} class="text-green-600 hover:underline text-xs">
															Ativar
														</button>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				</main>

				{/* Create Tenant Modal */}
				<div id="create-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
						<h3 class="text-lg font-bold mb-4">Novo Tenant</h3>
						<div id="create-error" class="hidden mb-3 p-2 bg-red-50 text-red-700 rounded text-sm"></div>
						<form onsubmit="createTenant(event)" class="space-y-3">
							<div>
								<label class="block text-sm font-medium mb-1">Subdominio</label>
								<div class="flex items-center gap-1">
									<input id="new-slug" type="text" required class="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="meu-parque" />
									<span class="text-gray-400 text-xs">.{domain}</span>
								</div>
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Nome do estabelecimento</label>
								<input id="new-name" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Nome do dono</label>
								<input id="new-owner" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Email</label>
								<input id="new-email" type="email" required class="w-full px-3 py-2 border rounded-lg text-sm" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Senha inicial</label>
								<input id="new-password" type="text" required class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Gere uma senha segura" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Plano</label>
								<select id="new-plan" class="w-full px-3 py-2 border rounded-lg text-sm">
									<option value="starter">Starter (R$ 97/mes)</option>
									<option value="pro" selected>Pro (R$ 197/mes)</option>
									<option value="enterprise">Enterprise (R$ 397/mes)</option>
								</select>
							</div>
							<div class="flex gap-2 pt-2">
								<button type="submit" id="create-btn" class="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm">Criar Tenant</button>
								<button type="button" onclick="hideCreateForm()" class="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm">Cancelar</button>
							</div>
						</form>
					</div>
				</div>

				{script}
			</body>
		</html>
	);
};
