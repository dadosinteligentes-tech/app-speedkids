import type { FC } from "hono/jsx";
import { html, raw } from "hono/html";
import type { Customer } from "../../db/schema";
import { AdminLayout } from "../admin/layout";

interface CustomerListProps {
	customers: Customer[];
	total: number;
	page: number;
	user: { name: string; role: string } | null;
}

export const CustomerList: FC<CustomerListProps> = ({ customers, total, page, user }) => {
	const totalPages = Math.ceil(total / 50);

	const script = html`<script>
${raw(`
function openCustomerModal(customer) {
	document.getElementById('customer-form-title').textContent = customer ? 'Editar Cliente' : 'Novo Cliente';
	document.getElementById('customer-id').value = customer ? customer.id : '';
	document.getElementById('customer-name').value = customer ? customer.name : '';
	document.getElementById('customer-phone').value = customer ? (customer.phone || '') : '';
	document.getElementById('customer-cpf').value = customer ? (customer.cpf || '') : '';
	document.getElementById('customer-email').value = customer ? (customer.email || '') : '';
	document.getElementById('customer-instagram').value = customer ? (customer.instagram || '') : '';
	document.getElementById('customer-notes').value = customer ? (customer.notes || '') : '';
	document.getElementById('customer-modal').classList.remove('hidden');
}

function closeCustomerModal() {
	document.getElementById('customer-modal').classList.add('hidden');
}

function saveCustomer() {
	var id = document.getElementById('customer-id').value;
	var data = {
		name: document.getElementById('customer-name').value,
		phone: document.getElementById('customer-phone').value || null,
		cpf: document.getElementById('customer-cpf').value || null,
		email: document.getElementById('customer-email').value || null,
		instagram: document.getElementById('customer-instagram').value || null,
		notes: document.getElementById('customer-notes').value || null
	};
	if (!data.name.trim()) { alert('Nome é obrigatório'); return; }

	var method = id ? 'PUT' : 'POST';
	var url = id ? '/api/customers/' + id : '/api/customers';
	fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
		.then(function(r) { if (!r.ok) return r.json().then(function(e) { throw new Error(e.error); }); return r.json(); })
		.then(function() { location.reload(); })
		.catch(function(err) { alert('Erro: ' + err.message); });
}
`)}
</script>`;

	return (
		<AdminLayout title="Clientes" user={user} activeTab="/admin/customers" bodyScripts={script}>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-display font-bold text-sk-text">Clientes ({total})</h2>
				<button
					onclick="openCustomerModal(null)"
					class="btn-touch px-4 py-2 bg-sk-orange text-white rounded-sk font-display btn-bounce font-medium active:bg-sk-orange-dark"
				>
					+ Novo Cliente
				</button>
			</div>

			<div class="bg-sk-surface rounded-sk shadow-sk-sm overflow-hidden">
				<table class="w-full text-sm font-body">
					<thead class="bg-sk-yellow-light/50 text-sk-muted">
						<tr>
							<th class="px-4 py-3 text-left">Nome</th>
							<th class="px-4 py-3 text-left">Telefone</th>
							<th class="px-4 py-3 text-left hidden md:table-cell">Email</th>
							<th class="px-4 py-3 text-right">Locações</th>
							<th class="px-4 py-3 text-right">Total Gasto</th>
							<th class="px-4 py-3 text-center">Ações</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100">
						{customers.map((c) => (
							<tr class="hover:bg-sk-yellow-light">
								<td class="px-4 py-3 font-medium">
									<a href={`/customers/${c.id}`} class="text-sk-blue-dark hover:underline">{c.name}</a>
								</td>
								<td class="px-4 py-3 text-sk-muted">{c.phone ?? "-"}</td>
								<td class="px-4 py-3 text-sk-muted hidden md:table-cell">{c.email ?? "-"}</td>
								<td class="px-4 py-3 text-right">{c.total_rentals}</td>
								<td class="px-4 py-3 text-right">R$ {(c.total_spent_cents / 100).toFixed(2).replace(".", ",")}</td>
								<td class="px-4 py-3 text-center">
									<button
										onclick={`openCustomerModal(${JSON.stringify({ id: c.id, name: c.name, phone: c.phone, cpf: c.cpf, email: c.email, instagram: c.instagram, notes: c.notes })})`}
										class="text-sk-blue-dark hover:underline text-xs"
									>
										Editar
									</button>
								</td>
							</tr>
						))}
						{customers.length === 0 && (
							<tr><td colspan={6} class="px-4 py-8 text-center text-sk-muted font-body">Nenhum cliente cadastrado</td></tr>
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div class="flex justify-center gap-2 mt-4">
					{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
						<a
							href={`/admin/customers?page=${p}`}
							class={`px-3 py-1 rounded text-sm ${p === page ? "bg-sk-orange text-white rounded-sk" : "bg-sk-surface text-sk-muted rounded-sk hover:bg-sk-yellow-light"}`}
						>
							{p}
						</a>
					))}
				</div>
			)}

			{/* Modal */}
			<div id="customer-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 overlay-fade">
				<div class="bg-sk-surface rounded-sk-xl p-6 w-full max-w-md shadow-sk-xl modal-slide-up">
					<h3 id="customer-form-title" class="text-lg font-display font-bold mb-4">Novo Cliente</h3>
					<input type="hidden" id="customer-id" />
					<div class="space-y-3">
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1">Nome *</label>
							<input id="customer-name" type="text" class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1">Telefone</label>
								<input id="customer-phone" type="tel" class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
							</div>
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1">CPF</label>
								<input id="customer-cpf" type="text" placeholder="000.000.000-00" class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
							</div>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1">Email</label>
								<input id="customer-email" type="email" class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
							</div>
							<div>
								<label class="block text-sm font-medium text-sk-text mb-1">Instagram</label>
								<input id="customer-instagram" type="text" placeholder="@usuario" class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue" />
							</div>
						</div>
						<div>
							<label class="block text-sm font-medium text-sk-text mb-1">Observações</label>
							<textarea id="customer-notes" rows={2} class="w-full border border-sk-border rounded-sk px-3 py-2 font-body focus:ring-sk-blue/30 focus:border-sk-blue"></textarea>
						</div>
					</div>
					<div class="flex gap-2 mt-4">
						<button onclick="saveCustomer()" class="flex-1 py-2 bg-sk-orange text-white rounded-sk font-display btn-bounce font-medium active:bg-sk-orange-dark">Salvar</button>
						<button onclick="closeCustomerModal()" class="flex-1 py-2 bg-gray-200 rounded-sk font-display font-medium">Cancelar</button>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
};
