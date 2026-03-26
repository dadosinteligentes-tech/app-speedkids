/**
 * Email service using Resend API (https://resend.com).
 * Requires RESEND_API_KEY env var. If not set, emails are logged to console.
 */

const RESEND_API = "https://api.resend.com/emails";

export interface EmailParams {
	to: string;
	subject: string;
	html: string;
}

export interface EmailLogEntry {
	tenantId: number | null;
	recipient: string;
	subject: string;
	eventType: string;
	metadata?: Record<string, string>;
}

export async function sendEmail(
	apiKey: string | undefined,
	fromAddress: string,
	params: EmailParams,
): Promise<{ ok: boolean; error?: string }> {
	if (!apiKey) {
		console.log(`[EMAIL SKIP] To: ${params.to} | Subject: ${params.subject}`);
		return { ok: false, error: "API key not configured" };
	}

	try {
		const res = await fetch(RESEND_API, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: fromAddress,
				to: params.to,
				subject: params.subject,
				html: params.html,
			}),
		});

		if (!res.ok) {
			const err = await res.text();
			console.error(`[EMAIL ERROR] ${res.status}: ${err}`);
			return { ok: false, error: `${res.status}: ${err}` };
		}

		return { ok: true };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[EMAIL ERROR]", msg);
		return { ok: false, error: msg };
	}
}

/** Persist email send attempt in the database for audit trail */
export async function logEmail(
	db: D1Database,
	entry: EmailLogEntry,
	status: "sent" | "failed" | "skipped",
	errorMessage?: string,
): Promise<void> {
	try {
		await db
			.prepare(
				`INSERT INTO email_logs (tenant_id, recipient, subject, event_type, status, error_message, metadata)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				entry.tenantId,
				entry.recipient,
				entry.subject,
				entry.eventType,
				status,
				errorMessage ?? null,
				entry.metadata ? JSON.stringify(entry.metadata) : null,
			)
			.run();
	} catch (err) {
		console.error("[EMAIL LOG ERROR]", err);
	}
}

/** Send email and log the result in one call */
export async function sendAndLogEmail(
	db: D1Database,
	apiKey: string | undefined,
	fromAddress: string,
	params: EmailParams,
	logEntry: EmailLogEntry,
): Promise<boolean> {
	const result = await sendEmail(apiKey, fromAddress, params);
	const status = !apiKey ? "skipped" : result.ok ? "sent" : "failed";
	await logEmail(db, logEntry, status, result.error);
	return result.ok;
}

export function buildWelcomeEmail(params: {
	ownerName: string;
	businessName: string;
	slug: string;
	domain: string;
	tempPassword: string;
	plan: string;
	planLabel: string;
	priceCents: number;
	trialDays: number;
}): EmailParams {
	const url = `https://${params.slug}.${params.domain}`;
	const priceStr = (params.priceCents / 100).toFixed(2).replace(".", ",");

	return {
		to: "", // caller sets this
		subject: `Bem-vindo ao Giro Kids — ${params.businessName}`,
		html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #F97316, #EA580C); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 22px;">Bem-vindo, ${params.ownerName}!</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Seu sistema está pronto para uso</p>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Sua conta para <strong>${params.businessName}</strong> foi criada com sucesso.
      </p>

      <!-- Purchase Details -->
      <div style="background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 10px; font-size: 14px; font-weight: bold; color: #9A3412;">Detalhes da sua assinatura</p>
        <table style="width: 100%; font-size: 13px; color: #78350F;">
          <tr><td style="padding: 3px 0;">Plano:</td><td style="padding: 3px 0; text-align: right; font-weight: bold;">${params.planLabel}</td></tr>
          <tr><td style="padding: 3px 0;">Valor mensal:</td><td style="padding: 3px 0; text-align: right; font-weight: bold;">R$ ${priceStr}</td></tr>
          <tr><td style="padding: 3px 0;">Período de teste:</td><td style="padding: 3px 0; text-align: right; font-weight: bold;">${params.trialDays} dias grátis</td></tr>
        </table>
        <p style="margin: 10px 0 0; font-size: 11px; color: #B45309;">
          Você não será cobrado durante o período de teste.
        </p>
      </div>

      <!-- System URL -->
      <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #6B7280;">Seu endereço:</p>
        <a href="${url}" style="font-size: 18px; font-weight: bold; color: #F97316; text-decoration: none;">${params.slug}.${params.domain}</a>
      </div>

      <!-- Credentials -->
      <div style="background: #FEF3C7; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #92400E;">Suas credenciais de acesso:</p>
        <p style="margin: 0; font-size: 13px; color: #78350F;">
          <strong>Email:</strong> (o email em que você recebeu esta mensagem)<br>
          <strong>Senha temporária:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${params.tempPassword}</code>
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #B45309;">
          Troque sua senha após o primeiro acesso.
        </p>
      </div>

      <a href="${url}/login" style="display: block; background: #F97316; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Acessar meu sistema
      </a>
    </div>
    <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #9CA3AF;">Giro Kids — DADOS INTELIGENTES LTDA — CNPJ: 47.773.826/0001-57</p>
      <p style="margin: 0; font-size: 10px; color: #C0C4CC;"><a href="https://giro-kids.com/legal/terms" style="color:#C0C4CC">Termos</a> · <a href="https://giro-kids.com/legal/privacy" style="color:#C0C4CC">Privacidade</a> · <a href="https://giro-kids.com/legal/lgpd" style="color:#C0C4CC">LGPD</a></p>
    </div>
  </div>
</body>
</html>`,
	};
}

export function buildPresentationEmail(params: {
	contactName: string;
	companyName: string;
	domain: string;
	customMessage?: string;
}): EmailParams {
	const landingUrl = `https://${params.domain}/landing`;

	return {
		to: "",
		subject: `Giro Kids — Apresentação para ${params.companyName}`,
		html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #F97316, #EA580C); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 22px;">Giro Kids</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Sistema de Gestão para Locação de Brinquedos</p>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Olá, <strong>${params.contactName}</strong>!
      </p>
      ${params.customMessage ? `<p style="color: #333; font-size: 14px; line-height: 1.6;">${params.customMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>` : ""}
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Somos a <strong>Giro Kids</strong> e gostaríamos de apresentar nosso sistema de gestão para
        <strong>${params.companyName}</strong>. Ajudamos parques, shoppings e espaços de lazer a
        gerenciar suas locações de brinquedos de forma profissional.
      </p>

      <div style="background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: bold; color: #9A3412;">O que oferecemos:</p>
        <table style="width: 100%; font-size: 13px; color: #78350F;">
          <tr><td style="padding: 4px 0;">✓ Controle de locações em tempo real com cronômetro</td></tr>
          <tr><td style="padding: 4px 0;">✓ Gestão de caixa com múltiplas formas de pagamento</td></tr>
          <tr><td style="padding: 4px 0;">✓ Relatórios completos de faturamento e desempenho</td></tr>
          <tr><td style="padding: 4px 0;">✓ Cadastro de clientes com programa de fidelidade</td></tr>
          <tr><td style="padding: 4px 0;">✓ Metas de vendas com gamificação para equipe</td></tr>
          <tr><td style="padding: 4px 0;">✓ Sistema 100% na nuvem, sem instalação</td></tr>
        </table>
      </div>

      <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #6B7280;">Teste grátis por 30 dias</p>
        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #F97316;">Sem compromisso, sem cartão</p>
      </div>

      <a href="${landingUrl}#planos" style="display: block; background: #F97316; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Conhecer os planos
      </a>

      <p style="color: #666; font-size: 12px; line-height: 1.5; margin-top: 20px;">
        Ficou com alguma dúvida? Responda este email ou entre em contato pelo nosso WhatsApp.
        Teremos prazer em agendar uma demonstração personalizada.
      </p>
    </div>
    <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0 0 4px; font-size: 11px; color: #9CA3AF;">Giro Kids — DADOS INTELIGENTES LTDA — CNPJ: 47.773.826/0001-57</p>
      <p style="margin: 0; font-size: 10px; color: #C0C4CC;"><a href="https://giro-kids.com/legal/terms" style="color:#C0C4CC">Termos</a> · <a href="https://giro-kids.com/legal/privacy" style="color:#C0C4CC">Privacidade</a> · <a href="https://giro-kids.com/legal/lgpd" style="color:#C0C4CC">LGPD</a></p>
    </div>
  </div>
</body>
</html>`,
	};
}
