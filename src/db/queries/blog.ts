import type { BlogPost } from "../schema";

export interface BlogSection {
	heading: string;
	content: string;
}

export interface BlogPostView extends Omit<BlogPost, "sections"> {
	sections: BlogSection[];
}

function parseSections(raw: string): BlogSection[] {
	try {
		return JSON.parse(raw);
	} catch {
		return [];
	}
}

function toView(post: BlogPost): BlogPostView {
	return { ...post, sections: parseSections(post.sections) };
}

export async function getPublishedPosts(db: D1Database): Promise<BlogPostView[]> {
	const { results } = await db
		.prepare("SELECT * FROM blog_posts WHERE published = 1 ORDER BY published_at DESC")
		.all<BlogPost>();
	return results.map(toView);
}

export async function getPublishedPostBySlug(db: D1Database, slug: string): Promise<BlogPostView | null> {
	const row = await db
		.prepare("SELECT * FROM blog_posts WHERE slug = ? AND published = 1")
		.bind(slug)
		.first<BlogPost>();
	return row ? toView(row) : null;
}

export async function getAllPosts(db: D1Database): Promise<BlogPostView[]> {
	const { results } = await db
		.prepare("SELECT * FROM blog_posts ORDER BY created_at DESC")
		.all<BlogPost>();
	return results.map(toView);
}

export async function getPostById(db: D1Database, id: number): Promise<BlogPostView | null> {
	const row = await db
		.prepare("SELECT * FROM blog_posts WHERE id = ?")
		.bind(id)
		.first<BlogPost>();
	return row ? toView(row) : null;
}

export async function createPost(
	db: D1Database,
	data: {
		slug: string;
		title: string;
		description: string;
		icon?: string;
		cover_image_url?: string | null;
		reading_time?: string;
		sections: BlogSection[];
		cta_text?: string | null;
		cta_href?: string | null;
		published?: boolean;
	},
): Promise<BlogPost> {
	const now = new Date().toISOString().replace("T", " ").slice(0, 19);
	const published = data.published ? 1 : 0;
	const publishedAt = published ? now : null;

	const row = await db
		.prepare(`
			INSERT INTO blog_posts (slug, title, description, icon, cover_image_url, reading_time, sections, cta_text, cta_href, published, published_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING *
		`)
		.bind(
			data.slug,
			data.title,
			data.description,
			data.icon ?? "📝",
			data.cover_image_url ?? null,
			data.reading_time ?? "5 min de leitura",
			JSON.stringify(data.sections),
			data.cta_text ?? "Teste grátis por 30 dias",
			data.cta_href ?? "/landing/#cadastro",
			published,
			publishedAt,
			now,
			now,
		)
		.first<BlogPost>();

	return row!;
}

export async function updatePost(
	db: D1Database,
	id: number,
	data: {
		slug?: string;
		title?: string;
		description?: string;
		icon?: string;
		cover_image_url?: string | null;
		reading_time?: string;
		sections?: BlogSection[];
		cta_text?: string | null;
		cta_href?: string | null;
		published?: boolean;
	},
): Promise<void> {
	const sets: string[] = [];
	const vals: (string | number | null)[] = [];

	if (data.slug !== undefined) { sets.push("slug = ?"); vals.push(data.slug); }
	if (data.title !== undefined) { sets.push("title = ?"); vals.push(data.title); }
	if (data.description !== undefined) { sets.push("description = ?"); vals.push(data.description); }
	if (data.icon !== undefined) { sets.push("icon = ?"); vals.push(data.icon); }
	if (data.cover_image_url !== undefined) { sets.push("cover_image_url = ?"); vals.push(data.cover_image_url); }
	if (data.reading_time !== undefined) { sets.push("reading_time = ?"); vals.push(data.reading_time); }
	if (data.sections !== undefined) { sets.push("sections = ?"); vals.push(JSON.stringify(data.sections)); }
	if (data.cta_text !== undefined) { sets.push("cta_text = ?"); vals.push(data.cta_text); }
	if (data.cta_href !== undefined) { sets.push("cta_href = ?"); vals.push(data.cta_href); }
	if (data.published !== undefined) {
		const pub = data.published ? 1 : 0;
		sets.push("published = ?");
		vals.push(pub);
		if (pub === 1) {
			sets.push("published_at = COALESCE(published_at, datetime('now'))");
		}
	}

	if (sets.length === 0) return;
	sets.push("updated_at = datetime('now')");
	vals.push(id);

	await db.prepare(`UPDATE blog_posts SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
	await db.prepare("DELETE FROM blog_posts WHERE id = ?").bind(id).run();
}
