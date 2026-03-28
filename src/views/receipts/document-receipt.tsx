import type { FC } from "hono/jsx";
import type { BusinessConfig } from "../../db/schema";
import { ReceiptLayout } from "./receipt-layout";

interface DocumentReceiptProps {
	title: string;
	renderedContent: string;
	config: BusinessConfig;
}

/**
 * Renders a document template on thermal receipt format.
 * Content lines are parsed:
 *   --- → separator
 *   [CENTRO]text → centered bold
 *   normal text → left-aligned paragraph
 */
export const DocumentReceipt: FC<DocumentReceiptProps> = ({ title, renderedContent, config }) => {
	const lines = renderedContent.split("\n");

	return (
		<ReceiptLayout title={title} config={config}>
			<div class="center bold mt">{title}</div>
			<div class="sep"></div>
			{lines.map((line) => {
				const trimmed = line.trim();
				if (!trimmed) return <div class="mt"></div>;
				if (trimmed === "---") return <div class="sep"></div>;
				if (trimmed.startsWith("[CENTRO]")) {
					return <div class="center bold mt">{trimmed.replace("[CENTRO]", "").trim()}</div>;
				}
				return <div class="mt">{trimmed}</div>;
			})}
			<div class="sep"></div>
			<div class="center sub mt">Documento impresso pelo sistema</div>
		</ReceiptLayout>
	);
};
