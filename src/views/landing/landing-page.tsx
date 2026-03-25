import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";

interface LandingPageProps {
	domain: string;
	stripePublishableKey: string;
}

export const LandingPage: FC<LandingPageProps> = ({ domain, stripePublishableKey }) => {
	const signupScript = html`<script>
${raw(`
var selectedPlan = 'pro';

function selectPlan(plan) {
	selectedPlan = plan;
	document.querySelectorAll('.plan-card').forEach(function(el) {
		el.classList.remove('ring-2', 'ring-sk-orange', 'border-sk-orange');
		el.classList.add('border-sk-border');
	});
	var card = document.getElementById('plan-' + plan);
	card.classList.add('ring-2', 'ring-sk-orange', 'border-sk-orange');
	card.classList.remove('border-sk-border');
}

var slugTimeout;
function checkSlug() {
	var slug = document.getElementById('slug').value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
	document.getElementById('slug').value = slug;
	var indicator = document.getElementById('slug-status');
	var preview = document.getElementById('slug-preview');
	preview.textContent = slug ? slug + '.${domain}' : '';

	if (slug.length < 3) {
		indicator.textContent = '';
		return;
	}

	clearTimeout(slugTimeout);
	indicator.textContent = 'Verificando...';
	indicator.className = 'text-xs text-sk-muted font-body';

	slugTimeout = setTimeout(function() {
		fetch('/api/signup/check-slug/' + encodeURIComponent(slug))
			.then(function(r) { return r.json(); })
			.then(function(data) {
				if (data.available) {
					indicator.textContent = 'Disponível!';
					indicator.className = 'text-xs text-sk-green font-display font-medium';
				} else {
					indicator.textContent = 'Indisponível';
					indicator.className = 'text-xs text-sk-danger font-display font-medium';
				}
			});
	}, 400);
}

function submitSignup(e) {
	e.preventDefault();
	var btn = document.getElementById('signup-btn');
	var errEl = document.getElementById('signup-error');
	btn.disabled = true;
	btn.textContent = 'Processando...';
	errEl.classList.add('hidden');

	var data = {
		slug: document.getElementById('slug').value.toLowerCase().trim(),
		businessName: document.getElementById('business-name').value.trim(),
		ownerName: document.getElementById('owner-name').value.trim(),
		ownerEmail: document.getElementById('owner-email').value.trim(),
		plan: selectedPlan
	};

	fetch('/api/signup/checkout', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok && res.data.checkoutUrl) {
			window.location.href = res.data.checkoutUrl;
		} else {
			errEl.textContent = res.data.error || 'Erro ao processar';
			errEl.classList.remove('hidden');
			btn.disabled = false;
			btn.textContent = 'Assinar e começar';
		}
	})
	.catch(function() {
		errEl.textContent = 'Erro de conexão';
		errEl.classList.remove('hidden');
		btn.disabled = false;
		btn.textContent = 'Assinar e começar';
	});
}

document.getElementById('signup-form').addEventListener('submit', submitSignup);
selectPlan('pro');

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
	a.addEventListener('click', function(e) {
		e.preventDefault();
		var target = document.querySelector(a.getAttribute('href'));
		if (target) target.scrollIntoView({ behavior: 'smooth' });
	});
});
`)}
</script>`;

	return (
		<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="theme-color" content="#FF7043" />
				<title>Giro Kids - Sistema de Gestão para Parques Infantis</title>
				<meta name="description" content="Plataforma completa para gestão de parques infantis, locadoras de brinquedos e espaços de diversão. Controle locações, caixa, estoque e clientes." />
				<link rel="icon" type="image/png" href="/logo-girokids.png" />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
				<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
				<script src="https://cdn.tailwindcss.com"></script>
				{html`
					<script>
					tailwind.config = {
						theme: {
							extend: {
								colors: {
									'sk-yellow':  { DEFAULT: '#FFC107', light: '#FFF8E1', dark: '#F9A825' },
									'sk-orange':  { DEFAULT: '#FF7043', light: '#FBE9E7', dark: '#BF360C' },
									'sk-blue':    { DEFAULT: '#0288D1', light: '#E1F5FE', dark: '#01579B' },
									'sk-green':   { DEFAULT: '#388E3C', light: '#E8F5E9', dark: '#1B5E20' },
									'sk-danger':  { DEFAULT: '#EF5350', light: '#FFEBEE' },
									'sk-purple':  { DEFAULT: '#AB47BC', light: '#F3E5F5' },
									'sk-bg':      '#FFF9F0',
									'sk-surface': '#FFFFFF',
									'sk-text':    '#3E2723',
									'sk-muted':   '#6D4C41',
									'sk-border':  '#FFCC80',
								},
								fontFamily: {
									'display': ['Fredoka', 'Baloo 2', 'sans-serif'],
									'body':    ['Quicksand', 'Poppins', 'sans-serif'],
								},
								borderRadius: {
									'sk':    '16px',
									'sk-lg': '24px',
									'sk-xl': '32px',
								},
								boxShadow: {
									'sk-sm': '0 2px 8px rgba(255,152,0,0.10)',
									'sk-md': '0 4px 16px rgba(255,152,0,0.12)',
									'sk-lg': '0 8px 32px rgba(255,152,0,0.15)',
									'sk-xl': '0 12px 48px rgba(255,152,0,0.18)',
								},
							},
						},
					}
					</script>
				`}
				{html`
					<style>
						@keyframes sk-float {
							0%, 100% { transform: translateY(0px); }
							50% { transform: translateY(-8px); }
						}
						.sk-float { animation: sk-float 3s ease-in-out infinite; }

						@keyframes sk-bounce {
							0%, 100% { transform: scale(1); }
							50% { transform: scale(0.92); }
						}
						.btn-bounce:active { animation: sk-bounce 0.15s ease-out; }

						@keyframes sk-wobble {
							0% { transform: rotate(0deg); }
							25% { transform: rotate(-1deg); }
							50% { transform: rotate(1deg); }
							75% { transform: rotate(-0.5deg); }
							100% { transform: rotate(0deg); }
						}
						.card-wobble:hover { animation: sk-wobble 0.4s ease-in-out; }

						@keyframes sk-fade-up {
							from { opacity: 0; transform: translateY(24px); }
							to { opacity: 1; transform: translateY(0); }
						}
						.animate-fade-up { animation: sk-fade-up 0.6s ease-out both; }

						@keyframes sk-scale-in {
							from { opacity: 0; transform: scale(0.9); }
							to { opacity: 1; transform: scale(1); }
						}
						.animate-scale-in { animation: sk-scale-in 0.5s ease-out both; }

						@keyframes sk-wave {
							0%, 100% { transform: rotate(0deg); }
							25% { transform: rotate(15deg); }
							75% { transform: rotate(-10deg); }
						}
						.animate-wave { animation: sk-wave 1.5s ease-in-out infinite; transform-origin: 70% 70%; }

						.plan-card { cursor: pointer; transition: all 0.25s ease; }
						.plan-card:hover { transform: translateY(-4px); }

						.wave-separator {
							width: 100%; height: 40px;
							background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 40'%3E%3Cpath fill='%23FFF9F0' d='M0,20 C360,40 720,0 1080,20 C1260,30 1380,25 1440,20 L1440,40 L0,40 Z'/%3E%3C/svg%3E") no-repeat center;
							background-size: cover;
							margin-top: -1px;
						}

						.btn-touch { min-height: 48px; min-width: 48px; }

						@media (prefers-reduced-motion: reduce) {
							.sk-float, .card-wobble:hover, .btn-bounce:active,
							.animate-fade-up, .animate-scale-in, .animate-wave {
								animation: none !important;
							}
						}

						/* Safelist for Tailwind CDN */
						.hidden.ring-2.ring-sk-orange.border-sk-orange.border-sk-border {}
					</style>
				`}
			</head>
			<body class="bg-sk-bg min-h-screen font-body text-sk-text">

				{/* ── Nav ── */}
				<nav class="bg-gradient-to-r from-sk-orange-dark to-sk-orange text-white shadow-lg sticky top-0 z-50">
					<div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
						<a href="#" class="flex items-center gap-2">
							<img src="/logo-girokids.png" alt="Giro Kids" class="h-10" />
						</a>
						<div class="flex items-center gap-4">
							<a href="#funcionalidades" class="hidden md:inline text-sm font-body text-white/90 hover:text-white">Funcionalidades</a>
							<a href="#planos" class="hidden md:inline text-sm font-body text-white/90 hover:text-white">Planos</a>
							<a href="#cadastro" class="btn-touch btn-bounce bg-white/20 hover:bg-white/30 px-5 py-2 rounded-sk text-sm font-display font-bold flex items-center">
								Começar agora
							</a>
						</div>
					</div>
				</nav>
				<div class="wave-separator"></div>

				{/* ── Hero ── */}
				<header class="relative overflow-hidden">
					{/* Floating decorations */}
					<span class="sk-float absolute top-8 left-[8%] text-5xl opacity-50 pointer-events-none select-none" style="animation-delay: 0s" aria-hidden="true">🎈</span>
					<span class="sk-float absolute top-16 right-[12%] text-4xl opacity-40 pointer-events-none select-none" style="animation-delay: 1s" aria-hidden="true">⭐</span>
					<span class="sk-float absolute bottom-12 left-[15%] text-4xl opacity-40 pointer-events-none select-none" style="animation-delay: 0.5s" aria-hidden="true">🏎️</span>
					<span class="sk-float absolute bottom-8 right-[10%] text-5xl opacity-50 pointer-events-none select-none" style="animation-delay: 1.5s" aria-hidden="true">🎠</span>
					<span class="sk-float absolute top-28 left-[45%] text-3xl opacity-30 pointer-events-none select-none" style="animation-delay: 2s" aria-hidden="true">🎮</span>

					<div class="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center relative z-10">
						<div class="animate-fade-up">
							<img src="/logo-girokids.png" alt="Giro Kids" class="h-24 mx-auto mb-6" />
							<h1 class="font-display font-bold text-4xl md:text-5xl lg:text-6xl text-sk-text mb-4 leading-tight">
								Gerencie seu parque infantil<br />
								<span class="text-sk-orange">com inteligência</span>
							</h1>
							<p class="font-body text-lg md:text-xl text-sk-muted mb-8 max-w-2xl mx-auto leading-relaxed">
								Controle locações, caixa, estoque e clientes em uma única plataforma.
								Pronto em minutos, sem instalação.
							</p>
						</div>
						<div class="animate-fade-up flex flex-col sm:flex-row gap-3 justify-center" style="animation-delay: 0.2s">
							<a href="#cadastro" class="btn-touch btn-bounce inline-flex items-center justify-center gap-2 bg-sk-orange hover:bg-sk-orange-dark text-white px-8 py-4 rounded-sk-lg font-display font-bold text-lg shadow-sk-lg active:shadow-sk-sm transition-shadow">
								Comece agora
								<span aria-hidden="true">→</span>
							</a>
							<a href="#funcionalidades" class="btn-touch btn-bounce inline-flex items-center justify-center gap-2 bg-sk-surface hover:bg-sk-yellow-light text-sk-text px-8 py-4 rounded-sk-lg font-display font-bold text-lg shadow-sk-sm border-2 border-sk-border transition-colors">
								Conhecer mais
							</a>
						</div>
					</div>
				</header>

				{/* ── Features ── */}
				<section id="funcionalidades" class="bg-sk-orange-light py-16 md:py-20">
					<div class="max-w-6xl mx-auto px-4">
						<div class="text-center mb-12">
							<h2 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
								Tudo que você precisa
							</h2>
							<p class="font-body text-sk-muted text-lg">Sistema completo para sua operação</p>
						</div>
						<div class="grid md:grid-cols-3 gap-6">
							{[
								{ emoji: "🏎️", title: "Locações em tempo real", desc: "Timer automático, pausa, retomada e cobrança de tempo extra. Acompanhe cada brinquedo no painel." },
								{ emoji: "💰", title: "Caixa completo", desc: "Abertura, fechamento, sangrias e suprimentos. PIX, cartão, dinheiro e pagamento misto." },
								{ emoji: "📊", title: "Relatórios detalhados", desc: "Faturamento, horários de pico, desempenho de operadores e análise de clientes." },
								{ emoji: "👥", title: "Gestão de clientes", desc: "Cadastro de responsáveis e crianças, histórico de visitas e programa de fidelidade." },
								{ emoji: "🔋", title: "Controle de baterias", desc: "Monitore carga, troca e autonomia de baterias dos seus equipamentos elétricos." },
								{ emoji: "🛍️", title: "Venda de produtos", desc: "Catálogo com fotos, vendas integradas ao caixa e controle de estoque." },
							].map((f, i) => (
								<div
									class="card-wobble bg-sk-surface rounded-sk-lg p-6 shadow-sk-sm border-2 border-sk-border/50 hover:shadow-sk-md transition-shadow animate-fade-up"
									style={`animation-delay: ${0.1 * i}s`}
								>
									<div class="sk-float text-4xl mb-3 inline-block" style={`animation-delay: ${0.3 * i}s`}>{f.emoji}</div>
									<h3 class="font-display font-bold text-lg text-sk-text mb-2">{f.title}</h3>
									<p class="font-body text-sm text-sk-muted leading-relaxed">{f.desc}</p>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* ── Extra highlights ── */}
				<section class="py-16 md:py-20">
					<div class="max-w-6xl mx-auto px-4">
						<div class="grid md:grid-cols-3 gap-8 text-center">
							<div class="animate-fade-up" style="animation-delay: 0.1s">
								<div class="bg-sk-yellow-light w-16 h-16 rounded-sk-lg flex items-center justify-center mx-auto mb-4 shadow-sk-sm">
									<span class="text-3xl">🎯</span>
								</div>
								<h3 class="font-display font-bold text-lg text-sk-text mb-1">Metas e gamificação</h3>
								<p class="font-body text-sm text-sk-muted">Defina metas de vendas para a equipe e celebre conquistas com animações.</p>
							</div>
							<div class="animate-fade-up" style="animation-delay: 0.2s">
								<div class="bg-sk-blue-light w-16 h-16 rounded-sk-lg flex items-center justify-center mx-auto mb-4 shadow-sk-sm">
									<span class="text-3xl">📱</span>
								</div>
								<h3 class="font-display font-bold text-lg text-sk-text mb-1">100% responsivo</h3>
								<p class="font-body text-sm text-sk-muted">Use no tablet, celular ou computador. Interface otimizada para toque.</p>
							</div>
							<div class="animate-fade-up" style="animation-delay: 0.3s">
								<div class="bg-sk-green-light w-16 h-16 rounded-sk-lg flex items-center justify-center mx-auto mb-4 shadow-sk-sm">
									<span class="text-3xl">☁️</span>
								</div>
								<h3 class="font-display font-bold text-lg text-sk-text mb-1">Na nuvem</h3>
								<p class="font-body text-sm text-sk-muted">Sem instalação, sem servidor. Seus dados seguros e acessíveis de qualquer lugar.</p>
							</div>
						</div>
					</div>
				</section>

				{/* ── Plans ── */}
				<section id="planos" class="bg-sk-orange-light py-16 md:py-20">
					<div class="max-w-6xl mx-auto px-4">
						<div class="text-center mb-12">
							<h2 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
								Escolha seu plano
							</h2>
							<p class="font-body text-sk-muted text-lg">Comece pequeno, cresça sem limites</p>
						</div>
						<div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
							{/* Starter */}
							<div id="plan-starter" class="plan-card card-wobble bg-sk-surface rounded-sk-lg p-6 shadow-sk-sm border-2 border-sk-border animate-scale-in" style="animation-delay: 0.1s" onclick="selectPlan('starter')">
								<div class="text-center mb-4">
									<span class="text-3xl" aria-hidden="true">🌱</span>
									<h3 class="font-display font-bold text-xl text-sk-text mt-2">Starter</h3>
									<p class="font-body text-sk-muted text-sm">Para quem está começando</p>
								</div>
								<div class="text-center mb-6">
									<span class="font-display font-bold text-4xl text-sk-text">R$ 97</span>
									<span class="font-body text-sk-muted text-sm">/mês</span>
								</div>
								<ul class="space-y-3 font-body text-sm text-sk-text">
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> 3 usuários</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> 15 brinquedos</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Locações e caixa</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Relatórios básicos</li>
								</ul>
							</div>

							{/* Pro */}
							<div id="plan-pro" class="plan-card card-wobble bg-sk-surface rounded-sk-lg p-6 shadow-sk-md border-2 ring-2 ring-sk-orange border-sk-orange relative animate-scale-in" style="animation-delay: 0.2s" onclick="selectPlan('pro')">
								<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-sk-orange text-white text-xs font-display font-bold px-4 py-1 rounded-sk shadow-sk-sm">
									Popular
								</span>
								<div class="text-center mb-4">
									<span class="text-3xl" aria-hidden="true">🚀</span>
									<h3 class="font-display font-bold text-xl text-sk-text mt-2">Pro</h3>
									<p class="font-body text-sk-muted text-sm">Para parques em crescimento</p>
								</div>
								<div class="text-center mb-6">
									<span class="font-display font-bold text-4xl text-sk-orange">R$ 197</span>
									<span class="font-body text-sk-muted text-sm">/mês</span>
								</div>
								<ul class="space-y-3 font-body text-sm text-sk-text">
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> 10 usuários</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> 50 brinquedos</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Todos os relatórios</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Logo e cores personalizadas</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Suporte por chat</li>
								</ul>
							</div>

							{/* Enterprise */}
							<div id="plan-enterprise" class="plan-card card-wobble bg-sk-surface rounded-sk-lg p-6 shadow-sk-sm border-2 border-sk-border animate-scale-in" style="animation-delay: 0.3s" onclick="selectPlan('enterprise')">
								<div class="text-center mb-4">
									<span class="text-3xl" aria-hidden="true">🏢</span>
									<h3 class="font-display font-bold text-xl text-sk-text mt-2">Enterprise</h3>
									<p class="font-body text-sk-muted text-sm">Para grandes operações</p>
								</div>
								<div class="text-center mb-6">
									<span class="font-display font-bold text-4xl text-sk-text">R$ 397</span>
									<span class="font-body text-sk-muted text-sm">/mês</span>
								</div>
								<ul class="space-y-3 font-body text-sm text-sk-text">
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Usuários ilimitados</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Brinquedos ilimitados</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Relatórios + exportação</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Suporte prioritário</li>
									<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> Backup sob demanda</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* ── Signup Form ── */}
				<section id="cadastro" class="py-16 md:py-20">
					<div class="max-w-lg mx-auto px-4">
						<div class="text-center mb-8">
							<span class="text-4xl mb-2 inline-block" aria-hidden="true">🎉</span>
							<h2 class="font-display font-bold text-3xl text-sk-text mb-2">Crie sua conta</h2>
							<p class="font-body text-sk-muted">Seu sistema estará pronto em minutos</p>
						</div>

						<div class="bg-sk-surface rounded-sk-xl shadow-sk-lg p-8 border-2 border-sk-border/50">
							<div id="signup-error" class="hidden mb-4 p-3 bg-sk-danger-light border border-sk-danger/30 text-sk-danger rounded-sk font-body text-sm"></div>

							<form id="signup-form" class="space-y-5">
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Nome do estabelecimento</label>
									<input id="business-name" type="text" required class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange text-base outline-none transition-colors" placeholder="Ex: AventuraPark" />
								</div>
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Endereço do seu sistema</label>
									<div class="flex items-center gap-2">
										<input id="slug" type="text" required oninput="checkSlug()" class="flex-1 px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange text-base outline-none transition-colors" placeholder="meu-parque" />
										<span class="font-body text-sk-muted text-sm whitespace-nowrap">.{domain}</span>
									</div>
									<div class="flex justify-between mt-1">
										<span id="slug-preview" class="text-xs text-sk-blue font-display font-medium"></span>
										<span id="slug-status" class="text-xs"></span>
									</div>
								</div>
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Seu nome</label>
									<input id="owner-name" type="text" required class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange text-base outline-none transition-colors" placeholder="Seu nome completo" />
								</div>
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Seu email</label>
									<input id="owner-email" type="email" required class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange text-base outline-none transition-colors" placeholder="seu@email.com" />
								</div>
								<button
									type="submit"
									id="signup-btn"
									class="btn-touch btn-bounce w-full py-4 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk-lg font-display font-bold text-lg shadow-sk-md active:shadow-sk-sm disabled:opacity-50 transition-all"
								>
									Assinar e começar
								</button>
								<p class="font-body text-xs text-sk-muted text-center">
									Ao assinar você concorda com nossos termos de uso. Cancele a qualquer momento.
								</p>
							</form>
						</div>
					</div>
				</section>

				{/* ── Footer ── */}
				<footer class="bg-gradient-to-r from-sk-orange-dark to-sk-orange text-white py-10">
					<div class="max-w-6xl mx-auto px-4 text-center">
						<div class="flex items-center justify-center gap-2 mb-3">
							<img src="/logo-girokids.png" alt="Giro Kids" class="h-10 brightness-0 invert" />
						</div>
						<p class="font-body text-white/80 text-sm mb-4">
							Sistema de gestão para parques infantis e espaços de diversão
						</p>
						<p class="font-body text-white/60 text-xs">
							&copy; {new Date().getFullYear()} Giro Kids. Todos os direitos reservados.
						</p>
					</div>
				</footer>

				{signupScript}
			</body>
		</html>
	);
};
