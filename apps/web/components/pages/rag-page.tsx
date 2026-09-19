"use client";

import { AlertTriangle, Check, Circle, FileText, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, ModeSelector, Notice, PageHeader, Panel, ProgressBar, ProvenanceStrip, Select } from "@/components/ui";
import type { ExecutionMode, RagRunResult, RagSearchResult, RagStatus } from "@/lib/types";

const stages = ["parse", "chunk", "embed", "retrieve", "generate"] as const;

export function RagPage() {
  const { locale, mode: defaultMode, setMode: setDefaultMode } = useApp();
  const [mode, setMode] = useState<ExecutionMode>(defaultMode);
  const [question, setQuestion] = useState("Jak dlouho můžu vrátit běžné zařízení?");
  const [topK, setTopK] = useState(5);
  const [provider, setProvider] = useState("fixture");
  const [model, setModel] = useState("fixture-grounded-v2");
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [result, setResult] = useState<RagRunResult | null>(null);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"chunk" | "context" | "prompt" | "answer">("chunk");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/rag/status")
      .then(async (response) => { if (!response.ok) throw new Error(await response.text()); return response.json() as Promise<RagStatus>; })
      .then(setStatus)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const changeMode = (next: ExecutionMode) => {
    setMode(next);
    setDefaultMode(next);
    if (next === "fixture") { setProvider("fixture"); setModel("fixture-grounded-v2"); }
    if (next === "local") { setProvider("ollama"); setModel("qwen3:8b"); }
    if (next === "cloud") { setProvider("openai"); setModel("gpt-5.4-mini"); }
  };

  const run = async () => {
    setLoading(true); setError(""); setSelected(0);
    try {
      const response = await fetch("/api/v1/rag/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, mode, provider, model, top_k: topK, response_language: "auto" }) });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json() as RagRunResult;
      setResult(payload);
      localStorage.setItem("llmlab:last-rag", JSON.stringify(payload));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setLoading(false); }
  };

  const chunk = result?.results[selected];
  const provenance = mode === "fixture"
    ? (locale === "cs" ? "Korpus: syntetický · Retrieval: skutečný lokální index · Generování: deterministický fixture" : "Corpus: synthetic · Retrieval: real local index · Generation: deterministic fixture")
    : mode === "local"
      ? (locale === "cs" ? "Korpus: syntetický · Retrieval: skutečný lokální index · Generování: Ollama" : "Corpus: synthetic · Retrieval: real local index · Generation: Ollama")
      : (locale === "cs" ? "Korpus: syntetický · Retrieval: skutečný lokální index · Generování: cloud po kliknutí" : "Corpus: synthetic · Retrieval: real local index · Generation: cloud after explicit action");

  return <div className="rag-page">
    <PageHeader title={locale === "cs" ? "Skutečný vícejazyčný RAG" : "Real multilingual RAG"} description={locale === "cs" ? "Český nebo anglický dotaz se hledá ve skutečných anglických dokumentech Atlas Works." : "Search real English Atlas Works documents with a Czech or English question."} helpKey="page.rag" actions={<ModeSelector value={mode} onChange={changeMode} />} />
    {status && <ProvenanceStrip mode={mode} provider={provider} model={result?.retrieval.embedding_model ?? status.embedding_model} tail={`${status.corpus_id} · v${status.corpus_version} · ${status.chunk_count} chunks`} />}
    {status?.embedding_warning && <Notice tone="warning" title={locale === "cs" ? "Použit fallback embedding" : "Embedding fallback active"}>{status.embedding_warning}</Notice>}
    {error && <Notice tone="danger" title={locale === "cs" ? "Pipeline selhala" : "Pipeline failed"}>{error}</Notice>}
    <div className="question-row">
      <label className="field"><HelpLabel label={locale === "cs" ? "Otázka" : "Question"} helpKey="field.ragQuestion" /><input maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void run(); }} /></label>
      <Button onClick={() => void run()} loading={loading} disabled={!question.trim()}><Play size={14} />{locale === "cs" ? "Spustit skutečnou pipeline" : "Run real pipeline"}</Button>
    </div>
    <p className="rag-truth-line"><Check size={14} />{provenance}</p>

    <div className="rag-workspace">
      <Panel title={locale === "cs" ? "Konfigurace" : "Configuration"} className="rag-config">
        <Readout label="Corpus" value={status ? `${status.corpus_id} v${status.corpus_version}` : "…"} />
        <Readout label={locale === "cs" ? "Dokumenty" : "Documents"} value={status ? `${status.document_count} · English · synthetic` : "…"} />
        <Readout label="Embedding" value={status?.embedding_model ?? "…"} />
        <Readout label={locale === "cs" ? "Rozměr" : "Dimensions"} value={status ? String(status.vector_dimensions) : "…"} />
        <label className="field"><HelpLabel label="Top K" /><input type="range" min={1} max={10} value={topK} onChange={(event) => setTopK(Number(event.target.value))} /><div className="range-output"><span>1</span><strong className="mono">{topK}</strong><span>10</span></div></label>
        {mode === "cloud" && <label className="field"><HelpLabel label="Provider" /><Select value={provider} onChange={setProvider} ariaLabel="Provider"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="gemini">Gemini</option><option value="openai_compatible">OpenAI-compatible</option></Select></label>}
        {mode !== "fixture" && <label className="field"><HelpLabel label="Generator model" /><input value={model} onChange={(event) => setModel(event.target.value)} /></label>}
        <div className={`mode-explainer mode-${mode}`}><strong>{mode}</strong><span>{provenance}</span></div>
      </Panel>

      <div className="rag-center">
        <Panel title={locale === "cs" ? "Naměřené fáze" : "Measured stages"} className="pipeline-panel">
          <div className="pipeline-stages">{stages.map((stage, index) => <div className={result ? "complete" : ""} key={stage}><span>{result ? <Check size={12} /> : index + 1}</span><strong>{stage}</strong><small className="mono">{result ? `${result.timings_ms[stage] ?? 0} ms` : "—"}</small></div>)}</div>
        </Panel>
        <Panel title={locale === "cs" ? "Skutečně nalezené chunky" : "Actually retrieved chunks"} aside={<span className="panel-meta">{result ? `${result.results.length} / ${result.retrieval.top_k}` : "0"}</span>} className="chunks-panel">
          {!result && <Empty locale={locale} />}
          {result && <div className="chunk-list">{result.results.map((item, index) => <button key={item.chunk_id} className={selected === index ? "selected" : ""} onClick={() => { setSelected(index); setTab("chunk"); }}><span className="chunk-rank"><Circle size={13} fill={selected === index ? "currentColor" : "none"} />#{index + 1}</span><div><strong>{item.document_id} · {item.section}</strong><small className="mono">{item.path}</small><p>{item.excerpt}</p></div><div className="chunk-score"><strong className="mono">{item.fused_score.toFixed(3)}</strong><ProgressBar value={item.fused_score * 100} /></div></button>)}</div>}
        </Panel>
      </div>

      <Panel title={locale === "cs" ? "Inspektor důkazů" : "Evidence inspector"} className="evidence-panel">
        <div className="tabs" role="tablist">{(["chunk", "context", "prompt", "answer"] as const).map((item) => <button role="tab" aria-selected={tab === item} key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
        {!result && <Empty locale={locale} />}
        {result && tab === "chunk" && (chunk ? <ChunkInspector chunk={chunk} /> : <Notice tone="warning" title="Out of scope">{result.answer}</Notice>)}
        {result && tab === "context" && <pre className="rag-code">{result.context || "[no relevant context — generation skipped]"}</pre>}
        {result && tab === "prompt" && <pre className="rag-code">{result.final_prompt}</pre>}
        {result && tab === "answer" && <Answer result={result} locale={locale} />}
      </Panel>
    </div>
    {result && <Answer result={result} locale={locale} />}
  </div>;
}

function Readout({ label, value }: { label: string; value: string }) { return <div className="rag-readout"><span>{label}</span><strong className="mono">{value}</strong></div>; }
function Empty({ locale }: { locale: string }) { return <div className="rag-empty"><FileText size={20} /><p>{locale === "cs" ? "Spusť dotaz. Výsledky nejsou předvyplněné." : "Run a question. Results are not prefilled."}</p></div>; }

function ChunkInspector({ chunk }: { chunk: RagSearchResult }) {
  return <div className="inspector-content"><div className="source-meta"><FileText size={18} /><div><strong>{chunk.title}</strong><span className="mono">{chunk.path} · {chunk.section}</span></div></div><div className="score-ledger"><Score label="dense" value={chunk.dense_score} /><Score label="BM25" value={chunk.lexical_score} /><Score label="fused" value={chunk.fused_score} /><Score label="reranker" value={chunk.reranker_score} /></div><span className="section-label">Original English evidence</span><blockquote>{chunk.excerpt}</blockquote></div>;
}
function Score({ label, value }: { label: string; value: number | null }) { return <div><span>{label}</span><strong className="mono">{value === null ? "not run" : value.toFixed(4)}</strong></div>; }
function Answer({ result, locale }: { result: RagRunResult; locale: string }) {
  return <section className={`rag-answer ${result.retrieval.generation_skipped ? "refused" : ""}`}><header><strong>{locale === "cs" ? "Odpověď" : "Answer"}</strong><span className="mono">{result.latency_ms} ms · ${result.usage.cost_usd ?? 0}</span></header><p>{result.answer}</p>{result.retrieval.generation_skipped && <small><AlertTriangle size={13} />{locale === "cs" ? "Generátor nebyl zavolán: nejlepší skóre nesplnilo práh relevance." : "Generator was not called: the best score did not meet the relevance threshold."}</small>}<footer className="mono">{result.provider} / {result.model} · input {result.usage.input_tokens} · output {result.usage.output_tokens}</footer></section>;
}
