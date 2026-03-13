import type { FC } from "hono/jsx";
import type { Comment } from "../db/queries";
import { Layout } from "./layout";

interface HomeProps {
	comments: Comment[];
}

export const Home: FC<HomeProps> = ({ comments }) => (
	<Layout title="SpeedKids - Home">
		<h1 class="text-2xl font-bold mb-6">Comentários</h1>

		<form method="post" action="/api/comments" class="mb-8 bg-white rounded-lg shadow p-6">
			<h2 class="text-lg font-semibold mb-4">Novo comentário</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="author">
						Autor
					</label>
					<input
						id="author"
						name="author"
						type="text"
						required
						class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="content">
						Conteúdo
					</label>
					<textarea
						id="content"
						name="content"
						required
						rows={3}
						class="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<button
					type="submit"
					class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
				>
					Enviar
				</button>
			</div>
		</form>

		<div class="space-y-4">
			{comments.length === 0 ? (
				<p class="text-gray-500">Nenhum comentário ainda.</p>
			) : (
				comments.map((comment) => (
					<div class="bg-white rounded-lg shadow p-4">
						<p class="font-semibold text-gray-800">{comment.author}</p>
						<p class="text-gray-600 mt-1">{comment.content}</p>
					</div>
				))
			)}
		</div>
	</Layout>
);
