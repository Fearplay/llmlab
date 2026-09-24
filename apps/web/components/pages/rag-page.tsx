"use client";

import { ArrowRight, BookOpen, FileText, LoaderCircle, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader } from "@/components/ui";
import { errorMessage, fetchJson, formatDate } from "./live-api";
import styles from "./user-rag-page.module.css";

type Strategy = "fixed" | "sentence" | "paragraph" | "semantic";
interface Document { id: string; name: string; media_type: string; strategy: Strategy; chunk_size: number; overlap: number; embedding_model_key: string; chunk_count: number; created_at: string }
interface Hit { chunk_id: string; document_id: string; document_name: string; text: string; start: number; end: number; page: number | null; score: number; dense_score: number; bm25_score: number | null; marker?: string }
interface RagAnswer { answer: string; question: string; sources: Hit[]; citations: Hit[]; citation_markers_valid: boolean; grounding_status: string; citation_warning: string | null; usage: { input_tokens: number; output_tokens: number }; model_key: string; run_id: string; latency_ms: number; retrieval: { hits: Hit[] } }

function supports(capabilities: string[] | Record<string, boolean>, key: string) { return Array.isArray(capabilities) ? capabilities.includes(key) : capabilities?.[key] === true; }

export function RagPage() {
  const { locale, models, selectedModel } = useApp();
  const cs = locale === "cs";
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [embeddingKey, setEmbeddingKey] = useState("");
  const [strategy, setStrategy] = useState<Strategy>("fixed");
  const [chunkSize, setChunkSize] = useState(450);
  const [overlap, setOverlap] = useState(80);
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [bm25, setBm25] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(512);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [preview, setPreview] = useState<{ id: string; chunks: Array<{ id: string; text: string; page?: number | null; start: number; end: number }> } | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const embeddingModels = useMemo(() => models.filter((model) => model.available && supports(model.capabilities, "embeddings")), [models]);
  const generationModels = useMemo(() => models.filter((model) => model.available && supports(model.capabilities, "generation")), [models]);
  const [generationKey, setGenerationKey] = useState("");

  useEffect(() => {
    if (embeddingKey || !embeddingModels.length) return;
    queueMicrotask(() => setEmbeddingKey(embeddingModels.find((model) => model.mode === "local")?.key ?? embeddingModels[0].key));
  }, [embeddingKey, embeddingModels]);
  useEffect(() => {
    if (!generationModels.length) return;
    queueMicrotask(() => setGenerationKey((current) => current || selectedModel?.key || generationModels[0].key));
  }, [generationModels, selectedModel?.key]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchJson<{ documents: Document[] }>("/api/v1/user-documents");
      setDocuments(data.documents);
      setStatusError(null);
      setSelectedIds((current) => current.length
        ? current.filter((id) => data.documents.some((doc) => doc.id === id))
        : data.documents.map((doc) => doc.id));
    } catch (caught) { setStatusError(errorMessage(caught, locale)); }
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  const selectedDocuments = documents.filter((doc) => selectedIds.includes(doc.id));
  const matchingDocuments = selectedDocuments.filter((doc) => doc.embedding_model_key === embeddingKey);
  const activeSource = answer?.sources.find((item) => item.chunk_id === sourceId) ?? answer?.sources[0];

  const upload = async () => {
    if (!file || !embeddingKey) return;
    setUploading(true); setActionError(null); setAnswer(null);
    try {
      const body = new FormData();
      body.set("file", file); body.set("strategy", strategy); body.set("chunk_size", String(chunkSize)); body.set("overlap", String(overlap)); body.set("embedding_model_key", embeddingKey);
      const response = await fetch("/api/v1/user-documents", { method: "POST", body });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json() as { document: Document };
      setFile(null); setSelectedIds([data.document.id]); await refresh();
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
    finally { setUploading(false); }
  };
  const remove = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/user-documents/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response));
      if (preview?.id === id) setPreview(null);
      setAnswer(null); await refresh();
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
  };
  const showChunks = async (id: string) => {
    try {
      const data = await fetchJson<{ chunks: Array<{ id: string; text: string; page?: number | null; start: number; end: number }> }>(`/api/v1/user-documents/${encodeURIComponent(id)}/chunks`);
      setPreview({ id, chunks: data.chunks }); setActionError(null);
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
  };
  const ask = async () => {
    if (!question.trim() || !generationKey || !matchingDocuments.length) return;
    setAsking(true); setAnswer(null); setActionError(null);
    try {
      const data = await fetchJson<RagAnswer>("/api/v1/user-rag/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), generation_model_key: generationKey, embedding_model_key: embeddingKey, document_ids: matchingDocuments.map((doc) => doc.id), top_k: topK, bm25_rerank: bm25, temperature, max_tokens: maxTokens }) });
      setAnswer(data); setSourceId(data.sources[0]?.chunk_id ?? null);
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
    finally { setAsking(false); }
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { setFile(event.target.files?.[0] ?? null); setActionError(null); };

  return <div className={styles.page}>
    <PageHeader eyebrow="RAG / RETRIEVAL" title={cs ? "RAG nad vašimi dokumenty" : "RAG with your documents"} description={cs ? "Nahrajte zdroj, vyberte způsob dělení a embedding. Pak sledujte, které úryvky vedly k odpovědi." : "Upload a source, choose chunking and an embedding model, then inspect which excerpts led to the answer."} helpKey="page.rag" />
    {statusError && <Notice tone="danger" title={cs ? "Seznam dokumentů není dostupný" : "Documents are unavailable"}>{statusError}</Notice>}
    {actionError && <Notice tone="danger" title={cs ? "Požadavek se nepodařil" : "Request failed"}>{actionError}</Notice>}
    <div className={styles.grid}>
      <div className={styles.left}>
        <section className={styles.panel}><header><div><span className={styles.step}>01 / SOURCE</span><h2>{cs ? "Nahrajte dokument" : "Upload a document"}</h2></div><span>{documents.length} {cs ? "uloženo" : "saved"}</span></header><div className={styles.body}>
          <label className={styles.upload}><Upload size={23} /><strong>{file?.name ?? (cs ? "Vybrat PDF, DOCX, TXT nebo Markdown" : "Choose PDF, DOCX, TXT or Markdown")}</strong><small>{cs ? "Max. 10 MB, text se uloží jen lokálně." : "Up to 10 MB; extracted text is stored locally."}</small><input type="file" accept=".pdf,.docx,.txt,.md,.markdown" onChange={onFile} /></label>
          <div className={styles.twoFields}><label className={styles.field}>{cs ? "Metoda dělení" : "Chunking method"}<select value={strategy} onChange={(event) => setStrategy(event.target.value as Strategy)}><option value="fixed">{cs ? "Pevná délka" : "Fixed size"}</option><option value="sentence">{cs ? "Podle vět" : "Sentences"}</option><option value="paragraph">{cs ? "Podle odstavců" : "Paragraphs"}</option><option value="semantic">{cs ? "Podle významu" : "Semantic"}</option></select></label><label className={styles.field}>{cs ? "Embedding model" : "Embedding model"}<select value={embeddingKey} onChange={(event) => setEmbeddingKey(event.target.value)}>{embeddingModels.map((model) => <option key={model.key} value={model.key}>{model.key}</option>)}</select></label></div>
          <div className={styles.twoFields}><label className={styles.field}>{cs ? "Velikost úryvku" : "Chunk size"}<div className={styles.slider}><input type="range" min={80} max={1200} step={10} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} /><strong>{chunkSize}</strong></div></label><label className={styles.field}>{cs ? "Překryv" : "Overlap"}<div className={styles.slider}><input type="range" min={0} max={Math.min(300, chunkSize - 10)} step={10} value={Math.min(overlap, chunkSize - 10)} onChange={(event) => setOverlap(Number(event.target.value))} /><strong>{overlap}</strong></div></label></div>
          <p className={styles.hint}>{cs ? "Menší úryvky vyhledávají přesněji, větší zachovají více souvislostí. Embedding převádí text na vektory pro hledání podobnosti." : "Smaller chunks improve precision; larger chunks preserve context. An embedding converts text into vectors for similarity search."}</p>
          <Button onClick={() => void upload()} loading={uploading} disabled={!file || !embeddingKey || overlap >= chunkSize}>{cs ? "Nahrát a indexovat" : "Upload and index"}</Button>
          {!embeddingModels.length && <p className={styles.hint}>{cs ? "Není dostupný embeddingový model. V Ollamě stáhněte např. all-minilm a obnovte nabídku modelů." : "No embedding model available. Pull e.g. all-minilm in Ollama and refresh the model list."}</p>}
        </div></section>
        <section className={styles.panel}><header><div><span className={styles.step}>02 / INDEX</span><h2>{cs ? "Zdroje a úryvky" : "Sources and chunks"}</h2></div></header><div className={styles.body}>
          {documents.length ? <div className={styles.docList}>{documents.map((doc) => <div key={doc.id} className={styles.doc}><input type="checkbox" checked={selectedIds.includes(doc.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id))} aria-label={`${cs ? "Vybrat" : "Select"} ${doc.name}`} /><FileText size={17} /><div><strong>{doc.name}</strong><small>{doc.chunk_count} {cs ? "úryvků" : "chunks"} · {doc.strategy} · {formatDate(doc.created_at, locale)}</small><small>{doc.embedding_model_key}</small></div><button type="button" onClick={() => void showChunks(doc.id)}>{cs ? "Náhled" : "Preview"}</button><button type="button" onClick={() => void remove(doc.id)} aria-label={`${cs ? "Smazat" : "Delete"} ${doc.name}`}><Trash2 size={15} /></button></div>)}</div> : <div className={styles.empty}><BookOpen size={22} /><strong>{cs ? "Zatím žádný dokument" : "No documents yet"}</strong><p>{cs ? "Nahrajte první soubor. Ukázkový korpus se nenačítá automaticky." : "Upload your first file. No sample corpus is loaded automatically."}</p></div>}
          {preview && <details open className={styles.preview}><summary>{cs ? "Úryvky dokumentu" : "Document chunks"} · {preview.chunks.length}</summary>{preview.chunks.map((chunk, index) => <article key={chunk.id}><span>#{index + 1} · {chunk.page ? `${cs ? "str." : "p."} ${chunk.page} · ` : ""}{chunk.start}–{chunk.end}</span><p>{chunk.text}</p></article>)}</details>}
        </div></section>
      </div>
      <div className={styles.right}>
        <section className={styles.panel}><header><div><span className={styles.step}>03 / QUESTION</span><h2>{cs ? "Zeptejte se dokumentů" : "Ask your documents"}</h2></div></header><div className={styles.body}>
          <label className={styles.field}>{cs ? "Otázka" : "Question"}<textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={cs ? "Např. Jaké jsou podmínky vrácení?" : "E.g. What is the return policy?"} /></label>
          <label className={styles.field}>{cs ? "Generativní model" : "Generation model"}<select value={generationKey} onChange={(event) => setGenerationKey(event.target.value)}>{generationModels.map((model) => <option key={model.key} value={model.key}>{model.key}</option>)}</select></label>
          <div className={styles.threeFields}><label className={styles.field}>Top K<div className={styles.slider}><input type="range" min={1} max={10} value={topK} onChange={(event) => setTopK(Number(event.target.value))} /><strong>{topK}</strong></div></label><label className={styles.field}>Temperature<div className={styles.slider}><input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /><strong>{temperature.toFixed(1)}</strong></div></label><label className={styles.field}>Max tokens<input type="number" min={1} max={8192} value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></label></div>
          <label className={styles.check}><input type="checkbox" checked={bm25} onChange={(event) => setBm25(event.target.checked)} /><span>{cs ? "Přerovnat výsledky pomocí BM25" : "Rerank results with BM25"}</span></label>
          <p className={styles.hint}>{cs ? "Nejprve se vyhledají relevantní úryvky. Ty pak dostane vybraný model jako podklady. Citace jsou odkazy na tyto úryvky." : "Relevant excerpts are retrieved first, then passed to the selected model. Citations link back to those exact excerpts."}</p>
          <Button onClick={() => void ask()} loading={asking} disabled={!question.trim() || !generationKey || !matchingDocuments.length}><Search size={15} />{cs ? "Vyhledat a odpovědět" : "Retrieve and answer"}</Button>
          {documents.length > 0 && !matchingDocuments.length && <p className={styles.hint}>{cs ? "Vybrané dokumenty používají jiný embeddingový model. Zvolte model použitý při nahrání." : "Selected documents use a different embedding model. Choose the model used during upload."}</p>}
        </div></section>
        <section className={styles.panel}><header><div><span className={styles.step}>04 / EVIDENCE</span><h2>{cs ? "Odpověď a důkazy" : "Answer and evidence"}</h2></div>{asking && <LoaderCircle className={styles.spin} size={18} />}</header><div className={styles.body}>
          {answer ? <><div className={styles.answer}><p>{answer.answer}</p><div><span>{answer.latency_ms} ms · {answer.usage.input_tokens} / {answer.usage.output_tokens} tokens</span><Link href="/history">{cs ? "Zobrazit běh" : "View run"}<ArrowRight size={13} /></Link></div></div>
            <p className={styles.citationNote}>{answer.citation_markers_valid ? (cs ? "Značky citací odkazují na nalezené úryvky. Pravdivost jednotlivých tvrzení ověřte ve zdrojích." : "Citation markers point to retrieved excerpts. Verify individual claims against the sources.") : (cs ? "Model nepoužil platné značky citací. Odpověď zkontrolujte proti úryvkům níže." : "The model did not use valid citation markers. Check its answer against the excerpts below.")}</p>
            <div className={styles.sourceTabs}>{answer.sources.map((source) => <button type="button" key={source.chunk_id} aria-pressed={activeSource?.chunk_id === source.chunk_id} onClick={() => setSourceId(source.chunk_id)}>{source.marker} {source.document_name}</button>)}</div>
            {activeSource && <article className={styles.source}><div><strong>{activeSource.document_name}</strong><span>{activeSource.page ? `${cs ? "str." : "p."} ${activeSource.page} · ` : ""}{cs ? "znaky" : "chars"} {activeSource.start}–{activeSource.end} · score {activeSource.score.toFixed(3)}</span></div><p>{activeSource.text}</p><small>chunk {activeSource.chunk_id}</small></article>}
          </> : <div className={styles.empty}><Search size={23} /><strong>{cs ? "Zatím žádná odpověď" : "No answer yet"}</strong><p>{cs ? "Vyberte dokument, položte otázku a zkontrolujte odpověď proti úryvkům." : "Select a document, ask a question and inspect the answer beside its excerpts."}</p></div>}
        </div></section>
      </div>
    </div>
  </div>;
}

async function responseError(response: Response): Promise<string> {
  try { const payload = await response.json() as { detail?: unknown }; if (typeof payload.detail === "string") return payload.detail; }
  catch { /* The response may not contain JSON. */ }
  return `HTTP ${response.status}`;
}
