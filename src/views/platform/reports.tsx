import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import { PlatformLayout } from "./layout";

interface ReportsProps {
	revenue: Array<{ period: string; revenue_cents: number; rental_count: number }>;
	tenantGrowth: Array<{ date: string; count: number }>;
	activeTenants: Array<{ id: number; name: string; slug: string; last_activity: string; login_count: number }>;
	inactiveTenants: Array<{ id: number; name: string; slug: string; last_activity: string | null; days_inactive: number }>;
	topTenants: Array<{ id: number; name: string; slug: string; plan: string; revenue_cents: number; rental_count: number }>;
	user: { name: string; email: string } | null;
}

function fmtBRL(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

const PLAN_COLORS: Record<string, string> = {
	starter: "bg-gray-100 text-gray-600",
	pro: "bg-blue-100 text-blue-700",
	enterprise: "bg-purple-100 text-purple-700",
};

export const PlatformReports: FC<ReportsProps> = ({ revenue, tenantGrowth, activeTenants, inactiveTenants, topTenants, user }) => {
	const chartScript = html`
		<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
		<script>
${raw(`
var revenueData = ${JSON.stringify(revenue)};

document.addEventListener('DOMContentLoaded', function() {
	var ctx = document.getElementById('revenueChart').getContext('2d');
	new Chart(ctx, {
		type: 'line',
		data: {
			labels: revenueData.map(function(r) { return r.period; }),
			datasets: [
				{
					label: 'Receita (R$)',
					data: revenueData.map(function(r) { return r.revenue_cents / 100; }),
					borderColor: '#2563eb',
					backgroundColor: 'rgba(37,99,235,0.08)',
					fill: true,
					tension: 0.3,
					pointRadius: 4,
					pointBackgroundColor: '#2563eb',
					yAxisID: 'y'
				},
				{
					label: 'Locacoes',
					data: revenueData.map(function(r) { return r.rental_count; }),
					borderColor: '#10b981',
					backgroundColor: 'rgba(16,185,129,0.08)',
					fill: false,
					tension: 0.3,
					pointRadius: 4,
					pointBackgroundColor: '#10b981',
					yAxisID: 'y1'
				}
			]
		},
		options: {
			responsive: true,
			interaction: { mode: 'index', intersect: false },
			scales: {
				y: { type: 'linear', position: 'left', ticks: { callback: function(v) { return 'R$ ' + v.toFixed(0); } } },
				y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
			},
			plugins: { legend: { position: 'top' } }
		}
	});
});

function showSection(name) {
	document.querySelectorAll('[data-section]').forEach(function(el) { el.classList.add('hidden'); });
	document.querySelectorAll('[data-section-btn]').forEach(function(el) {
		el.className = el.className.replace('border-blue-500 text-blue-600', 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300');
	});
	document.getElementById('section-' + name).classList.remove('hidden');
	document.getElementById('btn-' + name).className = document.getElementById('btn-' + name).className.replace('border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'border-blue-500 text-blue-600');
}
`)}
		</script>
	`;

	// Running total for tenant growth
	let runningTotal = 0;

	return (
		<PlatformLayout
			title="Relatorios"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Relatorios" }]}
			bodyScripts={chartScript}
		>
			{/* Tabs */}
			<div class="border-b mb-6">
				<nav class="flex gap-6">
					<button id="btn-revenue" data-section-btn onclick="showSection('revenue')" class="pb-3 text-sm font-medium border-b-2 border-blue-500 text-blue-600 transition-colors">
						Receita
					</button>
					<button id="btn-growth" data-section-btn onclick="showSection('growth')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Crescimento
					</button>
					<button id="btn-top" data-section-btn onclick="showSection('top')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Top Tenants
					</button>
					<button id="btn-active" data-section-btn onclick="showSection('active')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Ativos ({activeTenants.length})
					</button>
					<button id="btn-churn" data-section-btn onclick="showSection('churn')" class="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
						Risco de Churn ({inactiveTenants.length})
					</button>
				</nav>
			</div>

			{/* Section: Revenue */}
			<div id="section-revenue" data-section>
				<div class="bg-white rounded-xl shadow-sm border p-6 mb-6">
					<h2 class="font-semibold text-gray-900 mb-4">Receita por Periodo</h2>
					<div class="w-full" style="max-height:360px;">
						<canvas id="revenueChart"></canvas>
					</div>
				</div>

				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="px-6 py-4 border-b flex items-center justify-between">
						<h2 class="font-semibold text-gray-900">Detalhamento</h2>
						<span class="text-xs text-gray-400">{revenue.length} periodos</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Periodo</th>
									<th class="px-5 py-3 font-medium text-right">Receita</th>
									<th class="px-5 py-3 font-medium text-right">Locacoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{revenue.map((r) => (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3 font-medium">{r.period}</td>
										<td class="px-5 py-3 text-right font-medium text-green-700">{fmtBRL(r.revenue_cents)}</td>
										<td class="px-5 py-3 text-right">{r.rental_count}</td>
									</tr>
								))}
							</tbody>
						</table>
						{revenue.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum dado de receita</p>}
					</div>
				</div>
			</div>

			{/* Section: Tenant Growth */}
			<div id="section-growth" data-section class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="px-6 py-4 border-b flex items-center justify-between">
						<h2 class="font-semibold text-gray-900">Crescimento de Tenants</h2>
						<span class="text-xs text-gray-400">{tenantGrowth.length} registros</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Data</th>
									<th class="px-5 py-3 font-medium text-right">Novos</th>
									<th class="px-5 py-3 font-medium text-right">Total Acumulado</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{tenantGrowth.map((g) => {
									runningTotal += g.count;
									return (
										<tr class="hover:bg-blue-50/30 transition-colors">
											<td class="px-5 py-3 font-medium">{g.date}</td>
											<td class="px-5 py-3 text-right">{g.count}</td>
											<td class="px-5 py-3 text-right font-medium text-blue-700">{runningTotal}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{tenantGrowth.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum dado de crescimento</p>}
					</div>
				</div>
			</div>

			{/* Section: Top Tenants by Revenue */}
			<div id="section-top" data-section class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="px-6 py-4 border-b flex items-center justify-between">
						<h2 class="font-semibold text-gray-900">Top Tenants por Receita</h2>
						<span class="text-xs text-gray-400">{topTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">#</th>
									<th class="px-5 py-3 font-medium">Tenant</th>
									<th class="px-5 py-3 font-medium">Plano</th>
									<th class="px-5 py-3 font-medium text-right">Receita</th>
									<th class="px-5 py-3 font-medium text-right">Locacoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{topTenants.map((t, i) => {
									const planColor = PLAN_COLORS[t.plan] || PLAN_COLORS.starter;
									return (
										<tr class="hover:bg-blue-50/30 transition-colors">
											<td class="px-5 py-3 text-gray-400 font-medium">{i + 1}</td>
											<td class="px-5 py-3">
												<a href={`/platform/tenants/${t.id}`} class="font-medium text-gray-900 hover:text-blue-600 transition-colors">
													{t.name}
												</a>
												<p class="text-xs text-gray-400">{t.slug}</p>
											</td>
											<td class="px-5 py-3">
												<span class={`${planColor} px-2 py-0.5 rounded text-xs font-medium`}>
													{t.plan.charAt(0).toUpperCase() + t.plan.slice(1)}
												</span>
											</td>
											<td class="px-5 py-3 text-right font-medium text-green-700">{fmtBRL(t.revenue_cents)}</td>
											<td class="px-5 py-3 text-right">{t.rental_count}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{topTenants.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum dado</p>}
					</div>
				</div>
			</div>

			{/* Section: Active Tenants */}
			<div id="section-active" data-section class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="px-6 py-4 border-b flex items-center justify-between">
						<h2 class="font-semibold text-gray-900">Tenants Ativos</h2>
						<span class="text-xs text-gray-400">{activeTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Nome</th>
									<th class="px-5 py-3 font-medium">Slug</th>
									<th class="px-5 py-3 font-medium">Ultima Atividade</th>
									<th class="px-5 py-3 font-medium text-right">Logins</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{activeTenants.map((t) => (
									<tr class="hover:bg-blue-50/30 transition-colors">
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${t.id}`} class="font-medium text-gray-900 hover:text-blue-600 transition-colors">
												{t.name}
											</a>
										</td>
										<td class="px-5 py-3 text-gray-500">{t.slug}</td>
										<td class="px-5 py-3 text-gray-400 text-xs tabular-nums">{t.last_activity?.slice(0, 16).replace("T", " ")}</td>
										<td class="px-5 py-3 text-right font-medium">{t.login_count}</td>
									</tr>
								))}
							</tbody>
						</table>
						{activeTenants.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum tenant ativo</p>}
					</div>
				</div>
			</div>

			{/* Section: Churn Risk (Inactive) */}
			<div id="section-churn" data-section class="hidden">
				<div class="bg-white rounded-xl shadow-sm border overflow-hidden">
					<div class="px-6 py-4 border-b flex items-center justify-between">
						<h2 class="font-semibold text-gray-900">Risco de Churn (Inativos)</h2>
						<span class="text-xs text-gray-400">{inactiveTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="bg-gray-50 border-b text-left text-xs text-gray-500 uppercase tracking-wider">
									<th class="px-5 py-3 font-medium">Nome</th>
									<th class="px-5 py-3 font-medium">Slug</th>
									<th class="px-5 py-3 font-medium">Ultima Atividade</th>
									<th class="px-5 py-3 font-medium text-right">Dias Inativo</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{inactiveTenants.map((t) => {
									const isHighRisk = t.days_inactive > 60;
									return (
										<tr class={`${isHighRisk ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-blue-50/30"} transition-colors`}>
											<td class="px-5 py-3">
												<a href={`/platform/tenants/${t.id}`} class="font-medium text-gray-900 hover:text-blue-600 transition-colors">
													{t.name}
												</a>
											</td>
											<td class="px-5 py-3 text-gray-500">{t.slug}</td>
											<td class="px-5 py-3 text-gray-400 text-xs tabular-nums">
												{t.last_activity ? t.last_activity.slice(0, 16).replace("T", " ") : <span class="text-gray-300">Nunca</span>}
											</td>
											<td class="px-5 py-3 text-right">
												<span class={`font-medium ${isHighRisk ? "text-red-600" : "text-yellow-600"}`}>
													{t.days_inactive}d
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{inactiveTenants.length === 0 && <p class="text-center text-gray-400 py-8 text-sm">Nenhum tenant inativo</p>}
					</div>
				</div>
			</div>
		</PlatformLayout>
	);
};
