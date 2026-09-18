import { describe, expect, it } from "vitest";
import { getHelpContent } from "./help-content";

describe("contextual help content", () => {
  it("returns detailed localized AI explanations with examples", () => {
    const english = getHelpContent("page.rag", "RAG", "en", "section");
    const czech = getHelpContent("page.rag", "RAG", "cs", "section");

    expect(english.description).toContain("retrieves relevant source passages");
    expect(english.example.length).toBeGreaterThan(20);
    expect(czech.description).toContain("vyhledá relevantní pasáže");
    expect(czech.example.length).toBeGreaterThan(20);
  });

  it("provides a localized fallback for every unlabeled future control", () => {
    const english = getHelpContent(undefined, "Custom threshold", "en", "field");
    const czech = getHelpContent(undefined, "Vlastní práh", "cs", "metric");

    expect(english.title).toBe("Custom threshold");
    expect(english.description).toContain("current run");
    expect(english.example).toContain("Change");
    expect(czech.title).toBe("Vlastní práh");
    expect(czech.description).toContain("metrika");
    expect(czech.example).toContain("Porovnej");
  });
});
