import { describe, expect, it } from "vitest";
import { getHelpArticle, getHelpArticleForRoute, helpArticles } from "../lib/help/articles";

describe("help center content", () => {
  it("keeps article slugs unique and all workflow links resolvable", () => {
    expect(new Set(helpArticles.map((article) => article.slug)).size).toBe(helpArticles.length);
    for (const article of helpArticles) {
      expect(article.steps.length).toBeGreaterThanOrEqual(3);
      expect(article.connections.length).toBeGreaterThanOrEqual(2);
      for (const connection of article.connections) expect(getHelpArticle(connection.slug)).toBeDefined();
    }
  });

  it("maps exact and detail routes to contextual articles", () => {
    expect(getHelpArticleForRoute("/dashboard")?.slug).toBe("dashboard");
    expect(getHelpArticleForRoute("/work-orders/new")?.slug).toBe("work-orders");
    expect(getHelpArticleForRoute("/work-orders/123")?.slug).toBe("work-order-detail");
    expect(getHelpArticleForRoute("/assets/123/edit")?.slug).toBe("assets");
    expect(getHelpArticleForRoute("/inventory/items/123")?.slug).toBe("stock-items");
  });
});
