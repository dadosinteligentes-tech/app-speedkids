import type { FC } from "hono/jsx";
import type { BusinessConfig, Tenant, CashRegisterDenomination } from "../../db/schema";
import type { CashRegisterView, CashTransactionView, RegisterSummary } from "../../db/queries/cash-registers";
import type { DenominationMap } from "../../lib/denominations";
import { DENOMINATIONS } from "../../lib/denominations";
import { ReceiptLayout, fmtMoney, fmtDate, fmtTime } from "./receipt-layout";

interface CashReceiptProps {
	register: CashRegisterView;
	summary: RegisterSummary;
	transactions: CashTransactionView[];
	denomEvents: CashRegisterDenomination[];
	denomInventory: DenominationMap;
	config: BusinessConfig;
	tenant?: Tenant | null;
}

const TX_TYPE_LABELS: Record<string, string> = {
	rental_payment: "Pagamento locacao",
	product_sale: "Venda de produto",
	adjustment: "Ajuste",
	withdrawal: "Sangria",
	deposit: "Suprimento",
};

function buildDenomMap(events: CashRegisterDenomination[], eventType: string): DenominationMap {
	const map: DenominationMap = {};
	for (const e of events) {
		if (e.event_type === eventType) {
			map[e.denomination_cents] = (map[e.denomination_cents] ?? 0) + e.quantity;
		}
	}
	return map;
}

export const CashReceipt: FC<CashReceiptProps> = ({ register, summary, transactions, denomEvents, denomInventory, config }) => {
	const isOpen = register.status === "open";
	const titleText = isOpen ? "CONFERENCIA DE CAIXA" : "FECHAMENTO DE CAIXA";
	const declared = register.closing_balance_cents ?? 0;
	const expected = register.expected_balance_cents ?? summary.expected_cash_cents;
	const discrepancy = declared - expected;

	const openingMap = buildDenomMap(denomEvents, "opening");
	const closingMap = buildDenomMap(denomEvents, "closing");
	const hasOpening = Object.keys(openingMap).length > 0;
	const hasClosing = Object.keys(closingMap).length > 0;
	const activeDenoms = DENOMINATIONS.filter(d =>
		(openingMap[d.cents] ?? 0) > 0 ||
		(denomInventory[d.cents] ?? 0) > 0 ||
		(closingMap[d.cents] ?? 0) > 0
	);

	return (
		<ReceiptLayout title={titleText} config={config}>
			<div class="center bold mt">{titleText}</div>
			<div class="center sub">Caixa #{register.id} - {register.opened_by_name}</div>
			<div class="center sub mb">{fmtDate(register.opened_at)}</div>
			{register.closed_at && <div class="center sub">Fechado: {fmtTime(register.closed_at)}</div>}
			<div class="sep"></div>

			{/* Abertura */}
			<div class="mt">
				<div class="row">
					<span class="row-label">Abertura:</span>
					<span class="row-value">{fmtMoney(summary.opening_balance_cents)}</span>
				</div>
			</div>

			<div class="sep"></div>

			{/* Pagamentos por forma */}
			<div class="mt bold">Pagamentos</div>
			<div class="mt">
				{summary.cash_payments_cents > 0 && (
					<div class="row indent">
						<span class="row-label">Dinheiro:</span>
						<span class="row-value">{fmtMoney(summary.cash_payments_cents)}</span>
					</div>
				)}
				{summary.pix_payments_cents > 0 && (
					<div class="row indent">
						<span class="row-label">PIX:</span>
						<span class="row-value">{fmtMoney(summary.pix_payments_cents)}</span>
					</div>
				)}
				{summary.debit_payments_cents > 0 && (
					<div class="row indent">
						<span class="row-label">Debito:</span>
						<span class="row-value">{fmtMoney(summary.debit_payments_cents)}</span>
					</div>
				)}
				{summary.credit_payments_cents > 0 && (
					<div class="row indent">
						<span class="row-label">Credito:</span>
						<span class="row-value">{fmtMoney(summary.credit_payments_cents)}</span>
					</div>
				)}
			</div>

			{/* Suprimentos/Sangrias/Ajustes */}
			{(summary.total_deposits_cents > 0 || summary.total_withdrawals_cents > 0 || summary.total_adjustments_cents !== 0) && (
				<>
					<div class="sep"></div>
					<div class="mt">
						{summary.total_deposits_cents > 0 && (
							<div class="row">
								<span class="row-label">Suprimentos ({summary.deposit_count}):</span>
								<span class="row-value">{fmtMoney(summary.total_deposits_cents)}</span>
							</div>
						)}
						{summary.total_withdrawals_cents > 0 && (
							<div class="row">
								<span class="row-label">Sangrias ({summary.withdrawal_count}):</span>
								<span class="row-value">-{fmtMoney(summary.total_withdrawals_cents)}</span>
							</div>
						)}
						{summary.total_adjustments_cents !== 0 && (
							<div class="row">
								<span class="row-label">Ajustes ({summary.adjustment_count}):</span>
								<span class="row-value">{fmtMoney(summary.total_adjustments_cents)}</span>
							</div>
						)}
					</div>
				</>
			)}

			<div class="sep"></div>

			{/* Totais e diferença */}
			{!isOpen && (
				<div class="mt">
					<div class="row">
						<span class="row-label">Esperado (caixa):</span>
						<span class="row-value">{fmtMoney(expected)}</span>
					</div>
					<div class="row">
						<span class="row-label">Declarado:</span>
						<span class="row-value">{fmtMoney(declared)}</span>
					</div>
					<div class="row bold">
						<span class="row-label">Diferenca:</span>
						<span class="row-value">{discrepancy >= 0 ? "+" : ""}{fmtMoney(discrepancy)}</span>
					</div>
					<div class="sep"></div>
				</div>
			)}

			{isOpen && (
				<div class="mt">
					<div class="row bold">
						<span class="row-label">Saldo Atual:</span>
						<span class="row-value">{fmtMoney(summary.expected_cash_cents)}</span>
					</div>
					<div class="sep"></div>
				</div>
			)}

			{/* Contadores */}
			<div class="mt sub">
				<div class="row">
					<span class="row-label">Locacoes:</span>
					<span class="row-value">{summary.rental_count}</span>
				</div>
				{summary.product_sale_count > 0 && (
					<div class="row">
						<span class="row-label">Vendas produtos:</span>
						<span class="row-value">{summary.product_sale_count}</span>
					</div>
				)}
				{summary.courtesy_count > 0 && (
					<div class="row">
						<span class="row-label">Cortesias:</span>
						<span class="row-value">{summary.courtesy_count}</span>
					</div>
				)}
			</div>

			{/* Composição de cédulas */}
			{activeDenoms.length > 0 && (
				<>
					<div class="sep"></div>
					<div class="mt bold">Composicao de Cedulas</div>
					<div class="mt">
						<div class="row sub">
							<span class="row-label">Denom.</span>
							{hasOpening && <span style="width:35px;text-align:right">Abert</span>}
							<span style="width:35px;text-align:right">Esper</span>
							{hasClosing && <span style="width:35px;text-align:right">Cont.</span>}
							{hasClosing && <span style="width:30px;text-align:right">Dif</span>}
						</div>
						{activeDenoms.map(d => {
							const opening = openingMap[d.cents] ?? 0;
							const exp = denomInventory[d.cents] ?? 0;
							const closing = closingMap[d.cents] ?? 0;
							const diff = closing - exp;
							return (
								<div class="row">
									<span class="row-label">{d.label}</span>
									{hasOpening && <span style="width:35px;text-align:right">{opening}</span>}
									<span style="width:35px;text-align:right">{exp}</span>
									{hasClosing && <span style="width:35px;text-align:right">{closing}</span>}
									{hasClosing && <span style="width:30px;text-align:right">{diff > 0 ? `+${diff}` : diff === 0 ? "0" : String(diff)}</span>}
								</div>
							);
						})}
					</div>
				</>
			)}

			{/* Movimentações */}
			{transactions.length > 0 && (
				<>
					<div class="sep"></div>
					<div class="mt bold">Movimentacoes ({transactions.length})</div>
					<div class="mt">
						{transactions.map((tx) => (
							<div class="row sub">
								<span class="row-label">
									{fmtTime(tx.created_at)} {TX_TYPE_LABELS[tx.type] ?? tx.type}
								</span>
								<span class="row-value">
									{tx.type === "withdrawal" ? "-" : ""}{fmtMoney(tx.amount_cents)}
								</span>
							</div>
						))}
					</div>
				</>
			)}
		</ReceiptLayout>
	);
};
