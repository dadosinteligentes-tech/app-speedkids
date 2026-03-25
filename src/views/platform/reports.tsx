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
	starter: "bg-sk-bg text-sk-muted",
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
		el.className = el.className.replace('border-sk-blue text-sk-blue', 'border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border');
	});
	document.getElementById('section-' + name).classList.remove('hidden');
	document.getElementById('btn-' + name).className = document.getElementById('btn-' + name).className.replace('border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border', 'border-sk-blue text-sk-blue');
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
			<div class="border-b border-sk-border/30 mb-6">
				<nav class="flex gap-6">
					<button id="btn-revenue" data-section-btn onclick="showSection('revenue')" class="pb-3 text-sm font-medium font-display border-b-2 border-sk-blue text-sk-blue transition-colors">
						Receita
					</button>
					<button id="btn-growth" data-section-btn onclick="showSection('growth')" class="pb-3 text-sm font-medium font-display border-b-2 border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border transition-colors">
						Crescimento
					</button>
					<button id="btn-top" data-section-btn onclick="showSection('top')" class="pb-3 text-sm font-medium font-display border-b-2 border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border transition-colors">
						Top Tenants
					</button>
					<button id="btn-active" data-section-btn onclick="showSection('active')" class="pb-3 text-sm font-medium font-display border-b-2 border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border transition-colors">
						Ativos ({activeTenants.length})
					</button>
					<button id="btn-churn" data-section-btn onclick="showSection('churn')" class="pb-3 text-sm font-medium font-display border-b-2 border-transparent text-sk-muted hover:text-sk-text hover:border-sk-border transition-colors">
						Risco de Churn ({inactiveTenants.length})
					</button>
				</nav>
			</div>

			{/* Section: Revenue */}
			<div id="section-revenue" data-section>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 p-6 mb-6">
					<h2 class="font-semibold font-display text-sk-text mb-4">Receita por Periodo</h2>
					<div class="w-full" style="max-height:360px;">
						<canvas id="revenueChart"></canvas>
					</div>
				</div>

				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
					<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
						<h2 class="font-semibold font-display text-sk-text">Detalhamento</h2>
						<span class="text-xs font-body text-sk-muted">{revenue.length} periodos</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
									<th class="px-5 py-3 font-medium font-display">Periodo</th>
									<th class="px-5 py-3 font-medium font-display text-right">Receita</th>
									<th class="px-5 py-3 font-medium font-display text-right">Locacoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{revenue.map((r) => (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3 font-medium">{r.period}</td>
										<td class="px-5 py-3 text-right font-medium text-green-700">{fmtBRL(r.revenue_cents)}</td>
										<td class="px-5 py-3 text-right">{r.rental_count}</td>
									</tr>
								))}
							</tbody>
						</table>
						{revenue.length === 0 && <p class="text-center text-sk-muted py-8 text-sm font-body">Nenhum dado de receita</p>}
					</div>
				</div>
			</div>

			{/* Section: Tenant Growth */}
			<div id="section-growth" data-section class="hidden">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
					<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
						<h2 class="font-semibold font-display text-sk-text">Crescimento de Tenants</h2>
						<span class="text-xs font-body text-sk-muted">{tenantGrowth.length} registros</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
									<th class="px-5 py-3 font-medium font-display">Data</th>
									<th class="px-5 py-3 font-medium font-display text-right">Novos</th>
									<th class="px-5 py-3 font-medium font-display text-right">Total Acumulado</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{tenantGrowth.map((g) => {
									runningTotal += g.count;
									return (
										<tr class="hover:bg-sk-blue-light/30 transition-colors">
											<td class="px-5 py-3 font-medium">{g.date}</td>
											<td class="px-5 py-3 text-right">{g.count}</td>
											<td class="px-5 py-3 text-right font-medium text-blue-700">{runningTotal}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{tenantGrowth.length === 0 && <p class="text-center text-sk-muted py-8 text-sm font-body">Nenhum dado de crescimento</p>}
					</div>
				</div>
			</div>

			{/* Section: Top Tenants by Revenue */}
			<div id="section-top" data-section class="hidden">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
					<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
						<h2 class="font-semibold font-display text-sk-text">Top Tenants por Receita</h2>
						<span class="text-xs font-body text-sk-muted">{topTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
									<th class="px-5 py-3 font-medium font-display">#</th>
									<th class="px-5 py-3 font-medium font-display">Tenant</th>
									<th class="px-5 py-3 font-medium font-display">Plano</th>
									<th class="px-5 py-3 font-medium font-display text-right">Receita</th>
									<th class="px-5 py-3 font-medium font-display text-right">Locacoes</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{topTenants.map((t, i) => {
									const planColor = PLAN_COLORS[t.plan] || PLAN_COLORS.starter;
									return (
										<tr class="hover:bg-sk-blue-light/30 transition-colors">
											<td class="px-5 py-3 text-sk-muted font-medium">{i + 1}</td>
											<td class="px-5 py-3">
												<a href={`/platform/tenants/${t.id}`} class="font-medium text-sk-text hover:text-sk-blue transition-colors">
													{t.name}
												</a>
												<p class="text-xs text-sk-muted">{t.slug}</p>
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
						{topTenants.length === 0 && <p class="text-center text-sk-muted py-8 text-sm font-body">Nenhum dado</p>}
					</div>
				</div>
			</div>

			{/* Section: Active Tenants */}
			<div id="section-active" data-section class="hidden">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
					<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
						<h2 class="font-semibold font-display text-sk-text">Tenants Ativos</h2>
						<span class="text-xs font-body text-sk-muted">{activeTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
									<th class="px-5 py-3 font-medium font-display">Nome</th>
									<th class="px-5 py-3 font-medium font-display">Slug</th>
									<th class="px-5 py-3 font-medium font-display">Ultima Atividade</th>
									<th class="px-5 py-3 font-medium font-display text-right">Logins</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{activeTenants.map((t) => (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3">
											<a href={`/platform/tenants/${t.id}`} class="font-medium text-sk-text hover:text-sk-blue transition-colors">
												{t.name}
											</a>
										</td>
										<td class="px-5 py-3 text-sk-muted">{t.slug}</td>
										<td class="px-5 py-3 text-sk-muted text-xs tabular-nums">{t.last_activity?.slice(0, 16).replace("T", " ")}</td>
										<td class="px-5 py-3 text-right font-medium">{t.login_count}</td>
									</tr>
								))}
							</tbody>
						</table>
						{activeTenants.length === 0 && <p class="text-center text-sk-muted py-8 text-sm font-body">Nenhum tenant ativo</p>}
					</div>
				</div>
			</div>

			{/* Section: Churn Risk (Inactive) */}
			<div id="section-churn" data-section class="hidden">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
					<div class="px-6 py-4 border-b border-sk-border/30 flex items-center justify-between">
						<h2 class="font-semibold font-display text-sk-text">Risco de Churn (Inativos)</h2>
						<span class="text-xs font-body text-sk-muted">{inactiveTenants.length} tenants</span>
					</div>
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead>
								<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
									<th class="px-5 py-3 font-medium font-display">Nome</th>
									<th class="px-5 py-3 font-medium font-display">Slug</th>
									<th class="px-5 py-3 font-medium font-display">Ultima Atividade</th>
									<th class="px-5 py-3 font-medium font-display text-right">Dias Inativo</th>
								</tr>
							</thead>
							<tbody class="divide-y">
								{inactiveTenants.map((t) => {
									const isHighRisk = t.days_inactive > 60;
									return (
										<tr class={`${isHighRisk ? "bg-sk-danger-light/50 hover:bg-sk-danger-light" : "hover:bg-sk-blue-light/30"} transition-colors`}>
											<td class="px-5 py-3">
												<a href={`/platform/tenants/${t.id}`} class="font-medium text-sk-text hover:text-sk-blue transition-colors">
													{t.name}
												</a>
											</td>
											<td class="px-5 py-3 text-sk-muted">{t.slug}</td>
											<td class="px-5 py-3 text-sk-muted text-xs tabular-nums">
												{t.last_activity ? t.last_activity.slice(0, 16).replace("T", " ") : <span class="text-sk-border">Nunca</span>}
											</td>
											<td class="px-5 py-3 text-right">
												<span class={`font-medium ${isHighRisk ? "text-sk-danger" : "text-yellow-600"}`}>
													{t.days_inactive}d
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{inactiveTenants.length === 0 && <p class="text-center text-sk-muted py-8 text-sm font-body">Nenhum tenant inativo</p>}
					</div>
				</div>
			</div>
		</PlatformLayout>
	);
};
