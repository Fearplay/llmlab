"use client";

import { Check, ChevronLeft, ChevronRight, Circle, FileText, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, HelpLabel, MetricLabel, ModeSelector, PageHeader, Panel, ProgressBar, Select } from "@/components/ui";
import { ragChunks } from "@/lib/fixtures";
import type { ExecutionMode } from "@/lib/types";

const stages = ["parse", "chunk", "embed", "retrieve", "rerank", "generate", "evaluate"] as const;
const timings = ["0.08 s", "0.21 s", "0.18 s", "0.34 s", "0.19 s", "0.32 s", "0.10 s"];

export function RagPage() {
  const { t, mode: defaultMode, setMode: setDefaultMode } = useApp();
  const [mode, setMode] = useState<ExecutionMode>(defaultMode);
  const [question, setQuestion] = useState(t("rag.sampleQuestion"));
  const [topK, setTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(480);
  const [overlap, setOverlap] = useState(80);
  const [chunkStrategy, setChunkStrategy] = useState("recursive");
  const [retrieval, setRetrieval] = useState("hybrid");
  const [reranker, setReranker] = useState("on");
  const [selectedStage, setSelectedStage] = useState(3);
  const [selectedChunk, setSelectedChunk] = useState(1);
  const [tab, setTab] = useState("chunk");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(100);
  const visibleChunks = ragChunks.slice(0, topK);
  const chunk = ragChunks.find((item) => item.id === selectedChunk) ?? ragChunks[0];

  useEffect(() => {
    queueMicrotask(() => setQuestion(t("rag.sampleQuestion")));
  }, [t]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setProgress((value) => {
      const next = Math.min(100, value + 10);
      setSelectedStage(Math.min(stages.length - 1, Math.floor(next / 15)));
      if (next === 100) setRunning(false);
      return next;
    }), 180);
    return () => window.clearInterval(timer);
  }, [running]);

  const run = () => { setProgress(0); setSelectedStage(0); setRunning(true); };
  const provider = mode === "local" ? "Ollama" : mode === "cloud" ? "OpenAI" : "Fixture engine";

  return (
    <div className="rag-page">
      <PageHeader title={t("rag.title")} description={t("rag.subtitle")} helpKey="page.rag" actions={<div className="rag-mode"><label>{t("app.mode")}</label><ModeSelector value={mode} onChange={(value) => { setMode(value); setDefaultMode(value); }} /></div>} />
      <div className="question-row"><label className="field"><HelpLabel label={t("rag.question")} helpKey="field.ragQuestion" /><input value={question} onChange={(event) => setQuestion(event.target.value)} /></label><div className="field provider-field"><HelpLabel label={t("app.provider")} helpKey="prompt.provider" /><strong>{provider}</strong></div><Button onClick={run} loading={running}><Play size={14} />{t("rag.runPipeline")}</Button></div>
      {running && <div className="pipeline-progress"><ProgressBar value={progress} /><span className="mono">{progress}%</span></div>}

      <div className="rag-workspace">
        <Panel title={t("rag.configuration")} className="rag-config">
          <FieldSelect label={t("rag.source")} helpKey="field.sourceCorpus" value="docs" disabled><option value="docs">{t("rag.sourceValue")}</option></FieldSelect>
          <FieldSelect label={t("rag.chunkStrategy")} helpKey="field.chunkStrategy" value={chunkStrategy} onChange={setChunkStrategy}><option value="recursive">{t("rag.recursive")}</option><option value="sentence">{t("rag.sentenceBoundary")}</option><option value="fixed">{t("rag.fixedWindow")}</option></FieldSelect>
          <div className="form-grid"><label className="field"><HelpLabel label={t("rag.chunkSize")} helpKey="rag.chunkSize" /><input type="number" min={80} max={2000} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} /><small>{t("common.tokens")}</small></label><label className="field"><HelpLabel label={t("rag.overlap")} helpKey="rag.overlap" /><input type="number" min={0} max={500} value={overlap} onChange={(event) => setOverlap(Number(event.target.value))} /><small>{t("common.tokens")}</small></label></div>
          <FieldSelect label={t("rag.embedding")} helpKey="field.embeddingModel" value={mode === "local" ? "nomic" : "fixture"} disabled><option value="fixture">fixture-embed-v1</option><option value="nomic">nomic-embed-text</option></FieldSelect>
          <FieldSelect label={t("rag.retrieval")} helpKey="rag.retrieval" value={retrieval} onChange={setRetrieval}><option value="hybrid">{t("rag.hybrid")}</option><option value="vector">{t("rag.vectorOnly")}</option><option value="keyword">{t("rag.keywordOnly")}</option></FieldSelect>
          <label className="field"><HelpLabel label={t("rag.topK")} helpKey="rag.topK" /><input type="range" min={1} max={5} value={topK} onChange={(event) => { const next = Number(event.target.value); setTopK(next); if (selectedChunk > next) setSelectedChunk(1); }} /><div className="range-output"><span>1</span><strong className="mono">{topK}</strong><span>5</span></div></label>
          <FieldSelect label={t("rag.reranker")} helpKey="field.reranker" value={reranker} onChange={setReranker}><option value="on">{t("common.on")} · bge-reranker</option><option value="off">{t("common.off")}</option></FieldSelect>
          <FieldSelect label={t("rag.generator")} helpKey="prompt.model" value={provider} disabled><option>{provider}</option></FieldSelect>
          <div className={`mode-explainer mode-${mode}`}><strong>{t(`app.${mode}`)}</strong><span>{mode === "fixture" ? t("app.comingFromFixture") : mode === "local" ? "Requests stay on your Ollama host." : "Cloud request runs only after explicit action."}</span></div>
        </Panel>

        <div className="rag-center">
          <Panel title={t("rag.pipeline")} className="pipeline-panel">
            <div className="pipeline-stages">{stages.map((stage, index) => <button key={stage} className={`${selectedStage === index ? "selected" : ""} ${progress >= (index + 1) * 14 ? "complete" : ""}`} onClick={() => setSelectedStage(index)}><span>{progress >= (index + 1) * 14 ? <Check size={12} /> : index + 1}</span><strong>{t(`rag.${stage}`)}</strong><small className="mono">{progress >= (index + 1) * 14 ? timings[index] : "—"}</small></button>)}</div>
          </Panel>
          <Panel title={t("rag.retrieved")} aside={<span className="panel-meta">Top {topK} of 24</span>} className="chunks-panel">
            <div className="chunk-list">{visibleChunks.map((item) => <button key={item.id} className={selectedChunk === item.id ? "selected" : ""} onClick={() => { setSelectedChunk(item.id); setTab("chunk"); }}><span className="chunk-rank"><Circle size={14} fill={selectedChunk === item.id ? "currentColor" : "none"} />#{item.id}</span><div><strong>{item.title}</strong><small className="mono">{item.source} · chunk {item.chunk}</small><p>{item.text}</p></div><div className="chunk-score"><strong className="mono">{item.score.toFixed(3)}</strong><ProgressBar value={item.score * 100} /></div></button>)}</div>
          </Panel>
        </div>

        <Panel title={t("rag.evidence")} aside={<span className="inspector-pager"><ChevronLeft size={14} />{selectedChunk} / {topK}<ChevronRight size={14} /></span>} className="evidence-panel">
          <div className="tabs" role="tablist">{["chunk", "context", "prompt", "claims"].map((item) => <button role="tab" aria-selected={tab === item} key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{t(`rag.${item}`)}</button>)}</div>
          {tab === "chunk" && <ChunkInspector chunk={chunk} />}
          {tab === "context" && <div className="inspector-content"><span className="section-label">Assembled context · {topK} chunks</span>{visibleChunks.map((item) => <blockquote key={item.id}><strong>[{item.id}] {item.title}</strong><p>{item.text}</p></blockquote>)}</div>}
          {tab === "prompt" && <div className="inspector-content"><span className="section-label">{t("rag.finalPrompt")}</span><pre>{`SYSTEM\nAnswer only from CONTEXT. Cite sources.\n\nCONTEXT\n${visibleChunks.map((item) => `[${item.id}] ${item.text}`).join("\n")}\n\nQUESTION\n${question}`}</pre></div>}
          {tab === "claims" && <ClaimsInspector />}
        </Panel>
      </div>

      <div className="rag-results"><strong>{t("rag.pipelineResults")}</strong><ResultMetric label={t("rag.faithfulness")} helpKey="rag.faithfulness" value="0.92" percent={92} /><ResultMetric label={t("rag.contextPrecision")} value="0.88" percent={88} /><ResultMetric label={t("rag.relevance")} value="0.95" percent={95} /><div><MetricLabel label={t("rag.totalTime")} helpKey="metric.latency" /><strong className="mono">1.42 s</strong></div><div><MetricLabel label={t("rag.totalCost")} /><strong className="mono positive">{mode === "local" ? t("rag.localCost") : mode === "fixture" ? "$0.0041 fixture" : t("app.unavailable")}</strong></div></div>
      <p className="method-note">{t("rag.lossy")}</p>
    </div>
  );
}

function FieldSelect({ label, helpKey, value, children, onChange, disabled = false }: { label: string; helpKey?: string; value: string; children: React.ReactNode; onChange?: (value: string) => void; disabled?: boolean }) {
  return <label className="field"><HelpLabel label={label} helpKey={helpKey} /><Select value={value} onChange={onChange} disabled={disabled} ariaLabel={label}>{children}</Select></label>;
}

function ChunkInspector({ chunk }: { chunk: (typeof ragChunks)[number] }) {
  const { t } = useApp();
  return <div className="inspector-content"><div className="source-meta"><FileText size={18} /><div><strong>{chunk.title}</strong><span className="mono">{chunk.source}</span></div><span className="mono">{t("common.providerScore")} {chunk.score.toFixed(3)}</span></div><span className="section-label">{t("rag.chunkContent")}</span><div className="source-code"><span className="line-numbers">1<br />2<br />3<br />4</span><p>{highlight(chunk.text, "within 30 days of delivery")}</p></div><span className="section-label">{t("rag.retrievalFinding")}</span><div className={chunk.relevant ? "finding supported" : "finding warning"}><Check size={15} /><span>{chunk.relevant ? t("rag.usefulEvidence") : t("rag.lowRelevance")}</span></div></div>;
}

function ClaimsInspector() {
  const { t } = useApp();
  return <div className="inspector-content"><div className="answer-box"><span className="section-label">{t("rag.generatedAnswer")}</span><p>{t("rag.answer")}</p></div><div className="claim-card"><span className="claim-status"><Check size={14} />{t("rag.supported")}</span><p>{t("rag.selectedClaim")}</p><strong>{t("rag.sourceSpan")}</strong><blockquote>“Footwear items may be returned within 30 days of delivery…”</blockquote><small>Evaluator: fixture-faithfulness-v1 · {t("labs.confidence")} 0.94</small></div></div>;
}

function ResultMetric({ label, helpKey, value, percent }: { label: string; helpKey?: string; value: string; percent: number }) {
  return <div className="result-metric"><MetricLabel label={label} helpKey={helpKey} /><strong className="mono">{value}</strong><ProgressBar value={percent} tone="green" /></div>;
}

function highlight(text: string, needle: string) {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</>;
}
