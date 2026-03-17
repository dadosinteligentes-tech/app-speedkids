import type { FC, PropsWithChildren } from "hono/jsx";
import { AdminLayout } from "../admin/layout";
import { todayISO, daysAgoISO } from "../../lib/report-utils";

interface ReportLayoutProps {
	title: string;
	user: { name: string; role: string } | null;
	activeReport: string;
	from: string;
	to: string;
}

const REPORT_NAV = [
	{ href: "/admin/reports/financial", label: "Resumo", roles: ["manager", "owner"] },
	{ href: "/admin/reports/packages", label: "Pacotes", roles: ["manager", "owner"] },
	{ href: "/admin/reports/assets", label: "Ativos", roles: ["manager", "owner"] },
	{ href: "/admin/reports/peak-hours", label: "Horarios", roles: ["manager", "owner"] },
	{ href: "/admin/reports/operators", label: "Operadores", roles: ["owner"] },
	{ href: "/admin/reports/cash", label: "Caixa", roles: ["manager", "owner"] },
	{ href: "/admin/reports/customers", label: "Clientes", roles: ["manager", "owner"] },
	{ href: "/admin/reports/unpaid", label: "Não Pagos", roles: ["manager", "owner"] },
	{ href: "/admin/reports/shifts", label: "Turnos", roles: ["manager", "owner"] },
	{ href: "/admin/reports/cancelled", label: "Cancelados", roles: ["manager", "owner"] },
	{ href: "/admin/reports/detail", label: "Detalhamento", roles: ["manager", "owner"] },
];

export const ReportLayout: FC<PropsWithChildren<ReportLayoutProps>> = ({
	title,
	user,
	activeReport,
	from,
	to,
	children,
}) => (
	<AdminLayout title={`Relatorio — ${title}`} user={user} activeTab="/admin/reports">
		{/* Report sub-navigation */}
		<div class="flex flex-wrap gap-1 mb-4 bg-sk-surface rounded-sk p-2 shadow-sk-sm">
			{REPORT_NAV.filter((r) => user && r.roles.includes(user.role)).map((r) => (
				<a
					href={`${r.href}?from=${from}&to=${to}`}
					class={`px-3 py-1.5 rounded-lg text-xs font-medium font-body transition-colors ${
						activeReport === r.href
							? "bg-sk-orange text-white"
							: "text-sk-muted hover:bg-sk-yellow-light"
					}`}
				>
					{r.label}
				</a>
			))}
		</div>

		{/* Date range filter */}
		<form
			method="get"
			class="flex flex-wrap items-end gap-3 mb-6 p-3 bg-sk-surface rounded-sk shadow-sk-sm"
		>
			<div>
				<label class="block text-xs font-medium text-sk-muted font-body mb-1">
					De
				</label>
				<input
					type="date"
					name="from"
					value={from}
					class="px-3 py-1.5 border border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue"
				/>
			</div>
			<div>
				<label class="block text-xs font-medium text-sk-muted font-body mb-1">
					Ate
				</label>
				<input
					type="date"
					name="to"
					value={to}
					class="px-3 py-1.5 border border-sk-border rounded-sk text-sm font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue"
				/>
			</div>
			<button
				type="submit"
				class="px-4 py-1.5 bg-sk-orange text-white rounded-sk font-body text-sm btn-bounce active:bg-sk-orange-dark"
			>
				Filtrar
			</button>
			<a
				href={`${activeReport}?from=${todayISO()}&to=${todayISO()}`}
				class="px-3 py-1.5 bg-sk-yellow-light text-sk-muted rounded-sk font-body text-xs hover:bg-sk-yellow"
			>
				Hoje
			</a>
			<a
				href={`${activeReport}?from=${daysAgoISO(7)}&to=${todayISO()}`}
				class="px-3 py-1.5 bg-sk-yellow-light text-sk-muted rounded-sk font-body text-xs hover:bg-sk-yellow"
			>
				7 dias
			</a>
			<a
				href={`${activeReport}?from=${daysAgoISO(30)}&to=${todayISO()}`}
				class="px-3 py-1.5 bg-sk-yellow-light text-sk-muted rounded-sk font-body text-xs hover:bg-sk-yellow"
			>
				30 dias
			</a>
			<a
				href={`/api/reports/${activeReport.split("/").pop()}/export?from=${from}&to=${to}`}
				class="px-3 py-1.5 bg-sk-green text-white rounded-sk font-body text-xs btn-bounce active:bg-sk-green-dark"
			>
				Exportar Excel
			</a>
		</form>

		{children}
	</AdminLayout>
);
