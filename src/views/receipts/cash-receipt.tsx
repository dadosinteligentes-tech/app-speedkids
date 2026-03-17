import type { FC } from "hono/jsx";
import type { BusinessConfig } from "../../db/schema";
import type { CashRegisterView, RegisterSummary } from "../../db/queries/cash-registers";
import { ReceiptLayout, fmtMoney, fmtDate } from "./receipt-layout";

interface CashReceiptProps {
	register: CashRegisterView;
	summary: RegisterSummary;
	config: BusinessConfig;
}

export const CashReceipt: FC<CashReceiptProps> = ({ register, summary, config }) => {
	const isOpen = register.status === "open";
	const titleText = isOpen ? "CONFERÊNCIA DE CAIXA" : "FECHAMENTO DE CAIXA";
	const declared = register.closing_balance_cents ?? 0;
	const expected = register.expected_balance_cents ?? summary.expected_cash_cents;
	const discrepancy = declared - expected;

	return (
		<ReceiptLayout title={titleText} config={config}>
			<div class="center bold mt">{titleText}</div>
			<div class="center sub">Caixa #{register.id} - {register.opened_by_name}</div>
			<div class="center sub mb">{fmtDate(register.opened_at)}</div>
			<div class="sep"></div>

			<div class="mt">
				<div class="row">
					<span class="row-label">Abertura:</span>
					<span class="row-value">{fmtMoney(summary.opening_balance_cents)}</span>
				</div>
			</div>

			<div class="sep"></div>

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

			{(summary.total_deposits_cents > 0 || summary.total_withdrawals_cents > 0) && (
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

			<div class="mt sub">
				<div class="row">
					<span class="row-label">Locações:</span>
					<span class="row-value">{summary.rental_count}</span>
				</div>
				{summary.courtesy_count > 0 && (
					<div class="row">
						<span class="row-label">Cortesias:</span>
						<span class="row-value">{summary.courtesy_count}</span>
					</div>
				)}
			</div>
		</ReceiptLayout>
	);
};
