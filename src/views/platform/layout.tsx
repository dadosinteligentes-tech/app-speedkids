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
			<title>{title} — Dados Inteligentes</title>
			<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
			<script src="https://cdn.tailwindcss.com"></script>
			{html`<style>
				body { font-family: 'Inter', sans-serif; }
				.fade-in { animation: fadeIn 0.15s ease-out; }
				@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
				.toast { position: fixed; bottom: 24px; right: 24px; z-index: 100; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideUp 0.3s ease-out, fadeOut 0.3s ease-in 2.5s forwards; }
				@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } }
				@keyframes fadeOut { to { opacity: 0; } }
				.toast-success { background: #065f46; color: white; }
				.toast-error { background: #991b1b; color: white; }
			</style>`}
		</head>
		<body class="bg-gray-50 min-h-screen">
			{/* Navbar */}
			<nav class="bg-gray-900 text-white sticky top-0 z-50 shadow-md">
				<div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
					<div class="flex items-center gap-4">
						<a href="/platform" class="flex items-center gap-2 hover:opacity-90">
							<span class="font-bold text-lg tracking-tight">Dados Inteligentes</span>
						</a>
						<span class="text-[10px] bg-blue-500/80 px-2 py-0.5 rounded font-semibold uppercase tracking-wider">Admin</span>
					</div>
					<div class="flex items-center gap-4 text-sm">
						<a href="/platform" class="text-gray-300 hover:text-white transition-colors">Dashboard</a>
						<a href="/platform/reports" class="text-gray-300 hover:text-white transition-colors">Relatorios</a>
						<a href="/platform/superadmins" class="text-gray-300 hover:text-white transition-colors">Admins</a>
						<a href="/platform/plans" class="text-gray-300 hover:text-white transition-colors">Planos</a>
						<span class="text-gray-600">|</span>
						<a href="/" class="text-gray-300 hover:text-white transition-colors">App</a>
						<span class="text-gray-600">|</span>
						<span class="text-gray-400">{user?.email}</span>
						<button onclick="fetch('/api/auth/logout',{method:'POST'}).then(function(){location.href='/login'})" class="text-gray-400 hover:text-white transition-colors">Sair</button>
					</div>
				</div>
			</nav>

			<main class="max-w-7xl mx-auto px-6 py-6">
				{/* Breadcrumb + Title + Actions */}
				<div class="mb-6">
					{breadcrumb && breadcrumb.length > 0 && (
						<nav class="flex items-center gap-1 text-sm text-gray-400 mb-2">
							{breadcrumb.map((item, i) => (
								<>
									{i > 0 && <span class="mx-1">/</span>}
									{item.href
										? <a href={item.href} class="text-blue-500 hover:text-blue-600 transition-colors">{item.label}</a>
										: <span class="text-gray-600">{item.label}</span>
									}
								</>
							))}
						</nav>
					)}
					<div class="flex items-center justify-between flex-wrap gap-3">
						<h1 class="text-2xl font-bold text-gray-900">{title}</h1>
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
