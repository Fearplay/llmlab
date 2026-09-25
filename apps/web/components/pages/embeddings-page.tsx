"use client";

import { ArrowRight, Calculator, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel, Button, Notice, PageHeader } from "@/components/ui";
import { errorMessage, fetchJson } from "./live-api";
import styles from "./embeddings-page.module.css";

interface EmbeddingResult { vectors: number[][]; dimensions: number; provider: string; model: string; usage: { input_tokens: number }; fixture: boolean }
function supports(capabilities: string[] | Record<string, boolean>) { return Array.isArray(capabilities) ? capabilities.includes("embeddings") : capabilities?.embeddings === true; }
function cosine(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return null;
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const aa = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const bb = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  return aa && bb ? dot / aa / bb : null;
}

export function EmbeddingsPage() {
  const { locale, models } = useApp();
  const cs = locale === "cs";
  const available = useMemo(() => models.filter((model) => model.available && supports(model.capabilities)), [models]);
  const [modelKey, setModelKey] = useState("");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (!modelKey && available.length) queueMicrotask(() => setModelKey(available.find((model) => model.mode === "local")?.key ?? available[0].key)); }, [modelKey, available]);
  const calculate = async () => {
    const selected = available.find((model) => model.key === modelKey);
    if (!selected || !first.trim() || !second.trim()) return;
    setLoading(true); setResult(null); setError(null);
    try {
      const data = await fetchJson<EmbeddingResult>("/api/v1/embeddings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selected.mode, provider: selected.provider, model: selected.id, inputs: [first.trim(), second.trim()] }) });
      setResult(data);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setLoading(false); }
  };
  const similarity = result?.vectors?.length === 2 ? cosine(result.vectors[0], result.vectors[1]) : null;
  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "VEKTOROVÝ PROSTOR" : "VECTOR SPACE"} title={cs ? "Embeddingy a podobnost" : "Embeddings and similarity"} description={cs ? "Nechte skutečný embeddingový model převést dvě věty na vektory a prohlédněte si jejich kosinovou podobnost." : "Use a real embedding model to turn two sentences into vectors and inspect their cosine similarity."} helpKey="page.embeddings" />
    {error && <Notice tone="danger" title={cs ? "Embedding se nepodařil" : "Embedding failed"}>{error}</Notice>}
    <section className={styles.workspace}><div className={styles.form}><span className={styles.kicker}>01 / INPUT</span><h2>{cs ? "Porovnejte dva texty" : "Compare two texts"}</h2><label><HelpLabel label={cs ? "Embeddingový model" : "Embedding model"} helpKey="field.embeddingModel" /><select value={modelKey} onChange={(event) => { setModelKey(event.target.value); setResult(null); }}>{available.map((model) => <option key={model.key} value={model.key}>{model.key}</option>)}</select></label><label><HelpLabel label={cs ? "První text" : "First text"} helpKey="field.embeddingText" /><textarea rows={4} value={first} onChange={(event) => { setFirst(event.target.value); setResult(null); }} placeholder={cs ? "Napište první větu…" : "Write the first sentence…"} /></label><label><HelpLabel label={cs ? "Druhý text" : "Second text"} helpKey="field.embeddingText" /><textarea rows={4} value={second} onChange={(event) => { setSecond(event.target.value); setResult(null); }} placeholder={cs ? "Napište druhou větu…" : "Write the second sentence…"} /></label><Button loading={loading} disabled={!modelKey || !first.trim() || !second.trim()} onClick={() => void calculate()}><Calculator size={15} />{cs ? "Vypočítat podobnost" : "Calculate similarity"}</Button>{!available.length && <p className={styles.help}>{cs ? "Není dostupný embeddingový model. V Ollamě stáhněte např. all-minilm a obnovte seznam modelů." : "No embedding model is available. Pull e.g. all-minilm in Ollama and refresh the models."}</p>}</div><div className={styles.output}><span className={styles.kicker}>02 / RESULT</span><h2>{cs ? "Co model naměřil" : "What the model measured"}</h2>{result && similarity !== null ? <><div className={styles.score}><span>{cs ? "KOSINOVÁ PODOBNOST" : "COSINE SIMILARITY"}</span><strong>{similarity.toFixed(3)}</strong><p>{cs ? "1 znamená stejný směr vektorů, 0 pravý úhel, −1 opačný směr. Vyšší skóre často značí podobný význam, ale výsledek závisí na modelu." : "1 means aligned vectors, 0 orthogonal, −1 opposite. Higher scores often indicate similar meaning, but interpretation depends on the model."}</p></div><div className={styles.details}><div><span>{cs ? "Rozměry" : "Dimensions"}</span><strong>{result.dimensions}</strong></div><div><span>{cs ? "Vstupní tokeny" : "Input tokens"}</span><strong>{result.usage.input_tokens}</strong></div><div><span>{cs ? "Model" : "Model"}</span><strong>{result.model}</strong></div></div><div className={styles.vector}><span>{cs ? "Prvních 24 složek obou vektorů" : "First 24 components of both vectors"}</span>{result.vectors.map((vector, index) => <div key={index} className={styles.bars} aria-label={`${cs ? "Vektor" : "Vector"} ${index + 1}`}>{vector.slice(0, 24).map((value, position) => <i key={position} style={{ height: `${Math.max(4, Math.min(100, 50 + value * 45))}%` }} />)}</div>)}</div></> : <div className={styles.empty}><Sparkles size={22} /><strong>{cs ? "Výsledek vznikne až po výpočtu" : "Results appear after calculation"}</strong><p>{cs ? "Vektory nevyplňujeme ukázkovými čísly." : "No sample numbers are prefilled."}</p></div>}</div></section>
    <p className={styles.help}>{cs ? "Chcete vyhledávat v dokumentech pomocí embeddingů?" : "Want to search documents with embeddings?"} <Link href="/ai-lab/rag">{cs ? "Otevřít RAG" : "Open RAG"}<ArrowRight size={13} /></Link></p>
  </div>;
}
