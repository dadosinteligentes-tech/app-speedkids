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
	planFeatures?: { hasLoyalty?: boolean };
}

interface NavItem {
	href: string;
	label: string;
	icon: string;
	roles: string[];
	featureKey?: string;
}

const NAV_ITEMS: NavItem[] = [
	{ href: "/admin/assets", label: "Ativos", icon: "🏎️", roles: ["manager", "owner"] },
	{ href: "/admin/packages", label: "Pacotes", icon: "📦", roles: ["manager", "owner"] },
	{ href: "/admin/customers", label: "Clientes", icon: "👥", roles: ["manager", "owner"] },
	{ href: "/admin/reports", label: "Relatórios", icon: "📊", roles: ["manager", "owner"] },
	{ href: "/admin/goals", label: "Metas", icon: "🎯", roles: ["manager", "owner"] },
	{ href: "/admin/promotions", label: "Promoções", icon: "🏷️", roles: ["manager", "owner"] },
	{ href: "/admin/loyalty", label: "Fidelidade", icon: "⭐", roles: ["manager", "owner"], featureKey: "hasLoyalty" },
	{ href: "/admin/batteries", label: "Baterias", icon: "🔋", roles: ["manager", "owner"] },
	{ href: "/admin/logs", label: "Logs", icon: "📋", roles: ["manager", "owner"] },
	{ href: "/admin/users", label: "Usuários", icon: "👤", roles: ["owner"] },
	{ href: "/admin/permissions", label: "Permissões", icon: "🔐", roles: ["owner"] },
	{ href: "/admin/documents", label: "Documentos", icon: "📄", roles: ["manager", "owner"] },
	{ href: "/admin/settings", label: "Configurações", icon: "⚙️", roles: ["owner"] },
	{ href: "/admin/plan", label: "Meu Plano", icon: "📋", roles: ["manager", "owner"] },
];

function filterItems(items: NavItem[], user: { role: string } | null, features?: { hasLoyalty?: boolean }): NavItem[] {
	return items.filter((item) => {
		if (!user || !item.roles.includes(user.role)) return false;
		if (item.featureKey && features) {
			return !!(features as any)[item.featureKey];
		}
		return true;
	});
}

export const AdminLayout: FC<PropsWithChildren<AdminLayoutProps>> = ({ title, user, activeTab, children, bodyScripts, tenant, isPlatformAdmin, planFeatures }) => {
	const visibleItems = filterItems(NAV_ITEMS, user ?? null, planFeatures);

	return (
		<Layout title={`${tenant?.name || "App"} - ${title}`} user={user} bodyScripts={bodyScripts} tenant={tenant} isPlatformAdmin={isPlatformAdmin}>
			<div class="mb-4">
				<a href="/" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar ao Dashboard</a>
			</div>
			<div class="flex flex-col md:flex-row gap-6">
				<nav class="md:w-48 flex-shrink-0">
					{/* Mobile: horizontal scroll tabs */}
					<div class="md:hidden bg-sk-surface rounded-sk shadow-sk-sm p-2 overflow-x-auto">
						<div class="flex gap-1 min-w-max">
							{visibleItems.map((item) => (
								<a
									href={item.href}
									class={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium font-body whitespace-nowrap transition-colors ${
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
					</div>
					{/* Desktop: vertical sidebar */}
					<div class="hidden md:flex flex-col bg-sk-surface rounded-sk shadow-sk-sm p-2 gap-1">
						{visibleItems.map((item) => (
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
};
