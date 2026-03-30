import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { BlogLayout } from "./blog-layout";
import type { BlogPostView } from "../../db/queries/blog";

interface BlogPostProps {
	article: BlogPostView;
}

export const BlogPost: FC<BlogPostProps> = ({ article }) => (
	<BlogLayout
		title={article.title}
		description={article.description}
	>
		{/* Breadcrumb */}
		<nav class="mb-6 text-sm font-body text-sk-muted">
			<a href="/blog" class="hover:text-sk-orange transition-colors">Blog</a>
			<span class="mx-2">/</span>
			<span class="text-sk-text">{article.title}</span>
		</nav>

		<article class="bg-sk-surface rounded-sk-xl shadow-sk-md border-2 border-sk-border/30 p-6 md:p-10">
			{/* Header */}
			<header class="mb-8 pb-6 border-b-2 border-sk-border/30">
				{article.cover_image_url ? (
					<img src={article.cover_image_url} alt={article.title} class="w-full h-48 md:h-64 object-cover rounded-sk-lg mb-6" />
				) : (
					<span class="text-5xl mb-4 block" aria-hidden="true">{article.icon}</span>
				)}
				<h1 class="font-display font-bold text-2xl md:text-3xl lg:text-4xl text-sk-text mb-4 leading-tight">
					{article.title}
				</h1>
				<div class="flex items-center gap-3 text-sm font-body text-sk-muted">
					<time>{article.published_at}</time>
					<span>·</span>
					<span>{article.reading_time}</span>
				</div>
			</header>

			{/* Sections */}
			<div class="prose prose-sm max-w-none text-sk-text leading-relaxed space-y-8 font-body">
				{article.sections.map((section) => (
					<section>
						<h2 class="text-xl font-display font-bold text-sk-text mt-0 mb-3">
							{section.heading}
						</h2>
						<div class="space-y-3">
							{raw(section.content)}
						</div>
					</section>
				))}
			</div>

			{/* CTA */}
			{article.cta_text && article.cta_href && (
				<div class="mt-10 pt-8 border-t-2 border-sk-border/30 text-center">
					<p class="font-body text-sk-muted mb-4">
						Quer controlar seu parque com dados inteligentes?
					</p>
					<a
						href={article.cta_href}
						class="btn-touch btn-bounce inline-flex items-center gap-2 bg-sk-orange hover:bg-sk-orange-dark text-white px-8 py-3 rounded-sk font-display font-bold text-base shadow-sk-md transition-colors"
					>
						{article.cta_text}
					</a>
				</div>
			)}
		</article>

		{/* Back to blog */}
		<div class="mt-6 text-center">
			<a href="/blog" class="font-body text-sk-muted hover:text-sk-orange text-sm transition-colors">
				&larr; Voltar para o blog
			</a>
		</div>
	</BlogLayout>
);
