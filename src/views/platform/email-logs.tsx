import type { FC } from "hono/jsx";
import { PlatformLayout } from "./layout";
import { toBrazilDateTime } from "../../lib/timezone";

interface EmailLogRow {
	id: number;
	tenant_id: number | null;
	recipient: string;
	subject: string;
	event_type: string;
	status: string;
	error_message: string | null;
	metadata: string | null;
	created_at: string;
	tenant_name: string | null;
	tenant_slug: string | null;
}

interface Props {
	logs: EmailLogRow[];
	user: { name: string; email: string } | null;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
	sent: { bg: "bg-sk-green-light", text: "text-sk-green-dark", label: "Enviado" },
	failed: { bg: "bg-sk-danger-light", text: "text-sk-danger", label: "Falhou" },
	skipped: { bg: "bg-sk-bg", text: "text-sk-muted", label: "Pulado" },
};

const EVENT_LABELS: Record<string, string> = {
	welcome: "Boas-vindas",
	welcome_manual: "Boas-vindas (manual)",
	welcome_conversion: "Boas-vindas (conversão)",
	welcome_recovery: "Boas-vindas (recuperação)",
	payment_failed: "Falha no pagamento",
	subscription_cancelled: "Cancelamento",
	crm_presentation: "Apresentação CRM",
	admin_new_purchase: "Notif. nova compra",
	admin_plan_change: "Notif. mudança plano",
	admin_new_ticket: "Notif. novo ticket",
};

export const PlatformEmailLogs: FC<Props> = ({ logs, user }) => {
	const sentCount = logs.filter((l) => l.status === "sent").length;
	const failedCount = logs.filter((l) => l.status === "failed").length;

	return (
		<PlatformLayout
			title="Emails Enviados"
			user={user}
			breadcrumb={[{ label: "Dashboard", href: "/platform" }, { label: "Emails" }]}
		>
			{/* Summary */}
			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-muted font-display font-medium uppercase tracking-wider mb-1">Total</p>
					<p class="text-3xl font-bold font-display text-sk-text">{logs.length}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-green font-display font-medium uppercase tracking-wider mb-1">Enviados</p>
					<p class="text-3xl font-bold font-display text-sk-green-dark">{sentCount}</p>
				</div>
				<div class="bg-sk-surface rounded-sk p-5 shadow-sk-sm border-2 border-sk-border/50">
					<p class="text-xs text-sk-danger font-display font-medium uppercase tracking-wider mb-1">Falhas</p>
					<p class="text-3xl font-bold font-display text-sk-danger">{failedCount}</p>
				</div>
			</div>

			{/* Table */}
			<div class="bg-sk-surface rounded-sk shadow-sk-sm border-2 border-sk-border/50 overflow-hidden">
				<div class="px-6 py-4 border-b border-sk-border/30">
					<h2 class="font-semibold font-display text-sk-text">Registro de Emails</h2>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full text-sm font-body">
						<thead>
							<tr class="bg-sk-bg border-b border-sk-border/30 text-left text-xs text-sk-muted uppercase tracking-wider">
								<th class="px-5 py-3 font-medium font-display">Data</th>
								<th class="px-5 py-3 font-medium font-display">Tenant</th>
								<th class="px-5 py-3 font-medium font-display">Destinatário</th>
								<th class="px-5 py-3 font-medium font-display">Tipo</th>
								<th class="px-5 py-3 font-medium font-display">Assunto</th>
								<th class="px-5 py-3 font-medium font-display">Status</th>
								<th class="px-5 py-3 font-medium font-display">Erro</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{logs.map((log) => {
								const badge = STATUS_BADGE[log.status] || STATUS_BADGE.skipped;
								const eventLabel = EVENT_LABELS[log.event_type] || log.event_type;
								return (
									<tr class="hover:bg-sk-blue-light/30 transition-colors">
										<td class="px-5 py-3 text-sk-muted text-xs tabular-nums whitespace-nowrap">
											{log.created_at ? toBrazilDateTime(log.created_at) : "—"}
										</td>
										<td class="px-5 py-3">
											{log.tenant_id ? (
												<a href={`/platform/tenants/${log.tenant_id}`} class="font-medium font-display text-sk-text hover:text-sk-blue text-xs">
													{log.tenant_name || log.tenant_slug}
												</a>
											) : (
												<span class="text-xs text-sk-muted">&mdash;</span>
											)}
										</td>
										<td class="px-5 py-3 text-xs text-sk-text">{log.recipient}</td>
										<td class="px-5 py-3">
											<span class="bg-sk-blue-light text-sk-blue-dark px-2 py-0.5 rounded text-xs font-medium font-display">
												{eventLabel}
											</span>
										</td>
										<td class="px-5 py-3 text-xs text-sk-muted max-w-[200px] truncate">{log.subject}</td>
										<td class="px-5 py-3">
											<span class={`${badge.bg} ${badge.text} px-2 py-0.5 rounded text-xs font-medium font-display`}>
												{badge.label}
											</span>
										</td>
										<td class="px-5 py-3 text-xs text-sk-danger max-w-[150px] truncate" title={log.error_message || ""}>
											{log.error_message || ""}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{logs.length === 0 && (
						<div class="text-center py-12 text-sk-muted">
							<p class="text-sm font-body">Nenhum email registrado</p>
						</div>
					)}
				</div>
			</div>
		</PlatformLayout>
	);
};
