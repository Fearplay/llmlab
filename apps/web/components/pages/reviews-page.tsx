"use client";

import { ArrowRight, Check, CircleHelp, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { AnswerReveal, HelpLabel, Button, Notice, PageHeader, RunStatus } from "@/components/ui";
import { errorMessage, fetchJson, type ExperimentRecord, type ExperimentResult } from "./live-api";
import styles from "./reviews-page.module.css";

interface Review { id: string; run_id: string; case_id: string; verdict: "good" | "bad"; comment: string; created_at: string }
interface Item { run: ExperimentRecord; result: ExperimentResult; index: number }

export function ReviewsPage() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [runs, setRuns] = useState<ExperimentRecord[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [index, setIndex] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const [allRuns, allReviews] = await Promise.all([fetchJson<ExperimentRecord[]>("/api/v1/experiments"), fetchJson<Review[]>("/api/v1/reviews")]);
      setRuns(allRuns); setReviews(allReviews); setError(null);
    } catch (caught) { setError(errorMessage(caught, locale)); }
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const items = useMemo(() => runs.flatMap((run) => (run.results ?? []).map((result, position) => ({ run, result, index: position }))).filter(({ result }) => result.status === "completed" && Boolean(result.output)), [runs]);
  const item: Item | undefined = items[index];
  const saved = item ? reviews.find((review) => review.run_id === item.run.id && review.case_id === String(item.index)) : null;
  const reviewed = items.filter((entry) => reviews.some((review) => review.run_id === entry.run.id && review.case_id === String(entry.index))).length;
  const save = async (verdict: "good" | "bad") => {
    if (!item) return;
    setSaving(true); setError(null);
    try {
      await fetchJson<Review>("/api/v1/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: item.run.id, case_id: String(item.index), verdict, comment: comment.trim() }) });
      await load(); setComment("");
      if (index < items.length - 1) setIndex(index + 1);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setSaving(false); }
  };
  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "LIDSKÁ KONTROLA" : "HUMAN REVIEW"} title={cs ? "Posoudit odpovědi" : "Review answers"} description={cs ? "Přečtěte si skutečnou odpověď a sami označte, zda je použitelná. Vaše hodnocení se uloží k běhu." : "Read a real answer and mark whether it is useful. Your review is saved with the run."} />
    {error && <Notice tone="danger" title={cs ? "Hodnocení se nepodařilo" : "Review failed"}>{error}</Notice>}
    <div className={styles.stats}><strong>{reviewed} / {items.length}</strong><span>{cs ? "zkontrolovaných odpovědí" : "answers reviewed"}</span></div>
    {item ? <section className={styles.card}><div className={styles.head}><div><span>{item.run.kind} · {item.result.model_key}</span><h2>{item.run.name}</h2><small>{item.result.case_id ?? "case"} · {item.run.id}</small><RunStatus status={item.result.status} /></div><div className={styles.pager}><Button variant="secondary" disabled={index === 0} onClick={() => { setIndex(index - 1); setComment(""); }}>{cs ? "Předchozí" : "Previous"}</Button><span>{index + 1} / {items.length}</span><Button variant="secondary" disabled={index === items.length - 1} onClick={() => { setIndex(index + 1); setComment(""); }}>{cs ? "Další" : "Next"}</Button></div></div><div className={styles.body}>
      {typeof item.run.spec?.prompt === "string" && item.run.spec.prompt && <div className={styles.question}><span>{cs ? "OTÁZKA" : "QUESTION"}</span><p>{item.run.spec.prompt}</p></div>}
      <div className={styles.answer}><span>{cs ? "ODPOVĚĎ MODELU" : "MODEL ANSWER"}</span><AnswerReveal answer={item.result.output ?? ""} locale={locale} initiallyOpen /></div>
      {item.result.grade && <p className={styles.metric}>{cs ? "Automatická metrika" : "Automatic metric"}: {item.result.grade.method} · {Math.round((item.result.grade.score ?? 0) * 100)} %</p>}
      {saved && <p className={styles.saved}><Check size={16} />{cs ? "Dříve hodnoceno" : "Previously reviewed"}: {saved.verdict === "good" ? (cs ? "použitelné" : "useful") : (cs ? "nepoužitelné" : "not useful")}</p>}
      <label className={styles.comment}><HelpLabel label={cs ? "Poznámka (volitelné)" : "Note (optional)"} helpKey="field.reviewComment" /><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
      <div className={styles.actions}><Button variant="secondary" loading={saving} onClick={() => void save("bad")}><ThumbsDown size={15} />{cs ? "Nepoužitelné" : "Not useful"}</Button><Button loading={saving} onClick={() => void save("good")}><ThumbsUp size={15} />{cs ? "Použitelné" : "Useful"}</Button></div>
    </div></section> : <div className={styles.empty}><CircleHelp size={23} /><h2>{cs ? "Zatím není co hodnotit" : "Nothing to review yet"}</h2><p>{cs ? "Spusťte prompt, arénu nebo RAG. Skutečné odpovědi se pak objeví zde." : "Run a prompt, arena comparison or RAG. Real answers will appear here."}</p><Link href="/arena">{cs ? "Otevřít arénu" : "Open arena"}<ArrowRight size={14} /></Link></div>}
  </div>;
}
