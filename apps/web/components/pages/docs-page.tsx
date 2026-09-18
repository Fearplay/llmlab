"use client";

import { ArrowRight, Bot, Braces, ChartNoAxesCombined, FileCheck2, Network, ShieldCheck, SquareStack } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { PageHeader, Panel } from "@/components/ui";

const topics = [
  { key: "token", href: "/ai-lab/prompt-tokens", icon: Braces },
  { key: "embedding", href: "/ai-lab/embeddings", icon: Network },
  { key: "rag", href: "/ai-lab/rag", icon: SquareStack, wide: true },
  { key: "eval", href: "/evaluators", icon: FileCheck2 },
  { key: "grounding", href: "/ai-lab/grounding", icon: ShieldCheck },
  { key: "agent", href: "/ai-lab/agents", icon: Bot },
  { key: "training", href: "/ai-lab/training", icon: ChartNoAxesCombined },
] as const;

export function DocsPage() {
  const { t } = useApp();
  return <>
    <PageHeader eyebrow={t("learn.foundation")} title={t("learn.title")} description={t("learn.subtitle")} />
    <div className="learning-grid">{topics.map((topic) => {
      const Icon = topic.icon;
      return <Panel key={topic.key} className={"wide" in topic && topic.wide ? "learning-card wide" : "learning-card"}><Icon size={20} /><h2>{t(`learn.${topic.key}Title`)}</h2><p>{t(`learn.${topic.key}Text`)}</p>{topic.key === "rag" && <code className="rag-formula">{t("learn.ragFlow")}</code>}<Link className="inline-link" href={topic.href}>{t("learn.openLab")}<ArrowRight size={13} /></Link></Panel>;
    })}</div>
    <section className="learning-method"><strong>{t("learn.methodTitle")}</strong><p>{t("learn.methodText")}</p></section>
  </>;
}
