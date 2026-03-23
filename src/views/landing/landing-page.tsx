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
		el.classList.remove('ring-2', 'ring-blue-500');
	});
	document.getElementById('plan-' + plan).classList.add('ring-2', 'ring-blue-500');
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
	indicator.className = 'text-xs text-gray-500';

	slugTimeout = setTimeout(function() {
		fetch('/api/signup/check-slug/' + encodeURIComponent(slug))
			.then(function(r) { return r.json(); })
			.then(function(data) {
				if (data.available) {
					indicator.textContent = 'Disponivel!';
					indicator.className = 'text-xs text-green-600 font-medium';
				} else {
					indicator.textContent = 'Indisponivel';
					indicator.className = 'text-xs text-red-600 font-medium';
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
			btn.textContent = 'Assinar e comecar';
		}
	})
	.catch(function() {
		errEl.textContent = 'Erro de conexao';
		errEl.classList.remove('hidden');
		btn.disabled = false;
		btn.textContent = 'Assinar e comecar';
	});
}

document.getElementById('signup-form').addEventListener('submit', submitSignup);
selectPlan('pro');
`)}
</script>`;

	return (
		<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="theme-color" content="#2563EB" />
				<title>Dados Inteligentes - Sistema de Gestao para Parques de Diversao</title>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
				<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
				<script src="https://cdn.tailwindcss.com"></script>
				{html`<style>
					body { font-family: 'Inter', sans-serif; }
					.plan-card { cursor: pointer; transition: all 0.2s; }
					.plan-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
				</style>`}
			</head>
			<body class="bg-white text-gray-900">
				{/* Hero */}
				<header class="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
					<nav class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
						<span class="text-xl font-bold">Dados Inteligentes</span>
						<a href="#planos" class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium">Ver planos</a>
					</nav>
					<div class="max-w-6xl mx-auto px-6 py-20 text-center">
						<h1 class="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
							Gerencie seu parque de diversao<br />com inteligencia
						</h1>
						<p class="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
							Controle locacoes, caixa, estoque e clientes em uma unica plataforma.
							Pronto em minutos, sem instalacao.
						</p>
						<a href="#cadastro" class="inline-block bg-white text-blue-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 shadow-lg">
							Comece agora
						</a>
					</div>
				</header>

				{/* Features */}
				<section class="max-w-6xl mx-auto px-6 py-16">
					<h2 class="text-2xl font-bold text-center mb-10">Tudo que voce precisa</h2>
					<div class="grid md:grid-cols-3 gap-8">
						<div class="text-center p-6">
							<div class="text-4xl mb-3">🏎️</div>
							<h3 class="font-bold text-lg mb-2">Locacoes em tempo real</h3>
							<p class="text-gray-600 text-sm">Controle karts, bicicletas e brinquedos com timer automatico, pausa e cobranca por tempo extra.</p>
						</div>
						<div class="text-center p-6">
							<div class="text-4xl mb-3">💰</div>
							<h3 class="font-bold text-lg mb-2">Caixa completo</h3>
							<p class="text-gray-600 text-sm">Abertura, fechamento, sangrias, suprimentos e contagem de cedulas. PIX, cartao e dinheiro.</p>
						</div>
						<div class="text-center p-6">
							<div class="text-4xl mb-3">📊</div>
							<h3 class="font-bold text-lg mb-2">Relatorios detalhados</h3>
							<p class="text-gray-600 text-sm">Faturamento, horarios de pico, desempenho de operadores e analise de clientes.</p>
						</div>
						<div class="text-center p-6">
							<div class="text-4xl mb-3">👥</div>
							<h3 class="font-bold text-lg mb-2">Gestao de clientes</h3>
							<p class="text-gray-600 text-sm">Cadastro de responsaveis e criancas, historico de locacoes e programa de fidelidade.</p>
						</div>
						<div class="text-center p-6">
							<div class="text-4xl mb-3">🔋</div>
							<h3 class="font-bold text-lg mb-2">Controle de baterias</h3>
							<p class="text-gray-600 text-sm">Monitore carga, troca e autonomia de baterias dos seus equipamentos eletricos.</p>
						</div>
						<div class="text-center p-6">
							<div class="text-4xl mb-3">🛍️</div>
							<h3 class="font-bold text-lg mb-2">Venda de produtos</h3>
							<p class="text-gray-600 text-sm">Catalogo de produtos, fotos, vendas integradas ao caixa e relatorios de estoque.</p>
						</div>
					</div>
				</section>

				{/* Plans */}
				<section id="planos" class="bg-gray-50 py-16">
					<div class="max-w-6xl mx-auto px-6">
						<h2 class="text-2xl font-bold text-center mb-10">Planos</h2>
						<div class="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
							<div id="plan-starter" class="plan-card bg-white rounded-2xl p-6 shadow-sm border" onclick="selectPlan('starter')">
								<h3 class="font-bold text-lg mb-1">Starter</h3>
								<p class="text-3xl font-extrabold mb-1">R$ 97<span class="text-sm font-normal text-gray-500">/mes</span></p>
								<p class="text-gray-500 text-sm mb-4">Para quem esta comecando</p>
								<ul class="space-y-2 text-sm text-gray-700">
									<li>✓ 3 usuarios</li>
									<li>✓ 15 ativos</li>
									<li>✓ Locacoes e caixa</li>
									<li>✓ Relatorios basicos</li>
								</ul>
							</div>
							<div id="plan-pro" class="plan-card bg-white rounded-2xl p-6 shadow-sm border ring-2 ring-blue-500 relative" onclick="selectPlan('pro')">
								<span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">Popular</span>
								<h3 class="font-bold text-lg mb-1">Pro</h3>
								<p class="text-3xl font-extrabold mb-1">R$ 197<span class="text-sm font-normal text-gray-500">/mes</span></p>
								<p class="text-gray-500 text-sm mb-4">Para parques em crescimento</p>
								<ul class="space-y-2 text-sm text-gray-700">
									<li>✓ 10 usuarios</li>
									<li>✓ 50 ativos</li>
									<li>✓ Todos os relatorios</li>
									<li>✓ Logo e cores personalizadas</li>
									<li>✓ Suporte por chat</li>
								</ul>
							</div>
							<div id="plan-enterprise" class="plan-card bg-white rounded-2xl p-6 shadow-sm border" onclick="selectPlan('enterprise')">
								<h3 class="font-bold text-lg mb-1">Enterprise</h3>
								<p class="text-3xl font-extrabold mb-1">R$ 397<span class="text-sm font-normal text-gray-500">/mes</span></p>
								<p class="text-gray-500 text-sm mb-4">Para grandes operacoes</p>
								<ul class="space-y-2 text-sm text-gray-700">
									<li>✓ Usuarios ilimitados</li>
									<li>✓ Ativos ilimitados</li>
									<li>✓ Relatorios + export</li>
									<li>✓ Suporte prioritario</li>
									<li>✓ Backup sob demanda</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* Signup Form */}
				<section id="cadastro" class="py-16">
					<div class="max-w-lg mx-auto px-6">
						<h2 class="text-2xl font-bold text-center mb-2">Crie sua conta</h2>
						<p class="text-gray-500 text-center mb-8">Seu sistema estara pronto em minutos</p>

						<div id="signup-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"></div>

						<form id="signup-form" class="space-y-4">
							<div>
								<label class="block text-sm font-medium mb-1">Nome do estabelecimento</label>
								<input id="business-name" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="Ex: AventuraPark" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Endereco do seu sistema</label>
								<div class="flex items-center gap-2">
									<input id="slug" type="text" required oninput="checkSlug()" class="flex-1 px-4 py-3 border rounded-lg" placeholder="meu-parque" />
									<span class="text-gray-400 text-sm">.{domain}</span>
								</div>
								<div class="flex justify-between mt-1">
									<span id="slug-preview" class="text-xs text-blue-600 font-medium"></span>
									<span id="slug-status" class="text-xs"></span>
								</div>
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Seu nome</label>
								<input id="owner-name" type="text" required class="w-full px-4 py-3 border rounded-lg" placeholder="Seu nome completo" />
							</div>
							<div>
								<label class="block text-sm font-medium mb-1">Seu email</label>
								<input id="owner-email" type="email" required class="w-full px-4 py-3 border rounded-lg" placeholder="seu@email.com" />
							</div>
							<button
								type="submit"
								id="signup-btn"
								class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg disabled:opacity-50"
							>
								Assinar e comecar
							</button>
							<p class="text-xs text-gray-500 text-center">
								Ao assinar voce concorda com nossos termos de uso. Cancele a qualquer momento.
							</p>
						</form>
					</div>
				</section>

				{/* Footer */}
				<footer class="bg-gray-900 text-gray-400 py-8">
					<div class="max-w-6xl mx-auto px-6 text-center text-sm">
						<p>&copy; {new Date().getFullYear()} Dados Inteligentes. Todos os direitos reservados.</p>
					</div>
				</footer>

				{signupScript}
			</body>
		</html>
	);
};
