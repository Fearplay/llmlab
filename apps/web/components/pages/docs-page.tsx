"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/ui";
import { labEntries, labHref } from "@/lib/lab-catalog";
import { learningProgressKey, learningTracks, missions } from "@/lib/learning-content";

const tracks = learningTracks.filter((track) => track.id !== "bonus");
const extras: Record<string, { cs: string; en: string; href: string; summaryCs: string; summaryEn: string }> = {
  datasets: { cs: "Datasety", en: "Datasets", href: "/datasets", summaryCs: "Očekávání pro každý testovací případ.", summaryEn: "Expectations for every test case." },
  evaluators: { cs: "Evaluátory", en: "Evaluators", href: "/evaluators", summaryCs: "Měř odpověď podle konkrétního cíle.", summaryEn: "Score an answer against a concrete goal." },
  arena: { cs: "Aréna modelů", en: "Model arena", href: "/arena", summaryCs: "Porovnej odpovědi více modelů.", summaryEn: "Compare answers from several models." },
};
const tasks: Record<string, [string, string]> = {
  tokenizer: ["Porovnej českou větu s kódem a sleduj ID.", "Compare a Czech sentence with code and inspect IDs."],
  transformer: ["Vyber token a sleduj masku attention.", "Select a token and inspect the attention mask."],
  context: ["Zmenši rozpočet a sleduj ořez historie.", "Reduce the budget and watch history trimming."],
  generation: ["Nastav temperature na nulu a pak ji zvyš.", "Set temperature to zero, then raise it."],
  "prompt-tokens": ["Změň systémovou instrukci u stejného dotazu.", "Change the system instruction for the same question."],
  embeddings: ["Porovnej význam dvou různých vět.", "Compare the meaning of two different sentences."],
  "structured-output": ["Smaž povinné pole z JSON odpovědi.", "Remove a required field from the JSON answer."],
  chunking: ["Změň velikost a překryv úryvků.", "Change passage size and overlap."],
  retrieval: ["Porovnej BM25 a hybridní pořadí.", "Compare BM25 and hybrid rankings."],
  reranking: ["Změň důraz na rozmanitost výsledků.", "Change the diversity weight."],
  rag: ["Polož otázku nad vlastním dokumentem.", "Ask a question about your own document."],
  tools: ["Změň argumenty jediného volání.", "Change the arguments of a single call."],
  agents: ["Omez počet kroků a otevři stopu.", "Limit the steps and open the trace."],
  mcp: ["Porovnej seznam nástrojů a čtení zdroje.", "Compare tool listing with reading a resource."],
  datasets: ["Ulož test s očekávanou informací.", "Save a case with an expected fact."],
  evaluators: ["Vyber metriku pro jednu odpověď.", "Choose a metric for one answer."],
  "retrieval-evals": ["Změň K a sleduj Recall a Precision.", "Change K and inspect Recall and Precision."],
  grounding: ["Odstraň údaj z podkladu a sleduj tvrzení.", "Remove a fact from the evidence and inspect claims."],
  safety: ["Porovnej útok se zapnutou a vypnutou obranou.", "Compare an attack with and without a defense."],
  arena: ["Porovnej dvě odpovědi na stejný vstup.", "Compare two answers to the same input."],
  routing: ["Změň prioritu z ceny na délku kontextu.", "Switch priority from cost to context length."],
  inference: ["Změň TTFT a přehraj streaming.", "Change TTFT and replay streaming."],
  cache: ["Spusť stejný dotaz dvakrát.", "Run the same query twice."],
  "kv-cache": ["Zdvojnásob kontext a sleduj paměť.", "Double the context and inspect memory."],
  quantization: ["Porovnej FP16 a INT4.", "Compare FP16 and INT4."],
  "fine-tuning": ["Porovnej proměnlivá fakta se stálým stylem.", "Compare changing facts with a stable style."],
};

export function DocsPage() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(learningProgressKey) ?? "[]") as unknown; if (Array.isArray(saved)) queueMicrotask(() => setCompleted(saved.filter((item): item is string => typeof item === "string"))); } catch { /* Optional browser storage. */ }
  }, []);
  return <>
    <PageHeader title={cs ? "Výukové cesty" : "Learning paths"} description={cs ? "Čtyři cesty od prvního tokenu k provozu LLM aplikace. Každá lekce vede k pokusu." : "Four paths from the first token to running an LLM app. Every lesson leads to an experiment."} />
    <div className="docs-tracks">{tracks.map((track, trackIndex) => <details key={track.en} open={trackIndex === 0}><summary><span className="mono">{String(trackIndex + 1).padStart(2, "0")}</span><strong>{cs ? track.cs : track.en}</strong><small>{track.slugs.length} {cs ? "lekcí" : "lessons"}</small></summary><ol className="lesson-path">{track.slugs.map((slug, index) => { const entry = labEntries.find((item) => item.slug === slug); const extra = extras[slug]; return <li key={slug} className="lesson-step"><span className="lesson-number mono">{String(index + 1).padStart(2, "0")}</span><div><h2>{cs ? entry?.cs ?? extra.cs : entry?.en ?? extra.en}</h2><p>{cs ? entry?.summaryCs ?? extra.summaryCs : entry?.summaryEn ?? extra.summaryEn}</p><span className="lesson-task">{tasks[slug][cs ? 0 : 1]}</span></div><Link href={extra?.href ?? labHref(slug)} className="lesson-open">{cs ? "Vyzkoušet" : "Try it"}<ArrowRight size={16} /></Link></li>; })}</ol></details>)}</div>
    <section id="missions" className="guided-missions"><div className="guided-missions-heading"><div><span className="eyebrow">{cs ? "UČ SE POKUSEM" : "LEARN BY DOING"}</span><h2>{cs ? "Vedené mise" : "Guided missions"}</h2><p>{cs ? "Předpověz výsledek, vyzkoušej změnu a ověř si, čemu rozumíš. Funguje i bez API klíče." : "Predict the result, try a change, and check your understanding. Works without an API key."}</p></div><strong>{completed.length} / {missions.length}</strong></div>{learningTracks.map((track) => <div key={track.id} className="guided-mission-track"><h3>{cs ? track.cs : track.en}</h3><div>{track.slugs.map((slug) => { const mission = missions.find((item) => item.slug === slug)!; return <Link key={slug} href={`/docs/learn/${slug}`}><span aria-hidden="true">{completed.includes(slug) ? "✓" : "○"}</span><strong>{mission.title[locale]}</strong><small>{mission.action[locale]}</small><ArrowRight size={15} /></Link>; })}</div></div>)}</section>
  </>;
}
