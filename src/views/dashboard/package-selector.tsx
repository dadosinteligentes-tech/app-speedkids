import type { FC } from "hono/jsx";
import type { Package } from "../../db/schema";

interface PackageSelectorProps {
	packages: Package[];
}

export const PackageSelector: FC<PackageSelectorProps> = ({ packages }) => (
	<div
		id="package-modal"
		class="hidden fixed inset-0 z-50 flex items-end justify-center bg-black/30 overlay-fade"
		onclick="if(event.target===this)closePackageModal()"
	>
		<div class="w-full max-w-lg bg-sk-surface rounded-t-sk-xl p-6 pb-8 shadow-sk-xl modal-slide-up">
			<h2 class="text-xl font-display font-bold text-sk-text mb-4">🎁 Escolha o pacote</h2>
			<div class="grid grid-cols-2 gap-3">
				{packages.map((pkg) => (
					<button
						onclick={`selectPackage(${pkg.id})`}
						class="btn-touch btn-bounce p-4 bg-sk-blue-light border-2 border-sk-blue/30 rounded-sk text-center active:bg-sk-blue/20 active:border-sk-blue transition-all"
					>
						<div class="font-display font-bold text-lg text-sk-text">{pkg.name}</div>
						<div class="text-sk-blue-dark font-bold font-body mt-1">
							R$ {(pkg.price_cents / 100).toFixed(2).replace(".", ",")}
						</div>
					</button>
				))}
			</div>
			<button
				onclick="closePackageModal()"
				class="btn-touch w-full mt-4 py-3 bg-gray-200 rounded-sk font-display font-medium text-sk-muted active:bg-gray-300"
			>
				CANCELAR
			</button>
		</div>
	</div>
);
