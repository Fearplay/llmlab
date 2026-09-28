"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp, type CatalogModel } from "@/components/app-provider";
import { HelpLabel } from "@/components/ui";
import { fetchJson, type ExperimentRecord } from "./live-api";
import styles from "./improvements.module.css";

type LibraryItem = { id: string; text: string; outcome: "good" | "bad"; note: string };
type Task = "summary" | "analysis" | "documents";

function suggestions(text: string, cs: boolean): Array<{ label: string; value: string }> {
  const result: Array<{ label: string; value: string }> = [];
  if (!text.trim()) return result;
  if (/\b(něco|some(thing)?|krátce|briefly)\b/i.test(text)) {
    result.push({ label: cs ? "Upřesnit nejasný výraz" : "Clarify vague wording",
      value: text.replace(/\b(něco|something|some|krátce|briefly)\b/i, cs ? "konkrétní odpověď ve třech větách" : "a specific answer in three sentences") });
  }
  if (!/\b(vět|bod|slov|tabulk|sentenc|bullet|word|table|json)\b/i.test(text)) {
    result.push({ label: cs ? "Určit délku odpovědi" : "Specify the answer length",
      value: `${text.trim()}\n${cs ? "Odpověz ve třech větách." : "Answer in three sentences."}` });
  }
  if (!/\b(začátečník|odborník|děti|audien|beginner|expert|children)\b/i.test(text)) {
    result.push({ label: cs ? "Určit čtenáře" : "Specify the audience",
      value: `${text.trim()}\n${cs ? "Piš srozumitelně pro začátečníka." : "Write clearly for a beginner."}` });
  }
  return result;
}

export function PromptTools({ text, onApply }: { text: string; onApply: (value: string) => void }) {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [note, setNote] = useState("");
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem("llmlab.promptLibrary.v1") ?? "[]") as unknown;
    if (Array.isArray(saved)) queueMicrotask(() => setItems(saved.filter((item): item is LibraryItem =>
      !!item && typeof item === "object" && typeof item.text === "string" && typeof item.note === "string" && (item.outcome === "good" || item.outcome === "bad"))));
  } catch { /* Optional library. */ } }, []);
  const save = (outcome: "good" | "bad") => {
    if (!text.trim()) return;
    const next = [{ id: crypto.randomUUID(), text: text.trim(), note: note.trim(), outcome }, ...items];
    localStorage.setItem("llmlab.promptLibrary.v1", JSON.stringify(next));
    setItems(next); setNote("");
  };
  const offered = suggestions(text, cs);
  return <div className={styles.grid}>
    <section className={styles.panel}><h2>{cs ? "Jak prompt zpřesnit" : "Make the prompt clearer"}</h2><p>{cs ? "Návrhy vznikají místně podle textu. Změna se použije až po kliknutí." : "Suggestions are generated locally from your text. A change is applied only when clicked."}</p>{offered.length ? offered.map((item) => <article className={styles.card} key={item.label}><strong>{item.label}</strong><small>{item.value}</small><button onClick={() => onApply(item.value)}>{cs ? "Přijmout návrh" : "Apply suggestion"}</button></article>) : <p>{cs ? "Napište prompt; zde se objeví konkrétní návrhy." : "Write a prompt to see concrete suggestions."}</p>}</section>
    <section className={styles.panel}><h2>{cs ? "Knihovna dobrých a špatných promptů" : "Good and bad prompt library"}</h2><label className={styles.field}><HelpLabel label={cs ? "Co fungovalo nebo selhalo?" : "What worked or failed?"} helpKey="prompts.libraryNote" /><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label><div className={styles.row}><button onClick={() => save("good")} disabled={!text.trim() || !note.trim()}>{cs ? "Uložit jako povedený" : "Save as good"}</button><button onClick={() => save("bad")} disabled={!text.trim() || !note.trim()}>{cs ? "Uložit jako nepovedený" : "Save as bad"}</button></div>{items.slice(0, 12).map((item) => <article className={styles.card} key={item.id}><span className={styles.badge} data-done={item.outcome === "good"}>{item.outcome === "good" ? (cs ? "Povedený" : "Good") : (cs ? "Nepovedený" : "Bad")}</span><strong>{item.text.slice(0, 150)}</strong><p>{item.note}</p><button onClick={() => onApply(item.text)}>{cs ? "Načíst do editoru" : "Load into editor"}</button></article>)}</section>
  </div>;
}

function measured(runs: ExperimentRecord[], model: CatalogModel) {
  const rows = runs.flatMap((run) => run.metrics?.models ?? []).filter((item) => item.model_key === model.key);
  const graded = rows.filter((item) => typeof item.quality === "number");
  const timed = rows.filter((item) => typeof item.average_latency_ms === "number");
  return { quality: graded.length ? graded.reduce((sum, item) => sum + (item.quality ?? 0), 0) / graded.length : null,
    latency: timed.length ? timed.reduce((sum, item) => sum + (item.average_latency_ms ?? 0), 0) / timed.length : null,
    cases: graded.reduce((sum, item) => sum + item.scored_cases, 0) };
}

export function ModelAdvisor() {
  const { locale, models, setSelectedModelKey } = useApp();
  const cs = locale === "cs";
  const [task, setTask] = useState<Task>("summary");
  const [runs, setRuns] = useState<ExperimentRecord[]>([]);
  useEffect(() => { void fetchJson<ExperimentRecord[]>("/api/v1/experiments").then(setRuns).catch(() => {}); }, []);
  const ranked = useMemo(() => models.filter((model) => model.available &&
    (Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation))
    .map((model) => ({ model, evidence: measured(runs, model) }))
    .sort((a, b) => {
      const score = (item: typeof a) => {
        const quality = item.evidence.quality ?? 0;
        const speed = item.evidence.latency ? 1000 / Math.max(100, item.evidence.latency) : 0;
        const context = Math.log2(Math.max(1, item.model.context_window ?? 1));
        const local = item.model.mode === "local" ? 1 : 0;
        return task === "summary" ? quality * 5 + speed + local : task === "analysis" ? quality * 10 + context / 10 : quality * 7 + context / 12 + local;
      };
      return score(b) - score(a);
    }), [models, runs, task]);
  const best = ranked[0];
  return <section className={styles.panel}><h2>{cs ? "Doporučený model podle úkolu" : "Model suggestion for a task"}</h2><label className={styles.field}><HelpLabel label={cs ? "Typ úkolu" : "Task type"} helpKey="prompts.modelTask" /><select value={task} onChange={(event) => setTask(event.target.value as Task)}><option value="summary">{cs ? "Krátké shrnutí" : "Short summary"}</option><option value="analysis">{cs ? "Složitější rozbor" : "Detailed analysis"}</option><option value="documents">{cs ? "Odpověď nad dokumenty" : "Document question"}</option></select></label>{best ? <div className={styles.card}><strong>{best.model.key}</strong><p>{best.evidence.cases ? (cs ? `Naměřená kvalita z ${best.evidence.cases} případů; dostupnost a délka kontextu se také zohledňují.` : `Measured quality from ${best.evidence.cases} cases; availability and context length also matter.`) : (cs ? "Orientační doporučení podle dostupnosti a délky kontextu. Zatím chybí naměřené výsledky." : "Indicative suggestion from availability and context length. No measured results yet.")}</p><button onClick={() => setSelectedModelKey(best.model.key)}>{cs ? "Vybrat model" : "Select model"}</button></div> : <p>{cs ? "Zatím není dostupný generativní model." : "No generation model is available yet."}</p>}</section>;
}
