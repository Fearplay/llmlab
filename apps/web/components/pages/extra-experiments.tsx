"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel } from "@/components/ui";
import { bm25, cosine, teachingVector } from "@/lib/retrieval-demo";
import styles from "./extra-experiments.module.css";

type Output = { text: string; provider: string; model: string; mode: string; fixture: boolean; usage: { input_tokens: number; output_tokens: number; cost_usd: number | null }; latency_ms: number; applied_settings?: Record<string, unknown>; requested_settings?: Record<string, unknown> };

function useLocalizedSample<T>(czech: T, english: T): [T, Dispatch<SetStateAction<T>>] {
  const { locale } = useApp();
  const defaults = useRef({ cs: czech, en: english });
  const previousLocale = useRef(locale);
  const edited = useRef(false);
  const [value, setValue] = useState(locale === "cs" ? czech : english);
  useEffect(() => {
    if (previousLocale.current !== locale && !edited.current) queueMicrotask(() => setValue(defaults.current[locale]));
    previousLocale.current = locale;
  }, [locale]);
  const update: Dispatch<SetStateAction<T>> = (next) => { edited.current = true; setValue(next); };
  return [value, update];
}

async function generate(body: Record<string, unknown>): Promise<Output> {
  const response = await fetch("/api/v1/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as Output & { detail?: string };
  if (!response.ok) throw new Error(data.detail ?? `HTTP ${response.status}`);
  return { ...data, requested_settings: { temperature: body.temperature ?? 0.2, top_p: body.top_p ?? 0.9, max_tokens: body.max_tokens } };
}

function ResultCard({ title, output, cs }: { title: string; output: Output; cs: boolean }) {
  return <article className={styles.result}><h3>{title}</h3><strong className={styles.provenance}>{output.fixture ? cs ? "Ukázka · simulovaná odpověď" : "Fixture · simulated answer" : cs ? "Živá odpověď" : "Live answer"}</strong><p>{output.text}</p><small>{output.mode} · {output.provider}: {output.model} · {output.usage.input_tokens}/{output.usage.output_tokens} {cs ? "tokenů" : "tokens"} · {output.latency_ms} ms · {output.usage.cost_usd === null ? cs ? "cena neznámá" : "cost unknown" : `$${output.usage.cost_usd.toFixed(5)}`}</small><details><summary>{cs ? "Použitá nastavení" : "Run settings"}</summary><pre>{cs ? "Požadováno" : "Requested"}: {JSON.stringify(output.requested_settings, null, 2)}{output.applied_settings && Object.keys(output.applied_settings).length > 0 ? `\n${cs ? "Potvrzeno poskytovatelem" : "Confirmed by provider"}: ${JSON.stringify(output.applied_settings, null, 2)}` : ""}</pre></details></article>;
}

export function PromptCompare() {
  const { locale, mode, selectedModel } = useApp();
  const cs = locale === "cs";
  const [a, setA] = useLocalizedSample("Vysvětli token jednou větou.", "Explain a token in one sentence.");
  const [b, setB] = useLocalizedSample("Vysvětli token začátečníkovi pomocí přirovnání.", "Explain a token to a beginner using an analogy.");
  const [temperature, setTemperature] = useState(0.3);
  const [results, setResults] = useState<Output[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const model = mode === "fixture" ? { mode: "fixture", provider: "fixture", id: "fixture-gen-v2" } : selectedModel;
  const run = async () => {
    if (!model) return;
    setBusy(true); setError(""); setResults(null);
    try {
      const base = { mode: model.mode, provider: model.provider, model: model.id, temperature, top_p: 0.9, max_tokens: 256 };
      setResults(await Promise.all([a, b].map((prompt) => generate({ ...base, messages: [{ role: "user", content: prompt }] }))));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  return <section className={styles.panel}><h2>{cs ? "Porovnej dva prompty na stejném modelu" : "Compare two prompts on the same model"}</h2><p>{cs ? "Změň jednu formulaci. Dvě odpovědi se spustí až po kliknutí; cloudový režim může být placený. V režimu Ukázka je text odpovědi pevný, porovnáš hlavně vstupní tokeny." : "Change one wording. Two requests run only when clicked; cloud mode may incur a charge. Fixture answers use fixed text, so compare input tokens there."}</p><div className={styles.fields}><label><HelpLabel label={cs ? "Prompt A" : "Prompt A"} helpKey="field.comparePromptA" /><textarea value={a} onChange={(event) => setA(event.target.value)} rows={3} /></label><label><HelpLabel label={cs ? "Prompt B" : "Prompt B"} helpKey="field.comparePromptB" /><textarea value={b} onChange={(event) => setB(event.target.value)} rows={3} /></label></div><label className={styles.range}><HelpLabel label={`Temperature: ${temperature.toFixed(1)}`} helpKey="prompt.temperature" /><input type="range" min="0" max="1" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /></label><button type="button" disabled={!model || !a.trim() || !b.trim() || busy} onClick={() => void run()}>{busy ? cs ? "Porovnávám…" : "Comparing…" : cs ? "Spustit porovnání (2 volání)" : "Run comparison (2 calls)"}</button>{error && <p role="alert">{error}</p>}{results && <div className={styles.results}>{results.map((output, index) => <ResultCard key={index} title={`Prompt ${index ? "B" : "A"}`} output={output} cs={cs} />)}</div>}</section>;
}

export function GroundingCompare() {
  const { locale, mode, selectedModel } = useApp();
  const cs = locale === "cs";
  const [question, setQuestion] = useLocalizedSample("Kolik dní mám na vrácení zboží?", "How many days do I have to return goods?");
  const [evidence, setEvidence] = useLocalizedSample("Zboží lze vrátit do 30 dnů od doručení.", "Goods can be returned within 30 days of delivery.");
  const [results, setResults] = useState<Output[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const model = mode === "fixture" ? { mode: "fixture", provider: "fixture", id: "fixture-gen-v2" } : selectedModel;
  const run = async () => {
    if (!model) return;
    setBusy(true); setError(""); setResults(null);
    try {
      const base = { mode: model.mode, provider: model.provider, model: model.id, temperature: 0.2, top_p: 0.9, max_tokens: 256 };
      setResults(await Promise.all([
        generate({ ...base, messages: [{ role: "user", content: question }] }),
        generate({ ...base, messages: [{ role: "system", content: cs ? "Odpovídej jen podle dodaného podkladu. Pokud nestačí, řekni to." : "Answer only from supplied evidence. Say when it is insufficient." }, { role: "user", content: `${cs ? "Podklad" : "Evidence"}: ${evidence}\n${cs ? "Otázka" : "Question"}: ${question}` }] }),
      ]));
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  return <section className={styles.panel}><h2>{cs ? "Živě: s podkladem a bez podkladu" : "Live: with and without evidence"}</h2><p>{cs ? "Stejná otázka, dvě volání. Odpovědi posuďte proti podkladu sami; aplikace netvrdí, že je automaticky ověřila." : "Same question, two calls. Check both answers against the evidence yourself; the app does not claim automatic verification."}</p><div className={styles.fields}><label><HelpLabel label={cs ? "Otázka" : "Question"} helpKey="field.groundingQuestion" /><textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} /></label><label><HelpLabel label={cs ? "Podklad" : "Evidence"} helpKey="field.groundingEvidence" /><textarea rows={3} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label></div><button type="button" disabled={!model || !question.trim() || !evidence.trim() || busy} onClick={() => void run()}>{busy ? cs ? "Porovnávám…" : "Comparing…" : cs ? "Spustit dvě odpovědi" : "Run two answers"}</button>{error && <p role="alert">{error}</p>}{results && <div className={styles.results}><ResultCard title={cs ? "Bez podkladu" : "Without evidence"} output={results[0]} cs={cs} /><ResultCard title={cs ? "S podkladem" : "With evidence"} output={results[1]} cs={cs} /></div>}</section>;
}

export function MiniCorpus() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [query, setQuery] = useLocalizedSample("vrácení zboží", "return goods");
  const [texts, setTexts] = useLocalizedSample(["Zboží lze vrátit do 30 dnů.", "Expresní zásilka přijde zítra.", "Reklamace se řeší přes podporu."], ["Goods can be returned within 30 days.", "Express shipping arrives tomorrow.", "Warranty claims go through support."]);
  const lexical = bm25(query, texts);
  const max = Math.max(...lexical, 1e-9);
  const rows = texts.map((text, index) => ({ index, text, lexical: lexical[index] / max, vector: cosine(teachingVector(query), teachingVector(text)) })).sort((a, b) => (b.lexical + b.vector) - (a.lexical + a.vector));
  return <section className={styles.panel}><h2>{cs ? "Vlastní malý korpus" : "Your own mini corpus"}</h2><p>{cs ? "Uprav tři texty a dotaz. BM25 je skutečný lokální výpočet; vektorová podobnost je zjednodušená tematická ukázka." : "Edit three texts and the query. BM25 is computed locally; vector similarity uses a simplified teaching representation."}</p><label><HelpLabel label={cs ? "Hledaný dotaz" : "Search query"} helpKey="field.miniQuery" /><input value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className={styles.fields}>{texts.map((text, index) => <label key={index}><HelpLabel label={`${cs ? "Dokument" : "Document"} ${index + 1}`} helpKey="field.miniDocument" /><textarea rows={3} value={text} onChange={(event) => setTexts((current) => current.map((item, position) => position === index ? event.target.value : item))} /></label>)}</div><ol className={styles.rankings}>{rows.map((row) => <li key={row.index}><strong>{cs ? "Dokument" : "Document"} {row.index + 1}</strong><span>BM25 {row.lexical.toFixed(2)} · {cs ? "Tematická podobnost" : "Topic similarity"} {row.vector.toFixed(2)}</span><p>{row.text}</p></li>)}</ol></section>;
}

export function EvaluatorComparison() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [expected, setExpected] = useLocalizedSample("Vrácení trvá 30 dnů", "Returns take 30 days");
  const [answer, setAnswer] = useLocalizedSample("Zboží můžete vrátit do 30 dnů.", "You can return goods within 30 days.");
  const normalize = (text: string) => text.toLocaleLowerCase().trim().replace(/\s+/g, " ");
  const exact = normalize(expected) === normalize(answer);
  const words = [...new Set(normalize(expected).match(/[\p{L}\p{N}]+/gu) ?? [])];
  const found = new Set(normalize(answer).match(/[\p{L}\p{N}]+/gu) ?? []);
  const partial = words.length ? words.filter((word) => found.has(word)).length / words.length : 0;
  const presets = cs ? [
    { id: "exact", label: "Přesná shoda", reference: "Vrácení je možné do 30 dnů.", response: "Vrácení je možné do 30 dnů." },
    { id: "paraphrase", label: "Parafráze", reference: "Lhůta vrácení je 30 dnů.", response: "Zboží můžete vrátit do 30 dnů." },
    { id: "wrong", label: "Chybné číslo", reference: "Vrácení je možné do 30 dnů.", response: "Vrácení je možné do 14 dnů." },
  ] : [
    { id: "exact", label: "Exact match", reference: "Returns are allowed within 30 days.", response: "Returns are allowed within 30 days." },
    { id: "paraphrase", label: "Paraphrase", reference: "The return period is 30 days.", response: "You can return goods within 30 days." },
    { id: "wrong", label: "Wrong number", reference: "Returns are allowed within 30 days.", response: "Returns are allowed within 14 days." },
  ];
  return <section className={styles.panel}><h2>{cs ? "Stejná odpověď, různá pravidla hodnocení" : "One answer, different scoring rules"}</h2><p>{cs ? "Změň očekávání nebo odpověď. Výsledky jsou lokální textové kontroly; nehodnotí pravdivost ani význam." : "Edit the reference or answer. These are local text checks; they do not verify truth or meaning."}</p><div className={styles.presets}>{presets.map((preset) => <button type="button" key={preset.id} onClick={() => { setExpected(preset.reference); setAnswer(preset.response); }}>{preset.label}</button>)}</div><div className={styles.fields}><label><HelpLabel label={cs ? "Očekávaná odpověď" : "Reference answer"} helpKey="field.referenceAnswer" /><textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={2} /></label><label><HelpLabel label={cs ? "Odpověď modelu" : "Model answer"} helpKey="field.evaluatorAnswer" /><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={2} /></label></div><div className={styles.scores}><p>{cs ? "Přesná shoda" : "Exact match"}: <strong>{exact ? "100 %" : "0 %"}</strong></p><p>{cs ? "Částečná shoda slov" : "Partial word match"}: <strong>{Math.round(partial * 100)} %</strong></p></div><small>{cs ? "Zkuste změnit „30“ na „14“: částečná shoda může stále dát nenulové skóre, i když je údaj chybný." : "Change 30 to 14: partial matching can still score above zero even though the fact is wrong."}</small></section>;
}
