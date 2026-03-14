import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { CashRegisterView, CashTransactionView, RegisterSummary } from "../../db/queries/cash-registers";
import type { CashRegisterDenomination } from "../../db/schema";
import type { CashStatusBadge } from "../../lib/cash-status";
import type { DenominationMap } from "../../lib/denominations";
import { DENOMINATIONS } from "../../lib/denominations";
import { Layout } from "../layout";

interface ClosedSummaryProps {
	register: CashRegisterView;
	transactions: CashTransactionView[];
	summary: RegisterSummary;
	denomEvents: CashRegisterDenomination[];
	denomInventory: DenominationMap;
	user: { name: string; role: string } | null;
	cashStatus?: CashStatusBadge | null;
}

const TX_TYPE_LABELS: Record<string, string> = {
	rental_payment: "Pagamento locacao",
	adjustment: "Ajuste",
	withdrawal: "Sangria",
	deposit: "Suprimento",
};

function fmt(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function fmtTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function buildDenomMap(events: CashRegisterDenomination[], eventType: string): DenominationMap {
	const map: DenominationMap = {};
	for (const e of events) {
		if (e.event_type === eventType) {
			map[e.denomination_cents] = (map[e.denomination_cents] ?? 0) + e.quantity;
		}
	}
	return map;
}

export const CashClosedSummary: FC<ClosedSummaryProps> = ({ register, transactions, summary, denomEvents, denomInventory, user, cashStatus }) => {
	const discrepancy = (register.closing_balance_cents ?? 0) - (register.expected_balance_cents ?? 0);
	const absDiff = Math.abs(discrepancy);

	const diffColor = absDiff === 0
		? "bg-sk-green-light text-sk-green-dark"
		: absDiff <= 500
			? "bg-sk-yellow-light text-sk-yellow-dark"
			: "bg-sk-danger-light text-sk-danger";

	const script = html`<script>${raw(`function printSummary(){window.print();}`)}</script>`;

	return (
		<Layout title="SpeedKids - Resumo de Caixa" user={user} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4 flex items-center justify-between print:hidden">
				<a href="/cash" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Caixa</a>
				<button onclick="printSummary()" class="btn-touch px-4 py-2 bg-sk-blue text-white rounded-sk font-display font-medium text-sm btn-bounce">
					Imprimir
				</button>
			</div>

			<div class="max-w-2xl mx-auto">
				<h2 class="text-xl font-display font-bold text-sk-text mb-1">Resumo de Fechamento</h2>
				<p class="text-sm text-sk-muted font-body mb-4">
					Caixa #{register.id} &middot; {register.opened_by_name} &middot; {new Date(register.opened_at).toLocaleDateString("pt-BR")}
					{register.closed_at && <> &middot; Fechado {new Date(register.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
				</p>

				{/* Discrepancy hero */}
				<div class={`rounded-sk-xl p-6 text-center mb-6 ${diffColor.split(" ")[0]}`}>
					<p class="text-sm text-sk-muted font-body">Diferenca</p>
					<p class={`text-3xl font-display font-bold ${diffColor.split(" ").slice(1).join(" ")}`}>
						{discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)}
					</p>
					{absDiff === 0 && <p class="text-xs text-sk-green-dark font-body mt-1">Caixa conferido!</p>}
				</div>

				{/* Declared vs Expected */}
				<div class="grid grid-cols-2 gap-4 mb-4">
					<div class="bg-sk-blue-light rounded-sk p-4 text-center">
						<p class="text-xs text-sk-muted font-body">Declarado</p>
						<p class="text-xl font-display font-bold text-sk-blue-dark">{fmt(register.closing_balance_cents ?? 0)}</p>
					</div>
					<div class="bg-sk-yellow-light rounded-sk p-4 text-center">
						<p class="text-xs text-sk-muted font-body">Esperado</p>
						<p class="text-xl font-display font-bold text-sk-yellow-dark">{fmt(register.expected_balance_cents ?? 0)}</p>
					</div>
				</div>

				{/* Breakdown */}
				<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
					<h3 class="font-display font-bold text-sm text-sk-text mb-3">Detalhamento</h3>
					<div class="space-y-2 text-sm font-body">
						<div class="flex justify-between font-medium">
							<span>Saldo de abertura</span>
							<span>{fmt(summary.opening_balance_cents)}</span>
						</div>
						<hr class="border-sk-border" />
						<div class="flex justify-between">
							<span>Pagamentos em dinheiro</span>
							<span class="text-sk-green-dark">+{fmt(summary.cash_payments_cents)}</span>
						</div>
						<div class="flex justify-between text-sk-muted">
							<span>Pagamentos PIX</span>
							<span>{fmt(summary.pix_payments_cents)}</span>
						</div>
						<div class="flex justify-between text-sk-muted">
							<span>Pagamentos Debito</span>
							<span>{fmt(summary.debit_payments_cents)}</span>
						</div>
						<div class="flex justify-between text-sk-muted">
							<span>Pagamentos Credito</span>
							<span>{fmt(summary.credit_payments_cents)}</span>
						</div>
						{summary.courtesy_count > 0 && (
							<div class="flex justify-between text-sk-muted">
								<span>Cortesias</span>
								<span>{summary.courtesy_count}</span>
							</div>
						)}
						<hr class="border-sk-border" />
						<div class="flex justify-between">
							<span>Suprimentos ({summary.deposit_count})</span>
							<span class="text-sk-green-dark">+{fmt(summary.total_deposits_cents)}</span>
						</div>
						<div class="flex justify-between">
							<span>Sangrias ({summary.withdrawal_count})</span>
							<span class="text-sk-danger">-{fmt(summary.total_withdrawals_cents)}</span>
						</div>
						{summary.total_adjustments_cents !== 0 && (
							<div class="flex justify-between">
								<span>Ajustes ({summary.adjustment_count})</span>
								<span>{fmt(summary.total_adjustments_cents)}</span>
							</div>
						)}
						<hr class="border-sk-border" />
						<div class="flex justify-between font-medium">
							<span>Total locacoes</span>
							<span>{summary.rental_count}</span>
						</div>
						<div class="flex justify-between font-medium">
							<span>Esperado em caixa</span>
							<span>{fmt(summary.expected_cash_cents)}</span>
						</div>
						<div class="flex justify-between font-medium">
							<span>Declarado</span>
							<span>{fmt(register.closing_balance_cents ?? 0)}</span>
						</div>
					</div>
				</div>

				{/* Denomination breakdown */}
			{denomEvents.length > 0 && (() => {
				const openingMap = buildDenomMap(denomEvents, "opening");
				const closingMap = buildDenomMap(denomEvents, "closing");
				const hasOpening = Object.keys(openingMap).length > 0;
				const hasClosing = Object.keys(closingMap).length > 0;
				const activeDenoms = DENOMINATIONS.filter(d =>
					(openingMap[d.cents] ?? 0) > 0 ||
					(denomInventory[d.cents] ?? 0) > 0 ||
					(closingMap[d.cents] ?? 0) > 0
				);

				if (activeDenoms.length === 0) return null;

				return (
					<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
						<h3 class="font-display font-bold text-sm text-sk-text mb-3">Composicao de Cedulas</h3>
						<div class="overflow-x-auto">
							<table class="w-full text-sm font-body">
								<thead>
									<tr class="border-b border-sk-border">
										<th class="text-left py-2 pr-2 text-sk-muted font-medium">Denominacao</th>
										{hasOpening && <th class="text-center py-2 px-2 text-sk-muted font-medium">Abertura</th>}
										<th class="text-center py-2 px-2 text-sk-muted font-medium">Esperado</th>
										{hasClosing && <th class="text-center py-2 px-2 text-sk-muted font-medium">Contagem</th>}
										{hasClosing && <th class="text-center py-2 px-2 text-sk-muted font-medium">Dif.</th>}
									</tr>
								</thead>
								<tbody>
									{activeDenoms.map(d => {
										const opening = openingMap[d.cents] ?? 0;
										const expected = denomInventory[d.cents] ?? 0;
										const closing = closingMap[d.cents] ?? 0;
										const diff = closing - expected;
										return (
											<tr class="border-b border-gray-50">
												<td class="py-2 pr-2 font-medium">{d.label}</td>
												{hasOpening && <td class="text-center py-2 px-2">{opening}</td>}
												<td class="text-center py-2 px-2">{expected}</td>
												{hasClosing && <td class="text-center py-2 px-2">{closing}</td>}
												{hasClosing && (
													<td class={`text-center py-2 px-2 font-medium ${diff === 0 ? "text-sk-green-dark" : "text-sk-danger"}`}>
														{diff > 0 ? `+${diff}` : diff === 0 ? "0" : String(diff)}
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				);
			})()}

			{/* Transaction list */}
				<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden mb-6">
					<div class="px-4 py-3 bg-sk-yellow-light/50 border-b">
						<h3 class="font-display font-medium text-sk-text text-sm">Todas as Movimentacoes ({transactions.length})</h3>
					</div>
					{transactions.length === 0 ? (
						<p class="px-4 py-6 text-center text-sk-muted font-body text-sm">Nenhuma movimentacao</p>
					) : (
						<div class="divide-y divide-gray-100">
							{transactions.map((tx) => (
								<div class="px-4 py-3 flex items-center justify-between">
									<div>
										<span class="text-sm font-medium font-body">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
										{tx.description && <span class="text-xs text-sk-muted font-body ml-2">{tx.description}</span>}
										{tx.payment_method && <span class="text-xs text-sk-muted font-body ml-1">({tx.payment_method})</span>}
									</div>
									<div class="text-right">
										<span class={`font-medium text-sm ${tx.type === "withdrawal" ? "text-sk-danger" : "text-sk-green-dark"}`}>
											{tx.type === "withdrawal" ? "-" : "+"}{fmt(tx.amount_cents)}
										</span>
										<p class="text-xs text-sk-muted font-body">{fmtTime(tx.created_at)}</p>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</Layout>
	);
};
