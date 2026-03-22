import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { CashRegisterView, CashTransactionView, RegisterSummary } from "../../db/queries/cash-registers";
import type { CashRegisterDenomination } from "../../db/schema";
import type { CashStatusBadge } from "../../lib/cash-status";
import type { DenominationMap } from "../../lib/denominations";
import { DENOMINATIONS } from "../../lib/denominations";
import { Layout } from "../layout";
import { toBrazilDate, toBrazilTime } from "../../lib/timezone";

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
	product_sale: "Venda de produto",
	adjustment: "Ajuste",
	withdrawal: "Sangria",
	deposit: "Suprimento",
};

function fmt(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function fmtTime(iso: string): string {
	return toBrazilTime(iso);
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

	const printStyles = html`<style>${raw(`
		@media print {
			@page { size: 58mm auto; margin: 0; }
			html, body {
				width: 54mm !important;
				max-width: 54mm !important;
				margin: 0 !important;
				padding: 1mm 0 !important;
				background: white !important;
				font-family: 'Courier New', Courier, monospace !important;
				font-size: 11px !important;
				font-weight: 500 !important;
				line-height: 1.15 !important;
				color: #000 !important;
				-webkit-print-color-adjust: exact;
			}
			main { max-width: 100% !important; padding: 0 1mm !important; margin: 0 !important; }
			.max-w-2xl { max-width: 100% !important; }
			h2 { font-size: 13px !important; margin-bottom: 1px !important; }
			h3 { font-size: 11px !important; margin-bottom: 1px !important; }
			p { margin-bottom: 1px !important; }
			.text-3xl { font-size: 16px !important; }
			.text-2xl { font-size: 14px !important; }
			.text-xl { font-size: 13px !important; }
			.text-lg { font-size: 12px !important; }
			.text-sm, .text-xs { font-size: 10px !important; }
			.rounded-sk, .rounded-sk-xl, .rounded-sk-lg { border-radius: 0 !important; }
			.shadow-sk-sm, .shadow-sk-md { box-shadow: none !important; }
			.p-6 { padding: 2px 0 !important; }
			.p-4 { padding: 2px 0 !important; }
			.p-3 { padding: 1px 0 !important; }
			.px-4 { padding-left: 0 !important; padding-right: 0 !important; }
			.py-3 { padding-top: 1px !important; padding-bottom: 1px !important; }
			.py-2 { padding-top: 0 !important; padding-bottom: 0 !important; }
			.mb-6 { margin-bottom: 2px !important; }
			.mb-4 { margin-bottom: 2px !important; }
			.mb-3 { margin-bottom: 1px !important; }
			.mb-1 { margin-bottom: 0 !important; }
			.mt-3, .mt-4 { margin-top: 1px !important; }
			.gap-4, .gap-3 { gap: 2px !important; }
			.space-y-2 > * + * { margin-top: 0 !important; }
			.divide-y > * + * { border-top-width: 0 !important; }
			.border-b { border-bottom: 1px dashed #000 !important; }
			hr { border-top: 1px dashed #000 !important; margin: 1px 0 !important; }
			[class*="bg-sk-"] { background: transparent !important; }
			[class*="text-sk-"] { color: #000 !important; }
			.font-display, .font-body { font-family: 'Courier New', Courier, monospace !important; }
			table { font-size: 10px !important; }
			th, td { padding: 0 2px !important; }
		}
	`)}</style>`;

	const script = html`<script>${raw(`function printSummary(){window.print();}`)}</script>`;

	return (
		<Layout title="SpeedKids - Resumo de Caixa" user={user} headScripts={printStyles} bodyScripts={script} cashStatus={cashStatus}>
			<div class="mb-4 flex items-center justify-between print:hidden">
				<a href="/cash" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Caixa</a>
				<div class="flex gap-2">
					<button onclick={`window.open('/receipts/cash/${register.id}','_blank')`} class="btn-touch px-4 py-2 bg-sk-green text-white rounded-sk font-display font-medium text-sm btn-bounce">
						Imprimir Cupom
					</button>
					<button onclick="printSummary()" class="btn-touch px-4 py-2 bg-sk-blue text-white rounded-sk font-display font-medium text-sm btn-bounce">
						Imprimir
					</button>
				</div>
			</div>

			<div class="max-w-6xl mx-auto">
				<h2 class="text-2xl font-display font-bold text-sk-text mb-1">Resumo de Fechamento</h2>
				<p class="text-sm text-sk-text/60 font-body mb-4">
					Caixa #{register.id} &middot; {register.opened_by_name} &middot; {toBrazilDate(register.opened_at)}
					{register.closed_at && <> &middot; Fechado {toBrazilTime(register.closed_at)}</>}
				</p>

				<div class="lg:grid lg:grid-cols-2 lg:gap-6">
					{/* Coluna esquerda: resumo financeiro */}
					<div>
						{/* Discrepancy hero */}
						<div class={`rounded-sk-xl p-6 text-center mb-4 ${diffColor.split(" ")[0]}`}>
							<p class="text-sm font-body font-medium text-sk-text/70">Diferenca</p>
							<p class={`text-4xl font-display font-bold ${diffColor.split(" ").slice(1).join(" ")}`}>
								{discrepancy >= 0 ? "+" : ""}{fmt(discrepancy)}
							</p>
							{absDiff === 0 && <p class="text-sm text-sk-green-dark font-body mt-1 font-medium">Caixa conferido!</p>}
						</div>

						{/* Declared vs Expected */}
						<div class="grid grid-cols-2 gap-4 mb-4">
							<div class="bg-sk-blue-light rounded-sk p-4 text-center">
								<p class="text-sm text-sk-text/70 font-body font-medium mb-1">Declarado</p>
								<p class="text-2xl font-display font-bold text-sk-blue-dark">{fmt(register.closing_balance_cents ?? 0)}</p>
							</div>
							<div class="bg-sk-yellow-light rounded-sk p-4 text-center">
								<p class="text-sm text-sk-text/70 font-body font-medium mb-1">Esperado</p>
								<p class="text-2xl font-display font-bold text-sk-yellow-dark">{fmt(register.expected_balance_cents ?? 0)}</p>
							</div>
						</div>

						{/* Breakdown */}
						<div class="bg-sk-surface rounded-sk-xl shadow-sk-sm p-6 mb-4">
							<h3 class="font-display font-bold text-base text-sk-text mb-3">Detalhamento</h3>
							<div class="space-y-2 text-sm font-body">
								<div class="flex justify-between font-semibold text-sk-text">
									<span>Saldo de abertura</span>
									<span>{fmt(summary.opening_balance_cents)}</span>
								</div>
								<hr class="border-sk-border" />
								<div class="flex justify-between text-sk-text">
									<span>Pagamentos em dinheiro</span>
									<span class="font-medium text-sk-green-dark">+{fmt(summary.cash_payments_cents)}</span>
								</div>
								<div class="flex justify-between text-sk-text/70">
									<span>Pagamentos PIX</span>
									<span class="font-medium">{fmt(summary.pix_payments_cents)}</span>
								</div>
								<div class="flex justify-between text-sk-text/70">
									<span>Pagamentos Debito</span>
									<span class="font-medium">{fmt(summary.debit_payments_cents)}</span>
								</div>
								<div class="flex justify-between text-sk-text/70">
									<span>Pagamentos Credito</span>
									<span class="font-medium">{fmt(summary.credit_payments_cents)}</span>
								</div>
								{summary.courtesy_count > 0 && (
									<div class="flex justify-between text-sk-text/70">
										<span>Cortesias</span>
										<span class="font-medium">{summary.courtesy_count}</span>
									</div>
								)}
								<hr class="border-sk-border" />
								<div class="flex justify-between text-sk-text">
									<span>Suprimentos ({summary.deposit_count})</span>
									<span class="font-medium text-sk-green-dark">+{fmt(summary.total_deposits_cents)}</span>
								</div>
								<div class="flex justify-between text-sk-text">
									<span>Sangrias ({summary.withdrawal_count})</span>
									<span class="font-medium text-sk-danger">-{fmt(summary.total_withdrawals_cents)}</span>
								</div>
								{summary.total_adjustments_cents !== 0 && (
									<div class="flex justify-between text-sk-text">
										<span>Ajustes ({summary.adjustment_count})</span>
										<span class="font-medium">{fmt(summary.total_adjustments_cents)}</span>
									</div>
								)}
								<hr class="border-sk-border" />
								<div class="flex justify-between font-semibold text-sk-text">
									<span>Total locacoes</span>
									<span>{summary.rental_count}</span>
								</div>
								<div class="flex justify-between font-semibold text-sk-text">
									<span>Vendas de produtos</span>
									<span>{summary.product_sale_count}</span>
								</div>
								<div class="flex justify-between font-semibold text-sk-text">
									<span>Esperado em caixa</span>
									<span>{fmt(summary.expected_cash_cents)}</span>
								</div>
								<div class="flex justify-between font-semibold text-sk-text">
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
									<h3 class="font-display font-bold text-base text-sk-text mb-3">Composicao de Cedulas</h3>
									<div class="overflow-x-auto">
										<table class="w-full text-sm font-body">
											<thead>
												<tr class="border-b border-sk-border">
													<th class="text-left py-2 pr-2 text-sk-text font-semibold">Denominacao</th>
													{hasOpening && <th class="text-center py-2 px-2 text-sk-text font-semibold">Abertura</th>}
													<th class="text-center py-2 px-2 text-sk-text font-semibold">Esperado</th>
													{hasClosing && <th class="text-center py-2 px-2 text-sk-text font-semibold">Contagem</th>}
													{hasClosing && <th class="text-center py-2 px-2 text-sk-text font-semibold">Dif.</th>}
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
															<td class="py-2 pr-2 font-medium text-sk-text">{d.label}</td>
															{hasOpening && <td class="text-center py-2 px-2 text-sk-text">{opening}</td>}
															<td class="text-center py-2 px-2 text-sk-text">{expected}</td>
															{hasClosing && <td class="text-center py-2 px-2 text-sk-text">{closing}</td>}
															{hasClosing && (
																<td class={`text-center py-2 px-2 font-semibold ${diff === 0 ? "text-sk-green-dark" : "text-sk-danger"}`}>
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
					</div>

					{/* Coluna direita: movimentações */}
					<div>
						<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden mb-6 lg:sticky lg:top-4">
							<div class="px-4 py-3 bg-sk-yellow-light/50 border-b">
								<h3 class="font-display font-bold text-base text-sk-text">Todas as Movimentacoes ({transactions.length})</h3>
							</div>
							{transactions.length === 0 ? (
								<p class="px-4 py-6 text-center text-sk-text/60 font-body text-sm">Nenhuma movimentacao</p>
							) : (
								<div class="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
									{transactions.map((tx) => (
										<div class="px-4 py-3 flex items-start justify-between gap-2">
											<div>
												<span class="text-sm font-semibold font-body text-sk-text">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
												{tx.description && <p class="text-xs text-sk-text/60 font-body mt-0.5">{tx.description}</p>}
												{tx.payment_method && <p class="text-xs text-sk-text/60 font-body">{tx.payment_method}</p>}
											</div>
											<div class="text-right shrink-0">
												<span class={`font-bold text-sm ${tx.type === "withdrawal" ? "text-sk-danger" : "text-sk-green-dark"}`}>
													{tx.type === "withdrawal" ? "-" : "+"}{fmt(tx.amount_cents)}
												</span>
												<p class="text-xs text-sk-text/60 font-body">{fmtTime(tx.created_at)}</p>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</Layout>
	);
};
