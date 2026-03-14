import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Hono } from "hono";
import type { AppEnv } from "../types";
import { authMiddleware } from "./auth";

export function registerMiddleware(app: Hono<AppEnv>) {
	app.use("/api/*", cors());
	app.use("*", authMiddleware);

	app.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status);
		}
		console.error(err);
		return c.json({ error: "Internal Server Error" }, 500);
	});
}
