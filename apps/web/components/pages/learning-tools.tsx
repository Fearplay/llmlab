"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel } from "@/components/ui";
import { learningProgressKey } from "@/lib/learning-content";
import { fetchJson, type ExperimentRecord } from "./live-api";
import styles from "./improvements.module.css";

const areas = [
  { id: "prompt", cs: "Prompty", en: "Prompts", href: "/ai-lab/prompt-tokens", mission: "prompt-tokens", kind: "prompt" },
  { id: "arena", cs: "Porovnání modelů", en: "Model comparisons", href: "/arena", mission: "arena", kind: "arena" },
  { id: "documents", cs: "Dokumenty a RAG", en: "Documents and RAG", href: "/ai-lab/rag", mission: "rag", kind: "rag" },
  { id: "evaluation", cs: "Hodnocení", en: "Evaluation", href: "/datasets", mission: "evaluators", kind: "evaluation" },
  { id: "safety", cs: "Bezpečnost", en: "Safety", href: "/ai-lab/safety", mission: "safety", kind: "safety" },
  { id: "agent", cs: "Agenti", en: "Agents", href: "/ai-lab/agents", mission: "agents", kind: "agent" },
  { id: "flappy", cs: "Flappy AI", en: "Flappy AI", href: "/ai-lab/flappy", mission: "flappy", kind: "flappy" },
];

const terms = [
  { id: "token", cs: "Token je část textu, kterou model zpracovává jako jednotku.", en: "A token is a piece of text processed as one unit by a model." },
  { id: "embedding", cs: "Embedding je číselný vektor přibližně zachycující význam textu.", en: "An embedding is a numeric vector that approximates a text's meaning." },
  { id: "RAG", cs: "RAG nejprve najde podklady a potom je předá modelu k odpovědi.", en: "RAG retrieves evidence before asking a model to answer." },
  { id: "latency", cs: "Latence je čas od požadavku do dokončení odpovědi.", en: "Latency is the time from a request to a completed answer." },
  { id: "p95", cs: "p95 je hranice, pod kterou se vešlo 95 % naměřených časů.", en: "p95 is the value below which 95% of measured times fell." },
  { id: "grounding", cs: "Opora znamená, že konkrétní tvrzení lze doložit zdrojem.", en: "Grounding means a specific claim can be supported by evidence." },
];

export function ProgressMap() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [completed, setCompleted] = useState<string[]>([]);
  const [runKinds, setRunKinds] = useState<string[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [episodeCount, setEpisodeCount] = useState(0);
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(learningProgressKey) ?? "[]") as unknown;
      if (Array.isArray(value)) queueMicrotask(() => setCompleted(value.filter((item): item is string => typeof item === "string")));
    } catch { /* A damaged browser preference does not block the map. */ }
    void Promise.allSettled([
      fetchJson<ExperimentRecord[]>("/api/v1/experiments"),
      fetchJson<{ documents: unknown[] }>("/api/v1/user-documents"),
      fetchJson<{ episodes: unknown[] }>("/api/v1/game/episodes"),
    ]).then(([runs, documents, episodes]) => {
      if (runs.status === "fulfilled") setRunKinds(runs.value.map((item) => item.kind));
      if (documents.status === "fulfilled") setDocumentCount(documents.value.documents.length);
      if (episodes.status === "fulfilled") setEpisodeCount(episodes.value.episodes.length);
    });
  }, []);
  return <section className={styles.panel}><h2>{cs ? "Mapa pokroku" : "Learning progress map"}</h2><p>{cs ? "Ukazuje dokončené mise a typy pokusů, které už jste skutečně spustili." : "Shows completed missions and types of experiments you have actually run."}</p><div className={styles.grid}>{areas.map((area) => {
    const learned = completed.includes(area.mission);
    const tried = runKinds.includes(area.kind) || (area.id === "documents" && documentCount > 0) || (area.id === "flappy" && episodeCount > 0);
    return <article className={styles.card} key={area.id}><strong>{cs ? area.cs : area.en}</strong><span className={styles.badge} data-done={learned}>{learned ? (cs ? "Mise hotová" : "Mission complete") : (cs ? "Mise čeká" : "Mission to try")}</span><span className={styles.badge} data-done={tried}>{tried ? (cs ? "Pokus vyzkoušen" : "Experiment tried") : (cs ? "Pokus čeká" : "Experiment to try")}</span><Link href={area.href}>{cs ? "Pokračovat →" : "Continue →"}</Link></article>;
  })}</div></section>;
}

export function PersonalGlossary() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [term, setTerm] = useState(terms[0].id);
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => { try { const value = JSON.parse(localStorage.getItem("llmlab.glossaryNotes.v1") ?? "{}") as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) queueMicrotask(() => setNotes(value as Record<string, string>));
  } catch { /* Optional notes. */ } }, []);
  const selected = terms.find((item) => item.id === term)!;
  const save = () => localStorage.setItem("llmlab.glossaryNotes.v1", JSON.stringify(notes));
  return <section className={styles.panel}><h2>{cs ? "Můj slovníček" : "My glossary"}</h2><label className={styles.field}><HelpLabel label={cs ? "Pojem" : "Term"} helpKey="learning.glossaryTerm" /><select value={term} onChange={(event) => setTerm(event.target.value)}>{terms.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><p>{cs ? selected.cs : selected.en}</p><label className={styles.field}><HelpLabel label={cs ? "Moje poznámka a příklad" : "My note and example"} helpKey="learning.glossaryNote" /><textarea rows={3} value={notes[term] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [term]: event.target.value }))} /></label><div className={styles.row}><button onClick={save}>{cs ? "Uložit poznámku" : "Save note"}</button></div></section>;
}
