import { Hono } from "hono";
import type { AppEnv } from "./types";
import { registerMiddleware } from "./middleware";
import { authRoutes } from "./routes/api/auth";
import { rentalRoutes } from "./routes/api/rentals";
import { assetRoutes } from "./routes/api/assets";
import { packageRoutes } from "./routes/api/packages";
import { userRoutes } from "./routes/api/users";
import { logRoutes } from "./routes/api/logs";
import { shiftRoutes } from "./routes/api/shifts";
import { cashRegisterRoutes } from "./routes/api/cash-registers";
import { customerRoutes } from "./routes/api/customers";
import { reportApiRoutes } from "./routes/api/reports";
import { assetTypeRoutes } from "./routes/api/asset-types";
import { batteryRoutes } from "./routes/api/batteries";
import { businessConfigRoutes } from "./routes/api/business-config";
import { productRoutes } from "./routes/api/products";
import { productSaleRoutes } from "./routes/api/product-sales";
import { permissionRoutes } from "./routes/api/permissions";
import { loginPages } from "./routes/pages/login";
import { dashboardPages } from "./routes/pages/dashboard";
import { adminPages } from "./routes/pages/admin";
import { historyPages } from "./routes/pages/history";
import { shiftPages } from "./routes/pages/shift";
import { cashRegisterPages } from "./routes/pages/cash-register";
import { customerPages } from "./routes/pages/customers";
import { rentalPages } from "./routes/pages/rentals";
import { reportPages } from "./routes/pages/reports";
import { receiptPages } from "./routes/pages/receipts";
import { productPages } from "./routes/pages/products";

const app = new Hono<AppEnv>();

registerMiddleware(app);

// API routes
app.route("/api/auth", authRoutes);
app.route("/api/rentals", rentalRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/packages", packageRoutes);
app.route("/api/users", userRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/shifts", shiftRoutes);
app.route("/api/cash-registers", cashRegisterRoutes);
app.route("/api/customers", customerRoutes);
app.route("/api/reports", reportApiRoutes);
app.route("/api/asset-types", assetTypeRoutes);
app.route("/api/batteries", batteryRoutes);
app.route("/api/business-config", businessConfigRoutes);
app.route("/api/products", productRoutes);
app.route("/api/product-sales", productSaleRoutes);
app.route("/api/permissions", permissionRoutes);

// Page routes
app.route("/", loginPages);
app.route("/", dashboardPages);
app.route("/admin/reports", reportPages);
app.route("/admin", adminPages);
app.route("/history", historyPages);
app.route("/rentals", rentalPages);
app.route("/shift", shiftPages);
app.route("/cash", cashRegisterPages);
app.route("/customers", customerPages);
app.route("/products", productPages);
app.route("/receipts", receiptPages);

export default app;
