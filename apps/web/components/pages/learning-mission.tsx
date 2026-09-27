"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { learningProgressKey, missionBySlug, missions } from "@/lib/learning-content";
import styles from "./learning-mission.module.css";

export function LearningMission({ slug }: { slug: string }) {
  const { locale } = useApp();
  const cs = locale === "cs";
  const mission = missionBySlug(slug)!;
  const [prediction, setPrediction] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [visited, setVisited] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(learningProgressKey) ?? "[]") as unknown;
      if (Array.isArray(saved)) queueMicrotask(() => setCompleted(saved.filter((item): item is string => typeof item === "string")));
      const predicted = sessionStorage.getItem(`llmlab.missionPrediction.${slug}`);
      if (predicted === "0" || predicted === "1") queueMicrotask(() => setPrediction(Number(predicted)));
      queueMicrotask(() => setVisited(sessionStorage.getItem(`llmlab.missionVisited.${slug}`) === "1"));
    } catch { /* Storage may be unavailable; the mission still works in memory. */ }
  }, [slug]);
  const order = slug.length % 2 ? [1, 0] : [0, 1];
  const next = missions[missions.findIndex((item) => item.slug === slug) + 1];
  const correct = selected === 0;
  const finish = () => {
    setChecked(true);
    if (!correct || completed.includes(slug)) return;
    const updated = [...completed, slug];
    setCompleted(updated);
    try { localStorage.setItem(learningProgressKey, JSON.stringify(updated)); } catch { /* Keep in-memory progress. */ }
  };
  const experimentHref = `${mission.href}?mission=${encodeURIComponent(slug)}`;
  return <div className={styles.page}>
    <Link href="/docs#missions" className={styles.back}>{cs ? "← Zpět na výukové cesty" : "← Back to learning paths"}</Link>
    <header className={styles.hero}><span>{cs ? "VEDENÁ MISE" : "GUIDED MISSION"} · {mission.track.toUpperCase()}</span><h1>{mission.title[locale]}</h1><p>{cs ? "Nejdřív odhadni výsledek, potom ho zkus v laboratoři a nakonec vysvětli, co se stalo." : "Predict first, try it in the lab, then explain what happened."}</p></header>
    <div className={styles.steps}>
      <section><span className={styles.number}>01</span><div><h2>{cs ? "Předpověz" : "Predict"}</h2><p>{mission.question[locale]}</p><div className={styles.choices}>{order.map((index) => <button key={index} type="button" aria-pressed={prediction === index} onClick={() => { setPrediction(index); try { sessionStorage.setItem(`llmlab.missionPrediction.${slug}`, String(index)); } catch { /* Optional storage. */ } }}>{mission.choices[locale][index]}</button>)}</div><small>{cs ? "Odhad se nehodnotí; můžeš ho po pokusu změnit." : "Your prediction is not graded; you can change it after the experiment."}</small></div></section>
      <section><span className={styles.number}>02</span><div><h2>{cs ? "Vyzkoušej" : "Try it"}</h2><p>{mission.action[locale]}</p><Link href={experimentHref}>{cs ? "Otevřít pokus →" : "Open experiment →"}</Link><small>{cs ? "V laboratoři uvidíš odkaz zpět do této mise. Živý model je volitelný." : "The lab shows a link back here. A live model is optional."}</small></div></section>
      <section><span className={styles.number}>03</span><div><h2>{cs ? "Ověř, co ses naučil" : "Check what you learned"}</h2><p>{mission.question[locale]}</p><div className={styles.choices}>{order.map((index) => <button key={index} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); setChecked(false); }}>{mission.choices[locale][index]}</button>)}</div><button className={styles.check} type="button" disabled={!visited || selected === null} onClick={finish}>{cs ? "Zkontrolovat odpověď" : "Check answer"}</button>{!visited && <small>{cs ? "Nejdřív otevři pokus v kroku 2." : "Open the experiment in step 2 first."}</small>}{checked && <div role="status" className={correct ? styles.success : styles.retry}><strong>{correct ? cs ? "Správně, mise splněna" : "Correct, mission complete" : cs ? "Zkus to znovu" : "Try again"}</strong><p>{correct ? mission.choices[locale][0] : cs ? `Vrať se k pokusu: ${mission.action.cs}` : `Revisit the experiment: ${mission.action.en}`}</p>{correct && next && <Link href={`/docs/learn/${next.slug}`}>{cs ? "Další mise →" : "Next mission →"}</Link>}</div>}</div></section>
    </div>
    <p className={styles.progress}>{cs ? "Dokončeno" : "Completed"}: {completed.length} / {missions.length}</p>
  </div>;
}
