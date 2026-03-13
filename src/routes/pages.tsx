import { Hono } from "hono";
import { getComments } from "../db/queries";
import { Home } from "../views/home";

type Bindings = { DB: D1Database };

export const pageRoutes = new Hono<{ Bindings: Bindings }>();

pageRoutes.get("/", async (c) => {
	const comments = await getComments(c.env.DB);
	return c.html(<Home comments={comments} />);
});
