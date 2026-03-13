import { Hono } from "hono";
import { registerMiddleware } from "./middleware";
import { apiRoutes } from "./routes/api";
import { pageRoutes } from "./routes/pages";

type Bindings = { DB: D1Database };

const app = new Hono<{ Bindings: Bindings }>();

registerMiddleware(app);

app.route("/api", apiRoutes);
app.route("/", pageRoutes);

export default app;
