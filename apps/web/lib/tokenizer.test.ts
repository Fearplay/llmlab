import { describe, expect, it } from "vitest";
import { getTokenizer } from "./tokenizer";

describe("real tokenizer", () => {
  it("returns reversible token IDs for Czech text and JSON in both encodings", async () => {
    for (const name of ["o200k_base", "cl100k_base"] as const) {
      const tokenizer = await getTokenizer(name);
      for (const value of ["Dobrý den, světe!", '{"ok":true,"count":3}']) {
        const ids = tokenizer.encode(value);
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.every((id) => Number.isInteger(id) && id >= 0)).toBe(true);
        expect(tokenizer.decode(ids)).toBe(value);
      }
    }
  });
});
