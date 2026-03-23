import type { FC } from "hono/jsx";
import type { RentalSessionView, BusinessConfig, Tenant } from "../../db/schema";
import { ReceiptLayout, fmtMoney, fmtDateTime, fmtTime } from "./receipt-layout";

const PAYMENT_LABELS: Record<string, string> = {
	cash: "Dinheiro",
	pix: "PIX",
	debit: "Debito",
	credit: "Credito",
	courtesy: "Cortesia",
	mixed: "Misto",
};

interface RentalReceiptProps {
	session: RentalSessionView;
	attendantName: string | null;
	config: BusinessConfig;
	tenant?: Tenant | null;
}

export const RentalReceipt: FC<RentalReceiptProps> = ({ session, attendantName, config }) => {
	const baseAmount = session.amount_cents - (session.overtime_cents ?? 0);
	const hasOvertime = (session.overtime_cents ?? 0) > 0;

	return (
		<ReceiptLayout title="Comprovante de Locacao" config={config}>
			<div class="center bold mt">COMPROVANTE DE LOCACAO</div>
			<div class="center sub mb">{fmtDateTime(session.start_time)}</div>
			{attendantName && <div class="center sub mb">Operador: {attendantName}</div>}
			<div class="sep"></div>

			<div class="mt">
				<div class="bold">{session.asset_name}</div>
				<div>Pacote: {session.package_name}</div>
				<div>{session.duration_minutes} minutos</div>
			</div>

			{(session.child_name || session.customer_name) && (
				<div class="mt">
					{session.child_name && (
						<div>Crianca: {session.child_name}{session.child_age ? ` (${session.child_age} anos)` : ""}</div>
					)}
					{session.customer_name && (
						<div>Responsavel: {session.customer_name}</div>
					)}
					{session.customer_phone && (
						<div class="sub">Tel: {session.customer_phone}</div>
					)}
				</div>
			)}

			<div class="sep"></div>

			<div class="mt">
				{hasOvertime ? (
					<>
						<div class="row">
							<span class="row-label">Pacote:</span>
							<span class="row-value">{fmtMoney(baseAmount)}</span>
						</div>
						<div class="row">
							<span class="row-label">Tempo extra ({session.overtime_minutes}min):</span>
							<span class="row-value">{fmtMoney(session.overtime_cents)}</span>
						</div>
						<div class="sep"></div>
					</>
				) : null}
				<div class="row bold big">
					<span class="row-label">TOTAL:</span>
					<span class="row-value">{fmtMoney(session.amount_cents)}</span>
				</div>
				{session.payment_method && (
					<div class="row mt">
						<span class="row-label">Pagamento:</span>
						<span class="row-value">{PAYMENT_LABELS[session.payment_method] ?? session.payment_method}</span>
					</div>
				)}
			</div>

			<div class="sep"></div>

			<div class="mt sub">
				<div>Inicio: {fmtTime(session.start_time)}</div>
				{session.end_time && <div>Fim: {fmtTime(session.end_time)}</div>}
			</div>
		</ReceiptLayout>
	);
};
