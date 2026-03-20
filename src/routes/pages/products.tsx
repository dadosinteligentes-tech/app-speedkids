import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getAllProducts } from "../../db/queries/products";
import { getCashStatus } from "../../lib/cash-status";
import { ProductsPage } from "../../views/products/products-page";

export const productPages = new Hono<AppEnv>();

productPages.get("/", async (c) => {
	const user = c.get("user");
	if (!user) return c.redirect("/login");

	const [products, cashStatus] = await Promise.all([
		getAllProducts(c.env.DB),
		getCashStatus(c.env.DB),
	]);

	return c.html(
		<ProductsPage products={products} user={user} cashStatus={cashStatus} />,
	);
});
