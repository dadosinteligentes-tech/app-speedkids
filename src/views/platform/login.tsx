import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";

export const PlatformLoginPage: FC = () => {
	const loginScript = html`<script>
${raw(`
document.getElementById('platform-login-form').addEventListener('submit', function(e) {
	e.preventDefault();
	var btn = document.getElementById('login-btn');
	var errEl = document.getElementById('login-error');
	btn.disabled = true;
	btn.textContent = 'Entrando...';
	errEl.classList.add('hidden');

	fetch('/api/auth/platform-login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: document.getElementById('email').value,
			password: document.getElementById('password').value
		})
	})
	.then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
	.then(function(res) {
		if (res.ok) {
			window.location.href = res.data.redirect || '/platform';
		} else {
			errEl.textContent = res.data.error || 'Erro ao fazer login';
			errEl.classList.remove('hidden');
			btn.disabled = false;
			btn.textContent = 'Entrar';
		}
	})
	.catch(function() {
		errEl.textContent = 'Erro de conexão. Tente novamente.';
		errEl.classList.remove('hidden');
		btn.disabled = false;
		btn.textContent = 'Entrar';
	});
});
`)}
</script>`;

	return (
		<html lang="pt-BR">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="theme-color" content="#01579B" />
				<title>Giro Kids - Painel Administrativo</title>
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
							50% { transform: translateY(-6px); }
						}
						.sk-float { animation: sk-float 3s ease-in-out infinite; }
						@keyframes sk-bounce {
							0%, 100% { transform: scale(1); }
							50% { transform: scale(0.92); }
						}
						.btn-bounce:active { animation: sk-bounce 0.15s ease-out; }
						.btn-touch { min-height: 48px; min-width: 48px; }
						@media (prefers-reduced-motion: reduce) {
							.sk-float, .btn-bounce:active { animation: none !important; }
						}
					</style>
				`}
			</head>
			<body class="bg-sk-blue-dark min-h-screen font-body text-sk-text flex items-center justify-center">
				<div class="w-full max-w-sm px-4">
					<div class="text-center mb-8">
						<img src="/logo-girokids.png" alt="Giro Kids" class="h-16 mx-auto mb-4" />
						<div class="inline-flex items-center gap-2 bg-sk-blue/20 text-white px-4 py-1.5 rounded-sk text-sm font-display font-medium">
							<span class="w-2 h-2 rounded-full bg-sk-green"></span>
							Painel Administrativo
						</div>
					</div>

					<div class="bg-sk-surface rounded-sk-xl shadow-sk-xl p-8">
						<div id="login-error" class="hidden mb-4 p-3 bg-sk-danger-light border border-sk-danger/30 text-sk-danger rounded-sk font-body text-sm"></div>

						<form id="platform-login-form" class="space-y-4">
							<div>
								<label for="email" class="block text-sm font-display font-medium text-sk-text mb-1">
									Email
								</label>
								<input
									type="email"
									id="email"
									name="email"
									required
									autocomplete="email"
									class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base outline-none transition-colors"
									placeholder="admin@giro-kids.com"
								/>
							</div>

							<div>
								<label for="password" class="block text-sm font-display font-medium text-sk-text mb-1">
									Senha
								</label>
								<input
									type="password"
									id="password"
									name="password"
									required
									autocomplete="current-password"
									class="w-full px-4 py-3 border-2 border-sk-border rounded-sk font-body focus:ring-2 focus:ring-sk-blue/30 focus:border-sk-blue text-base outline-none transition-colors"
									placeholder="Sua senha"
								/>
							</div>

							<button
								type="submit"
								id="login-btn"
								class="btn-touch btn-bounce w-full py-3 bg-sk-blue hover:bg-sk-blue-dark text-white rounded-sk font-display font-bold text-lg shadow-sk-sm disabled:opacity-50 transition-colors"
							>
								Entrar
							</button>
						</form>
					</div>

					<div class="text-center mt-6">
						<a href="/landing" class="text-white/60 hover:text-white/80 text-sm font-body transition-colors">
							← Voltar ao site
						</a>
					</div>
				</div>

				{loginScript}
			</body>
		</html>
	);
};
