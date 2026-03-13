import { Hono } from "hono";
import { getComments, getCommentById, createComment, deleteComment } from "../db/queries";

type Bindings = { DB: D1Database };

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

apiRoutes.get("/comments", async (c) => {
	const comments = await getComments(c.env.DB);
	return c.json(comments);
});

apiRoutes.get("/comments/:id", async (c) => {
	const id = Number(c.req.param("id"));
	const comment = await getCommentById(c.env.DB, id);
	if (!comment) {
		return c.json({ error: "Comment not found" }, 404);
	}
	return c.json(comment);
});

apiRoutes.post("/comments", async (c) => {
	const body = await c.req.parseBody();
	const author = String(body["author"] ?? "");
	const content = String(body["content"] ?? "");

	if (!author || !content) {
		return c.json({ error: "author and content are required" }, 400);
	}

	const comment = await createComment(c.env.DB, author, content);

	// If the request came from a form, redirect back to home
	const accept = c.req.header("Accept") ?? "";
	if (accept.includes("text/html") || c.req.header("Content-Type")?.includes("form")) {
		return c.redirect("/");
	}

	return c.json(comment, 201);
});

apiRoutes.delete("/comments/:id", async (c) => {
	const id = Number(c.req.param("id"));
	await deleteComment(c.env.DB, id);
	return c.json({ ok: true });
});
