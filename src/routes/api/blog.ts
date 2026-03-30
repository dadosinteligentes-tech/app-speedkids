import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { createPost, updatePost, getPostById, getPublishedPosts } from "../../db/queries/blog";

export const blogApiRoutes = new Hono<AppEnv>();

// Serve blog images from R2 (public)
blogApiRoutes.get("/images/*", async (c) => {
	const key = c.req.path.replace("/api/blog/images/", "");
	if (!key) return c.json({ error: "Key obrigatória" }, 400);

	const object = await c.env.B_BUCKET_SPEEDKIDS.get(key);
	if (!object) return c.json({ error: "Imagem não encontrada" }, 404);

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/jpeg");
	headers.set("Cache-Control", "public, max-age=86400");
	return new Response(object.body, { headers });
});

// Public: list published posts (JSON)
blogApiRoutes.get("/posts", async (c) => {
	const posts = await getPublishedPosts(c.env.DB);
	return c.json(posts);
});

// --- Workflow API (Bearer token auth) ---

function requireBlogApiKey(c: any): boolean {
	const apiKey = c.env.BLOG_API_KEY;
	if (!apiKey) return false;
	const auth = c.req.header("Authorization");
	if (!auth) return false;
	return auth === `Bearer ${apiKey}`;
}

// Create post via workflow
blogApiRoutes.post("/posts", async (c) => {
	if (!requireBlogApiKey(c)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const body = await c.req.json<{
		slug: string; title: string; description: string;
		icon?: string; reading_time?: string;
		sections: { heading: string; content: string }[];
		cta_text?: string | null; cta_href?: string | null;
		published?: boolean;
	}>();

	if (!body.slug || !body.title || !body.description || !body.sections) {
		return c.json({ error: "slug, title, description e sections são obrigatórios" }, 400);
	}
	if (!/^[a-z0-9-]+$/.test(body.slug)) {
		return c.json({ error: "Slug deve conter apenas letras minúsculas, números e hífens" }, 400);
	}

	const post = await createPost(c.env.DB, body);
	return c.json(post, 201);
});

// Update post via workflow
blogApiRoutes.put("/posts/:id", async (c) => {
	if (!requireBlogApiKey(c)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const id = parseInt(c.req.param("id"), 10);
	const existing = await getPostById(c.env.DB, id);
	if (!existing) return c.json({ error: "Post não encontrado" }, 404);

	const body = await c.req.json();
	if (body.slug && !/^[a-z0-9-]+$/.test(body.slug)) {
		return c.json({ error: "Slug deve conter apenas letras minúsculas, números e hífens" }, 400);
	}
	await updatePost(c.env.DB, id, body);
	return c.json({ ok: true });
});

// Upload cover image via workflow
blogApiRoutes.post("/posts/:id/image", async (c) => {
	if (!requireBlogApiKey(c)) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const id = parseInt(c.req.param("id"), 10);
	const existing = await getPostById(c.env.DB, id);
	if (!existing) return c.json({ error: "Post não encontrado" }, 404);

	const formData = await c.req.formData();
	const file = formData.get("image");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "Arquivo de imagem obrigatório" }, 400);
	}

	const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
	if (!allowedTypes.includes(file.type)) {
		return c.json({ error: "Tipo inválido. Use JPEG, PNG ou WebP" }, 400);
	}
	if (file.size > 2 * 1024 * 1024) {
		return c.json({ error: "Arquivo muito grande. Máximo 2MB" }, 400);
	}

	// Delete old image
	if (existing.cover_image_url) {
		const oldKey = existing.cover_image_url.replace("/api/blog/images/", "");
		if (oldKey) await c.env.B_BUCKET_SPEEDKIDS.delete(oldKey);
	}

	const extMap: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
	const ext = extMap[file.type] ?? "jpg";
	const key = `blog/${id}/${Date.now()}.${ext}`;

	await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	const imageUrl = `/api/blog/images/${key}`;
	await updatePost(c.env.DB, id, { cover_image_url: imageUrl });

	return c.json({ cover_image_url: imageUrl });
});
