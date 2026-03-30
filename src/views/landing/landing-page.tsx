import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { PlanConfig } from "../../db/queries/platform";

interface LandingPageProps {
	domain: string;
	stripePublishableKey: string;
	plans: Record<string, PlanConfig>;
}

export const LandingPage: FC<LandingPageProps> = ({ domain, stripePublishableKey, plans }) => {
	const signupScript = html`<script>
${raw(`
var selectedPlan = 'pro';
var planLabels = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };

function choosePlan(plan) {
	selectedPlan = plan;
	document.getElementById('selected-plan').value = plan;
	var label = document.getElementById('plan-label');
	if (label) label.textContent = 'Plano selecionado: ' + planLabels[plan];
	document.querySelector('#cadastro').scrollIntoView({ behavior: 'smooth' });
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
		plan: document.getElementById('selected-plan').value || 'pro'
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

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
	a.addEventListener('click', function(e) {
		e.preventDefault();
		var target = document.querySelector(a.getAttribute('href'));
		if (target) target.scrollIntoView({ behavior: 'smooth' });
	});
});

// Revenue calculator
function calcRevenue() {
	var price = parseFloat(document.getElementById('calc-price').value) || 0;
	var rentals = parseInt(document.getElementById('calc-rentals').value) || 0;
	var extraMinutes = 3; // average extra minutes not charged
	var avgDuration = 10; // average rental duration
	var lossPerRental = price * (extraMinutes / avgDuration);
	var monthlyLoss = Math.round(lossPerRental * rentals * 30);
	document.getElementById('calc-value').textContent = 'R$ ' + monthlyLoss.toLocaleString('pt-BR');
}

// Billing toggle (monthly/annual)
var isAnnual = false;
function toggleBilling() {
	isAnnual = !isAnnual;
	var dot = document.getElementById('billing-dot');
	var toggle = document.getElementById('billing-toggle');
	var labelM = document.getElementById('label-monthly');
	var labelA = document.getElementById('label-annual');
	if (isAnnual) {
		dot.style.transform = 'translateX(28px)';
		toggle.style.background = '#388E3C';
		labelM.className = 'font-body text-sm text-sk-muted';
		labelA.className = 'font-body text-sm font-medium text-sk-text';
	} else {
		dot.style.transform = 'translateX(0)';
		toggle.style.background = '';
		labelM.className = 'font-body text-sm font-medium text-sk-text';
		labelA.className = 'font-body text-sm text-sk-muted';
	}
	// Update price displays
	document.querySelectorAll('[data-price-monthly]').forEach(function(el) {
		var monthly = el.getAttribute('data-price-monthly');
		var annual = el.getAttribute('data-price-annual');
		el.textContent = isAnnual ? annual : monthly;
	});
	document.querySelectorAll('[data-period]').forEach(function(el) {
		el.textContent = isAnnual ? '/ano' : '/mês';
	});
	// Update savings badge visibility
	document.querySelectorAll('[data-savings]').forEach(function(el) {
		el.style.display = isAnnual ? 'block' : 'none';
	});
}

// Override choosePlan to include billing cycle
var _origChoosePlan = choosePlan;
choosePlan = function(plan) {
	var fullPlan = isAnnual ? plan + '-annual' : plan;
	selectedPlan = fullPlan;
	document.getElementById('selected-plan').value = fullPlan;
	var suffix = isAnnual ? ' (Anual)' : '';
	var label = document.getElementById('plan-label');
	if (label) label.textContent = 'Plano selecionado: ' + planLabels[plan] + suffix;
	document.querySelector('#cadastro').scrollIntoView({ behavior: 'smooth' });
};

// Reset balloon animation on click outside
document.addEventListener('click', function(e) {
	if (!e.target.closest('.feature-card-wrap')) {
		document.querySelectorAll('.feature-card-wrap.active').forEach(function(el) {
			el.classList.remove('active');
		});
	}
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

						/* Feature card with floating party balloons */
						.feature-card-wrap {
							position: relative;
							overflow: visible;
							cursor: pointer;
						}
						.feature-card-wrap:hover > .feature-inner,
						.feature-card-wrap.active > .feature-inner {
							border-color: #FF7043;
							box-shadow: 0 4px 16px rgba(255,152,0,0.15);
							transform: translateY(-2px);
						}
						.feature-inner {
							transition: all 0.3s ease;
							position: relative;
							z-index: 1;
						}

						/* Party balloon base */
						.party-balloon {
							position: absolute;
							bottom: 50%;
							width: 32px;
							height: 40px;
							border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
							opacity: 0;
							pointer-events: none;
							z-index: 0;
							filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
						}
						/* Balloon knot + string */
						.party-balloon::before {
							content: '';
							position: absolute;
							bottom: -4px;
							left: 50%;
							transform: translateX(-50%);
							width: 0; height: 0;
							border-left: 5px solid transparent;
							border-right: 5px solid transparent;
							border-top: 6px solid inherit;
							border-top-color: inherit;
						}
						.party-balloon::after {
							content: '';
							position: absolute;
							bottom: -38px;
							left: 50%;
							width: 1.5px;
							height: 34px;
							background: rgba(0,0,0,0.15);
							transform-origin: top center;
						}
						/* Shine on balloon */
						.party-balloon span {
							position: absolute;
							top: 8px;
							left: 9px;
							width: 8px;
							height: 10px;
							background: rgba(255,255,255,0.45);
							border-radius: 50%;
							transform: rotate(-30deg);
						}

						@keyframes balloon-rise {
							0% {
								opacity: 0;
								transform: translateY(0) scale(0.3) rotate(0deg);
							}
							15% {
								opacity: 1;
								transform: translateY(-20px) scale(1) rotate(-5deg);
							}
							50% {
								transform: translateY(-80px) scale(1) rotate(5deg);
							}
							85% {
								opacity: 1;
								transform: translateY(-140px) scale(0.95) rotate(-3deg);
							}
							100% {
								opacity: 0;
								transform: translateY(-180px) scale(0.9) rotate(5deg);
							}
						}

						.feature-card-wrap:hover .party-balloon,
						.feature-card-wrap.active .party-balloon {
							animation: balloon-rise 1.8s ease-out forwards;
						}
						/* Stagger each balloon */
						.party-balloon:nth-child(1) { left: 15%; animation-delay: 0s; background: #FF7043; }
						.party-balloon:nth-child(1)::before { border-top-color: #FF7043; }
						.party-balloon:nth-child(2) { left: 40%; animation-delay: 0.15s; background: #FFC107; }
						.party-balloon:nth-child(2)::before { border-top-color: #FFC107; }
						.party-balloon:nth-child(3) { left: 65%; animation-delay: 0.3s; background: #0288D1; }
						.party-balloon:nth-child(3)::before { border-top-color: #0288D1; }
						.party-balloon:nth-child(4) { left: 85%; animation-delay: 0.1s; background: #388E3C; }
						.party-balloon:nth-child(4)::before { border-top-color: #388E3C; }
						.party-balloon:nth-child(5) { left: 5%; animation-delay: 0.25s; background: #AB47BC; }
						.party-balloon:nth-child(5)::before { border-top-color: #AB47BC; }

						.feature-card-wrap:hover .party-balloon:nth-child(2),
						.feature-card-wrap.active .party-balloon:nth-child(2) { animation-delay: 0.15s; }
						.feature-card-wrap:hover .party-balloon:nth-child(3),
						.feature-card-wrap.active .party-balloon:nth-child(3) { animation-delay: 0.3s; }
						.feature-card-wrap:hover .party-balloon:nth-child(4),
						.feature-card-wrap.active .party-balloon:nth-child(4) { animation-delay: 0.1s; }
						.feature-card-wrap:hover .party-balloon:nth-child(5),
						.feature-card-wrap.active .party-balloon:nth-child(5) { animation-delay: 0.25s; }

						@keyframes sk-fade-up {
							from { opacity: 0; transform: translateY(24px); }
							to { opacity: 1; transform: translateY(0); }
						}
						.animate-fade-up { animation: sk-fade-up 0.6s ease-out both; }

						@keyframes sk-wave {
							0%, 100% { transform: rotate(0deg); }
							25% { transform: rotate(15deg); }
							75% { transform: rotate(-10deg); }
						}
						.animate-wave { animation: sk-wave 1.5s ease-in-out infinite; transform-origin: 70% 70%; }

						.wave-separator {
							width: 100%; height: 40px;
							background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 40'%3E%3Cpath fill='%23FFF9F0' d='M0,20 C360,40 720,0 1080,20 C1260,30 1380,25 1440,20 L1440,40 L0,40 Z'/%3E%3C/svg%3E") no-repeat center;
							background-size: cover;
							margin-top: -1px;
						}

						.btn-touch { min-height: 48px; min-width: 48px; }

						@media (prefers-reduced-motion: reduce) {
							.sk-float, .btn-bounce:active,
							.animate-fade-up, .animate-wave,
							.party-balloon {
								animation: none !important;
							}
						}

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
							<a href="/blog" class="hidden md:inline text-sm font-body text-white/90 hover:text-white">Blog</a>
							<a href="/apresentacao.html" target="_blank" class="hidden md:inline text-sm font-body text-white/90 hover:text-white">Apresentação</a>
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
								Pare de perder dinheiro<br />
								<span class="text-sk-orange">com tempo extra não cobrado</span>
							</h1>
							<p class="font-body text-lg md:text-xl text-sk-muted mb-8 max-w-2xl mx-auto leading-relaxed">
								O Giro Kids controla seus brinquedos, cobra automaticamente o tempo extra e mostra exatamente quanto você fatura. Teste grátis por 30 dias.
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

				{/* ── Pain Points ── */}
				<section class="py-16 md:py-20">
					<div class="max-w-4xl mx-auto px-4">
						<div class="text-center mb-10">
							<h2 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
								Você se identifica?
							</h2>
						</div>
						<div class="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
							{[
								"Uso o cronômetro do celular pra controlar o tempo e sempre perco a conta",
								"Não sei qual brinquedo dá mais lucro e qual só dá manutenção",
								"Meus funcionários dão tempo extra de graça e eu não tenho como controlar",
								"As baterias acabam no meio do giro e as crianças ficam chorando",
								"Não faço ideia de quanto faturo por dia, só vejo no final do mês",
								"Já tentei planilha, caderninho e WhatsApp — nada funciona direito",
							].map((pain, i) => (
								<div class="flex items-start gap-3 bg-sk-surface rounded-sk p-4 shadow-sk-sm border border-sk-border/50 animate-fade-up" style={`animation-delay: ${0.08 * i}s`}>
									<span class="text-sk-danger text-lg flex-shrink-0 mt-0.5">✕</span>
									<p class="font-body text-sm text-sk-text leading-relaxed">{pain}</p>
								</div>
							))}
						</div>
						<div class="text-center mt-10">
							<p class="font-display font-bold text-xl text-sk-orange">O Giro Kids resolve todos esses problemas.</p>
						</div>
					</div>
				</section>

				{/* ── Revenue Calculator ── */}
				<section class="bg-sk-orange-light py-16 md:py-20">
					<div class="max-w-2xl mx-auto px-4">
						<div class="text-center mb-8">
							<h2 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
								Quanto você perde por mês?
							</h2>
							<p class="font-body text-sk-muted text-lg">Descubra a receita que está escapando do seu parque</p>
						</div>
						<div class="bg-sk-surface rounded-sk-xl shadow-sk-lg p-6 md:p-8 border-2 border-sk-border/50">
							<div class="space-y-5">
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Quantos brinquedos você tem?</label>
									<input id="calc-toys" type="number" min="1" value="10" oninput="calcRevenue()" class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body text-base focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" />
								</div>
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Preço por locação (R$)</label>
									<input id="calc-price" type="number" min="1" value="20" oninput="calcRevenue()" class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body text-base focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" />
								</div>
								<div>
									<label class="block text-sm font-display font-medium text-sk-text mb-1">Locações por dia (média)</label>
									<input id="calc-rentals" type="number" min="1" value="30" oninput="calcRevenue()" class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body text-base focus:ring-2 focus:ring-sk-orange/30 focus:border-sk-orange outline-none" />
								</div>
							</div>
							<div id="calc-result" class="mt-6 bg-sk-danger-light border border-sk-danger/30 rounded-sk-lg p-5 text-center">
								<p class="font-body text-sm text-sk-text mb-1">Receita perdida estimada por mês:</p>
								<p class="font-display font-bold text-4xl text-sk-danger" id="calc-value">R$ 5.400</p>
								<p class="font-body text-xs text-sk-muted mt-2">Baseado em 3 minutos extras por locação não cobrados (média do mercado)</p>
							</div>
							<a href="#cadastro" class="btn-touch btn-bounce block w-full mt-5 py-4 bg-sk-orange hover:bg-sk-orange-dark text-white text-center rounded-sk-lg font-display font-bold text-lg shadow-sk-md">
								Quero recuperar essa receita
							</a>
						</div>
					</div>
				</section>

				{/* ── Video Demo ── */}
				<section class="py-16 md:py-20">
					<div class="max-w-4xl mx-auto px-4 text-center">
						<h2 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
							Veja o sistema funcionando
						</h2>
						<p class="font-body text-sk-muted text-lg mb-8">2 minutos para entender como o Giro Kids transforma seu parque</p>
						<div class="bg-sk-surface rounded-sk-xl shadow-sk-lg border-2 border-sk-border/50 overflow-hidden aspect-video flex items-center justify-center">
							<div class="text-center p-8">
								<span class="text-6xl mb-4 block">🎬</span>
								<p class="font-display font-bold text-xl text-sk-text mb-2">Video demo em breve</p>
								<p class="font-body text-sm text-sk-muted">Enquanto isso, teste o sistema gratuitamente por 30 dias</p>
								<a href="#cadastro" class="btn-touch btn-bounce inline-block mt-4 px-6 py-3 bg-sk-orange hover:bg-sk-orange-dark text-white rounded-sk font-display font-bold text-sm shadow-sk-sm">
									Experimentar grátis
								</a>
							</div>
						</div>
					</div>
				</section>

				{/* ── Social Proof ── */}
				<section class="bg-sk-orange-light py-12">
					<div class="max-w-4xl mx-auto px-4">
						<div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
							<div>
								<p class="font-display font-bold text-3xl text-sk-orange">100%</p>
								<p class="font-body text-sm text-sk-muted">Na nuvem</p>
							</div>
							<div>
								<p class="font-display font-bold text-3xl text-sk-orange">30 dias</p>
								<p class="font-body text-sm text-sk-muted">Grátis para testar</p>
							</div>
							<div>
								<p class="font-display font-bold text-3xl text-sk-orange">5 min</p>
								<p class="font-body text-sm text-sk-muted">Para configurar</p>
							</div>
							<div>
								<p class="font-display font-bold text-3xl text-sk-orange">12+</p>
								<p class="font-body text-sm text-sk-muted">Tipos de relatório</p>
							</div>
						</div>
					</div>
				</section>

				{/* ── Features ── */}
				<section id="funcionalidades" class="py-16 md:py-20">
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
									class="feature-card-wrap animate-fade-up"
									style={`animation-delay: ${0.1 * i}s`}
									onclick="this.classList.toggle('active')"
								>
									<div class="party-balloon"><span></span></div>
									<div class="party-balloon"><span></span></div>
									<div class="party-balloon"><span></span></div>
									<div class="party-balloon"><span></span></div>
									<div class="party-balloon"><span></span></div>
									<div class="feature-inner bg-sk-surface rounded-sk-lg p-6 shadow-sk-sm border-2 border-sk-border/50 cursor-pointer">
										<div class="sk-float text-4xl mb-3 inline-block" style={`animation-delay: ${0.3 * i}s`}>{f.emoji}</div>
										<h3 class="font-display font-bold text-lg text-sk-text mb-2">{f.title}</h3>
										<p class="font-body text-sm text-sk-muted leading-relaxed">{f.desc}</p>
									</div>
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
							<p class="font-body text-sk-muted text-lg mb-6">Comece pequeno, cresça sem limites</p>
							{/* Billing toggle */}
							<div class="flex items-center justify-center gap-3">
								<span id="label-monthly" class="font-body text-sm font-medium text-sk-text">Mensal</span>
								<button
									id="billing-toggle"
									onclick="toggleBilling()"
									class="relative w-14 h-7 bg-sk-border rounded-full transition-colors"
									aria-label="Alternar cobrança mensal/anual"
								>
									<span id="billing-dot" class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform"></span>
								</button>
								<span id="label-annual" class="font-body text-sm text-sk-muted">Anual <span class="text-sk-green font-display font-bold text-xs">2 meses grátis</span></span>
							</div>
						</div>
						<div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
							{(() => {
								const planMeta: Record<string, { icon: string; subtitle: string; highlight: boolean; btnClass: string; features: (cfg: { maxUsers: number; maxAssets: number; hasTickets?: boolean; hasLoyalty?: boolean }) => string[] }> = {
									starter: {
										icon: "🌱", subtitle: "Para quem está começando", highlight: false,
										btnClass: "bg-sk-yellow hover:bg-sk-yellow-dark text-sk-text",
										features: (c) => {
											const f = [`${c.maxUsers} usuários`, `${c.maxAssets} brinquedos`, "Locações e caixa", "Relatórios básicos", "Metas de vendas"];
											if (c.hasLoyalty) f.push("Programa de fidelidade");
											return f;
										},
									},
									pro: {
										icon: "🚀", subtitle: "Para parques em crescimento", highlight: true,
										btnClass: "bg-sk-orange hover:bg-sk-orange-dark text-white",
										features: (c) => {
											const f = [`${c.maxUsers} usuários`, `${c.maxAssets} brinquedos`, "Todos os relatórios"];
											if (c.hasLoyalty) f.push("Programa de fidelidade");
											f.push("Logo e cores personalizadas");
											if (c.hasTickets) f.push("Suporte por chat");
											return f;
										},
									},
									enterprise: {
										icon: "🏢", subtitle: "Para grandes operações", highlight: false,
										btnClass: "bg-sk-blue hover:bg-sk-blue-dark text-white",
										features: (c) => {
											const f = [
												c.maxUsers >= 999 ? "Usuários ilimitados" : `${c.maxUsers} usuários`,
												c.maxAssets >= 999 ? "Brinquedos ilimitados" : `${c.maxAssets} brinquedos`,
												"Relatórios + exportação",
											];
											if (c.hasLoyalty) f.push("Programa de fidelidade");
											if (c.hasTickets) f.push("Suporte prioritário");
											f.push("Backup sob demanda");
											return f;
										},
									},
								};
								const order = ["starter", "pro", "enterprise"];
								return order.map((key) => {
									const cfg = plans[key];
									const meta = planMeta[key];
									if (!cfg || !meta) return null;
									const fmtPrice = (cents: number) => {
										const r = Math.floor(cents / 100);
										const c = cents % 100;
										const rf = r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
										return c > 0 ? `R$ ${rf},${c.toString().padStart(2, "0")}` : `R$ ${rf}`;
									};
									const annualPrices: Record<string, number> = { starter: 97000, pro: 197000, enterprise: 297000 };
									const priceStr = fmtPrice(cfg.priceCents);
									const annualStr = fmtPrice(annualPrices[key] ?? cfg.priceCents * 10);
									const borderClass = meta.highlight
										? "shadow-sk-md border-2 ring-2 ring-sk-orange border-sk-orange relative"
										: "shadow-sk-sm border-2 border-sk-border";
									const priceColor = meta.highlight ? "text-sk-orange" : "text-sk-text";
									return (
										<div class={`bg-sk-surface rounded-sk-lg p-6 ${borderClass}`}>
											{meta.highlight && (
												<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-sk-orange text-white text-xs font-display font-bold px-4 py-1 rounded-sk shadow-sk-sm">
													Popular
												</span>
											)}
											<div class="text-center mb-4">
												<span class="text-3xl" aria-hidden="true">{meta.icon}</span>
												<h3 class="font-display font-bold text-xl text-sk-text mt-2">{cfg.label}</h3>
												<p class="font-body text-sk-muted text-sm">{meta.subtitle}</p>
											</div>
											<div class="text-center mb-6">
												<span class={`font-display font-bold text-4xl ${priceColor}`} data-price-monthly={priceStr} data-price-annual={annualStr}>{priceStr}</span>
												<span class="font-body text-sk-muted text-sm" data-period>/mês</span>
												<div class="text-sk-green font-display font-bold text-xs mt-1" data-savings style="display:none">Economia de 2 meses!</div>
											</div>
											<ul class="space-y-3 font-body text-sm text-sk-text mb-6">
												{meta.features(cfg).map((f) => (
													<li class="flex items-center gap-2"><span class="text-sk-green font-bold">✓</span> {f}</li>
												))}
											</ul>
											<button onclick={`choosePlan('${key}')`} class={`btn-touch btn-bounce block w-full py-3 text-center rounded-sk font-display font-bold text-base shadow-sk-sm transition-colors ${meta.btnClass}`}>
												30 dias grátis
											</button>
										</div>
									);
								});
							})()}
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
							<div id="plan-label" class="text-center mb-4 font-display font-bold text-sk-blue text-sm">Plano selecionado: Pro</div>
							<div id="signup-error" class="hidden mb-4 p-3 bg-sk-danger-light border border-sk-danger/30 text-sk-danger rounded-sk font-body text-sm"></div>

							<form id="signup-form" class="space-y-5">
								<input type="hidden" id="selected-plan" value="pro" />
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
									Começar 30 dias grátis
								</button>
								<p class="font-body text-xs text-sk-muted text-center">
									30 dias grátis para testar. Sem cobrança durante o período de avaliação. Cancele a qualquer momento.
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
						<p class="font-body text-white/80 text-sm mb-3">
							Sistema de gestão para parques infantis e espaços de diversão
						</p>
						<div class="flex items-center justify-center gap-4 mb-4 text-xs font-body">
							<a href="/apresentacao.html" target="_blank" class="text-white/70 hover:text-white underline">Apresentação</a>
							<a href="/blog" class="text-white/70 hover:text-white underline">Blog</a>
							<a href="/legal/terms" class="text-white/70 hover:text-white underline">Termos de Uso</a>
							<a href="/legal/privacy" class="text-white/70 hover:text-white underline">Privacidade</a>
							<a href="/legal/lgpd" class="text-white/70 hover:text-white underline">LGPD</a>
						</div>
						<div class="font-body text-white/50 text-xs space-y-0.5">
							<p class="font-display font-medium text-white/60">DADOS INTELIGENTES LTDA</p>
							<p>CNPJ: 47.773.826/0001-57</p>
							<p>Av. dos Holandeses, n. 7, Edif. Metr. Market Place, Sala 507, CEP 65.071-380, Calhau, São Luís - MA</p>
							<p class="mt-2">&copy; {new Date().getFullYear()} Giro Kids. Todos os direitos reservados.</p>
						</div>
					</div>
				</footer>

				{signupScript}
			</body>
		</html>
	);
};
