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

export async function sendEmail(
	apiKey: string | undefined,
	fromAddress: string,
	params: EmailParams,
): Promise<boolean> {
	if (!apiKey) {
		console.log(`[EMAIL SKIP] To: ${params.to} | Subject: ${params.subject}`);
		console.log(`[EMAIL BODY] ${params.html.slice(0, 200)}...`);
		return false;
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
			return false;
		}

		return true;
	} catch (err) {
		console.error("[EMAIL ERROR]", err);
		return false;
	}
}

export function buildWelcomeEmail(params: {
	ownerName: string;
	businessName: string;
	slug: string;
	domain: string;
	tempPassword: string;
}): EmailParams {
	const url = `https://${params.slug}.${params.domain}`;

	return {
		to: "", // caller sets this
		subject: `Bem-vindo ao Dados Inteligentes — ${params.businessName}`,
		html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #2563EB, #4F46E5); padding: 30px; text-align: center; color: white;">
      <h1 style="margin: 0; font-size: 22px;">Bem-vindo, ${params.ownerName}!</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Seu sistema esta pronto para uso</p>
    </div>
    <div style="padding: 30px;">
      <p style="color: #333; font-size: 14px; line-height: 1.6;">
        Sua conta para <strong>${params.businessName}</strong> foi criada com sucesso.
        Acesse seu sistema pelo endereco abaixo:
      </p>
      <div style="background: #EEF2FF; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #6B7280;">Seu endereco:</p>
        <a href="${url}" style="font-size: 18px; font-weight: bold; color: #2563EB; text-decoration: none;">${params.slug}.${params.domain}</a>
      </div>
      <div style="background: #FEF3C7; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #92400E;">Suas credenciais de acesso:</p>
        <p style="margin: 0; font-size: 13px; color: #78350F;">
          <strong>Email:</strong> (o email em que voce recebeu esta mensagem)<br>
          <strong>Senha temporaria:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 14px;">${params.tempPassword}</code>
        </p>
        <p style="margin: 8px 0 0; font-size: 11px; color: #B45309;">
          Troque sua senha apos o primeiro acesso.
        </p>
      </div>
      <a href="${url}/login" style="display: block; background: #2563EB; color: white; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Acessar meu sistema
      </a>
    </div>
    <div style="padding: 20px; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0; font-size: 11px; color: #9CA3AF;">Dados Inteligentes — Sistema de Gestao para Parques de Diversao</p>
    </div>
  </div>
</body>
</html>`,
	};
}
