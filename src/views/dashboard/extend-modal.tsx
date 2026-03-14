import type { FC } from "hono/jsx";
import type { Package } from "../../db/schema";

interface ExtendModalProps {
	packages: Package[];
}

export const ExtendModal: FC<ExtendModalProps> = ({ packages }) => (
	<div id="extend-modal" class="hidden fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-50 overlay-fade">
		<div class="bg-sk-surface rounded-t-sk-xl md:rounded-sk-xl shadow-sk-xl w-full max-w-md p-6 modal-slide-up">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-display font-bold text-sk-text">⏰ Estender Tempo</h3>
				<button onclick="closeExtendModal()" class="text-sk-muted text-2xl leading-none hover:text-sk-orange" aria-label="Fechar">&times;</button>
			</div>
			<p class="text-sm text-sk-muted font-body mb-4">Selecione um pacote para adicionar tempo:</p>
			<div class="grid grid-cols-1 gap-2">
				{packages.map((pkg) => (
					<button
						onclick={`extendWithPackage(${pkg.id})`}
						class="btn-touch btn-bounce w-full py-3 px-4 bg-sk-blue-light border border-sk-blue/30 rounded-sk text-left hover:bg-sk-blue/20 active:bg-sk-blue/30"
					>
						<span class="font-display font-bold text-sk-blue-dark">{pkg.name}</span>
						<span class="text-sm text-sk-blue font-body ml-2">
							+{pkg.duration_minutes}min — R$ {(pkg.price_cents / 100).toFixed(2).replace(".", ",")}
						</span>
					</button>
				))}
			</div>
		</div>
	</div>
);
