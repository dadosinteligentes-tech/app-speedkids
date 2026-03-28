import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getBusinessConfig } from "../../db/queries/business-config";
import { getSessionById } from "../../db/queries/rentals";
import { getUserById } from "../../db/queries/users";
import { getShiftReportById } from "../../db/queries/reports";
import { getRegisterById, getRegisterSummary, getTransactions, getDenominationEvents, getDenominationInventory } from "../../db/queries/cash-registers";
import { RentalReceipt } from "../../views/receipts/rental-receipt";
import { ShiftReceipt } from "../../views/receipts/shift-receipt";
import { CashReceipt } from "../../views/receipts/cash-receipt";
import { ProductSaleReceipt } from "../../views/receipts/product-sale-receipt";
import { getProductSaleById } from "../../db/queries/product-sales";
import { DocumentReceipt } from "../../views/receipts/document-receipt";
import { getTemplateById, renderTemplate, buildVariablesFromSession, getSampleVariables } from "../../db/queries/document-templates";

export const receiptPages = new Hono<AppEnv>();

// Helper: check business config is set up
async function requireConfig(db: D1Database, tenantId: number) {
	const config = await getBusinessConfig(db, tenantId);
	if (!config || !config.name) return null;
	return config;
}

receiptPages.get("/rental/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(
			<html><body style="font-family:monospace;padding:20px;text-align:center">
				<p>Configure os dados do estabelecimento em<br/><strong>Admin &gt; Configuracoes</strong><br/>antes de imprimir cupons.</p>
			</body></html>,
		);
	}

	const session = await getSessionById(c.env.DB, c.req.param("id"), tenantId);
	if (!session) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Sessao nao encontrada.</p></body></html>, 404);

	let attendantName: string | null = null;
	if (session.attendant_id) {
		const user = await getUserById(c.env.DB, tenantId, session.attendant_id);
		attendantName = user?.name ?? null;
	}

	const tenant = c.get("tenant");
	return c.html(<RentalReceipt session={session} attendantName={attendantName} config={config} tenant={tenant} />);
});

receiptPages.get("/shift/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(
			<html><body style="font-family:monospace;padding:20px;text-align:center">
				<p>Configure os dados do estabelecimento em<br/><strong>Admin &gt; Configuracoes</strong><br/>antes de imprimir cupons.</p>
			</body></html>,
		);
	}

	const shiftId = Number(c.req.param("id"));
	const shift = await getShiftReportById(c.env.DB, tenantId, shiftId);
	if (!shift) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Turno nao encontrado.</p></body></html>, 404);

	const tenant = c.get("tenant");
	return c.html(<ShiftReceipt shift={shift} config={config} tenant={tenant} />);
});

receiptPages.get("/cash/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(
			<html><body style="font-family:monospace;padding:20px;text-align:center">
				<p>Configure os dados do estabelecimento em<br/><strong>Admin &gt; Configuracoes</strong><br/>antes de imprimir cupons.</p>
			</body></html>,
		);
	}

	const registerId = Number(c.req.param("id"));
	const register = await getRegisterById(c.env.DB, registerId, tenantId);
	if (!register) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Caixa nao encontrado.</p></body></html>, 404);

	const [summary, transactions, denomEvents, denomInventory] = await Promise.all([
		getRegisterSummary(c.env.DB, registerId),
		getTransactions(c.env.DB, registerId),
		getDenominationEvents(c.env.DB, registerId),
		getDenominationInventory(c.env.DB, registerId),
	]);
	const tenant = c.get("tenant");
	return c.html(<CashReceipt register={register} summary={summary} transactions={transactions}
		denomEvents={denomEvents} denomInventory={denomInventory} config={config} tenant={tenant} />);
});

receiptPages.get("/product-sale/:id", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(
			<html><body style="font-family:monospace;padding:20px;text-align:center">
				<p>Configure os dados do estabelecimento em<br/><strong>Admin &gt; Configuracoes</strong><br/>antes de imprimir cupons.</p>
			</body></html>,
		);
	}

	const saleId = Number(c.req.param("id"));
	const sale = await getProductSaleById(c.env.DB, saleId, tenantId);
	if (!sale) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Venda nao encontrada.</p></body></html>, 404);

	const tenant = c.get("tenant");
	return c.html(<ProductSaleReceipt sale={sale} config={config} tenant={tenant} />);
});

// Document template preview (with sample data) — must be registered before :sessionId to avoid "preview" matching as sessionId
receiptPages.get("/document/:templateId/preview", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(<html><body style="font-family:monospace;padding:20px;text-align:center"><p>Configure os dados primeiro.</p></body></html>);
	}

	const templateId = Number(c.req.param("templateId"));
	const template = await getTemplateById(c.env.DB, tenantId, templateId);
	if (!template) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Modelo nao encontrado.</p></body></html>, 404);

	const vars = getSampleVariables();
	vars.empresa = config.name;
	vars.cnpj = config.cnpj || "";
	vars.endereco = config.address || "";
	vars.telefone = config.phone || "";

	const rendered = renderTemplate(template.content, vars);
	return c.html(<DocumentReceipt title={`[PREVIEW] ${template.name}`} renderedContent={rendered} config={config} />);
});

// Document template receipt (with rental session data)
receiptPages.get("/document/:templateId/:sessionId", async (c) => {
	const tenantId = c.get("tenant_id");
	const config = await requireConfig(c.env.DB, tenantId);
	if (!config) {
		return c.html(
			<html><body style="font-family:monospace;padding:20px;text-align:center">
				<p>Configure os dados do estabelecimento antes de imprimir.</p>
			</body></html>,
		);
	}

	const templateId = Number(c.req.param("templateId"));
	const sessionId = c.req.param("sessionId");

	const template = await getTemplateById(c.env.DB, tenantId, templateId);
	if (!template) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Modelo nao encontrado.</p></body></html>, 404);

	const session = await getSessionById(c.env.DB, sessionId, tenantId);
	if (!session) return c.html(<html><body style="font-family:monospace;padding:20px"><p>Sessao nao encontrada.</p></body></html>, 404);

	let attendantName: string | undefined;
	if (session.attendant_id) {
		const user = await getUserById(c.env.DB, tenantId, session.attendant_id);
		attendantName = user?.name;
	}

	const vars = buildVariablesFromSession(session, config, attendantName);
	const rendered = renderTemplate(template.content, vars);

	return c.html(<DocumentReceipt title={template.name} renderedContent={rendered} config={config} />);
});
