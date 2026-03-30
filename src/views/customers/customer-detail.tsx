import type { FC } from "hono/jsx";
import type { Customer, RentalSessionView, Tenant } from "../../db/schema";
import { AdminLayout } from "../admin/layout";
import { toBrazilDate, toBrazilDateTime } from "../../lib/timezone";

interface CustomerDetailProps {
	customer: Customer;
	sessions: RentalSessionView[];
	totalSessions: number;
	user: { name: string; role: string } | null;
	tenant?: Tenant | null;
	isPlatformAdmin?: boolean;
	planFeatures?: { hasLoyalty?: boolean; hasTickets?: boolean };
}

const STATUS_LABELS: Record<string, string> = {
	running: "Em uso",
	paused: "Pausado",
	completed: "Concluído",
	cancelled: "Cancelado",
};

export const CustomerDetail: FC<CustomerDetailProps> = ({ customer, sessions, totalSessions, user, tenant, isPlatformAdmin, planFeatures }) => (
	<AdminLayout title={`Cliente: ${customer.name}`} user={user} activeTab="/admin/customers" tenant={tenant} isPlatformAdmin={isPlatformAdmin} planFeatures={planFeatures}>
		<div class="mb-4">
			<a href="/admin/customers" class="text-sk-orange font-body text-sm hover:underline">&larr; Voltar para Clientes</a>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4">
				<h3 class="text-lg font-display font-bold text-sk-text mb-3">{customer.name}</h3>
				<div class="space-y-2 text-sm font-body">
					<div><span class="text-sk-muted">Telefone:</span> <span class="font-medium">{customer.phone ?? "-"}</span></div>
					{customer.cpf && <div><span class="text-sk-muted">CPF:</span> <span class="font-medium">{customer.cpf}</span></div>}
					<div><span class="text-sk-muted">Email:</span> <span class="font-medium">{customer.email ?? "-"}</span></div>
					{customer.instagram && <div><span class="text-sk-muted">Instagram:</span> <span class="font-medium">{customer.instagram}</span></div>}
					{customer.notes && <div><span class="text-sk-muted">Notas:</span> <span class="font-medium">{customer.notes}</span></div>}
					<div class="text-xs text-sk-muted pt-2">Cadastrado em {toBrazilDate(customer.created_at)}</div>
				</div>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
				<div class="text-3xl font-bold text-sk-blue font-display">{customer.total_rentals}</div>
				<div class="text-sm text-sk-muted font-body mt-1">Locações</div>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 text-center">
				<div class="text-3xl font-bold text-sk-green font-display">
					R$ {(customer.total_spent_cents / 100).toFixed(2).replace(".", ",")}
				</div>
				<div class="text-sm text-sk-muted font-body mt-1">Total Gasto</div>
			</div>
		</div>

		{/* Loyalty card */}
		<div class="bg-sk-surface rounded-sk shadow-sk-sm p-4 mb-6">
			<div class="flex items-center justify-between mb-2">
				<h3 class="font-display font-bold text-sk-text">Programa de Fidelidade</h3>
				{customer.email_verified ? (
					<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-green-light text-sk-green-dark">Email verificado</span>
				) : (
					<span class="px-2 py-0.5 rounded text-xs font-medium font-display bg-sk-yellow-light text-sk-yellow-dark">Email não verificado</span>
				)}
			</div>
			<div class="flex items-center gap-6">
				<div>
					<span class="text-2xl font-display font-bold text-sk-orange">{customer.loyalty_points.toLocaleString("pt-BR")}</span>
					<span class="text-sm text-sk-muted font-body ml-1">pontos</span>
				</div>
				{!customer.email_verified && customer.email && (
					<button onclick={`fetch('/api/loyalty/send-verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_id:${customer.id}})}).then(function(r){return r.json()}).then(function(d){if(d.ok)alert('Email de verificação enviado!');else alert(d.error||'Erro')})`}
						class="text-sk-blue text-xs font-display font-medium hover:underline">
						Enviar verificação
					</button>
				)}
			</div>
		</div>

		<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
			<div class="px-4 py-3 border-b bg-sk-yellow-light/50">
				<h3 class="font-display font-bold text-sk-text">Histórico de Locações ({totalSessions})</h3>
			</div>
			<table class="w-full text-sm font-body">
				<thead class="text-sk-muted bg-sk-yellow-light/50">
					<tr>
						<th class="px-4 py-2 text-left">Data</th>
						<th class="px-4 py-2 text-left">Ativo</th>
						<th class="px-4 py-2 text-left">Pacote</th>
						<th class="px-4 py-2 text-right">Valor</th>
						<th class="px-4 py-2 text-center">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{sessions.map((s) => (
						<tr class="hover:bg-sk-yellow-light">
							<td class="px-4 py-2">{toBrazilDateTime(s.start_time)}</td>
							<td class="px-4 py-2">{s.asset_name}</td>
							<td class="px-4 py-2">{s.package_name}</td>
							<td class="px-4 py-2 text-right">R$ {(s.amount_cents / 100).toFixed(2).replace(".", ",")}</td>
							<td class="px-4 py-2 text-center">
								<span class={`px-2 py-0.5 rounded-sk text-xs font-medium ${
									s.status === "completed" ? "bg-sk-green-light text-sk-green-dark" :
									s.status === "running" ? "bg-sk-blue-light text-sk-blue-dark" :
									s.status === "paused" ? "bg-sk-yellow-light text-sk-yellow-dark" :
									"bg-sk-danger-light text-sk-danger"
								}`}>
									{STATUS_LABELS[s.status] ?? s.status}
								</span>
							</td>
						</tr>
					))}
					{sessions.length === 0 && (
						<tr><td colspan={5} class="px-4 py-8 text-center text-sk-muted font-body">Nenhuma locação encontrada</td></tr>
					)}
				</tbody>
			</table>
		</div>
	</AdminLayout>
);
