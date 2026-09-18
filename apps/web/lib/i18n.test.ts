import { describe, expect, it } from "vitest";
import { messages, translate } from "./i18n";

describe("translate", () => {
  it("returns both supported translations", () => {
    expect(translate("en", "nav.overview")).toBe("Overview");
    expect(translate("cs", "nav.overview")).toBe("Přehled");
  });

  it("keeps an unknown key visible", () => {
    expect(translate("en", "missing.key")).toBe("missing.key");
  });

  it("keeps Czech and English catalogs structurally identical", () => {
    expect(flattenKeys(messages.cs)).toEqual(flattenKeys(messages.en));
  });
});

function flattenKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === "object" ? flattenKeys(item, path) : [path];
  }).sort();
}
