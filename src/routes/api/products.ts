import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { getActiveProducts, getAllProducts, getProductById, createProduct, updateProduct, toggleProductActive } from "../../db/queries/products";
import { auditLog } from "../../lib/logger";
import { requirePermission } from "../../middleware/require-permission";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const EXT_MAP: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const productRoutes = new Hono<AppEnv>();

productRoutes.get("/", async (c) => {
	const all = c.req.query("all");
	const products = all ? await getAllProducts(c.env.DB) : await getActiveProducts(c.env.DB);
	return c.json(products);
});

// Serve product photo from R2
productRoutes.get("/photo/*", async (c) => {
	const key = c.req.path.replace("/api/products/photo/", "");
	if (!key) return c.json({ error: "Key obrigatoria" }, 400);

	const object = await c.env.B_BUCKET_SPEEDKIDS.get(key);
	if (!object) return c.json({ error: "Foto nao encontrada" }, 404);

	const headers = new Headers();
	headers.set("Content-Type", object.httpMetadata?.contentType ?? "image/jpeg");
	headers.set("Cache-Control", "public, max-age=86400");
	return new Response(object.body, { headers });
});

productRoutes.get("/:id", async (c) => {
	const product = await getProductById(c.env.DB, Number(c.req.param("id")));
	if (!product) return c.json({ error: "Produto nao encontrado" }, 404);
	return c.json(product);
});

productRoutes.post("/", requirePermission("products.manage"), async (c) => {
	const body = await c.req.json<{
		name: string; price_cents: number; description?: string; category?: string; sort_order?: number;
	}>();
	if (!body.name || body.price_cents == null) {
		return c.json({ error: "Nome e preco sao obrigatorios" }, 400);
	}
	const product = await createProduct(c.env.DB, body);
	await auditLog(c, "product.create", "product", product?.id, { name: body.name });
	return c.json(product, 201);
});

productRoutes.put("/:id", requirePermission("products.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getProductById(c.env.DB, id);
	if (!existing) return c.json({ error: "Produto nao encontrado" }, 404);
	const body = await c.req.json<{
		name?: string; price_cents?: number; description?: string; category?: string; sort_order?: number;
	}>();
	await updateProduct(c.env.DB, id, body);
	await auditLog(c, "product.update", "product", id, body);
	const updated = await getProductById(c.env.DB, id);
	return c.json(updated);
});

productRoutes.patch("/:id/toggle", requirePermission("products.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getProductById(c.env.DB, id);
	if (!existing) return c.json({ error: "Produto nao encontrado" }, 404);
	await toggleProductActive(c.env.DB, id);
	await auditLog(c, "product.toggle", "product", id);
	const updated = await getProductById(c.env.DB, id);
	return c.json(updated);
});

// Upload product photo to R2
productRoutes.post("/:id/photo", requirePermission("products.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getProductById(c.env.DB, id);
	if (!existing) return c.json({ error: "Produto nao encontrado" }, 404);

	const formData = await c.req.formData();
	const file = formData.get("photo");
	if (!file || !(file instanceof File)) {
		return c.json({ error: "Arquivo de foto obrigatorio" }, 400);
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return c.json({ error: "Tipo de arquivo invalido. Use JPEG, PNG ou WebP" }, 400);
	}
	if (file.size > MAX_SIZE) {
		return c.json({ error: "Arquivo muito grande. Maximo 2MB" }, 400);
	}

	// Delete old photo if exists
	if (existing.photo_url) {
		await c.env.B_BUCKET_SPEEDKIDS.delete(existing.photo_url);
	}

	const ext = EXT_MAP[file.type] ?? "jpg";
	const key = `products/${id}/${Date.now()}.${ext}`;

	await c.env.B_BUCKET_SPEEDKIDS.put(key, file.stream(), {
		httpMetadata: { contentType: file.type },
	});

	await updateProduct(c.env.DB, id, { photo_url: key });
	await auditLog(c, "product.photo.upload", "product", id, { key });

	return c.json({ photo_url: key }, 200);
});

// Delete product photo
productRoutes.delete("/:id/photo", requirePermission("products.manage"), async (c) => {
	const id = Number(c.req.param("id"));
	const existing = await getProductById(c.env.DB, id);
	if (!existing) return c.json({ error: "Produto nao encontrado" }, 404);

	if (existing.photo_url) {
		await c.env.B_BUCKET_SPEEDKIDS.delete(existing.photo_url);
		await updateProduct(c.env.DB, id, { photo_url: null });
		await auditLog(c, "product.photo.delete", "product", id);
	}

	return c.json({ ok: true });
});
