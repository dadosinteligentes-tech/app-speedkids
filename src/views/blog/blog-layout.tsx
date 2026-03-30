import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";

interface BlogLayoutProps {
	title: string;
	description: string;
	canonical?: string;
	children: any;
}

export const BlogLayout: FC<BlogLayoutProps> = ({ title, description, canonical, children }) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="theme-color" content="#FF7043" />
			<title>{title} — Giro Kids Blog</title>
			<meta name="description" content={description} />
			{canonical && <link rel="canonical" href={canonical} />}
			<meta property="og:title" content={`${title} — Giro Kids`} />
			<meta property="og:description" content={description} />
			<meta property="og:type" content="article" />
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
							},
						},
					},
				}
				</script>
			`}
			{html`
				<style>
					.btn-touch { min-height: 48px; min-width: 48px; }
					@keyframes sk-bounce {
						0%, 100% { transform: scale(1); }
						50% { transform: scale(0.92); }
					}
					.btn-bounce:active { animation: sk-bounce 0.15s ease-out; }
				</style>
			`}
		</head>
		<body class="bg-sk-bg min-h-screen font-body text-sk-text">

			{/* Header */}
			<header class="bg-gradient-to-r from-sk-orange-dark to-sk-orange py-4 shadow-lg">
				<div class="max-w-4xl mx-auto px-4 flex items-center justify-between">
					<a href="/landing" class="flex items-center gap-2">
						<img src="/logo-girokids.png" alt="Giro Kids" class="h-8 brightness-0 invert" />
					</a>
					<nav class="flex items-center gap-4 text-sm">
						<a href="/blog" class="text-white/90 hover:text-white font-body">Blog</a>
						<a href="/landing/#planos" class="text-white/90 hover:text-white font-body hidden sm:inline">Planos</a>
						<a href="/landing/#cadastro" class="btn-touch btn-bounce bg-white/20 hover:bg-white/30 px-4 py-2 rounded-sk text-white font-display font-bold text-sm flex items-center">
							Teste grátis
						</a>
					</nav>
				</div>
			</header>

			{/* Content */}
			<main class="max-w-4xl mx-auto px-4 py-10">
				{children}
			</main>

			{/* Footer */}
			<footer class="bg-gradient-to-r from-sk-orange-dark to-sk-orange text-white py-10 mt-10">
				<div class="max-w-4xl mx-auto px-4 text-center">
					<div class="flex items-center justify-center gap-2 mb-3">
						<img src="/logo-girokids.png" alt="Giro Kids" class="h-10 brightness-0 invert" />
					</div>
					<p class="font-body text-white/80 text-sm mb-3">
						Sistema de gestão para parques infantis e espaços de diversão
					</p>
					<div class="flex items-center justify-center gap-4 mb-4 text-xs font-body">
						<a href="/blog" class="text-white/70 hover:text-white underline">Blog</a>
						<a href="/landing" class="text-white/70 hover:text-white underline">Início</a>
						<a href="/legal/terms" class="text-white/70 hover:text-white underline">Termos de Uso</a>
						<a href="/legal/privacy" class="text-white/70 hover:text-white underline">Privacidade</a>
					</div>
					<div class="font-body text-white/50 text-xs space-y-0.5">
						<p class="font-display font-medium text-white/60">DADOS INTELIGENTES LTDA</p>
						<p>CNPJ: 47.773.826/0001-57</p>
						<p>Av. dos Holandeses, n. 7, Edif. Metr. Market Place, Sala 507, CEP 65.071-380, Calhau, São Luís - MA</p>
						<p class="mt-2">&copy; {new Date().getFullYear()} Giro Kids. Todos os direitos reservados.</p>
					</div>
				</div>
			</footer>
		</body>
	</html>
);
