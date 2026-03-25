import type { FC, PropsWithChildren } from "hono/jsx";
import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { Tenant } from "../../db/schema";
import { Layout } from "../layout";

interface AdminLayoutProps {
	title: string;
	user: { name: string; role: string } | null;
	activeTab?: string;
	bodyScripts?: HtmlEscapedString | Promise<HtmlEscapedString>;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
}

const NAV_ITEMS = [
	{ href: "/admin/assets", label: "Ativos", icon: "🏎️", roles: ["manager", "owner"] },
	{ href: "/admin/packages", label: "Pacotes", icon: "📦", roles: ["manager", "owner"] },
	{ href: "/admin/customers", label: "Clientes", icon: "👥", roles: ["manager", "owner"] },
	{ href: "/admin/reports", label: "Relatórios", icon: "📊", roles: ["manager", "owner"] },
	{ href: "/admin/goals", label: "Metas", icon: "🎯", roles: ["manager", "owner"] },
	{ href: "/admin/promotions", label: "Promoções", icon: "🏷️", roles: ["manager", "owner"] },
	{ href: "/admin/batteries", label: "Baterias", icon: "🔋", roles: ["manager", "owner"] },
	{ href: "/admin/logs", label: "Logs", icon: "📋", roles: ["manager", "owner"] },
	{ href: "/admin/users", label: "Usuários", icon: "👤", roles: ["owner"] },
	{ href: "/admin/permissions", label: "Permissões", icon: "🔐", roles: ["owner"] },
	{ href: "/admin/settings", label: "Configurações", icon: "⚙️", roles: ["owner"] },
	{ href: "/admin/plan", label: "Meu Plano", icon: "📋", roles: ["manager", "owner"] },
];

export const AdminLayout: FC<PropsWithChildren<AdminLayoutProps>> = ({ title, user, activeTab, children, bodyScripts, tenant, isPlatformAdmin }) => (
	<Layout title={`${tenant?.name || "App"} - ${title}`} user={user} bodyScripts={bodyScripts} tenant={tenant} isPlatformAdmin={isPlatformAdmin}>
		<div class="mb-4">
			<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
		</div>
		<div class="flex flex-col md:flex-row gap-6">
			<nav class="md:w-48 flex-shrink-0">
				<div class="bg-sk-surface rounded-sk shadow-sk-sm p-2 flex md:flex-col gap-1">
					{NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)).map((item) => (
						<a
							href={item.href}
							class={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium font-body transition-colors ${
								activeTab === item.href
									? "bg-sk-orange-light text-sk-orange-dark"
									: "text-sk-muted hover:bg-sk-yellow-light"
							}`}
						>
							<span>{item.icon}</span>
							{item.label}
						</a>
					))}
				</div>
			</nav>
			<div class="flex-1 min-w-0">{children}</div>
		</div>
	</Layout>
);
