import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { TermsPage, PrivacyPage, LgpdPage } from "../../views/landing/legal-pages";

export const legalPages = new Hono<AppEnv>();

legalPages.get("/terms", (c) => c.html(<TermsPage />));
legalPages.get("/privacy", (c) => c.html(<PrivacyPage />));
legalPages.get("/lgpd", (c) => c.html(<LgpdPage />));
