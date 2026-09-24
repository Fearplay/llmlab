"use client";

import { ArrowRight, Braces, CheckCheck, CircleHelp, Scale, WholeWord } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/ui";
import { fetchJson, type ExperimentRecord } from "./live-api";
import styles from "./evaluators-page.module.css";

const methods = [
  { id: "exact_match", icon: WholeWord, cs: "Přesná shoda", en: "Exact match", csText: "Porovná celý text odpovědi s referencí po sjednocení velikosti písmen a mezer. Hodí se pro krátké jednoznačné odpovědi.", enText: "Compares the whole answer with a reference after normalizing case and spacing. Best for short, unambiguous answers." },
  { id: "partial_match", icon: Scale, cs: "Částečná shoda", en: "Partial match", csText: "Měří, kolik slov očekávané odpovědi se vyskytuje ve výstupu. Delší správnou větu tak nepenalizuje, ale neumí ověřit význam ani odhalit rozpor.", enText: "Measures how many reference words appear in the output. It accepts a longer answer, but cannot verify meaning or detect contradictions." },
  { id: "contains", icon: CheckCheck, cs: "Obsahuje text", en: "Contains text", csText: "Zkontroluje, zda odpověď obsahuje očekávaný text. Vhodné pro klíčová fakta nebo požadovanou frázi.", enText: "Checks whether the answer contains expected text. Useful for key facts or required phrases." },
  { id: "json_schema", icon: Braces, cs: "JSON schéma", en: "JSON schema", csText: "Přečte odpověď jako JSON a ověří ji proti vašemu schématu. Testuje strukturu, nikoli pravdivost hodnot.", enText: "Parses the answer as JSON and validates it against your schema. Tests structure, not factual accuracy." },
];

export function EvaluatorsPage() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [latest, setLatest] = useState<ExperimentRecord | null>(null);
  useEffect(() => {
    fetchJson<ExperimentRecord[]>("/api/v1/experiments")
      .then((runs) => setLatest(runs.find((run) => run.kind === "evaluation") ?? null))
      .catch(() => undefined);
  }, []);
  const grades = (latest?.results ?? []).flatMap((item) => item.grade ? [item.grade] : []);
  const measured = grades.length ? grades.reduce((sum, grade) => sum + (grade.score ?? 0), 0) / grades.length : null;
  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "VYHODNOCENÍ" : "SCORING"} title={cs ? "Jak hodnotíme odpovědi" : "How answers are scored"} description={cs ? "Metriku zvolíte u každé otázky v datasetu. Výsledek se počítá až ze skutečné odpovědi modelu." : "Choose a metric for each dataset case. Scores are calculated only from the model’s real answer."} />
    <div className={styles.intro}><CircleHelp size={19} /><p>{cs ? "Skóre je pomůcka, nikoli verdikt o pravdivosti. Bez referenční odpovědi nebo schématu aplikace kvalitu neodhaduje. Volitelný AI hodnotitel v Aréně ukazuje názor modelu zvlášť." : "A score is a guide, not a verdict on truth. Without a reference or schema, the app does not infer answer quality. The optional AI judge in Arena is shown separately as a model opinion."}</p></div>
    <div className={styles.grid}>{methods.map(({ id, icon: Icon, cs: nameCs, en, csText, enText }) => <article key={id} className={styles.card}><div><Icon size={20} /><span>{id}</span></div><h2>{cs ? nameCs : en}</h2><p>{cs ? csText : enText}</p></article>)}</div>
    <section className={styles.last}><div><span>{cs ? "POSLEDNÍ EVALUACE" : "LATEST EVALUATION"}</span><h2>{latest?.name ?? (cs ? "Zatím žádná evaluace" : "No evaluation yet")}</h2><p>{measured === null ? (cs ? "Vytvořte dataset a spusťte ho s vybraným modelem." : "Create a dataset and run it with a selected model.") : `${grades.length} ${cs ? "ohodnocených odpovědí" : "scored answers"} · ${(measured * 100).toFixed(1)} %`}</p></div><Link href="/datasets">{cs ? "Otevřít datasety" : "Open datasets"}<ArrowRight size={15} /></Link></section>
  </div>;
}
