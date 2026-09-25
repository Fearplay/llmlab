"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { labEntries, labGroups, labHref } from "@/lib/lab-catalog";
import styles from "./lab-overview.module.css";

export function LabOverview() {
  const { locale } = useApp();
  const cs = locale === "cs";
  return <div className={styles.page}>
    <header className={styles.hero}><div><span className={styles.mark} aria-hidden="true">◉ ━ ◉ ━ ◉ ━ ◉</span><h1>{cs ? "Projdi celý život jednoho požadavku" : "Follow a request through its whole life"}</h1><p>{cs ? "Změň jeden parametr, spusť experiment a sleduj, co se stane s tokeny, podklady, odpovědí i cenou." : "Change one parameter, run an experiment, and see what happens to tokens, evidence, answers and cost."}</p></div><div className={styles.flow} aria-label={cs ? "Tok požadavku" : "Request flow"}><span>TEXT</span><span>TOKENS</span><span>MODEL</span><span>{cs ? "KONTEXT" : "CONTEXT"}</span><span>{cs ? "VÝSLEDEK" : "RESULT"}</span></div></header>
    <div className={styles.paths}>{labGroups.map((group, index) => <section className={styles.path} key={group.id}><div className={styles.pathHeading}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><div><h2>{cs ? group.cs : group.en}</h2><p>{cs ? group.descriptionCs : group.descriptionEn}</p></div></div><div className={styles.links}>{labEntries.filter((entry) => entry.group === group.id).map((entry) => <Link key={entry.slug} href={labHref(entry.slug)}><span><strong>{cs ? entry.cs : entry.en}</strong><small>{cs ? entry.summaryCs : entry.summaryEn}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div></section>)}</div>
  </div>;
}
