export type EncodingName = "o200k_base" | "cl100k_base";
export interface Tokenizer { encode(value: string, allowedSpecial?: string[], disallowedSpecial?: string[]): number[]; decode(tokens: number[]): string }
const encodings = new Map<EncodingName, Promise<Tokenizer>>();

export function getTokenizer(name: EncodingName): Promise<Tokenizer> {
  const cached = encodings.get(name);
  if (cached) return cached;
  const loading = Promise.all([
    import("js-tiktoken/lite"),
    name === "o200k_base" ? import("js-tiktoken/ranks/o200k_base") : import("js-tiktoken/ranks/cl100k_base"),
  ]).then(([{ Tiktoken }, ranks]) => new Tiktoken(ranks.default));
  encodings.set(name, loading);
  return loading;
}
