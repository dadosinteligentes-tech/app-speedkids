import type { FC } from "hono/jsx";

interface ChangeDisplayProps {
	prefix: string;
}

export const ChangeDisplay: FC<ChangeDisplayProps> = ({ prefix }) => (
	<div id={`${prefix}-change-display`} class="hidden mt-3">
		<div class="bg-sk-yellow-light rounded-sk p-3 text-center mb-2">
			<p class="text-xs text-sk-muted font-body">Troco a devolver</p>
			<p
				id={`${prefix}-change-amount`}
				class="text-3xl font-display font-bold text-sk-yellow-dark"
			>
				R$ 0,00
			</p>
		</div>
		<div
			id={`${prefix}-change-breakdown`}
			class="grid grid-cols-3 sm:grid-cols-4 gap-2"
		></div>
		<div
			id={`${prefix}-change-impossible`}
			class="hidden bg-sk-danger-light rounded-sk p-3 text-center text-sm font-body text-sk-danger mt-2"
		>
			Troco exato indisponivel! Verifique manualmente.
		</div>
	</div>
);
