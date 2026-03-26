import type { FC } from "hono/jsx";

const COMPANY = {
	name: "DADOS INTELIGENTES LTDA",
	cnpj: "47.773.826/0001-57",
	address: "Av. dos Holandeses, n. 7, Edif. Metr. Market Place, Sala 507, CEP 65.071-380, Calhau, São Luís - MA",
	email: "contato@giro-kids.com",
	brand: "Giro Kids",
	domain: "giro-kids.com",
};

const LegalLayout: FC<{ title: string; children: any }> = ({ title, children }) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title} — Giro Kids</title>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
			<script src="https://cdn.tailwindcss.com"></script>
			<script dangerouslySetInnerHTML={{ __html: `tailwind.config={theme:{extend:{fontFamily:{display:['Fredoka','sans-serif'],body:['Quicksand','sans-serif']},colors:{'sk-orange':{DEFAULT:'#F97316',light:'#FFF7ED',dark:'#EA580C'},'sk-text':'#1E293B','sk-muted':'#94A3B8','sk-surface':'#FFFFFF','sk-bg':'#F8FAFC','sk-border':'#E2E8F0'}}}}` }} />
		</head>
		<body class="bg-sk-bg font-body text-sk-text">
			{/* Header */}
			<header class="bg-gradient-to-r from-sk-orange-dark to-sk-orange py-4">
				<div class="max-w-4xl mx-auto px-4 flex items-center justify-between">
					<a href="/landing" class="flex items-center gap-2">
						<img src="/logo-girokids.png" alt="Giro Kids" class="h-8 brightness-0 invert" />
					</a>
					<nav class="flex gap-4 text-sm text-white/80">
						<a href="/legal/terms" class="hover:text-white">Termos</a>
						<a href="/legal/privacy" class="hover:text-white">Privacidade</a>
						<a href="/legal/lgpd" class="hover:text-white">LGPD</a>
					</nav>
				</div>
			</header>

			{/* Content */}
			<main class="max-w-4xl mx-auto px-4 py-10">
				<h1 class="text-3xl font-display font-bold text-sk-text mb-8">{title}</h1>
				<div class="prose prose-sm max-w-none text-sk-text leading-relaxed space-y-4 font-body">
					{children}
				</div>
			</main>

			{/* Footer */}
			<footer class="bg-sk-text text-white/60 py-6 mt-10">
				<div class="max-w-4xl mx-auto px-4 text-center text-xs font-body space-y-1">
					<p class="font-display font-bold text-white/80">{COMPANY.name}</p>
					<p>CNPJ: {COMPANY.cnpj}</p>
					<p>{COMPANY.address}</p>
					<p>&copy; {new Date().getFullYear()} {COMPANY.brand}. Todos os direitos reservados.</p>
				</div>
			</footer>
		</body>
	</html>
);

// ── Termos de Uso ──
export const TermsPage: FC = () => (
	<LegalLayout title="Termos de Uso">
		<p><strong>Última atualização:</strong> 26 de março de 2026</p>

		<h2 class="text-xl font-display font-bold mt-6">1. Aceitação dos Termos</h2>
		<p>Ao acessar e utilizar a plataforma {COMPANY.brand} (disponível em {COMPANY.domain}), operada por {COMPANY.name}, inscrita no CNPJ {COMPANY.cnpj}, você concorda integralmente com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p>

		<h2 class="text-xl font-display font-bold mt-6">2. Descrição do Serviço</h2>
		<p>O {COMPANY.brand} é um sistema SaaS (Software as a Service) de gestão para parques infantis, espaços de diversão e locação de brinquedos. O serviço inclui:</p>
		<ul class="list-disc pl-6 space-y-1">
			<li>Controle de locações em tempo real</li>
			<li>Gestão de caixa e pagamentos</li>
			<li>Cadastro de clientes e programa de fidelidade</li>
			<li>Relatórios de faturamento e desempenho</li>
			<li>Metas de vendas com gamificação</li>
			<li>Suporte via sistema de tickets (conforme o plano contratado)</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">3. Cadastro e Conta</h2>
		<p>Para utilizar o serviço, o contratante deve fornecer informações verdadeiras, completas e atualizadas. O contratante é responsável pela confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>

		<h2 class="text-xl font-display font-bold mt-6">4. Planos e Pagamento</h2>
		<p>O {COMPANY.brand} oferece diferentes planos de assinatura com funcionalidades e limites distintos. O pagamento é recorrente (mensal) e processado via Stripe. O contratante pode alterar ou cancelar seu plano a qualquer momento pelo painel de administração.</p>
		<p>Em caso de inadimplência, o acesso ao sistema poderá ser suspenso após notificação por email.</p>

		<h2 class="text-xl font-display font-bold mt-6">5. Período de Teste (Trial)</h2>
		<p>Novos cadastros podem incluir um período de teste gratuito de 30 dias. Após o término, será necessário confirmar uma forma de pagamento para manter o acesso.</p>

		<h2 class="text-xl font-display font-bold mt-6">6. Propriedade Intelectual</h2>
		<p>Todo o conteúdo da plataforma, incluindo código-fonte, design, marcas e logotipos, é de propriedade exclusiva da {COMPANY.name}. É proibida a reprodução, modificação ou distribuição sem autorização expressa.</p>

		<h2 class="text-xl font-display font-bold mt-6">7. Responsabilidades do Contratante</h2>
		<ul class="list-disc pl-6 space-y-1">
			<li>Utilizar a plataforma de acordo com a legislação vigente</li>
			<li>Não realizar engenharia reversa, scraping ou acesso não autorizado</li>
			<li>Manter os dados de seus clientes de acordo com a LGPD</li>
			<li>Garantir que os usuários vinculados à conta sigam estes termos</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">8. Limitação de Responsabilidade</h2>
		<p>A {COMPANY.name} não se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma, incluindo perda de dados, lucros cessantes ou interrupção de negócios.</p>

		<h2 class="text-xl font-display font-bold mt-6">9. Disponibilidade</h2>
		<p>O serviço é fornecido "como está". Embora façamos nosso melhor para garantir disponibilidade contínua, não garantimos que o serviço será ininterrupto ou livre de erros.</p>

		<h2 class="text-xl font-display font-bold mt-6">10. Cancelamento e Encerramento</h2>
		<p>O contratante pode cancelar sua assinatura a qualquer momento. Após o cancelamento, os dados serão mantidos por 30 dias e, em seguida, poderão ser excluídos permanentemente.</p>

		<h2 class="text-xl font-display font-bold mt-6">11. Alterações nos Termos</h2>
		<p>Reservamo-nos o direito de alterar estes termos a qualquer momento, mediante notificação por email. O uso continuado da plataforma após a notificação implica aceitação das alterações.</p>

		<h2 class="text-xl font-display font-bold mt-6">12. Foro</h2>
		<p>Fica eleito o foro da Comarca de São Luís - MA para dirimir quaisquer litígios decorrentes destes termos, com renúncia de qualquer outro, por mais privilegiado que seja.</p>

		<h2 class="text-xl font-display font-bold mt-6">13. Contato</h2>
		<p>{COMPANY.name}<br />CNPJ: {COMPANY.cnpj}<br />{COMPANY.address}<br />Email: {COMPANY.email}</p>
	</LegalLayout>
);

// ── Política de Privacidade ──
export const PrivacyPage: FC = () => (
	<LegalLayout title="Política de Privacidade">
		<p><strong>Última atualização:</strong> 26 de março de 2026</p>

		<h2 class="text-xl font-display font-bold mt-6">1. Introdução</h2>
		<p>A {COMPANY.name} ("nós") está comprometida em proteger a privacidade dos usuários da plataforma {COMPANY.brand}. Esta política descreve como coletamos, usamos, armazenamos e protegemos seus dados pessoais.</p>

		<h2 class="text-xl font-display font-bold mt-6">2. Dados Coletados</h2>
		<p>Coletamos os seguintes tipos de dados:</p>
		<ul class="list-disc pl-6 space-y-1">
			<li><strong>Dados de cadastro:</strong> nome, email, telefone, CNPJ, endereço do estabelecimento</li>
			<li><strong>Dados de uso:</strong> logs de acesso, funcionalidades utilizadas, relatórios gerados</li>
			<li><strong>Dados de pagamento:</strong> processados diretamente pelo Stripe — não armazenamos dados de cartão</li>
			<li><strong>Dados de clientes finais:</strong> informações cadastradas pelo contratante sobre seus próprios clientes (nome, telefone, email)</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">3. Finalidade do Tratamento</h2>
		<ul class="list-disc pl-6 space-y-1">
			<li>Prestação do serviço contratado</li>
			<li>Comunicação sobre o serviço (cobranças, atualizações, suporte)</li>
			<li>Melhoria da plataforma com base em dados de uso agregados</li>
			<li>Cumprimento de obrigações legais e regulatórias</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">4. Compartilhamento de Dados</h2>
		<p>Não vendemos ou compartilhamos dados pessoais com terceiros, exceto:</p>
		<ul class="list-disc pl-6 space-y-1">
			<li><strong>Stripe:</strong> para processamento de pagamentos</li>
			<li><strong>Resend:</strong> para envio de emails transacionais</li>
			<li><strong>Cloudflare:</strong> para hospedagem e segurança da infraestrutura</li>
			<li><strong>Autoridades judiciais:</strong> quando exigido por lei ou ordem judicial</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">5. Armazenamento e Segurança</h2>
		<p>Os dados são armazenados em infraestrutura Cloudflare com criptografia em trânsito (TLS) e em repouso. Senhas são armazenadas usando hash PBKDF2-SHA256 com salt único por usuário.</p>

		<h2 class="text-xl font-display font-bold mt-6">6. Retenção de Dados</h2>
		<p>Os dados são mantidos enquanto a conta estiver ativa. Após cancelamento, os dados são retidos por 30 dias para possibilitar reativação, e então excluídos permanentemente.</p>

		<h2 class="text-xl font-display font-bold mt-6">7. Cookies</h2>
		<p>Utilizamos cookies essenciais para autenticação de sessão (cookie <code>sk_session</code>). Não utilizamos cookies de rastreamento ou publicidade.</p>

		<h2 class="text-xl font-display font-bold mt-6">8. Direitos do Titular</h2>
		<p>Conforme a LGPD, você tem direito a:</p>
		<ul class="list-disc pl-6 space-y-1">
			<li>Acessar, corrigir ou excluir seus dados pessoais</li>
			<li>Solicitar portabilidade dos dados</li>
			<li>Revogar consentimento a qualquer momento</li>
			<li>Solicitar informações sobre o compartilhamento de seus dados</li>
		</ul>
		<p>Para exercer seus direitos, entre em contato pelo email: {COMPANY.email}</p>

		<h2 class="text-xl font-display font-bold mt-6">9. Contato do Encarregado (DPO)</h2>
		<p>{COMPANY.name}<br />CNPJ: {COMPANY.cnpj}<br />{COMPANY.address}<br />Email: {COMPANY.email}</p>
	</LegalLayout>
);

// ── LGPD ──
export const LgpdPage: FC = () => (
	<LegalLayout title="LGPD — Lei Geral de Proteção de Dados">
		<p><strong>Última atualização:</strong> 26 de março de 2026</p>

		<h2 class="text-xl font-display font-bold mt-6">1. Compromisso com a LGPD</h2>
		<p>A {COMPANY.name} está em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais). Este documento complementa nossa Política de Privacidade com informações específicas sobre o tratamento de dados conforme a LGPD.</p>

		<h2 class="text-xl font-display font-bold mt-6">2. Papel das Partes</h2>
		<ul class="list-disc pl-6 space-y-1">
			<li><strong>Controlador:</strong> O contratante (parque/espaço de diversão) é o controlador dos dados pessoais de seus clientes finais cadastrados na plataforma.</li>
			<li><strong>Operador:</strong> A {COMPANY.name} atua como operador, processando dados pessoais em nome do contratante conforme as instruções do serviço contratado.</li>
			<li><strong>Controlador próprio:</strong> A {COMPANY.name} é controladora dos dados dos contratantes (nome, email, CNPJ, dados de pagamento).</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">3. Bases Legais para Tratamento</h2>
		<ul class="list-disc pl-6 space-y-1">
			<li><strong>Execução de contrato:</strong> dados necessários para prestação do serviço (Art. 7º, V)</li>
			<li><strong>Legítimo interesse:</strong> melhoria do serviço e comunicação (Art. 7º, IX)</li>
			<li><strong>Obrigação legal:</strong> dados exigidos por legislação fiscal e tributária (Art. 7º, II)</li>
			<li><strong>Consentimento:</strong> para comunicações de marketing, quando aplicável (Art. 7º, I)</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">4. Medidas de Segurança</h2>
		<ul class="list-disc pl-6 space-y-1">
			<li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
			<li>Hash de senhas com PBKDF2-SHA256 e salt único</li>
			<li>Isolamento de dados por tenant (multi-tenancy com separação lógica)</li>
			<li>Controle de acesso baseado em papéis (RBAC)</li>
			<li>Logs de auditoria para operações sensíveis</li>
			<li>Infraestrutura Cloudflare com proteção DDoS</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">5. Transferência Internacional de Dados</h2>
		<p>Os dados podem ser processados em servidores da Cloudflare localizados em diferentes países. A Cloudflare mantém cláusulas contratuais padrão e mecanismos de adequação conforme a LGPD (Art. 33).</p>

		<h2 class="text-xl font-display font-bold mt-6">6. Direitos dos Titulares</h2>
		<p>Garantimos o exercício dos seguintes direitos (Art. 18 da LGPD):</p>
		<ul class="list-disc pl-6 space-y-1">
			<li>Confirmação da existência de tratamento</li>
			<li>Acesso aos dados pessoais</li>
			<li>Correção de dados incompletos, inexatos ou desatualizados</li>
			<li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
			<li>Portabilidade dos dados</li>
			<li>Eliminação dos dados tratados com consentimento</li>
			<li>Informação sobre o compartilhamento de dados</li>
			<li>Revogação do consentimento</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">7. Incidentes de Segurança</h2>
		<p>Em caso de incidente de segurança envolvendo dados pessoais, notificaremos a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados conforme o Art. 48 da LGPD.</p>

		<h2 class="text-xl font-display font-bold mt-6">8. Responsabilidades do Contratante</h2>
		<p>Como controlador dos dados de seus clientes finais, o contratante deve:</p>
		<ul class="list-disc pl-6 space-y-1">
			<li>Garantir base legal para o tratamento dos dados</li>
			<li>Informar seus clientes sobre a coleta e uso de dados</li>
			<li>Atender solicitações de titulares referentes aos dados sob sua responsabilidade</li>
			<li>Não cadastrar dados sensíveis na plataforma sem base legal adequada</li>
		</ul>

		<h2 class="text-xl font-display font-bold mt-6">9. Encarregado de Proteção de Dados (DPO)</h2>
		<p><strong>{COMPANY.name}</strong><br />CNPJ: {COMPANY.cnpj}<br />{COMPANY.address}<br />Email: {COMPANY.email}</p>
	</LegalLayout>
);
