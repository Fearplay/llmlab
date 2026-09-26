"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { teachingVector, cosine } from "@/lib/retrieval-demo";
import { fetchJson, type ExperimentRecord, type PriceCatalog } from "../live-api";
import { Bars, Experiment, Field, Note, Panel, Readout, type LabLocale } from "./concept-lab";
import { InfoTip } from "@/components/ui";
import styles from "./operations-labs.module.css";

const demoModels = [
  { id: "malý", en: "small", cost: .08, latency: 450, context: 8_000, quality: .67, type: "simple" },
  { id: "střední", en: "medium", cost: .65, latency: 900, context: 32_000, quality: .84, type: "general" },
  { id: "velký", en: "large", cost: 3.2, latency: 1800, context: 128_000, quality: .93, type: "complex" },
];
function RoutingLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [rule, setRule] = useState<"cost" | "speed" | "context" | "task">("cost");
  const [tokens, setTokens] = useState(3000);
  const [task, setTask] = useState<"simple" | "complex">("simple");
  const eligible = demoModels.filter((model) => model.context >= tokens);
  const chosen = [...eligible].sort((a, b) => rule === "cost" ? a.cost - b.cost : rule === "speed" ? a.latency - b.latency : rule === "context" ? b.context - a.context : task === "complex" ? b.quality - a.quality : a.cost - b.cost)[0];
  return <Experiment controls={<Panel title={cs ? "Pravidlo směrování" : "Routing rule"}><Field helpKey="field.concept" label={cs ? "Priorita" : "Priority"}><select value={rule} onChange={(event) => setRule(event.target.value as typeof rule)}><option value="cost">{cs ? "Nejnižší cena" : "Lowest cost"}</option><option value="speed">{cs ? "Nejkratší čas" : "Lowest latency"}</option><option value="context">{cs ? "Nejdelší kontext" : "Longest context"}</option><option value="task">{cs ? "Typ úlohy" : "Task type"}</option></select></Field><Field helpKey="field.concept" label={`${cs ? "Potřebný kontext" : "Required context"}: ${tokens.toLocaleString(locale)}`}><input type="range" min="1000" max="128000" step="1000" value={tokens} onChange={(event) => setTokens(Number(event.target.value))} /></Field><Field helpKey="field.routingTask" label={cs ? "Úloha" : "Task"}><select value={task} onChange={(event) => setTask(event.target.value as typeof task)}><option value="simple">{cs ? "Jednoduchá otázka" : "Simple question"}</option><option value="complex">{cs ? "Složitá analýza" : "Complex analysis"}</option></select></Field><Note>{cs ? "Čas, cena a kvalita v horním příkladu jsou ukázkové. Níže se pravidlo aplikuje na skutečně dostupné modely a známá měření." : "Time, price and quality in the example above are illustrative. Below, the rule applies to available models and known measurements."}</Note></Panel>} result={<Panel title={cs ? "Rozhodnutí routeru" : "Router decision"}><Readout label={cs ? "Vybraný model" : "Selected model"} value={chosen ? cs ? chosen.id : chosen.en : cs ? "Žádný" : "None"} detail={chosen ? `${chosen.context.toLocaleString(locale)} ${cs ? "tokenů kontextu" : "context tokens"}` : cs ? "Požadavek překračuje kontext všech modelů" : "Request exceeds every model's context"} /><div className={styles.modelTable}>{demoModels.map((model) => <div key={model.id} data-selected={chosen?.id === model.id}><strong>{cs ? model.id : model.en}</strong><span>{model.latency} ms</span><span>${model.cost.toFixed(2)} / 1M</span><span>{model.context.toLocaleString(locale)}</span></div>)}</div><LiveRouting locale={locale} rule={rule} task={task} tokens={tokens} /></Panel>} />;
}
function LiveRouting({ locale, rule, task, tokens }: { locale: LabLocale; rule: "cost" | "speed" | "context" | "task"; task: "simple" | "complex"; tokens: number }) {
  const cs = locale === "cs";
  const { models } = useApp();
  const [prices, setPrices] = useState<PriceCatalog | null>(null);
  const [runs, setRuns] = useState<ExperimentRecord[]>([]);
  useEffect(() => {
    fetchJson<PriceCatalog>("/api/v1/prices").then(setPrices).catch(() => undefined);
    fetchJson<ExperimentRecord[]>("/api/v1/experiments").then(setRuns).catch(() => undefined);
  }, []);
  const measured = models.filter((model) => model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation)).map((model) => {
    const samples = runs.flatMap((run) => run.results ?? []).filter((item) => item.model_key === model.key && typeof item.latency_ms === "number");
    const latency = samples.length ? samples.reduce((sum, item) => sum + (item.latency_ms ?? 0), 0) / samples.length : null;
    return { ...model, latency, price: prices?.prices[model.key]?.input_per_million_usd ?? null };
  });
  const eligible = measured.filter((model) => model.context_window != null && model.context_window >= tokens);
  const ranked = [...eligible].filter((model) => rule === "cost" || task === "simple" && rule === "task" ? model.price !== null : rule === "speed" ? model.latency !== null : true).sort((a, b) => rule === "context" || rule === "task" && task === "complex" ? (b.context_window ?? 0) - (a.context_window ?? 0) : rule === "speed" ? (a.latency ?? Infinity) - (b.latency ?? Infinity) : (a.price ?? Infinity) - (b.price ?? Infinity));
  const chosen = ranked[0];
  return <div className={styles.liveRouting}><h3>{cs ? "Dostupné modely" : "Available models"}</h3><p>{cs ? "Směrování používá katalog, zveřejněné ceny a časy vašich dřívějších běhů. Neznámý kontext nebo metrika model z daného pravidla vyřadí." : "Routing uses the catalog, published prices and latency from your previous runs. Unknown context or metrics exclude a model from that rule."}</p><strong>{chosen ? chosen.key : cs ? "Žádný model se známými potřebnými údaji" : "No model with the required known data"}</strong><div className={styles.modelTable}>{measured.map((model) => <div key={model.key} data-selected={chosen?.key === model.key}><strong>{model.id}</strong><span>{model.latency === null ? "—" : `${Math.round(model.latency)} ms`}</span><span>{model.price === null ? "—" : `$${model.price}/1M`}</span><span>{model.context_window?.toLocaleString(locale) ?? "—"}</span></div>)}</div></div>;
}
function InferenceLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [input, setInput] = useState(800);
  const [output, setOutput] = useState(24);
  const [ttft, setTtft] = useState(400);
  const [speed, setSpeed] = useState(25);
  const [visible, setVisible] = useState(0);
  const [running, setRunning] = useState(false);
  useEffect(() => { if (!running) return; if (visible >= output) return; const timer = window.setTimeout(() => setVisible((count) => count + 1), visible === 0 ? ttft : 1000 / speed); return () => window.clearTimeout(timer); }, [running, visible, output, ttft, speed]);
  const duration = ttft + Math.max(0, output - 1) * 1000 / speed;
  return <Experiment controls={<Panel title={cs ? "Simuluj streaming" : "Simulate streaming"}><Field helpKey="field.concept" label={`${cs ? "Vstupní tokeny" : "Input tokens"}: ${input}`}><input type="range" min="100" max="8000" step="100" value={input} onChange={(event) => setInput(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={`${cs ? "Výstupní tokeny" : "Output tokens"}: ${output}`}><input type="range" min="5" max="80" step="1" value={output} onChange={(event) => { setOutput(Number(event.target.value)); setVisible(0); setRunning(false); }} /></Field><Field helpKey="field.concept" label={`TTFT: ${ttft} ms`}><input type="range" min="100" max="1500" step="50" value={ttft} onChange={(event) => setTtft(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={`${cs ? "Rychlost" : "Speed"}: ${speed} tok/s`}><input type="range" min="5" max="80" step="5" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></Field><button className={styles.action} type="button" onClick={() => { setVisible(0); setRunning(true); }}>{cs ? "Přehrát generování" : "Replay generation"}</button><Note>{cs ? "Časová osa je simulace. TTFT měří čekání na první token, rychlost až následné tokeny." : "This timeline is simulated. TTFT measures the wait for the first token; generation speed covers subsequent tokens."}</Note></Panel>} result={<Panel title={cs ? "Průběh v čase" : "Timeline"}><div className={styles.metrics}><Readout label="TTFT" value={`${ttft} ms`} /><Readout label={cs ? "Celkový čas" : "Total time"} value={`${(duration / 1000).toFixed(1)} s`} /><Readout label={cs ? "Poměr výstup/vstup" : "Output/input ratio"} value={`${Math.round(output / input * 100)} %`} /></div><div className={styles.stream} aria-live="polite">{Array.from({ length: visible }, (_, index) => <i key={index} />)}</div><p>{visible} / {output} {cs ? "výstupních tokenů" : "output tokens"}</p><LiveInference locale={locale} /></Panel>} />;
}
type InferenceMetrics = { ttft_ms: number | null; total_ms: number; input_tokens: number | null; output_tokens: number | null; output_tokens_per_second: number | null; cost_usd: number | null };
function LiveInference({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const { selectedModel } = useApp();
  const [prompt, setPrompt] = useState(cs ? "Vysvětli jednou větou, co je token." : "Explain a token in one sentence.");
  const [text, setText] = useState("");
  const [metrics, setMetrics] = useState<InferenceMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    if (!selectedModel || !prompt.trim()) return;
    setBusy(true); setText(""); setMetrics(null); setError("");
    try {
      const payload = { mode: selectedModel.mode, provider: selectedModel.provider, model: selectedModel.id, messages: [{ role: "user", content: prompt.trim() }], max_tokens: 256 };
      if (!["ollama", "openai", "openai_compatible"].includes(selectedModel.provider)) {
        const result = await fetchJson<{ text: string; latency_ms: number; usage: { input_tokens: number; output_tokens: number; cost_usd: number | null } }>("/api/v1/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        setText(result.text); setMetrics({ ttft_ms: null, total_ms: result.latency_ms, input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens, output_tokens_per_second: null, cost_usd: result.usage.cost_usd });
      } else {
        const response = await fetch("/api/v1/inference/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const accept = (line: string) => {
          if (!line.trim()) return;
          const event = JSON.parse(line) as { type: string; text?: string; message?: string } & Partial<InferenceMetrics>;
          if (event.type === "delta") setText((current) => current + (event.text ?? ""));
          if (event.type === "done") setMetrics({ ttft_ms: event.ttft_ms ?? null, total_ms: event.total_ms ?? 0, input_tokens: event.input_tokens ?? null, output_tokens: event.output_tokens ?? null, output_tokens_per_second: event.output_tokens_per_second ?? null, cost_usd: event.cost_usd ?? null });
          if (event.type === "error") throw new Error(event.message ?? "Stream error");
        };
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
          let boundary = buffer.indexOf("\n");
          while (boundary >= 0) { accept(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1); boundary = buffer.indexOf("\n"); }
          if (done) { if (buffer.trim()) accept(buffer); break; }
        }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  return <div className={styles.liveInference}><h3>{cs ? "Změřit dostupný model" : "Measure an available model"}</h3><p>{cs ? "Ollama, OpenAI a kompatibilní API streamují skutečné chunky. U ostatních poskytovatelů měříme dokončený požadavek bez TTFT." : "Ollama, OpenAI, and compatible APIs stream real chunks. Other providers measure a completed request without TTFT."}</p><Field helpKey="field.cacheInput" label={cs ? "Vstup" : "Input"}><textarea rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></Field><button className={styles.action} disabled={!selectedModel || busy || !prompt.trim()} onClick={() => void run()}>{busy ? cs ? "Generuji…" : "Generating…" : cs ? "Spustit živé měření" : "Run live measurement"}</button>{error && <p role="alert">{error}</p>}<div className={styles.liveOutput} aria-live="polite">{text}</div>{metrics && <div className={styles.metrics}><Readout label="TTFT" value={metrics.ttft_ms === null ? "—" : `${metrics.ttft_ms} ms`} /><Readout label={cs ? "Celkový čas" : "Total time"} value={`${metrics.total_ms} ms`} /><Readout label={cs ? "Tokeny vstup / výstup" : "Input / output tokens"} value={`${metrics.input_tokens ?? "—"} / ${metrics.output_tokens ?? "—"}`} /><Readout label={cs ? "Rychlost" : "Speed"} value={metrics.output_tokens_per_second === null ? "—" : `${metrics.output_tokens_per_second} tok/s`} /><Readout label={cs ? "Odhad ceny" : "Estimated cost"} value={metrics.cost_usd === null ? "—" : `$${metrics.cost_usd.toFixed(5)}`} /></div>}</div>;
}
interface CacheEntry { query: string; modelKey: string; answer: string; latency: number; cost: number | null }
function CacheLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const { selectedModel } = useApp();
  const [query, setQuery] = useState(cs ? "Jak vrátit zboží?" : "How do I return goods?");
  const [strategy, setStrategy] = useState<"none" | "exact" | "semantic">("exact");
  const [live, setLive] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(.8);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [last, setLast] = useState<{ hit: boolean; source?: string; latency: number; cost: number | null; answer: string } | null>(null);
  const run = async () => {
    const modelKey = live ? selectedModel?.key ?? "" : "fixture";
    const source = strategy === "exact" ? entries.find((item) => item.query === query && item.modelKey === modelKey) : strategy === "semantic" && !live ? entries.find((item) => cosine(teachingVector(item.query), teachingVector(query)) >= threshold && teachingVector(query).some(Boolean)) : undefined;
    if (source) { setLast({ hit: true, source: source.query, latency: 0, cost: 0, answer: source.answer }); return; }
    setWorking(true); setError("");
    try {
      let entry: CacheEntry;
      if (live && selectedModel) {
        const result = await fetchJson<{ text: string; latency_ms: number; usage: { cost_usd: number | null } }>("/api/v1/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedModel.mode, provider: selectedModel.provider, model: selectedModel.id, messages: [{ role: "user", content: query }], max_tokens: 256 }) });
        entry = { query, modelKey, answer: result.text, latency: result.latency_ms, cost: result.usage.cost_usd };
      } else {
        entry = { query, modelKey, answer: cs ? `Ukázková odpověď pro: ${query}` : `Example answer for: ${query}`, latency: 720, cost: .002 };
      }
      setEntries((current) => [...current, entry]); setLast({ hit: false, latency: entry.latency, cost: entry.cost, answer: entry.answer });
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setWorking(false); }
  };
  return <Experiment controls={<Panel title={cs ? "Požadavek a cache" : "Request and cache"}><Field helpKey="field.concept" label={cs ? "Dotaz" : "Query"}><input value={query} onChange={(event) => setQuery(event.target.value)} /></Field><Field helpKey="field.cacheStrategy" label={cs ? "Strategie" : "Strategy"}><select value={strategy} onChange={(event) => { setStrategy(event.target.value as typeof strategy); if (event.target.value === "semantic") setLive(false); }}><option value="none">{cs ? "Bez cache" : "No cache"}</option><option value="exact">{cs ? "Přesná shoda" : "Exact match"}</option><option value="semantic">{cs ? "Sémantická ukázka" : "Semantic example"}</option></select></Field>{strategy === "semantic" && <Field helpKey="field.concept" label={`${cs ? "Práh podobnosti" : "Similarity threshold"}: ${threshold.toFixed(2)}`}><input type="range" min="0.5" max="1" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></Field>}<label className={styles.check}><input type="checkbox" checked={live} onChange={(event) => { setLive(event.target.checked); setEntries([]); setLast(null); }} disabled={!selectedModel || strategy === "semantic"} /><InfoTip label={cs ? "Živý model" : "Live model"} helpKey="field.liveCache" context="field" />{cs ? "Použít vybraný živý model" : "Use the selected live model"}</label><button className={styles.action} type="button" disabled={working || !query.trim()} onClick={() => void run()}>{working ? cs ? "Čekám…" : "Waiting…" : cs ? "Spustit požadavek" : "Run request"}</button><button className={styles.secondary} type="button" onClick={() => { setEntries([]); setLast(null); }}>{cs ? "Vymazat cache" : "Clear cache"}</button><Note>{cs ? "Cache žije jen v této stránce. V živém režimu měříme skutečný miss; hit vrací uloženou odpověď bez modelu. Sémantická shoda je pouze ukázka s tematickým vektorem." : "The cache lives only on this page. Live mode measures a real miss; a hit returns the saved answer without a model call. Semantic matching is a topic-vector demo."}</Note></Panel>} result={<Panel title={cs ? "Výsledek opakování" : "Repeated request result"}>{error && <p role="alert">{error}</p>}{last ? <><Readout label={last.hit ? "Cache hit" : "Cache miss"} value={`${last.latency} ms`} detail={last.cost === null ? "—" : `$${last.cost.toFixed(4)}`} /><p>{last.answer}</p>{last.source && <p>{cs ? "Znovu použitý dotaz" : "Reused query"}: {last.source}</p>}</> : <p>{cs ? "Spusť stejný dotaz dvakrát a porovnej." : "Run the same query twice to compare."}</p>}<Readout label={cs ? "Záznamů v relaci" : "Entries in session"} value={entries.length} /></Panel>} />;
}
function KvCacheLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [layers, setLayers] = useState(32);
  const [heads, setHeads] = useState(8);
  const [dimension, setDimension] = useState(128);
  const [tokens, setTokens] = useState(4096);
  const [bits, setBits] = useState(16);
  const bytes = 2 * layers * heads * dimension * tokens * bits / 8;
  const uncached = tokens * (tokens + 1) / 2;
  return <Experiment controls={<Panel title={cs ? "Nastavení modelu" : "Model settings"}><Field helpKey="field.concept" label={`${cs ? "Vrstvy" : "Layers"}: ${layers}`}><input type="range" min="8" max="80" step="8" value={layers} onChange={(event) => setLayers(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={`${cs ? "KV hlavy" : "KV heads"}: ${heads}`}><input type="range" min="2" max="32" step="2" value={heads} onChange={(event) => setHeads(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={`${cs ? "Rozměr hlavy" : "Head dimension"}: ${dimension}`}><input type="range" min="64" max="256" step="32" value={dimension} onChange={(event) => setDimension(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={`${cs ? "Délka kontextu" : "Context length"}: ${tokens}`}><input type="range" min="512" max="32768" step="512" value={tokens} onChange={(event) => setTokens(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={cs ? "Přesnost uložených stavů" : "Stored state precision"}><select value={bits} onChange={(event) => setBits(Number(event.target.value))}><option value="16">FP16</option><option value="8">INT8</option><option value="4">INT4</option></select></Field></Panel>} result={<Panel title={cs ? "Paměť a opakovaná práce" : "Memory and repeated work"}><Readout label={cs ? "Velikost KV cache" : "KV cache size"} value={`${(bytes / 1024 ** 3).toFixed(2)} GiB`} detail="2 × layers × KV heads × head dimension × tokens × bytes" /><div className={styles.metrics}><Readout label={cs ? "Bez uložení, načtené pozice" : "Without reuse, positions read"} value={uncached.toLocaleString(locale)} /><Readout label={cs ? "S cache, načtené pozice" : "With cache, positions read"} value={tokens.toLocaleString(locale)} /></div><Note>{cs ? "Toto je výpočet velikosti K/V stavů, ne měření konkrétního modelu. Skutečná implementace přidává režii a může použít jiné uspořádání." : "This calculates K/V state size, not a measurement of a specific model. Real implementations add overhead and may use another layout."}</Note></Panel>} />;
}
function QuantizationLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [parameters, setParameters] = useState(7);
  const [selected, setSelected] = useState(16);
  const [question, setQuestion] = useState(cs ? "Shrň pravidla vrácení." : "Summarize the return policy.");
  const variants = [16, 8, 4].map((bits) => ({ bits, memory: parameters * 1e9 * bits / 8 / 1024 ** 3, quality: bits === 16 ? .92 : bits === 8 ? .9 : .83, speed: bits === 16 ? 22 : bits === 8 ? 35 : 48 }));
  const active = variants.find((item) => item.bits === selected)!;
  return <Experiment controls={<Panel title={cs ? "Stejný výukový model" : "Same example model"}><Field helpKey="field.concept" label={`${cs ? "Parametry" : "Parameters"}: ${parameters}B`}><input type="range" min="3" max="70" step="1" value={parameters} onChange={(event) => setParameters(Number(event.target.value))} /></Field><Field helpKey="field.concept" label={cs ? "Reprezentace" : "Representation"}><select value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{variants.map((item) => <option key={item.bits} value={item.bits}>{item.bits === 16 ? "FP16" : `INT${item.bits}`}</option>)}</select></Field><Field helpKey="field.compareQuestion" label={cs ? "Srovnávací otázka" : "Comparison question"}><input value={question} onChange={(event) => setQuestion(event.target.value)} /></Field><Note>{cs ? "Hodnoty rychlosti a kvality jsou ilustrační pro princip kvantizace. Nejde o benchmark nainstalovaného modelu." : "Speed and quality values illustrate quantization. They are not benchmarks of an installed model."}</Note></Panel>} result={<Panel title={cs ? "Velikost a kompromis" : "Size and trade-off"}><div className={styles.metrics}><Readout label={cs ? "Hmotnost vah" : "Weight size"} value={`${active.memory.toFixed(1)} GiB`} /><Readout label={cs ? "Ukázková rychlost" : "Example speed"} value={`${active.speed} tok/s`} /><Readout label={cs ? "Ukázková kvalita" : "Example quality"} value={`${Math.round(active.quality * 100)} %`} /></div><Bars labels={variants.map((item) => item.bits === 16 ? "FP16" : `INT${item.bits}`)} values={variants.map((item) => item.memory / variants[0].memory)} highlight={variants.findIndex((item) => item.bits === selected)} /><p className={styles.question}>{question}</p><LocalVariantComparison locale={locale} question={question} /></Panel>} />;
}
function LocalVariantComparison({ locale, question }: { locale: LabLocale; question: string }) {
  const cs = locale === "cs";
  const { models } = useApp();
  const local = models.filter((model) => model.provider === "ollama" && model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation));
  const [selected, setSelected] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [results, setResults] = useState<Array<{ key: string; text?: string; latency?: number; outputTokens?: number; error?: string }>>([]);
  const run = async () => {
    setWorking(true); setResults([]);
    const next: typeof results = [];
    for (const key of selected) {
      const model = local.find((item) => item.key === key);
      if (!model) continue;
      try {
        const output = await fetchJson<{ text: string; latency_ms: number; usage: { output_tokens: number } }>("/api/v1/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "local", provider: "ollama", model: model.id, messages: [{ role: "user", content: question }], temperature: 0, max_tokens: 256 }) });
        next.push({ key, text: output.text, latency: output.latency_ms, outputTokens: output.usage.output_tokens });
      } catch (caught) { next.push({ key, error: caught instanceof Error ? caught.message : String(caught) }); }
      setResults([...next]);
    }
    setWorking(false);
  };
  return <div className={styles.localCompare}><h3>{cs ? "Živé porovnání lokálních variant" : "Live comparison of local variants"}</h3><p>{cs ? "Vyberte 2–3 varianty stejného modelu nainstalované v Ollamě. Měříme jejich odpověď a čas; přesnost kvantizace musí odpovídat názvu varianty." : "Select 2–3 variants of the same model installed in Ollama. We measure answers and latency; the variant name must identify its quantization."}</p><div>{local.map((model) => <label key={model.key}><input type="checkbox" checked={selected.includes(model.key)} disabled={selected.length >= 3 && !selected.includes(model.key)} onChange={() => setSelected((current) => current.includes(model.key) ? current.filter((key) => key !== model.key) : [...current, model.key])} /><InfoTip label={model.id} helpKey="field.localVariant" context="field" />{model.id}</label>)}</div><button className={styles.action} disabled={selected.length < 2 || working} onClick={() => void run()}>{working ? cs ? "Porovnávám…" : "Comparing…" : cs ? "Porovnat odpovědi" : "Compare responses"}</button>{results.map((result) => <article key={result.key}><strong>{result.key}</strong><span>{result.latency == null ? result.error : `${result.latency} ms · ${result.outputTokens} ${cs ? "výstupních tokenů" : "output tokens"}`}</span><p>{result.text}</p></article>)}</div>;
}
const sampleJsonl = '{"messages":[{"role":"user","content":"Kdy lze vrátit zboží?"},{"role":"assistant","content":"Do 30 dnů od doručení."}]}';
function FineTuningLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [need, setNeed] = useState<"style" | "facts" | "format">("facts");
  const [method, setMethod] = useState<"sft" | "lora" | "qlora">("lora");
  const [data, setData] = useState(sampleJsonl);
  let validity = "";
  try { const rows = data.trim().split(/\r?\n/).map((line) => JSON.parse(line) as { messages?: { role: string; content: string }[] }); if (!rows.length || rows.some((row) => !Array.isArray(row.messages) || !row.messages.some((message) => message.role === "assistant"))) validity = cs ? "Každý řádek potřebuje messages a odpověď asistenta." : "Each line needs messages and an assistant answer."; } catch { validity = cs ? "Neplatné JSONL." : "Invalid JSONL."; }
  const recommendation = need === "facts" ? "RAG" : need === "style" ? cs ? "Prompt nebo fine-tuning" : "Prompt or fine-tuning" : cs ? "Strukturovaný výstup" : "Structured output";
  const descriptions = { sft: cs ? "Aktualizace všech vah na příkladech." : "Update all weights on examples.", lora: cs ? "Trénují se malé přidané matice." : "Train small added matrices.", qlora: cs ? "LoRA nad kvantizovaným základním modelem." : "LoRA over a quantized base model." };
  return <Experiment controls={<Panel title={cs ? "Jaký problém řešíš?" : "What problem are you solving?"}><Field helpKey="field.concept" label={cs ? "Typ potřeby" : "Need"}><select value={need} onChange={(event) => setNeed(event.target.value as typeof need)}><option value="facts">{cs ? "Nové nebo měnící se znalosti" : "New or changing facts"}</option><option value="style">{cs ? "Stálý styl odpovědi" : "Consistent answer style"}</option><option value="format">{cs ? "Pevný formát odpovědi" : "Fixed answer format"}</option></select></Field><Field helpKey="field.concept" label={cs ? "Trénovací metoda" : "Training method"}><select value={method} onChange={(event) => setMethod(event.target.value as typeof method)}><option value="sft">SFT</option><option value="lora">LoRA</option><option value="qlora">QLoRA</option></select></Field><Field helpKey="field.concept" label={cs ? "Příklady JSONL" : "JSONL examples"}><textarea rows={8} value={data} onChange={(event) => setData(event.target.value)} /></Field><Note>{cs ? "Tato stránka model netrénuje. Učí vybrat přístup a zkontrolovat tvar příkladů." : "This page does not train a model. It helps choose an approach and check example format."}</Note></Panel>} result={<Panel title={cs ? "Rozhodnutí a data" : "Decision and data"}><Readout label={cs ? "První volba" : "First choice"} value={recommendation} /><div className={styles.method}><strong>{method.toUpperCase()}</strong><p>{descriptions[method]}</p></div><Readout label={cs ? "Platnost trénovacích řádků" : "Training row validity"} value={validity ? cs ? "Opravit" : "Fix" : cs ? "Platné" : "Valid"} detail={validity || undefined} /><Note>{cs ? "Prompt mění instrukce, RAG dodává aktuální fakta a fine-tuning mění chování modelu pomocí trénovacích dat." : "Prompting changes instructions, RAG supplies current facts, and fine-tuning adjusts behavior using training examples."}</Note></Panel>} />;
}

export function OperationsLab({ slug, locale }: { slug: string; locale: LabLocale }) {
  if (slug === "routing") return <RoutingLab locale={locale} />;
  if (slug === "inference") return <InferenceLab locale={locale} />;
  if (slug === "cache") return <CacheLab locale={locale} />;
  if (slug === "kv-cache") return <KvCacheLab locale={locale} />;
  if (slug === "quantization") return <QuantizationLab locale={locale} />;
  if (slug === "fine-tuning") return <FineTuningLab locale={locale} />;
  return null;
}
