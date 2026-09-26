"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { HelpLabel, InfoTip } from "@/components/ui";
import { labEntries, labGroups, labHref } from "@/lib/lab-catalog";
import { FoundationLab } from "./foundation-labs";
import { KnowledgeLab } from "./knowledge-labs";
import { ApplicationLab } from "./application-labs";
import { OperationsLab } from "./operations-labs";
import { GroundingCompare, MiniCorpus } from "../extra-experiments";
import styles from "./concept-lab.module.css";

export type LabLocale = "cs" | "en";
export function Field({ label, helpKey, children }: { label: string; helpKey: string; children: React.ReactNode }) {
  return <label className={styles.field}><HelpLabel label={label} helpKey={helpKey} />{children}</label>;
}
export function Readout({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div className={styles.readout}><span className="metric-help-label">{label}<InfoTip label={label} context="metric" /></span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
export function Note({ children }: { children: React.ReactNode }) { return <p className={styles.note}>{children}</p>; }
export function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className={styles.panel}><h2 className="panel-title-row">{title}<InfoTip label={title} context="section" /></h2>{children}</section>; }
export function Experiment({ controls, result }: { controls: React.ReactNode; result: React.ReactNode }) { return <div className={styles.experiment}><div>{controls}</div><div>{result}</div></div>; }
export function Bars({ values, labels, highlight }: { values: number[]; labels: string[]; highlight?: number }) { return <div className={styles.bars}>{values.map((value, index) => <div className={styles.barRow} key={`${labels[index]}-${index}`}><span>{labels[index]}</span><div className={styles.barTrack}><i className={highlight === index ? styles.highlight : ""} style={{ width: `${Math.max(1, Math.min(100, value * 100))}%` }} /></div><strong>{Math.round(value * 100)} %</strong></div>)}</div>; }

export function ConceptLab({ slug }: { slug: string }) {
  const { locale } = useApp();
  const entry = labEntries.find((item) => item.slug === slug);
  if (!entry) return null;
  const cs = locale === "cs";
  const group = labGroups.find((item) => item.id === entry.group)!;
  const index = labEntries.indexOf(entry);
  const next = labEntries[index + 1];
  const previous = labEntries[index - 1];
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.breadcrumb}><Link href="/ai-lab">{cs ? "AI laboratoř" : "AI Lab"}</Link><span>/</span><span>{cs ? group.cs : group.en}</span></div><h1>{cs ? entry.cs : entry.en}</h1><p>{cs ? entry.summaryCs : entry.summaryEn}</p></header>
    <div className={styles.lesson}><strong>{cs ? "Vyzkoušej změnu" : "Try a change"}</strong><span>{cs ? "Uprav jednu vstupní hodnotu a porovnej výsledek. Měřené a ukázkové hodnoty jsou vždy rozlišené." : "Change one input and compare the result. Measured and example values are always distinguished."}</span></div>
    {entry.group === "foundations" && <FoundationLab slug={slug} locale={locale} />}
    {entry.group === "knowledge" && <KnowledgeLab slug={slug} locale={locale} />}
    {entry.group === "applications" && <ApplicationLab slug={slug} locale={locale} />}
    {entry.group === "operations" && <OperationsLab slug={slug} locale={locale} />}
    {slug === "retrieval" && <MiniCorpus />}
    {slug === "grounding" && <GroundingCompare />}
    <footer className={styles.footer}>{previous ? <Link href={labHref(previous.slug)}><ArrowLeft size={15} />{cs ? previous.cs : previous.en}</Link> : <span />}{next ? <Link href={labHref(next.slug)}>{cs ? next.cs : next.en}<ArrowRight size={15} /></Link> : <span />}</footer>
  </div>;
}
