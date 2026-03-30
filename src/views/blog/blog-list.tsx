import type { FC } from "hono/jsx";
import { BlogLayout } from "./blog-layout";
import type { BlogPostView } from "../../db/queries/blog";

interface BlogListProps {
	articles: BlogPostView[];
}

export const BlogList: FC<BlogListProps> = ({ articles }) => (
	<BlogLayout
		title="Blog"
		description="Dicas, guias e estratégias para donos de parques infantis, locadoras de brinquedos e espaços de diversão."
	>
		<div class="mb-10">
			<h1 class="font-display font-bold text-3xl md:text-4xl text-sk-text mb-3">
				Blog Giro Kids
			</h1>
			<p class="font-body text-sk-muted text-lg">
				Guias e estratégias para parques infantis e espaços de diversão
			</p>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			{articles.map((article) => (
				<a
					href={`/blog/${article.slug}`}
					class="group bg-sk-surface rounded-sk-lg border-2 border-sk-border/50 shadow-sk-sm hover:shadow-sk-md hover:border-sk-orange/50 transition-all p-6 block"
				>
					{article.cover_image_url ? (
						<img src={article.cover_image_url} alt={article.title} class="w-full h-40 object-cover rounded-sk mb-4" />
					) : (
						<span class="text-4xl mb-3 block" aria-hidden="true">{article.icon}</span>
					)}
					<h2 class="font-display font-bold text-xl text-sk-text mb-2 group-hover:text-sk-orange transition-colors">
						{article.title}
					</h2>
					<p class="font-body text-sk-muted text-sm mb-4 line-clamp-3">
						{article.description}
					</p>
					<div class="flex items-center gap-3 text-xs font-body text-sk-muted">
						<time>{article.published_at}</time>
						<span>·</span>
						<span>{article.reading_time}</span>
					</div>
				</a>
			))}
		</div>
	</BlogLayout>
);
