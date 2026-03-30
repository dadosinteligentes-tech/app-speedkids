import { describe, it, expect } from "vitest";
import { seedArticles } from "../../src/views/blog/articles";

describe("seedArticles", () => {
	it("has at least 2 articles", () => {
		expect(seedArticles.length).toBeGreaterThanOrEqual(2);
	});

	it("each article has required fields", () => {
		for (const article of seedArticles) {
			expect(article.slug).toBeTruthy();
			expect(article.title).toBeTruthy();
			expect(article.description).toBeTruthy();
			expect(article.reading_time).toBeTruthy();
			expect(article.icon).toBeTruthy();
			expect(article.sections.length).toBeGreaterThan(0);
		}
	});

	it("all slugs are unique", () => {
		const slugs = seedArticles.map((a) => a.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("slugs contain only valid URL characters", () => {
		for (const article of seedArticles) {
			expect(article.slug).toMatch(/^[a-z0-9-]+$/);
		}
	});

	it("each section has heading and content", () => {
		for (const article of seedArticles) {
			for (const section of article.sections) {
				expect(section.heading).toBeTruthy();
				expect(section.content).toBeTruthy();
			}
		}
	});

	it("articles have published flag set", () => {
		for (const article of seedArticles) {
			expect(article.published).toBe(1);
		}
	});

	it("articles have CTA fields", () => {
		for (const article of seedArticles) {
			expect(article.cta_text).toBeTruthy();
			expect(article.cta_href).toBeTruthy();
		}
	});
});
