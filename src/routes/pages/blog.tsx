import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { BlogList } from "../../views/blog/blog-list";
import { BlogPost } from "../../views/blog/blog-post";
import { getPublishedPosts, getPublishedPostBySlug } from "../../db/queries/blog";

export const blogPages = new Hono<AppEnv>();

blogPages.get("/", async (c) => {
	const articles = await getPublishedPosts(c.env.DB);
	return c.html(<BlogList articles={articles} />);
});

blogPages.get("/:slug", async (c) => {
	const slug = c.req.param("slug");
	const article = await getPublishedPostBySlug(c.env.DB, slug);

	if (!article) {
		return c.html(
			<html lang="pt-BR">
				<head>
					<meta charset="UTF-8" />
					<title>Artigo não encontrado — Giro Kids</title>
					<meta http-equiv="refresh" content="3;url=/blog" />
				</head>
				<body style="font-family:sans-serif;text-align:center;padding:4rem">
					<h1>Artigo não encontrado</h1>
					<p>Redirecionando para o blog...</p>
				</body>
			</html>,
			404,
		);
	}

	return c.html(<BlogPost article={article} />);
});
