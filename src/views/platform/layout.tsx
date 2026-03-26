import type { FC, PropsWithChildren } from "hono/jsx";
import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

interface PlatformLayoutProps {
	title: string;
	user?: { name: string; email: string } | null;
	breadcrumb?: { label: string; href?: string }[];
	actions?: HtmlEscapedString | Promise<HtmlEscapedString>;
	bodyScripts?: HtmlEscapedString | Promise<HtmlEscapedString>;
}

export const PlatformLayout: FC<PropsWithChildren<PlatformLayoutProps>> = ({
	title, user, breadcrumb, actions, bodyScripts, children,
}) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="theme-color" content="#01579B" />
			<title>{title} — Giro Kids Admin</title>
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
			{html`<style>
				@keyframes sk-fade-in {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.fade-in { animation: sk-fade-in 0.2s ease-out; }

				@keyframes sk-bounce {
					0%, 100% { transform: scale(1); }
					50% { transform: scale(0.92); }
				}
				.btn-bounce:active { animation: sk-bounce 0.15s ease-out; }
				.btn-touch { min-height: 48px; min-width: 48px; }

				.wave-separator {
					width: 100%; height: 40px;
					background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 40'%3E%3Cpath fill='%23FFF9F0' d='M0,20 C360,40 720,0 1080,20 C1260,30 1380,25 1440,20 L1440,40 L0,40 Z'/%3E%3C/svg%3E") no-repeat center;
					background-size: cover;
					margin-top: -1px;
				}

				.toast {
					position: fixed; bottom: 24px; right: 24px; z-index: 100;
					padding: 12px 20px; border-radius: 16px; font-size: 14px; font-weight: 600;
					font-family: 'Quicksand', sans-serif;
					box-shadow: 0 8px 32px rgba(0,0,0,0.15);
					animation: slideUp 0.3s ease-out, fadeOut 0.3s ease-in 2.5s forwards;
				}
				@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } }
				@keyframes fadeOut { to { opacity: 0; } }
				.toast-success { background: #388E3C; color: white; }
				.toast-error { background: #EF5350; color: white; }

				@media (prefers-reduced-motion: reduce) {
					.fade-in, .btn-bounce:active, .toast { animation: none !important; }
				}
			</style>`}
		</head>
		<body class="bg-sk-bg min-h-screen font-body text-sk-text">
			{/* Navbar */}
			<nav class="bg-gradient-to-r from-sk-blue-dark to-sk-blue text-white sticky top-0 z-50 shadow-lg">
				<div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<a href="/platform" class="flex items-center gap-2 hover:opacity-90">
							<img src="/logo-girokids.png" alt="Giro Kids" class="h-9" />
						</a>
						<span class="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-sk text-white font-display font-bold uppercase tracking-wider">Admin</span>
					</div>
					<div class="flex items-center gap-4 text-sm font-body">
						<a href="/platform" class="text-white/80 hover:text-white transition-colors">Dashboard</a>
						<a href="/platform/reports" class="text-white/80 hover:text-white transition-colors">Relatórios</a>
						<a href="/platform/users" class="text-white/80 hover:text-white transition-colors">Usuários</a>
						<a href="/platform/subscriptions" class="text-white/80 hover:text-white transition-colors">Assinaturas</a>
						<a href="/platform/emails" class="text-white/80 hover:text-white transition-colors">Emails</a>
						<a href="/platform/superadmins" class="text-white/80 hover:text-white transition-colors">Admins</a>
						<a href="/platform/plans" class="text-white/80 hover:text-white transition-colors">Planos</a>
						<span class="text-white/30">|</span>
						<span class="text-white/60">{user?.email}</span>
						<button onclick="fetch('/api/auth/logout',{method:'POST'}).then(function(){location.href='/platform/login'})" class="text-white/60 hover:text-white transition-colors underline">Sair</button>
					</div>
				</div>
			</nav>
			<div class="wave-separator"></div>

			<main class="max-w-7xl mx-auto px-4 py-6">
				{/* Breadcrumb + Title + Actions */}
				<div class="mb-6">
					{breadcrumb && breadcrumb.length > 0 && (
						<nav class="flex items-center gap-1 text-sm text-sk-muted mb-2 font-body">
							{breadcrumb.map((item, i) => (
								<>
									{i > 0 && <span class="mx-1 text-sk-border">/</span>}
									{item.href
										? <a href={item.href} class="text-sk-blue hover:text-sk-blue-dark transition-colors">{item.label}</a>
										: <span class="text-sk-muted">{item.label}</span>
									}
								</>
							))}
						</nav>
					)}
					<div class="flex items-center justify-between flex-wrap gap-3">
						<h1 class="text-2xl font-display font-bold text-sk-text">{title}</h1>
						{actions}
					</div>
				</div>

				{/* Content */}
				<div class="fade-in">
					{children}
				</div>
			</main>

			{/* Toast helper */}
			{html`<script>
				function showToast(msg, type) {
					var el = document.createElement('div');
					el.className = 'toast toast-' + (type || 'success');
					el.textContent = msg;
					document.body.appendChild(el);
					setTimeout(function() { el.remove(); }, 3000);
				}
			</script>`}

			{bodyScripts ?? ""}
		</body>
	</html>
);
