"use client";

import { ArrowRight, BookOpen, FileText, LoaderCircle, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { AnswerReveal, HelpLabel, InfoTip, Button, Notice, PageHeader, RunStatus } from "@/components/ui";
import { MiniCorpus } from "./extra-experiments";
import { errorMessage, fetchJson, formatDate } from "./live-api";
import styles from "./user-rag-page.module.css";

type Strategy = "fixed" | "sentence" | "paragraph" | "semantic";
interface Document { id: string; name: string; media_type: string; strategy: Strategy; chunk_size: number; overlap: number; embedding_model_key: string; chunk_count: number; created_at: string }
interface Hit { chunk_id: string; document_id: string; document_name: string; text: string; start: number; end: number; page: number | null; score: number; dense_score: number; bm25_score: number | null; marker?: string }
interface RagAnswer { answer: string; question: string; sources: Hit[]; citations: Hit[]; citation_markers_valid: boolean; grounding_status: string; citation_warning: string | null; usage: { input_tokens: number; output_tokens: number }; model_key: string; run_id: string; latency_ms: number; retrieval: { hits: Hit[] }; pipeline?: Array<{ id: string; data: unknown }> }
const pipelineLinks: Record<string, string> = { chunking: "/ai-lab/chunking", embedding: "/ai-lab/embeddings", query_transform: "/ai-lab/retrieval", retrieval: "/ai-lab/retrieval", reranking: "/ai-lab/reranking", context: "/ai-lab/context", llm: "/ai-lab/prompt-tokens", answer: "/ai-lab/grounding" };
interface Chunk { id?: string; text: string; page?: number | null; start: number; end: number }
interface ChunkPreview { id: string | null; name: string; chunks: Chunk[]; strategy: Strategy; chunkSize: number; overlap: number }

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
  const [sourceMode, setSourceMode] = useState<"text" | "file">("text");
  const [textName, setTextName] = useState("Vložený text");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [retrievalMode, setRetrievalMode] = useState<"vector" | "lexical" | "hybrid">("vector");
  const [rewrittenQuery, setRewrittenQuery] = useState("");
  const [extraQueries, setExtraQueries] = useState("");
  const [diverse, setDiverse] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(512);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [preview, setPreview] = useState<ChunkPreview | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [asking, setAsking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => { if (preview) previewRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [preview]);

  const selectedDocuments = documents.filter((doc) => selectedIds.includes(doc.id));
  const matchingDocuments = selectedDocuments.filter((doc) => doc.embedding_model_key === embeddingKey);
  const activeSource = answer?.sources.find((item) => item.chunk_id === sourceId) ?? answer?.sources[0];

  const sourcePayload = () => ({ name: textName.trim() || "Vložený text", text: pastedText, strategy, chunk_size: chunkSize, overlap, embedding_model_key: embeddingKey });
  const clearDraftPreview = () => setPreview((current) => current?.id ? current : null);
  const completeIndex = async (response: Response) => {
    if (!response.ok) throw new Error(await responseError(response));
    const data = await response.json() as { document: Document };
    setFile(null);
    await refresh();
    setSelectedIds([data.document.id]);
    await showChunks(data.document.id);
  };
  const loadSample = async () => {
    if (!embeddingKey) return;
    setLoadingSample(true); setActionError(null); setAnswer(null);
    try {
      const data = await fetchJson<{ name: string; text: string }>("/api/v1/user-rag/sample-text");
      setTextName(data.name); setPastedText(data.text); setSourceMode("text");
      setPreview(null);
      const payload = { name: data.name, text: data.text, strategy, chunk_size: chunkSize, overlap, embedding_model_key: embeddingKey };
      if (strategy !== "semantic") {
        const draft = await fetchJson<{ chunks: Chunk[] }>("/api/v1/user-documents/text/preview", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        setPreview({ id: null, name: data.name, chunks: draft.chunks, strategy, chunkSize, overlap });
      }
      const response = await fetch("/api/v1/user-documents/text", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      await completeIndex(response);
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
    finally { setLoadingSample(false); }
  };
  const previewText = async () => {
    if (!pastedText.trim() || (strategy === "semantic" && !embeddingKey)) return;
    setPreviewing(true); setActionError(null);
    try {
      const data = await fetchJson<{ chunks: Chunk[] }>("/api/v1/user-documents/text/preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sourcePayload()),
      });
      setPreview({ id: null, name: textName.trim() || (cs ? "Vložený text" : "Pasted text"), chunks: data.chunks, strategy, chunkSize, overlap });
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
    finally { setPreviewing(false); }
  };
  const upload = async () => {
    if (!embeddingKey || (sourceMode === "file" ? !file : !pastedText.trim())) return;
    setUploading(true); setActionError(null); setAnswer(null);
    try {
      let response: Response;
      if (sourceMode === "file") {
        const body = new FormData();
        body.set("file", file!); body.set("strategy", strategy); body.set("chunk_size", String(chunkSize)); body.set("overlap", String(overlap)); body.set("embedding_model_key", embeddingKey);
        response = await fetch("/api/v1/user-documents", { method: "POST", body });
      } else {
        response = await fetch("/api/v1/user-documents/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sourcePayload()) });
      }
      await completeIndex(response);
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
      const data = await fetchJson<{ document: Document; chunks: Chunk[] }>(`/api/v1/user-documents/${encodeURIComponent(id)}/chunks`);
      setPreview({ id, name: data.document.name, chunks: data.chunks, strategy: data.document.strategy, chunkSize: data.document.chunk_size, overlap: data.document.overlap }); setActionError(null);
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
  };
  const ask = async () => {
    if (!question.trim() || !generationKey || !matchingDocuments.length) return;
    setAsking(true); setAnswer(null); setActionError(null);
    try {
      const data = await fetchJson<RagAnswer>("/api/v1/user-rag/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), generation_model_key: generationKey, embedding_model_key: embeddingKey, document_ids: matchingDocuments.map((doc) => doc.id), top_k: topK, retrieval_mode: retrievalMode, rewritten_query: rewrittenQuery.trim(), extra_queries: extraQueries.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 4), rerank_diversity: diverse, temperature, max_tokens: maxTokens }) });
      setAnswer(data); setSourceId(data.sources[0]?.chunk_id ?? null);
    } catch (caught) { setActionError(errorMessage(caught, locale)); }
    finally { setAsking(false); }
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => { setFile(event.target.files?.[0] ?? null); setActionError(null); };

  return <div className={styles.page}>
    <PageHeader eyebrow="RAG / RETRIEVAL" title={cs ? "RAG nad vašimi dokumenty" : "RAG with your documents"} description={cs ? "Vložte dlouhý text nebo nahrajte soubor. Uvidíte přesné chunky, které se indexují a používají v odpovědi." : "Paste a long text or upload a file. Inspect the exact chunks used for indexing and answers."} helpKey="page.rag" />
    {statusError && <Notice tone="danger" title={cs ? "Seznam dokumentů není dostupný" : "Documents are unavailable"}>{statusError}</Notice>}
    {actionError && <Notice tone="danger" title={cs ? "Požadavek se nepodařil" : "Request failed"}>{actionError}</Notice>}
    <div className={styles.grid}>
      <div className={styles.left}>
        <section className={styles.panel}><header><div><span className={styles.step}>01 / SOURCE</span><h2>{cs ? "Zdroj pro RAG" : "RAG source"}</h2></div><span>{documents.length} {cs ? "uloženo" : "saved"}</span></header><div className={styles.body}>
          <div className={styles.sourceTabs} role="group" aria-label={cs ? "Typ zdroje" : "Source type"}><button type="button" aria-pressed={sourceMode === "text"} disabled={loadingSample} onClick={() => setSourceMode("text")}>{cs ? "Vložit text" : "Paste text"}</button><button type="button" aria-pressed={sourceMode === "file"} disabled={loadingSample} onClick={() => setSourceMode("file")}>{cs ? "Nahrát soubor" : "Upload file"}</button></div>
          {sourceMode === "text" ? <div className={styles.textSource}>
            <div className={styles.sampleRow}><p className={styles.hint}>{cs ? "Načtení dlouhého anglického příkladu Atlas Works ho rovnou rozdělí a zaindexuje do kroku 2. Pro české dotazy vyberte vícejazyčný embeddingový model. Cloudový embedding může být placený." : "Loading the long English Atlas Works example also chunks and indexes it in step 2. Use a multilingual embedding model for Czech questions. Cloud embeddings may incur a charge."}</p><button type="button" onClick={() => void loadSample()} disabled={!embeddingKey || loadingSample || uploading}>{loadingSample ? (cs ? "Načítám a indexuji…" : "Loading and indexing…") : (cs ? "Načíst a indexovat příklad" : "Load and index example")}</button></div>
            <label className={styles.field}><HelpLabel label={cs ? "Název textu" : "Text name"} helpKey="field.documentName" /><input type="text" maxLength={120} disabled={loadingSample} value={textName} onChange={(event) => setTextName(event.target.value)} /></label>
            <label className={styles.field}><HelpLabel label={cs ? "Text dokumentu" : "Document text"} helpKey="field.sourceCorpus" /><textarea rows={12} maxLength={100000} disabled={loadingSample} value={pastedText} onChange={(event) => { setPastedText(event.target.value); clearDraftPreview(); }} placeholder={cs ? "Sem vložte dlouhý text, který chcete rozdělit a prohledávat…" : "Paste the long text you want to chunk and search…"} /></label>
            <span className={styles.counter}>{pastedText.length.toLocaleString(cs ? "cs-CZ" : "en-US")} / 100 000 {cs ? "znaků" : "characters"}</span>
          </div> : <label className={styles.upload}><Upload size={23} /><InfoTip label={cs ? "Nahrát dokument" : "Upload document"} helpKey="field.uploadDocument" context="field" /><strong>{file?.name ?? (cs ? "Vybrat PDF, DOCX, TXT nebo Markdown" : "Choose PDF, DOCX, TXT or Markdown")}</strong><small>{cs ? "Max. 10 MB, text se uloží jen lokálně." : "Up to 10 MB; extracted text is stored locally."}</small><input type="file" accept=".pdf,.docx,.txt,.md,.markdown" onChange={onFile} /></label>}
          <div className={styles.twoFields}><label className={styles.field}><HelpLabel label={cs ? "Metoda dělení" : "Chunking method"} helpKey="field.chunkStrategy" /><select value={strategy} disabled={loadingSample} onChange={(event) => { setStrategy(event.target.value as Strategy); clearDraftPreview(); }}><option value="fixed">{cs ? "Pevná délka" : "Fixed size"}</option><option value="sentence">{cs ? "Podle vět" : "Sentences"}</option><option value="paragraph">{cs ? "Podle odstavců" : "Paragraphs"}</option><option value="semantic">{cs ? "Podle významu" : "Semantic"}</option></select></label><label className={styles.field}><HelpLabel label={cs ? "Embedding model" : "Embedding model"} helpKey="field.embeddingModel" /><select value={embeddingKey} disabled={loadingSample} onChange={(event) => { setEmbeddingKey(event.target.value); clearDraftPreview(); }}>{embeddingModels.map((model) => <option key={model.key} value={model.key}>{model.key}</option>)}</select></label></div>
          <div className={styles.twoFields}><label className={styles.field}><HelpLabel label={cs ? "Velikost úryvku" : "Chunk size"} helpKey="rag.chunkSize" /><div className={styles.slider}><input type="range" min={80} max={1200} step={10} disabled={loadingSample} value={chunkSize} onChange={(event) => { setChunkSize(Number(event.target.value)); clearDraftPreview(); }} /><strong>{chunkSize}</strong></div></label><label className={styles.field}><HelpLabel label={cs ? "Překryv" : "Overlap"} helpKey="rag.overlap" /><div className={styles.slider}><input type="range" min={0} max={Math.min(300, chunkSize - 10)} step={10} disabled={loadingSample} value={Math.min(overlap, chunkSize - 10)} onChange={(event) => { setOverlap(Number(event.target.value)); clearDraftPreview(); }} /><strong>{overlap}</strong></div></label></div>
          <p className={styles.hint}>{cs ? "Menší úryvky vyhledávají přesněji, větší zachovají více souvislostí. Embedding převádí text na vektory pro hledání podobnosti." : "Smaller chunks improve precision; larger chunks preserve context. An embedding converts text into vectors for similarity search."}</p>
          <p className={styles.hint}>{cs ? "Velikost a překryv jsou přibližné tokeny (backend počítá 4 znaky na token). Náhled ukazuje skutečné hranice v původním textu." : "Size and overlap are approximate tokens (the backend uses 4 characters per token). The preview shows actual boundaries in the source text."}</p>
          {sourceMode === "text" && strategy === "semantic" && <p className={styles.hint}>{cs ? "Sémantický náhled volá embeddingový model. U cloudového modelu může vzniknout cena ještě před indexací." : "Semantic preview calls the embedding model. A cloud model may incur a cost before indexing."}</p>}
          <div className={styles.actions}>{sourceMode === "text" && <Button onClick={() => void previewText()} loading={previewing} disabled={loadingSample || !pastedText.trim() || overlap >= chunkSize || (strategy === "semantic" && !embeddingKey)}>{cs ? "Ukázat chunky" : "Preview chunks"}</Button>}<Button onClick={() => void upload()} loading={uploading} disabled={loadingSample || (sourceMode === "file" ? !file : !pastedText.trim() || !textName.trim()) || !embeddingKey || overlap >= chunkSize}>{sourceMode === "text" ? (cs ? "Vložit a indexovat" : "Paste and index") : (cs ? "Nahrát a indexovat" : "Upload and index")}</Button></div>
          {!embeddingModels.length && <p className={styles.hint}>{cs ? "Není dostupný embeddingový model. V Ollamě stáhněte např. all-minilm a obnovte nabídku modelů." : "No embedding model available. Pull e.g. all-minilm in Ollama and refresh the model list."}</p>}
        </div></section>
        <section className={styles.panel}><header><div><span className={styles.step}>02 / INDEX</span><h2>{cs ? "Zdroje a úryvky" : "Sources and chunks"} <InfoTip label={cs ? "Výběr dokumentů" : "Select documents"} helpKey="field.selectDocuments" context="field" /></h2></div></header><div className={styles.body}>
          {documents.length ? <div className={styles.docList}>{documents.map((doc) => <div key={doc.id} className={styles.doc}><label><input type="checkbox" checked={selectedIds.includes(doc.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id))} aria-label={`${cs ? "Vybrat" : "Select"} ${doc.name}`} /><InfoTip label={cs ? "Vybrat dokument" : "Select document"} helpKey="field.selectDocuments" context="field" /></label><FileText size={17} /><div><strong>{doc.name}</strong><small>{doc.chunk_count} {cs ? "úryvků" : "chunks"} · {doc.strategy} · {formatDate(doc.created_at, locale)}</small><small>{doc.embedding_model_key}</small></div><button type="button" onClick={() => void showChunks(doc.id)}>{cs ? "Náhled" : "Preview"}</button><button type="button" onClick={() => void remove(doc.id)} aria-label={`${cs ? "Smazat" : "Delete"} ${doc.name}`}><Trash2 size={15} /></button></div>)}</div> : loadingSample ? <div className={styles.empty} role="status"><LoaderCircle className={styles.spin} size={22} /><strong>{cs ? "Připravuji index z načteného textu…" : "Indexing the loaded text…"}</strong><p>{cs ? "Chunky se v tomto kroku objeví po dokončení." : "The chunks will appear here when indexing finishes."}</p></div> : pastedText.trim() && sourceMode === "text" ? <div className={styles.empty}><BookOpen size={22} /><strong>{cs ? "Text z kroku 1 ještě není indexovaný" : "The text in step 1 is not indexed yet"}</strong><p>{cs ? "Indexujte ho, aby se tady objevily chunky a šlo se na něj ptát." : "Index it to see its chunks here and ask questions about it."}</p><Button onClick={() => void upload()} loading={uploading} disabled={!embeddingKey || overlap >= chunkSize}>{cs ? "Indexovat text z kroku 1" : "Index text from step 1"}</Button></div> : <div className={styles.empty}><BookOpen size={22} /><strong>{cs ? "Zatím žádný dokument" : "No documents yet"}</strong><p>{cs ? "Vložte text nebo nahrajte první soubor." : "Paste text or upload your first file."}</p></div>}
          {preview && <div ref={previewRef} className={styles.preview}><div className={styles.previewHeading}><strong>{preview.id ? (cs ? "Indexované chunky" : "Indexed chunks") : (cs ? "Náhled dělení před indexací" : "Chunk preview before indexing")}</strong><span>{preview.name} · {preview.chunks.length} {cs ? "chunků" : "chunks"}</span></div><p className={styles.previewExplanation}>{cs ? `Metoda ${preview.strategy}, cílová velikost ~${preview.chunkSize * 4} znaků, nastavený překryv ~${preview.overlap * 4} znaků. Čísla níže jsou skutečné pozice v textu.` : `Method ${preview.strategy}, target size ~${preview.chunkSize * 4} characters, configured overlap ~${preview.overlap * 4} characters. Positions below refer to the original text.`}</p>{!preview.id && <p className={styles.previewExplanation}>{cs ? "Tyto chunky zatím nejsou v indexu. Vyberte embeddingový model a klikněte na Vložit a indexovat, aby je šlo použít v otázce." : "These chunks are not indexed yet. Choose an embedding model and click Paste and index to use them in a question."}</p>}<div className={styles.chunkList}>{preview.chunks.map((chunk, index) => { const previous = preview.chunks[index - 1]; const shared = previous ? Math.max(0, previous.end - chunk.start) : 0; return <article key={chunk.id ?? `${chunk.start}-${chunk.end}-${index}`}><div><strong>#{index + 1}</strong><span>{chunk.page ? `${cs ? "str." : "p."} ${chunk.page} · ` : ""}{cs ? "znaky" : "chars"} {chunk.start}–{chunk.end} · {chunk.end - chunk.start} {cs ? "znaků" : "characters"}{shared > 0 ? ` · ${cs ? "překryv" : "overlap"} ${shared}` : ""}</span></div><p>{chunk.text}</p></article>; })}</div></div>}
        </div></section>
      </div>
      <div className={styles.right}>
        <section className={styles.panel}><header><div><span className={styles.step}>03 / QUESTION</span><h2>{cs ? "Zeptejte se dokumentů" : "Ask your documents"}</h2></div></header><div className={styles.body}>
          <label className={styles.field}><HelpLabel label={cs ? "Otázka" : "Question"} helpKey="field.ragQuestion" /><textarea rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={cs ? "Např. Jaké jsou podmínky vrácení?" : "E.g. What is the return policy?"} /></label>
          <label className={styles.field}><HelpLabel label={cs ? "Generativní model" : "Generation model"} helpKey="prompt.model" /><select value={generationKey} onChange={(event) => setGenerationKey(event.target.value)}>{generationModels.map((model) => <option key={model.key} value={model.key}>{model.key}</option>)}</select></label>
          <div className={styles.threeFields}><label className={styles.field}><HelpLabel label="Top K" helpKey="rag.topK" /><div className={styles.slider}><input type="range" min={1} max={10} value={topK} onChange={(event) => setTopK(Number(event.target.value))} /><strong>{topK}</strong></div></label><label className={styles.field}><HelpLabel label="Temperature" helpKey="prompt.temperature" /><div className={styles.slider}><input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} /><strong>{temperature.toFixed(1)}</strong></div></label><label className={styles.field}><HelpLabel label="Max tokens" helpKey="prompt.maxTokens" /><input type="number" min={1} max={8192} value={maxTokens} onChange={(event) => setMaxTokens(Number(event.target.value))} /></label></div>
          <label className={styles.field}><HelpLabel label={cs ? "Metoda vyhledávání" : "Retrieval method"} helpKey="field.retrievalMethod" /><select value={retrievalMode} onChange={(event) => setRetrievalMode(event.target.value as typeof retrievalMode)}><option value="vector">{cs ? "Vektorové" : "Vector"}</option><option value="lexical">BM25</option><option value="hybrid">{cs ? "Hybridní: vektor + BM25" : "Hybrid: vector + BM25"}</option></select></label>
          <details className={styles.pipelineOptions}><summary>{cs ? "Rozšířené kroky: dotazy a reranking" : "Advanced steps: queries and reranking"}</summary><div><label className={styles.field}><HelpLabel label={cs ? "Přepsaný dotaz (volitelné)" : "Rewritten query (optional)"} helpKey="field.rewrittenQuery" /><input value={rewrittenQuery} onChange={(event) => setRewrittenQuery(event.target.value)} /></label><label className={styles.field}><HelpLabel label={cs ? "Další dotazy (jeden na řádek, max. 4)" : "Additional queries (one per line, max 4)"} helpKey="field.extraQueries" /><textarea rows={3} value={extraQueries} onChange={(event) => setExtraQueries(event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={diverse} onChange={(event) => setDiverse(event.target.checked)} /><HelpLabel label={cs ? "Přerovnat MMR podle odlišnosti úryvků" : "MMR reranking for passage diversity"} helpKey="field.rerankDiversity" /></label></div></details>
          <p className={styles.hint}>{cs ? "Nejprve se vyhledají relevantní úryvky. Ty pak dostane vybraný model jako podklady. Citace jsou odkazy na tyto úryvky." : "Relevant excerpts are retrieved first, then passed to the selected model. Citations link back to those exact excerpts."}</p>
          <Button onClick={() => void ask()} loading={asking} disabled={!question.trim() || !generationKey || !matchingDocuments.length}><Search size={15} />{cs ? "Vyhledat a odpovědět" : "Retrieve and answer"}</Button>
          {documents.length > 0 && !matchingDocuments.length && <p className={styles.hint}>{cs ? "Vybrané dokumenty používají jiný embeddingový model. Zvolte model použitý při nahrání." : "Selected documents use a different embedding model. Choose the model used during upload."}</p>}
        </div></section>
        <section className={styles.panel}><header><div><span className={styles.step}>04 / EVIDENCE</span><h2>{cs ? "Odpověď a důkazy" : "Answer and evidence"}</h2></div>{asking && <LoaderCircle className={styles.spin} size={18} />}</header><div className={styles.body}>
          {answer ? <><div className={styles.answer}><RunStatus status="completed" /><AnswerReveal answer={answer.answer} locale={locale} initiallyOpen /><div className={styles.answerMeta}><span>{answer.latency_ms} ms · {answer.usage.input_tokens} / {answer.usage.output_tokens} tokens</span><Link href="/history">{cs ? "Zobrazit běh" : "View run"}<ArrowRight size={13} /></Link></div></div>
            {answer.pipeline && <div className={styles.pipelineTrace}><h3>{cs ? "Průchod pipeline" : "Pipeline trace"}</h3>{answer.pipeline.map((step, index) => <details key={`${step.id}-${index}`}><summary><span>{String(index + 1).padStart(2, "0")}</span>{step.id.replaceAll("_", " ")}</summary><pre>{typeof step.data === "string" ? step.data : JSON.stringify(step.data, null, 2)}</pre>{pipelineLinks[step.id] && <Link href={pipelineLinks[step.id]}>{cs ? "Otevřít samostatnou laboratoř →" : "Open standalone lab →"}</Link>}</details>)}</div>}
            <p className={styles.citationNote}>{answer.citation_markers_valid ? (cs ? "Značky citací odkazují na nalezené úryvky. Pravdivost jednotlivých tvrzení ověřte ve zdrojích." : "Citation markers point to retrieved excerpts. Verify individual claims against the sources.") : (cs ? "Model nepoužil platné značky citací. Odpověď zkontrolujte proti úryvkům níže." : "The model did not use valid citation markers. Check its answer against the excerpts below.")}</p>
            <div className={styles.sourceTabs}>{answer.sources.map((source) => <button type="button" key={source.chunk_id} aria-pressed={activeSource?.chunk_id === source.chunk_id} onClick={() => setSourceId(source.chunk_id)}>{source.marker} {source.document_name}</button>)}</div>
            {activeSource && <article className={styles.source}><div><strong>{activeSource.document_name}</strong><span>{activeSource.page ? `${cs ? "str." : "p."} ${activeSource.page} · ` : ""}{cs ? "znaky" : "chars"} {activeSource.start}–{activeSource.end} · score {activeSource.score.toFixed(3)}</span></div><p>{activeSource.text}</p><small>chunk {activeSource.chunk_id}</small></article>}
          </> : <div className={styles.empty}><Search size={23} /><strong>{cs ? "Zatím žádná odpověď" : "No answer yet"}</strong><p>{cs ? "Vyberte dokument, položte otázku a zkontrolujte odpověď proti úryvkům." : "Select a document, ask a question and inspect the answer beside its excerpts."}</p></div>}
        </div></section>
      </div>
    </div>
    <MiniCorpus />
  </div>;
}

async function responseError(response: Response): Promise<string> {
  try { const payload = await response.json() as { detail?: unknown }; if (typeof payload.detail === "string") return payload.detail; }
  catch { /* The response may not contain JSON. */ }
  return `HTTP ${response.status}`;
}
