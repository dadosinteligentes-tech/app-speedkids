import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import type { BusinessConfig } from "../../db/schema";

interface ReceiptLayoutProps {
	title: string;
	config: BusinessConfig;
}

function fmtDateTime(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const ReceiptLayout: FC<PropsWithChildren<ReceiptLayoutProps>> = ({ title, config, children }) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title}</title>
			{raw(`<style>
				@page { margin: 0; size: 58mm auto; }
				* { margin: 0; padding: 0; box-sizing: border-box; }
				body {
					width: 48mm;
					max-width: 48mm;
					margin: 0 auto;
					padding: 2mm 0;
					font-family: 'Courier New', Courier, monospace;
					font-size: 10px;
					line-height: 1.3;
					color: #000;
				}
				.center { text-align: center; }
				.right { text-align: right; }
				.bold { font-weight: bold; }
				.big { font-size: 12px; }
				.small { font-size: 8px; }
				.sep { border-top: 1px dashed #000; margin: 3px 0; }
				.row { display: flex; justify-content: space-between; }
				.row-label { flex: 1; }
				.row-value { text-align: right; white-space: nowrap; }
				.indent { padding-left: 6px; }
				.mt { margin-top: 4px; }
				.mb { margin-bottom: 4px; }
				@media screen {
					body { padding: 12px; border: 1px dashed #ccc; margin: 20px auto; }
				}
			</style>`)}
		</head>
		<body>
			{/* Header */}
			<div class="center bold big mb">{config.name}</div>
			{config.address && <div class="center small">{config.address}</div>}
			{config.cnpj && <div class="center small">CNPJ: {config.cnpj}</div>}
			{config.phone && <div class="center small">Tel: {config.phone}</div>}
			<div class="sep"></div>

			{/* Content */}
			{children}

			{/* Footer */}
			<div class="sep"></div>
			{config.receipt_footer && <div class="center small mt">{config.receipt_footer}</div>}
			<div class="center small mt">Impresso em {fmtDateTime(new Date().toISOString())}</div>

			{raw(`<script>window.onload=function(){window.print();}</script>`)}
		</body>
	</html>
);

export function fmtMoney(cents: number): string {
	return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

export function fmtDate(iso: string): string {
	return new Date(iso).toLocaleDateString("pt-BR");
}

export function fmtTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export { fmtDateTime };
