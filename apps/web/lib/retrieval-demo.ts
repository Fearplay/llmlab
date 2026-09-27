export interface DemoDocument { id: string; cs: string; en: string; topic: string; type: "policy" | "guide" }
export const demoDocuments: DemoDocument[] = [
  { id: "returns", topic: "refund", type: "policy", cs: "Zboží lze vrátit do 30 dnů od doručení. Peníze vrátíme do 14 dnů po přijetí zásilky.", en: "Goods can be returned within 30 days of delivery. We refund payment within 14 days after receiving the parcel." },
  { id: "shipping", topic: "shipping", type: "guide", cs: "Běžné doručení trvá tři pracovní dny. Expresní zásilku doručíme následující pracovní den.", en: "Standard delivery takes three business days. Express parcels arrive on the next business day." },
  { id: "security", topic: "security", type: "policy", cs: "Přístup k účtu vyžaduje heslo a druhý faktor. Obnovovací kódy uložte na bezpečné místo.", en: "Account access requires a password and a second factor. Store recovery codes in a safe place." },
  { id: "warranty", topic: "refund", type: "guide", cs: "Reklamaci nahlaste přes podporu. Záruka trvá dva roky a nevztahuje se na běžné opotřebení.", en: "Report a warranty claim to support. Coverage lasts two years and excludes ordinary wear." },
  { id: "privacy", topic: "security", type: "guide", cs: "Osobní údaje uchováváme jen po nezbytnou dobu. Export dat lze vyžádat v nastavení účtu.", en: "We retain personal data only as long as needed. Request a data export in account settings." },
];

const topicTerms: Record<string, string[]> = {
  refund: ["vrátit", "vrácení", "peníze", "reklamace", "refund", "return", "payment", "warranty"],
  shipping: ["doručení", "zásilka", "expresní", "delivery", "shipping", "parcel", "express"],
  security: ["účet", "heslo", "faktor", "údaje", "bezpečné", "account", "password", "privacy", "data", "factor"],
};
const normalize = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const words = (text: string): string[] => normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
export function teachingVector(text: string): number[] {
  const tokens = words(text);
  return Object.values(topicTerms).map((terms) => terms.reduce((count, term) => count + tokens.filter((word) => word.startsWith(normalize(term).slice(0, 4))).length, 0));
}
export function cosine(left: number[], right: number[]) {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const a = Math.hypot(...left), b = Math.hypot(...right);
  return a && b ? dot / (a * b) : 0;
}
export function bm25(query: string, corpus: string[]): number[] {
  const tokenized = corpus.map(words);
  const queryWords = [...new Set(words(query))];
  const averageLength = tokenized.reduce((sum, row) => sum + row.length, 0) / Math.max(1, tokenized.length);
  return tokenized.map((row) => queryWords.reduce((score, term) => {
    const frequency = row.filter((word) => word === term).length;
    if (!frequency) return score;
    const df = tokenized.filter((doc) => doc.includes(term)).length;
    const idf = Math.log(1 + (tokenized.length - df + .5) / (df + .5));
    return score + idf * (frequency * 2.2) / (frequency + 1.2 * (.25 + .75 * row.length / Math.max(1, averageLength)));
  }, 0));
}
export type RetrievalMode = "lexical" | "vector" | "hybrid";
export interface DemoHit { id: string; text: string; type: DemoDocument["type"]; lexical: number; vector: number; score: number; rank: number }
export function retrieve(query: string, locale: "cs" | "en", mode: RetrievalMode, filter: "all" | "policy" | "guide" = "all") {
  const documents = demoDocuments.filter((doc) => filter === "all" || doc.type === filter);
  const texts = documents.map((doc) => doc[locale]);
  const lexical = bm25(query, texts);
  const maxLexical = Math.max(...lexical, 1e-9);
  const queryVector = teachingVector(query);
  return documents.map((doc, index) => {
    const lex = lexical[index] / maxLexical;
    const vector = cosine(queryVector, teachingVector(texts[index]));
    return { id: doc.id, text: texts[index], type: doc.type, lexical: lex, vector, score: mode === "lexical" ? lex : mode === "vector" ? vector : .5 * lex + .5 * vector, rank: 0 };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((hit, index) => ({ ...hit, rank: index + 1 }));
}
export function rerankMmr(hits: DemoHit[], lambda: number) {
  const remaining = [...hits];
  const result: DemoHit[] = [];
  while (remaining.length) {
    const scored = remaining.map((hit) => ({ hit, mmr: lambda * hit.score - (1 - lambda) * Math.max(0, ...result.map((selected) => cosine(teachingVector(hit.text), teachingVector(selected.text)))) }));
    scored.sort((a, b) => b.mmr - a.mmr || a.hit.id.localeCompare(b.hit.id));
    const chosen = scored[0].hit;
    result.push(chosen);
    remaining.splice(remaining.findIndex((item) => item.id === chosen.id), 1);
  }
  return result.map((hit, index) => ({ ...hit, rank: index + 1 }));
}
export function retrievalMetrics(ids: string[], relevant: string[], k: number) {
  const top = ids.slice(0, k);
  const matches = top.filter((id) => relevant.includes(id)).length;
  const first = ids.findIndex((id) => relevant.includes(id));
  return { recall: relevant.length ? matches / relevant.length : null, precision: matches / k, mrr: first < 0 ? 0 : 1 / (first + 1), matches };
}

export type ChunkStrategy = "fixed" | "sentence" | "paragraph" | "structure";
export function chunkText(text: string, strategy: ChunkStrategy, size: number, overlap: number) {
  const source = text.trim();
  if (!source) return [];
  if (strategy === "fixed") {
    const chunks: string[] = [];
    const step = Math.max(1, size - overlap);
    for (let start = 0; start < source.length; start += step) {
      chunks.push(source.slice(start, start + size));
      if (start + size >= source.length) break;
    }
    return chunks;
  }
  const units = strategy === "paragraph" ? source.split(/\n\s*\n/) : strategy === "structure" ? source.split(/(?=^#{1,3}\s)/m) : source.match(/[^.!?]+[.!?]?/g) ?? [source];
  const chunks: string[] = [];
  let current = "";
  for (const unit of units.map((item) => item.trim()).filter(Boolean)) {
    if (current && `${current}\n${unit}`.length > size) { chunks.push(current); current = overlap ? `${current.slice(-overlap)} ${unit}` : unit; }
    else current = current ? `${current}\n${unit}` : unit;
  }
  if (current) chunks.push(current);
  return chunks;
}
