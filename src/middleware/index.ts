import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";

type Bindings = { DB: D1Database };

export function registerMiddleware(app: Hono<{ Bindings: Bindings }>) {
	app.use("/api/*", cors());

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status);
		}
		console.error(err);
		return c.json({ error: "Internal Server Error" }, 500);
	});
}
