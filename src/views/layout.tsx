import type { FC, PropsWithChildren } from "hono/jsx";

interface LayoutProps {
	title?: string;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({ title, children }) => (
	<html lang="pt-BR">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>{title ?? "SpeedKids"}</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-gray-50 min-h-screen">
			<nav class="bg-white shadow">
				<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
					<a href="/" class="text-xl font-bold text-blue-600">SpeedKids</a>
				</div>
			</nav>
			<main class="max-w-4xl mx-auto px-4 py-8">{children}</main>
		</body>
	</html>
);
