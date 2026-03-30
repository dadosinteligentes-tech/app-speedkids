import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { verifyVerificationToken } from "../../lib/email-verification";
import { markEmailVerified } from "../../db/queries/loyalty";

export const loyaltyPages = new Hono<AppEnv>();

// Public page: verify email token
loyaltyPages.get("/verify", async (c) => {
	const token = c.req.query("token");
	if (!token) return renderResult(c, false, "Token não fornecido");

	const secret = c.env.LOYALTY_HMAC_SECRET;
	if (!secret) return renderResult(c, false, "Serviço indisponível");

	const result = await verifyVerificationToken(secret, token);
	if (!result.valid) return renderResult(c, false, result.error ?? "Token inválido");

	// Verify customer exists and email matches
	const customer = await c.env.DB
		.prepare("SELECT id, name, email, email_verified FROM customers WHERE id = ? AND tenant_id = ?")
		.bind(result.customerId!, result.tenantId!)
		.first<{ id: number; name: string; email: string | null; email_verified: number }>();

	if (!customer) return renderResult(c, false, "Cliente não encontrado");
	if (customer.email !== result.email) return renderResult(c, false, "Email não confere");

	if (customer.email_verified) {
		return renderResult(c, true, "Seu email já foi verificado anteriormente!", customer.name);
	}

	await markEmailVerified(c.env.DB, result.tenantId!, result.customerId!);
	return renderResult(c, true, "Email verificado com sucesso! Agora você participa do programa de fidelidade.", customer.name);
});

function renderResult(c: any, success: boolean, message: string, name?: string) {
	const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${success ? "Email Verificado" : "Erro"} — Programa de Fidelidade</title>
	<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Quicksand:wght@400;500;600&display=swap" rel="stylesheet">
	<style>
		body { font-family: 'Quicksand', sans-serif; background: #FFF9F0; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
		.card { background: white; border-radius: 24px; box-shadow: 0 8px 32px rgba(255,152,0,0.15); max-width: 420px; width: 100%; text-align: center; overflow: hidden; }
		.header { background: linear-gradient(135deg, ${success ? "#388E3C" : "#EF5350"}, ${success ? "#1B5E20" : "#C62828"}); padding: 40px 30px; color: white; }
		.header h1 { font-family: 'Fredoka', sans-serif; font-size: 24px; margin: 0; }
		.icon { font-size: 48px; margin-bottom: 12px; }
		.body { padding: 30px; }
		.body p { color: #3E2723; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
		.name { font-family: 'Fredoka', sans-serif; font-weight: 700; color: #FF7043; }
	</style>
</head>
<body>
	<div class="card">
		<div class="header">
			<div class="icon">${success ? "✅" : "❌"}</div>
			<h1>${success ? "Email Verificado!" : "Ops!"}</h1>
		</div>
		<div class="body">
			${name ? `<p>Olá, <span class="name">${name}</span>!</p>` : ""}
			<p>${message}</p>
			${success ? '<p style="color:#388E3C;font-weight:600;">⭐ Seus pontos começarão a acumular automaticamente a cada pagamento.</p>' : ""}
		</div>
	</div>
</body>
</html>`;
	return c.html(html, success ? 200 : 400);
}
