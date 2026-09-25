"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { chunkText, demoDocuments, rerankMmr, retrievalMetrics, retrieve, type ChunkStrategy, type RetrievalMode } from "@/lib/retrieval-demo";
import { errorMessage, fetchJson } from "../live-api";
import { Experiment, Field, Note, Panel, Readout, type LabLocale } from "./concept-lab";
import styles from "./knowledge-labs.module.css";

const sample = { cs: "# Vrácení zboží\nZboží lze vrátit do 30 dnů od doručení. Peníze vrátíme do 14 dnů.\n\n# Doručení\nBěžné doručení trvá tři pracovní dny. Expresní zásilka přijde následující den.\n\n# Zabezpečení\nÚčet chraňte heslem a druhým faktorem.", en: "# Returns\nGoods can be returned within 30 days of delivery. We refund payment within 14 days.\n\n# Shipping\nStandard delivery takes three business days. Express shipping takes one day.\n\n# Security\nProtect your account with a password and second factor." };
function ChunkingLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [text, setText] = useState(sample[locale]);
  const [strategy, setStrategy] = useState<ChunkStrategy>("fixed");
  const [size, setSize] = useState(110);
  const [overlap, setOverlap] = useState(20);
  const chunks = useMemo(() => chunkText(text, strategy, size, Math.min(overlap, size - 1)), [text, strategy, size, overlap]);
  return <Experiment controls={<Panel title={cs ? "Dokument a pravidlo dělení" : "Document and splitting rule"}><Field label={cs ? "Dokument" : "Document"}><textarea rows={11} value={text} onChange={(event) => setText(event.target.value)} /></Field><Field label={cs ? "Strategie" : "Strategy"}><select value={strategy} onChange={(event) => setStrategy(event.target.value as ChunkStrategy)}><option value="fixed">{cs ? "Pevná velikost" : "Fixed size"}</option><option value="sentence">{cs ? "Věty" : "Sentences"}</option><option value="paragraph">{cs ? "Odstavce" : "Paragraphs"}</option><option value="structure">{cs ? "Nadpisy" : "Headings"}</option></select></Field><Field label={`${cs ? "Velikost" : "Size"}: ${size} ${cs ? "znaků" : "characters"}`}><input type="range" min="50" max="300" step="10" value={size} onChange={(event) => setSize(Number(event.target.value))} /></Field><Field label={`${cs ? "Překryv" : "Overlap"}: ${overlap} ${cs ? "znaků" : "characters"}`}><input type="range" min="0" max="80" step="5" value={overlap} onChange={(event) => setOverlap(Number(event.target.value))} /></Field><Note>{cs ? "Tento náhled pracuje se znaky. Živá RAG pipeline používá vlastní nastavení velikosti chunků při indexaci." : "This preview uses characters. Live RAG has its own chunk size settings during indexing."}</Note></Panel>} result={<Panel title={cs ? "Vzniklé úryvky" : "Resulting chunks"}><Readout label={cs ? "Počet chunků" : "Chunk count"} value={chunks.length} /><div className={styles.chunkList}>{chunks.map((chunk, index) => <article key={index}><strong>{cs ? "Úryvek" : "Chunk"} {index + 1} · {chunk.length} {cs ? "znaků" : "characters"}</strong><p>{chunk}</p></article>)}</div><Link className={styles.link} href="/ai-lab/retrieval">{cs ? "Podívat se na vyhledávání →" : "Explore retrieval →"}</Link></Panel>} />;
}

const queryExamples = { cs: "Kdy mohu vrátit zboží?", en: "When can I return goods?" };
function rewrite(query: string, locale: LabLocale) {
  const normalized = query.toLocaleLowerCase();
  if (/vr[aá]t|return|refund/.test(normalized)) return locale === "cs" ? "lhůta pro vrácení zboží peníze" : "return period goods refund";
  if (/doru|zásil|ship|deliver/.test(normalized)) return locale === "cs" ? "doba doručení zásilky" : "shipping delivery time";
  return query;
}
function RetrievalLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [query, setQuery] = useState(queryExamples[locale]);
  const [mode, setMode] = useState<RetrievalMode>("hybrid");
  const [filter, setFilter] = useState<"all" | "policy" | "guide">("all");
  const [rewriting, setRewriting] = useState(false);
  const [multi, setMulti] = useState(false);
  const queries = [query, ...(rewriting && rewrite(query, locale) !== query ? [rewrite(query, locale)] : []), ...(multi ? [locale === "cs" ? `${query} pravidla podpora` : `${query} policy support`] : [])];
  const byQuery = queries.map((item) => retrieve(item, locale, mode, filter));
  const hits = byQuery[0]?.map((hit) => ({ ...hit, score: Math.max(...byQuery.map((rows) => rows.find((row) => row.id === hit.id)?.score ?? 0)) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).map((hit, index) => ({ ...hit, rank: index + 1 })) ?? [];
  return <Experiment controls={<Panel title={cs ? "Dotaz a způsob hledání" : "Query and search method"}><Field label={cs ? "Dotaz" : "Query"}><input value={query} onChange={(event) => setQuery(event.target.value)} /></Field><Field label={cs ? "Metoda" : "Method"}><select value={mode} onChange={(event) => setMode(event.target.value as RetrievalMode)}><option value="lexical">BM25</option><option value="vector">{cs ? "Vektorové" : "Vector"}</option><option value="hybrid">{cs ? "Hybridní" : "Hybrid"}</option></select></Field><Field label={cs ? "Filtr metadat" : "Metadata filter"}><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">{cs ? "Všechny dokumenty" : "All documents"}</option><option value="policy">{cs ? "Pravidla" : "Policies"}</option><option value="guide">{cs ? "Návody" : "Guides"}</option></select></Field><label className={styles.check}><input type="checkbox" checked={rewriting} onChange={(event) => setRewriting(event.target.checked)} />{cs ? "Přepsat dotaz" : "Rewrite query"}</label><label className={styles.check}><input type="checkbox" checked={multi} onChange={(event) => setMulti(event.target.checked)} />{cs ? "Více dotazů" : "Multi-query"}</label><div className={styles.queryList}>{queries.map((item, index) => <span key={index}>{index + 1}. {item}</span>)}</div><Note>{cs ? "Ukázkové vektory jsou vytvořené z témat dokumentů. Živá RAG stránka pracuje se skutečným embeddingovým modelem." : "Teaching vectors are built from document topics. The live RAG page uses a real embedding model."}</Note></Panel>} result={<Panel title={cs ? "Kandidátní úryvky" : "Candidate passages"}><div className={styles.hitList}>{hits.map((hit) => <article key={hit.id}><header><strong>{hit.rank}. {hit.id}</strong><span>{hit.type}</span></header><p>{hit.text}</p><div className={styles.scores}><span>BM25 {hit.lexical.toFixed(2)}</span><span>{cs ? "Vektor" : "Vector"} {hit.vector.toFixed(2)}</span><strong>{cs ? "Celkem" : "Total"} {hit.score.toFixed(2)}</strong></div></article>)}</div><Link className={styles.link} href="/ai-lab/rag">{cs ? "Otevřít živou RAG pipeline →" : "Open live RAG pipeline →"}</Link></Panel>} />;
}
function RerankingLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [query, setQuery] = useState(queryExamples[locale]);
  const [balance, setBalance] = useState(.65);
  const [topK, setTopK] = useState(3);
  const before = useMemo(() => retrieve(query, locale, "hybrid"), [query, locale]);
  const after = useMemo(() => rerankMmr(before, balance), [before, balance]);
  return <Experiment controls={<Panel title={cs ? "Přerovnej výsledky" : "Rerank results"}><Field label={cs ? "Dotaz" : "Query"}><input value={query} onChange={(event) => setQuery(event.target.value)} /></Field><Field label={`${cs ? "Důraz na relevanci" : "Relevance weight"}: ${balance.toFixed(2)}`}><input type="range" min="0" max="1" step="0.05" value={balance} onChange={(event) => setBalance(Number(event.target.value))} /></Field><Field label={`Top K: ${topK}`}><input type="range" min="1" max="5" value={topK} onChange={(event) => setTopK(Number(event.target.value))} /></Field><Note>{cs ? "MMR vyvažuje relevanci k dotazu a rozdílnost již vybraných úryvků. Jde o reprodukovatelnou výukovou metodu." : "MMR balances query relevance against similarity to passages already selected. This is a reproducible teaching method."}</Note></Panel>} result={<Panel title={cs ? "Před a po" : "Before and after"}><div className={styles.comparison}><div><h3>{cs ? "Původní pořadí" : "Original order"}</h3>{before.map((hit) => <div key={hit.id}>{hit.rank}. {hit.id}</div>)}</div><div><h3>{cs ? "Po přerovnání" : "After reranking"}</h3>{after.map((hit) => <div key={hit.id} data-removed={hit.rank > topK}>{hit.rank}. {hit.id}<span>{hit.rank <= topK ? `${hit.rank - (before.find((old) => old.id === hit.id)?.rank ?? hit.rank)}` : cs ? "mimo kontext" : "out of context"}</span></div>)}</div></div><Readout label={cs ? "Úryvků předaných modelu" : "Passages sent to model"} value={topK} /><Note>{cs ? "Změna pořadí může změnit důkazy, které se vejdou do kontextu odpovědi." : "A rank change can alter the evidence that fits in the answer context."}</Note></Panel>} />;
}
const evalQueries = [
  { cs: "Kolik dní mám na vrácení zboží?", en: "How many days do I have to return goods?", relevant: ["returns"] },
  { cs: "Jak zabezpečit účet a získat export dat?", en: "How do I secure my account and export data?", relevant: ["security", "privacy"] },
  { cs: "Kdy dorazí expresní zásilka?", en: "When does an express parcel arrive?", relevant: ["shipping"] },
];
function RetrievalEvalsLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [mode, setMode] = useState<RetrievalMode>("hybrid");
  const [topK, setTopK] = useState(2);
  const rows = evalQueries.map((item) => { const hits = retrieve(item[locale], locale, mode); return { query: item[locale], relevant: item.relevant, hits, metrics: retrievalMetrics(hits.map((hit) => hit.id), item.relevant, topK) }; });
  const average = (key: "recall" | "precision" | "mrr") => rows.reduce((sum, row) => sum + (row.metrics[key] ?? 0), 0) / rows.length;
  return <Experiment controls={<Panel title={cs ? "Nastavení testu" : "Test settings"}><Field label={cs ? "Vyhledávání" : "Search"}><select value={mode} onChange={(event) => setMode(event.target.value as RetrievalMode)}><option value="lexical">BM25</option><option value="vector">{cs ? "Vektorové" : "Vector"}</option><option value="hybrid">{cs ? "Hybridní" : "Hybrid"}</option></select></Field><Field label={`K: ${topK}`}><input type="range" min="1" max="5" value={topK} onChange={(event) => setTopK(Number(event.target.value))} /></Field><Note>{cs ? "Relevantní dokumenty jsou předem označené u každého testovacího dotazu. Precision@K používá jmenovatel K." : "Relevant documents are specified for each test query. Precision@K uses K as its denominator."}</Note></Panel>} result={<Panel title={cs ? "Kvalita tří dotazů" : "Quality across three queries"}><div className={styles.metrics}><Readout label={`Recall@${topK}`} value={average("recall").toFixed(2)} /><Readout label={`Precision@${topK}`} value={average("precision").toFixed(2)} /><Readout label="MRR" value={average("mrr").toFixed(2)} /></div><div className={styles.evalRows}>{rows.map((row) => <details key={row.query}><summary>{row.query} <strong>{row.metrics.matches}/{row.relevant.length}</strong></summary><p>{cs ? "Relevantní" : "Relevant"}: {row.relevant.join(", ")}</p><p>{cs ? "Nalezeno" : "Retrieved"}: {row.hits.slice(0, topK).map((hit) => hit.id).join(", ")}</p><p>Recall {row.metrics.recall?.toFixed(2)} · Precision {row.metrics.precision.toFixed(2)} · MRR {row.metrics.mrr.toFixed(2)}</p></details>)}</div><DatasetRetrievalEval locale={locale} topK={topK} /></Panel>} />;
}

function DatasetRetrievalEval({ locale, topK }: { locale: LabLocale; topK: number }) {
  const cs = locale === "cs";
  const { models } = useApp();
  const [datasets, setDatasets] = useState<Array<{ id: string; name: string; cases: Array<{ id: string; input: string; relevant_document_ids?: string[] }> }>>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; embedding_model_key: string }>>([]);
  const [datasetId, setDatasetId] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ scored_cases: number; recall_at_k: number | null; precision_at_k: number | null; mrr: number | null; cases: Array<{ case_id: string; status: string; recall_at_k?: number; precision_at_k?: number; mrr?: number }> } | null>(null);
  useEffect(() => {
    Promise.all([fetchJson<typeof datasets>("/api/v1/datasets"), fetchJson<{ documents: typeof documents }>("/api/v1/user-documents")])
      .then(([saved, indexed]) => { setDatasets(saved); setDocuments(indexed.documents); })
      .catch(() => undefined);
  }, []);
  const selected = datasets.find((item) => item.id === datasetId);
  const embeddingKey = documents[0]?.embedding_model_key;
  const modelReady = models.some((model) => model.key === embeddingKey && model.available);
  const run = async () => {
    if (!selected || !embeddingKey) return;
    setWorking(true); setError(null); setResult(null);
    try {
      const rankings = await Promise.all(selected.cases.filter((item) => item.relevant_document_ids?.length).map(async (item) => {
        const response = await fetchJson<{ hits: Array<{ document_id: string }> }>("/api/v1/user-rag/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: item.input, embedding_model_key: embeddingKey, document_ids: documents.filter((doc) => doc.embedding_model_key === embeddingKey).map((doc) => doc.id), top_k: Math.min(20, topK), bm25_rerank: true }) });
        return { case_id: item.id, document_ids: response.hits.map((hit) => hit.document_id) };
      }));
      if (!rankings.length) throw new Error(cs ? "Dataset neobsahuje ID relevantních dokumentů." : "Dataset has no relevant document IDs.");
      setResult(await fetchJson<typeof result & object>("/api/v1/retrieval-evals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_id: selected.id, k: topK, rankings }) }));
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setWorking(false); }
  };
  return <div className={styles.datasetEval}><h3>{cs ? "Váš dataset a živé dokumenty" : "Your dataset and live documents"}</h3><p>{cs ? "Stejný dataset použijete v Aréně i zde. ID relevantních dokumentů patří k jednotlivým otázkám." : "Reuse the same dataset in Arena and here. Relevant document IDs belong to individual questions."}</p><Field label={cs ? "Dataset" : "Dataset"}><select value={datasetId} onChange={(event) => setDatasetId(event.target.value)}><option value="">{cs ? "Vybrat dataset" : "Select dataset"}</option>{datasets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><button type="button" onClick={() => void run()} disabled={!selected || !embeddingKey || !modelReady || working}>{working ? cs ? "Vyhodnocuji…" : "Evaluating…" : cs ? "Spustit retrieval eval" : "Run retrieval eval"}</button>{!documents.length && <p>{cs ? "Nejprve indexujte dokumenty v RAG pipeline." : "Index documents in the RAG pipeline first."}</p>}{error && <p role="alert">{error}</p>}{result && <><div className={styles.metrics}><Readout label={`Recall@${topK}`} value={result.recall_at_k?.toFixed(2) ?? "—"} /><Readout label={`Precision@${topK}`} value={result.precision_at_k?.toFixed(2) ?? "—"} /><Readout label="MRR" value={result.mrr?.toFixed(2) ?? "—"} /></div><div className={styles.evalRows}>{result.cases.map((item) => <p key={item.case_id}>{item.case_id}: {item.status === "scored" ? `Recall ${item.recall_at_k?.toFixed(2)} · Precision ${item.precision_at_k?.toFixed(2)} · MRR ${item.mrr?.toFixed(2)}` : cs ? "bez očekávaných dokumentů" : "no relevant documents"}</p>)}</div></>}</div>;
}
function GroundingLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [strict, setStrict] = useState(false);
  const [evidence, setEvidence] = useState(demoDocuments[0][locale]);
  const hasDays = /30/.test(evidence);
  const hasRefund = /14/.test(evidence);
  const cases = [
    { name: cs ? "Bez podkladů" : "Without evidence", answer: cs ? "Zboží můžete vrátit do 14 dnů." : "You may return goods within 14 days.", claims: [{ text: cs ? "Lhůta je 14 dnů" : "Return period is 14 days", verdict: "unsupported" }] },
    { name: cs ? "S RAG kontextem" : "With RAG context", answer: cs ? "Zboží můžete vrátit do 30 dnů; peníze se vrací do 14 dnů." : "Goods can be returned within 30 days; refunds are issued within 14 days.", claims: [{ text: cs ? "Lhůta je 30 dnů" : "Return period is 30 days", verdict: hasDays ? "supported" : "unsupported" }, { text: cs ? "Peníze do 14 dnů" : "Refund within 14 days", verdict: hasRefund ? "supported" : "unsupported" }] },
    { name: cs ? "Pouze podle zdrojů" : "Evidence-only instruction", answer: strict && !hasDays ? cs ? "Z podkladů nelze určit lhůtu pro vrácení." : "The evidence does not establish a return period." : cs ? "Podle podkladu lze zboží vrátit do 30 dnů." : "According to the evidence, goods can be returned within 30 days.", claims: strict && !hasDays ? [] : [{ text: cs ? "Lhůta je 30 dnů" : "Return period is 30 days", verdict: hasDays ? "supported" : "contradicted" }] },
  ];
  return <Experiment controls={<Panel title={cs ? "Otázka a podklad" : "Question and evidence"}><p>{cs ? "Otázka: Do kdy mohu vrátit zboží?" : "Question: How long can I return goods?"}</p><Field label={cs ? "Poskytnutý dokument" : "Provided document"}><textarea rows={7} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></Field><label className={styles.check}><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />{cs ? "Při chybějícím důkazu odpovědět nevím" : "Say unknown when evidence is missing"}</label><Note>{cs ? "Odpovědi jsou pevně dané scénáře. Verdikty testují jejich konkrétní tvrzení proti číselným údajům podkladu; nejde o automatické ověřování libovolného textu." : "Answers are fixed scenarios. Verdicts compare their specific claims with numbers in the evidence; this does not verify arbitrary text."}</Note></Panel>} result={<Panel title={cs ? "Tři odpovědi" : "Three answers"}><div className={styles.claimCards}>{cases.map((item) => <article key={item.name}><h3>{item.name}</h3><p>{item.answer}</p>{item.claims.map((claim) => <span data-verdict={claim.verdict} key={claim.text}>{claim.text}: {claim.verdict}</span>)}</article>)}</div><Link className={styles.link} href="/ai-lab/rag">{cs ? "Vyzkoušet na vlastním dokumentu →" : "Try your own document →"}</Link></Panel>} />;
}

export function KnowledgeLab({ slug, locale }: { slug: string; locale: LabLocale }) {
  if (slug === "chunking") return <ChunkingLab locale={locale} />;
  if (slug === "retrieval") return <RetrievalLab locale={locale} />;
  if (slug === "reranking") return <RerankingLab locale={locale} />;
  if (slug === "retrieval-evals") return <RetrievalEvalsLab locale={locale} />;
  if (slug === "grounding") return <GroundingLab locale={locale} />;
  return null;
}
