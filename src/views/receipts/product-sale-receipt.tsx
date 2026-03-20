import type { FC } from "hono/jsx";
import type { BusinessConfig } from "../../db/schema";
import type { ProductSaleView } from "../../db/queries/product-sales";
import { ReceiptLayout, fmtMoney, fmtDateTime } from "./receipt-layout";

const PAYMENT_LABELS: Record<string, string> = {
	cash: "Dinheiro",
	pix: "PIX",
	debit: "Debito",
	credit: "Credito",
	mixed: "Misto",
};

interface ProductSaleReceiptProps {
	sale: ProductSaleView;
	config: BusinessConfig;
}

export const ProductSaleReceipt: FC<ProductSaleReceiptProps> = ({ sale, config }) => {
	return (
		<ReceiptLayout title="Comprovante de Venda" config={config}>
			<div class="center bold mt">COMPROVANTE DE VENDA</div>
			<div class="center sub mb">{fmtDateTime(sale.created_at)}</div>
			{sale.attendant_name && <div class="center sub mb">Operador: {sale.attendant_name}</div>}
			<div class="sep"></div>

			<div class="mt">
				{sale.items.map((item) => (
					<div class="row">
						<span class="row-label">{item.quantity}x {item.product_name}</span>
						<span class="row-value">{fmtMoney(item.total_cents)}</span>
					</div>
				))}
			</div>

			<div class="sep"></div>

			{sale.discount_cents > 0 && (
				<>
					<div class="row mt">
						<span class="row-label">Subtotal:</span>
						<span class="row-value">{fmtMoney(sale.total_cents + sale.discount_cents)}</span>
					</div>
					<div class="row">
						<span class="row-label">Desconto:</span>
						<span class="row-value">-{fmtMoney(sale.discount_cents)}</span>
					</div>
				</>
			)}

			<div class="row bold big mt">
				<span class="row-label">TOTAL:</span>
				<span class="row-value">{fmtMoney(sale.total_cents)}</span>
			</div>
			{sale.payment_method && (
				<div class="row mt">
					<span class="row-label">Pagamento:</span>
					<span class="row-value">{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</span>
				</div>
			)}

			{sale.customer_name && (
				<>
					<div class="sep"></div>
					<div class="mt sub">Cliente: {sale.customer_name}</div>
				</>
			)}

			{sale.notes && (
				<div class="mt sub">Obs: {sale.notes}</div>
			)}
		</ReceiptLayout>
	);
};
