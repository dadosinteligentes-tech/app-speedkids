import type { FC } from "hono/jsx";
import type { DetailSession, DetailContext } from "../../db/queries/reports";
import { ReportLayout } from "./layout";
import { toBrazilDateTime, toBrazilDate } from "../../lib/timezone";
import type { Tenant } from "../../db/schema";

interface ReportDetailProps {
	sessions: DetailSession[];
	total: number;
	totalRevenueCents: number;
	context: DetailContext;
	page: number;
	from: string;
	to: string;
	filter: string;
	filterParams: string;
	backUrl: string;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

function formatCurrency(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function formatDateTime(iso: string): string {
	return toBrazilDateTime(iso);
}

const PAYMENT_LABELS: Record<string, string> = {
	cash: "Dinheiro",
	credit: "Crédito",
	debit: "Débito",
	pix: "PIX",
	mixed: "Misto",
	courtesy: "Cortesia",
};

const PER_PAGE = 50;

export const ReportDetailView: FC<ReportDetailProps> = ({
	sessions, total, totalRevenueCents, context, page, from, to, filter, filterParams, backUrl, user, tenant, isPlatformAdmin, planFeatures,
}) => {
	const totalPages = Math.ceil(total / PER_PAGE);

	const baseQs = `filter=${filter}${filterParams}&from=${from}&to=${to}`;

	return (
		<ReportLayout title={context.label} user={user} activeReport={backUrl} from={from} to={to} tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
			{filter !== "all" && (
				<div class="mb-4">
					<a href={`${backUrl}?from=${from}&to=${to}`} class="text-sk-orange font-body text-sm hover:underline">
						&larr; Voltar ao relatório
					</a>
				</div>
			)}

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-4">
				<h2 class="text-lg font-display font-bold text-sk-text">{context.label}</h2>
				<p class="text-sm text-sk-muted font-body">
					{toBrazilDate(from + "T12:00:00")} — {toBrazilDate(to + "T12:00:00")}
					{" "}&middot; {total} locações
				</p>
			</div>

			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Total Locações</p>
					<p class="text-xl font-display font-bold text-sk-text">{total}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Receita</p>
					<p class="text-xl font-display font-bold text-sk-orange">{formatCurrency(totalRevenueCents)}</p>
				</div>
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
					<p class="text-xs text-sk-muted font-body mb-1">Ticket Médio</p>
					<p class="text-xl font-display font-bold text-sk-blue-dark">
						{formatCurrency(total > 0 ? Math.round(totalRevenueCents / total) : 0)}
					</p>
				</div>
			</div>

			{sessions.length === 0 ? (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-8 text-center">
					<p class="text-sk-muted font-body">Nenhuma locação encontrada.</p>
				</div>
			) : (
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
					<div class="overflow-x-auto">
						<table class="w-full text-sm font-body">
							<thead class="bg-sk-yellow-light/50 text-sk-muted text-left">
								<tr>
									<th class="px-3 py-3 font-medium">Data</th>
									<th class="px-3 py-3 font-medium hidden sm:table-cell">Criança</th>
									<th class="px-3 py-3 font-medium hidden md:table-cell">Responsável</th>
									<th class="px-3 py-3 font-medium hidden sm:table-cell">Ativo</th>
									<th class="px-3 py-3 font-medium hidden md:table-cell">Pacote</th>
									<th class="px-3 py-3 font-medium text-right">Valor</th>
									<th class="px-3 py-3 font-medium hidden md:table-cell">Pagamento</th>
									<th class="px-3 py-3 font-medium hidden lg:table-cell">Operador</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{sessions.map((s) => (
									<tr class="hover:bg-sk-yellow-light">
										<td class="px-3 py-2 whitespace-nowrap text-xs text-sk-muted">
											{formatDateTime(s.start_time)}
										</td>
										<td class="px-3 py-2 hidden sm:table-cell">{s.child_name ?? "—"}</td>
										<td class="px-3 py-2 hidden md:table-cell">
											{s.customer_id ? (
												<a href={`/customers/${s.customer_id}`} class="text-sk-blue-dark hover:underline">
													{s.customer_name}
												</a>
											) : (s.customer_name ?? "—")}
										</td>
										<td class="px-3 py-2 hidden sm:table-cell text-sk-muted">{s.asset_name}</td>
										<td class="px-3 py-2 hidden md:table-cell text-sk-muted">{s.package_name}</td>
										<td class="px-3 py-2 text-right font-medium">
											{formatCurrency(s.amount_cents)}
											{s.overtime_cents > 0 && (
												<span class="text-xs text-sk-orange ml-1" title="Valor já incluso no total">
													(incl. {formatCurrency(s.overtime_cents)} extra)
												</span>
											)}
										</td>
										<td class="px-3 py-2 hidden md:table-cell text-sk-muted text-xs">
											{s.paid ? (PAYMENT_LABELS[s.payment_method ?? ""] ?? s.payment_method ?? "—") : "Pendente"}
										</td>
										<td class="px-3 py-2 hidden lg:table-cell text-sk-muted">{s.attendant_name ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{totalPages > 1 && (
				<div class="flex items-center justify-between mt-4 text-sm font-body">
					<span class="text-sk-muted">Página {page} de {totalPages}</span>
					<div class="flex gap-2">
						{page > 1 && (
							<a href={`/admin/reports/detail?${baseQs}&page=${page - 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk hover:bg-sk-yellow-light">&larr; Anterior</a>
						)}
						{page < totalPages && (
							<a href={`/admin/reports/detail?${baseQs}&page=${page + 1}`}
								class="px-3 py-1 bg-sk-surface border border-sk-border rounded-sk hover:bg-sk-yellow-light">Próxima &rarr;</a>
						)}
					</div>
				</div>
			)}
		</ReportLayout>
	);
};
