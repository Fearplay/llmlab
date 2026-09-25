"use client";

import { useEffect, useMemo, useState } from "react";
import { getTokenizer, type EncodingName, type Tokenizer } from "@/lib/tokenizer";
import { Bars, Experiment, Field, Note, Panel, Readout, type LabLocale } from "./concept-lab";
import styles from "./foundation-labs.module.css";

const examples = {
  cs: { text: "Ahoj, světe! Model čte tokeny.", code: "const answer = { count: 42 };", json: '{"name":"Praha","count":42}', other: "Příští token závisí na kontextu" },
  en: { text: "Hello, world! A model reads tokens.", code: "const answer = { count: 42 };", json: '{"name":"Prague","count":42}', other: "The next token depends on context" },
};

function useTokenizer(name: EncodingName) {
  const [encoder, setEncoder] = useState<Tokenizer | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let live = true; getTokenizer(name).then((value) => { if (live) { setEncoder(value); setError(""); } }).catch(() => { if (live) setError("Tokenizer unavailable"); }); return () => { live = false; }; }, [name]);
  return { encoder, error };
}

function TokenizerLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [name, setName] = useState<EncodingName>("o200k_base");
  const [text, setText] = useState(examples.cs.text);
  const { encoder, error } = useTokenizer(name);
  const tokens = useMemo(() => encoder && text ? encoder.encode(text, [], []) : [], [encoder, text]);
  return <Experiment controls={<Panel title={cs ? "Vstup a kódování" : "Input and encoding"}><Field label={cs ? "Kódování" : "Encoding"}><select value={name} onChange={(event) => setName(event.target.value as EncodingName)}><option value="o200k_base">o200k_base</option><option value="cl100k_base">cl100k_base</option></select></Field><Field label={cs ? "Text" : "Text"}><textarea rows={6} value={text} onChange={(event) => setText(event.target.value)} /></Field><div className={styles.exampleButtons}>{(["text", "code", "json", "other"] as const).map((key) => <button key={key} type="button" onClick={() => setText(examples[locale][key])}>{key === "other" ? cs ? "Jiný text" : "Other text" : key}</button>)}</div><Note>{cs ? "ID jsou přesná pro zobrazené kódování, nikoli automaticky pro model vybraný v horní liště." : "IDs are exact for this encoding, not automatically for the model selected above."}</Note></Panel>} result={<Panel title={cs ? "Výsledek tokenizace" : "Tokenization result"}>{error ? <p role="alert">{error}</p> : !encoder ? <p>{cs ? "Načítám slovník…" : "Loading encoding…"}</p> : <><Readout label={cs ? "Počet tokenů" : "Token count"} value={tokens.length} detail={`${text.trim().split(/\s+/).filter(Boolean).length} ${cs ? "slov podle mezer" : "whitespace-separated words"}`} /><div className={styles.tokens}>{tokens.map((id, index) => <div key={`${id}-${index}`} className={styles.token}><span>{encoder.decode([id]).replaceAll(" ", "␠").replaceAll("\n", "↵") || "∅"}</span><strong>{id}</strong></div>)}</div></>}</Panel>} />;
}

function hash(value: string) { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return result >>> 0; }
function softmax(values: number[]) { const max = Math.max(...values); const exps = values.map((value) => Math.exp(value - max)); const sum = exps.reduce((a, b) => a + b, 0); return exps.map((value) => value / sum); }
function attention(text: string) {
  const tokens = text.trim().split(/\s+/).filter(Boolean).slice(0, 7);
  const vectors = tokens.map((token) => { const code = hash(token); return [((code & 255) / 127.5) - 1, (((code >>> 8) & 255) / 127.5) - 1, (((code >>> 16) & 255) / 127.5) - 1]; });
  const q = vectors.map(([a, b, c]) => [a + b * .4, b - c * .3, c + a * .2]);
  const k = vectors.map(([a, b, c]) => [a * .6 - c * .2, b + a * .4, c - b * .3]);
  const v = vectors.map(([a, b, c]) => [b + c * .2, c - a * .4, a + b * .3]);
  const weights = q.map((row, i) => softmax(k.map((key, j) => j > i ? -1e9 : row.reduce((sum, number, d) => sum + number * key[d], 0) / Math.sqrt(3))));
  const last = weights.at(-1) ?? [];
  const context = [0, 1, 2].map((d) => last.reduce((sum, weight, i) => sum + weight * (v[i]?.[d] ?? 0), 0));
  const logits = [context[0] + context[1], context[1] - context[2], context[2] + context[0], -context[0] - context[1]];
  return { tokens, q, k, v, weights, probabilities: softmax(logits) };
}
function TransformerLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [text, setText] = useState(cs ? "Kočka sedí na" : "A cat sits on");
  const [selected, setSelected] = useState(0);
  const result = useMemo(() => attention(text), [text]);
  const row = Math.min(selected, Math.max(0, result.tokens.length - 1));
  const format = (vector: number[]) => vector.map((number) => number.toFixed(2)).join(" · ");
  return <Experiment controls={<Panel title={cs ? "Malý výukový model" : "Small teaching model"}><Field label={cs ? "Vstup, nejvýše sedm slov" : "Input, at most seven words"}><textarea rows={4} value={text} onChange={(event) => { setText(event.target.value); setSelected(0); }} /></Field><Field label={cs ? "Sledovaný token" : "Selected token"}><select value={row} onChange={(event) => setSelected(Number(event.target.value))}>{result.tokens.map((token, index) => <option value={index} key={index}>{index + 1}. {token}</option>)}</select></Field><Note>{cs ? "Embeddingy i váhy jsou deterministická zjednodušená ukázka. Nejde o vnitřní stavy připojeného modelu." : "Embeddings and weights form a deterministic teaching example, not internal states of your connected model."}</Note></Panel>} result={<><Panel title="Q / K / V"><div className={styles.vectors}>{result.tokens.map((token, index) => <div key={index} className={row === index ? styles.selected : ""}><strong>{token}</strong><span>Q {format(result.q[index])}</span><span>K {format(result.k[index])}</span><span>V {format(result.v[index])}</span></div>)}</div></Panel><Panel title={cs ? "Causal maska a attention" : "Causal mask and attention"}><div className={styles.matrix}><div className={styles.matrixHead}><span />{result.tokens.map((token, index) => <span key={index}>{token}</span>)}</div>{result.weights.map((weights, index) => <div key={index} className={styles.matrixRow}><strong>{result.tokens[index]}</strong>{weights.map((weight, j) => <span key={j} style={{ background: j > index ? "var(--surface-muted)" : `color-mix(in srgb, var(--blue) ${Math.round(weight * 70)}%, var(--paper))` }}>{j > index ? "×" : weight.toFixed(2)}</span>)}</div>)}</div><Note>{cs ? "Budoucí tokeny jsou maskované. Každý řádek zbývajících vah dává součet 1." : "Future tokens are masked. The remaining weights in each row sum to 1."}</Note><Bars labels={result.tokens} values={result.weights[row] ?? []} /></Panel><Panel title={cs ? "Ukázkové pravděpodobnosti dalšího tokenu" : "Illustrative next-token probabilities"}><Bars labels={cs ? ["model", "odpověď", "data", "text"] : ["model", "answer", "data", "text"]} values={result.probabilities} /></Panel></>} />;
}

const candidates = { cs: ["model", "člověk", "nástroj", "dokument", "odpověď"], en: ["model", "person", "tool", "document", "answer"] };
const baseLogits = [2.4, 1.9, 1.25, .45, -.2];
export function sampleDistribution(temperature: number, topP: number, topK: number) {
  if (temperature === 0) return [1, 0, 0, 0, 0];
  const probs = softmax(baseLogits.map((logit) => logit / temperature));
  const ranked = probs.map((probability, index) => ({ probability, index })).sort((a, b) => b.probability - a.probability);
  let cumulative = 0;
  const included = new Set<number>();
  for (const item of ranked.slice(0, topK)) { if (cumulative < topP || included.size === 0) { included.add(item.index); cumulative += item.probability; } }
  const total = probs.reduce((sum, value, index) => sum + (included.has(index) ? value : 0), 0);
  return probs.map((value, index) => included.has(index) ? value / total : 0);
}
function nextRandom(seed: number) { const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return { next, value: next / 4294967296 }; }
function GenerationLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [temperature, setTemperature] = useState(.8);
  const [topP, setTopP] = useState(.9);
  const [topK, setTopK] = useState(5);
  const [seed, setSeed] = useState(42);
  const [samples, setSamples] = useState<number[]>([]);
  const probabilities = useMemo(() => sampleDistribution(temperature, topP, topK), [temperature, topP, topK]);
  const run = () => { let state = seed >>> 0; const values: number[] = []; for (let i = 0; i < 12; i++) { const random = nextRandom(state); state = random.next; let cumulative = 0; values.push(Math.max(0, probabilities.findIndex((value) => (cumulative += value) > random.value))); } setSamples(values); };
  return <Experiment controls={<Panel title={cs ? "Nastavení výběru" : "Sampling settings"}><Field label={`Temperature: ${temperature.toFixed(1)}`}><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => { setTemperature(Number(event.target.value)); setSamples([]); }} /></Field><Field label={`Top-p: ${topP.toFixed(2)}`}><input type="range" min="0.05" max="1" step="0.05" value={topP} onChange={(event) => { setTopP(Number(event.target.value)); setSamples([]); }} /></Field><Field label={`Top-k: ${topK}`}><input type="range" min="1" max="5" step="1" value={topK} onChange={(event) => { setTopK(Number(event.target.value)); setSamples([]); }} /></Field><Field label="Seed"><input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} /></Field><button type="button" className={styles.action} onClick={run}>{cs ? "Vybrat 12× další token" : "Sample next token 12 times"}</button><Note>{cs ? "Jde o viditelnou výukovou distribuci. Pravděpodobnosti skutečných modelů tímto rozhraním neměříme." : "This is a visible teaching distribution. It does not claim to measure a provider model's token probabilities."}</Note></Panel>} result={<><Panel title={cs ? "Pravděpodobnosti po filtrech" : "Probabilities after filtering"}><Bars labels={candidates[locale]} values={probabilities} /></Panel><Panel title={cs ? "Opakované generování" : "Repeated generation"}>{samples.length ? <div className={styles.sampleList}>{samples.map((sample, index) => <span key={index}>{candidates[locale][sample]}</span>)}</div> : <p>{cs ? "Spusť výběr a sleduj, zda se opakuje stejný token." : "Run sampling to see whether the same token repeats."}</p>}<Note>{cs ? "Stejný seed a parametry dávají stejnou sérii; temperature 0 vždy zvolí nejpravděpodobnější token." : "The same seed and settings reproduce the series; temperature 0 always selects the most likely token."}</Note></Panel></>} />;
}

const contextInitial = { system: "Odpovídej přesně a stručně.", history: "Uživatel: Jak funguje RAG?\nAsistent: Najde podklady a pak odpoví.", documents: "Dokument: RAG předává modelu relevantní úryvky.", tools: "Výsledek vyhledávání: Nalezeny dva úryvky.", user: "Můžeš uvést příklad?" };
type ContextKey = keyof typeof contextInitial;
function ContextLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [parts, setParts] = useState(contextInitial);
  const [budget, setBudget] = useState(90);
  const [compress, setCompress] = useState(false);
  const { encoder } = useTokenizer("o200k_base");
  const keys: ContextKey[] = ["system", "history", "documents", "tools", "user"];
  const labels = { cs: ["Systém", "Historie", "Dokumenty", "Nástroje", "Uživatel"], en: ["System", "History", "Documents", "Tools", "User"] };
  const counts = keys.map((key) => encoder?.encode(parts[key], [], []).length ?? 0);
  const effective = counts.map((count, index) => index === 1 && compress ? Math.ceil(count * .45) : count);
  const kept = [...keys]; let total = effective.reduce((a, b) => a + b, 0);
  for (const key of ["history", "tools", "documents"] as ContextKey[]) { if (total <= budget) break; const index = keys.indexOf(key); total -= effective[index]; kept.splice(kept.indexOf(key), 1); }
  const overflow = total > budget;
  return <Experiment controls={<Panel title={cs ? "Sestav kontext" : "Build context"}><Field label={`${cs ? "Rozpočet" : "Budget"}: ${budget} ${cs ? "tokenů" : "tokens"}`}><input type="range" min="10" max="250" step="5" value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></Field>{keys.map((key, index) => <Field key={key} label={labels[locale][index]}><textarea rows={key === "history" ? 3 : 2} value={parts[key]} onChange={(event) => setParts((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}<Field label={cs ? "Komprimovat historii výukovým souhrnem" : "Compress history with a teaching summary"}><input type="checkbox" checked={compress} onChange={(event) => setCompress(event.target.checked)} /></Field></Panel>} result={<Panel title={cs ? "Obsazení okna" : "Window usage"}>{!encoder ? <p>{cs ? "Načítám tokenizer…" : "Loading tokenizer…"}</p> : <><Readout label={cs ? "Ponechané tokeny" : "Kept tokens"} value={`${total} / ${budget}`} detail={overflow ? cs ? "Povinné části přesahují rozpočet" : "Required parts exceed the budget" : undefined} /><div className={styles.contextParts}>{keys.map((key, index) => <div key={key} data-dropped={!kept.includes(key)}><span>{labels[locale][index]}</span><strong>{effective[index]} / {counts[index]}</strong><em>{kept.includes(key) ? cs ? "zůstává" : "kept" : cs ? "oříznuto" : "trimmed"}</em></div>)}</div><Note>{cs ? "Počty obsahu používají o200k_base. Režie zpráv poskytovatele se může lišit. Komprese je názorný odhad, nikoli výstup modelu." : "Content counts use o200k_base. Provider message overhead may differ. Compression is an illustrative estimate, not model output."}</Note></>}</Panel>} />;
}

export function FoundationLab({ slug, locale }: { slug: string; locale: LabLocale }) {
  if (slug === "tokenizer") return <TokenizerLab locale={locale} />;
  if (slug === "transformer") return <TransformerLab locale={locale} />;
  if (slug === "generation") return <GenerationLab locale={locale} />;
  if (slug === "context") return <ContextLab locale={locale} />;
  return null;
}
