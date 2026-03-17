import type { FC } from "hono/jsx";
import type { BusinessConfig } from "../../db/schema";
import type { ShiftReport } from "../../db/queries/reports";
import { ReceiptLayout, fmtMoney, fmtDateTime } from "./receipt-layout";

interface ShiftReceiptProps {
	shift: ShiftReport;
	config: BusinessConfig;
}

export const ShiftReceipt: FC<ShiftReceiptProps> = ({ shift, config }) => (
	<ReceiptLayout title="Resumo do Turno" config={config}>
		<div class="center bold mt">RESUMO DO TURNO</div>
		{shift.shift_name && <div class="center mb">{shift.shift_name}</div>}
		<div class="sep"></div>

		<div class="mt">
			<div>Operador: {shift.user_name}</div>
			<div>Inicio: {fmtDateTime(shift.started_at)}</div>
			{shift.ended_at && <div>Fim: {fmtDateTime(shift.ended_at)}</div>}
		</div>

		<div class="sep"></div>

		<div class="mt">
			<div class="row">
				<span class="row-label">Locações:</span>
				<span class="row-value">{shift.rental_count}</span>
			</div>
			<div class="row bold">
				<span class="row-label">Receita total:</span>
				<span class="row-value">{fmtMoney(shift.revenue_cents)}</span>
			</div>
		</div>

		<div class="sep"></div>

		<div class="mt">
			<div class="center bold mb">VENDAS POR PAGAMENTO</div>
			{shift.cash_count > 0 && (
				<div class="row indent">
					<span class="row-label">Dinheiro ({shift.cash_count}x):</span>
					<span class="row-value">{fmtMoney(shift.cash_cents)}</span>
				</div>
			)}
			{shift.credit_count > 0 && (
				<div class="row indent">
					<span class="row-label">Credito ({shift.credit_count}x):</span>
					<span class="row-value">{fmtMoney(shift.credit_cents)}</span>
				</div>
			)}
			{shift.debit_count > 0 && (
				<div class="row indent">
					<span class="row-label">Debito ({shift.debit_count}x):</span>
					<span class="row-value">{fmtMoney(shift.debit_cents)}</span>
				</div>
			)}
			{shift.pix_count > 0 && (
				<div class="row indent">
					<span class="row-label">PIX ({shift.pix_count}x):</span>
					<span class="row-value">{fmtMoney(shift.pix_cents)}</span>
				</div>
			)}
			{shift.courtesy_count > 0 && (
				<div class="row indent">
					<span class="row-label">Cortesias ({shift.courtesy_count}x):</span>
					<span class="row-value">R$ 0,00</span>
				</div>
			)}
		</div>
	</ReceiptLayout>
);
