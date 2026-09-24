"use client";

import { ArrowRight, Bird, Database, FlaskConical, RotateCcw, Sparkles, Swords, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader, RunStatus } from "@/components/ui";
import { errorMessage, fetchJson, formatCost, formatDate, type ExperimentRecord, type OperationsSummary } from "./live-api";
import styles from "./overview-page.module.css";

const routes = [
  { href: "/ai-lab/prompt-tokens", icon: Sparkles, cs: "Vyzkoušet prompt", en: "Try a prompt" },
  { href: "/arena", icon: Swords, cs: "Porovnat modely", en: "Compare models" },
  { href: "/ai-lab/rag", icon: Database, cs: "Pracovat s dokumenty", en: "Use documents" },
  { href: "/ai-lab/flappy", icon: Bird, cs: "Flappy AI", en: "Flappy AI" },
];

export function DashboardPage() {
  const { locale, projectName, selectedModel, models } = useApp();
  const cs = locale === "cs";
  const [runs, setRuns] = useState<ExperimentRecord[]>([]);
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExamples, setShowExamples] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [records, operations] = await Promise.all([
        fetchJson<ExperimentRecord[]>("/api/v1/experiments"),
        fetchJson<OperationsSummary>("/api/v1/operations/summary"),
      ]);
      setRuns(records);
      setSummary(operations);
      setError(null);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setLoading(false); }
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  const connected = models.filter((model) => model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation));
  const completed = runs.filter((run) => run.status === "completed").length;
  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "VAŠE LABORATOŘ" : "YOUR LAB"} title={projectName || "LLMLab"} description={cs ? "Zkoušejte modely, porovnávejte odpovědi a sledujte každý skutečný běh na jednom místě." : "Explore models, compare responses and follow every real run in one place."} actions={<Button variant="secondary" onClick={() => void refresh()} loading={loading}><RotateCcw size={15} />{cs ? "Obnovit" : "Refresh"}</Button>} />
    {error && <Notice tone="danger" title={cs ? "Data se nepodařilo načíst" : "Could not load lab data"}>{error}</Notice>}
    <section className={styles.hero} aria-label={cs ? "Začněte experimentovat" : "Get started"}>
      <div className={styles.heroText}><span className={styles.kicker}>{cs ? "PROZKOUMEJTE JAK LLM FUNGUJÍ" : "EXPLORE HOW LLMS WORK"}</span><h2>{cs ? "Od prvního promptu k vlastnímu experimentu." : "From your first prompt to your own experiment."}</h2><p>{cs ? "Vyberte model nahoře vpravo a spusťte prompt. Výsledek, čas a spotřeba se uloží do historie. Modely Ollamy se objeví automaticky, pokud je server spuštěný." : "Choose a model in the top right and run a prompt. Its output, time and usage are saved to history. Ollama models appear automatically when its server is running."}</p><Link href="/ai-lab/prompt-tokens" className={styles.heroAction}>{cs ? "Otevřít Prompt a tokeny" : "Open Prompt & tokens"}<ArrowRight size={16} /></Link></div>
      <div className={styles.heroMeta}><div><span>{cs ? "DOSTUPNÉ MODELY" : "AVAILABLE MODELS"}</span><strong>{connected.length}</strong></div><div><span>{cs ? "VYBRANÝ MODEL" : "SELECTED MODEL"}</span><strong className={styles.modelName}>{selectedModel?.id ?? (cs ? "Vyberte model" : "Choose a model")}</strong></div></div>
    </section>
    <section className={styles.quickLinks} aria-label={cs ? "Laboratoře" : "Labs"}>{routes.map(({ href, icon: Icon, cs: c, en }) => <Link key={href} href={href} className={styles.quickLink}><Icon size={18} /><span>{cs ? c : en}</span><ArrowRight size={15} /></Link>)}</section>
    <section className={styles.metricBand} aria-label={cs ? "Skutečné statistiky" : "Real statistics"}>
      <Metric label={cs ? "Uložené běhy" : "Saved runs"} value={String(summary?.runs ?? 0)} note={cs ? "v místní databázi" : "in local database"} icon={<FlaskConical size={18} />} />
      <Metric label={cs ? "Dokončené" : "Completed"} value={String(completed)} note={cs ? "promptů a experimentů" : "prompts and experiments"} icon={<Sparkles size={18} />} />
      <Metric label={cs ? "Vstupní / výstupní tokeny" : "Input / output tokens"} value={`${summary?.input_tokens ?? 0} / ${summary?.output_tokens ?? 0}`} note={cs ? "nahlášené poskytovateli" : "reported by providers"} icon={<Database size={18} />} />
      <Metric label={cs ? "Odhad ceny API" : "Estimated API cost"} value={formatCost(summary?.estimated_usd ?? 0, locale)} note={(summary?.unknown_calls ?? 0) > 0 ? `${summary?.unknown_calls} ${cs ? "volání bez známé ceny" : "calls with unknown price"}` : (cs ? "z dostupných cen" : "from available rates")} icon={<Wallet size={18} />} />
    </section>
    <section className={styles.history}><div className={styles.sectionHead}><div><span className={styles.kicker}>{cs ? "ZÁZNAMY" : "RECORDS"}</span><h2>{cs ? "Poslední běhy" : "Recent runs"}</h2></div><Link href="/history">{cs ? "Celá historie" : "Full history"}<ArrowRight size={15} /></Link></div>
      {runs.length ? <div className={styles.runList}>{runs.slice(0, 5).map((run) => <Link href="/history" key={run.id} className={styles.run}><span className={styles.runKind}>{run.kind}</span><strong>{run.name}</strong><span>{run.model}</span><time>{formatDate(run.created_at, locale)}</time><RunStatus status={run.status} /></Link>)}</div> : <div className={styles.empty}><FlaskConical size={23} /><h3>{cs ? "Zatím tu není žádný běh" : "No runs yet"}</h3><p>{cs ? "Spusťte první prompt nebo arénu. Tady potom uvidíte skutečné výsledky." : "Run your first prompt or arena comparison to see real results here."}</p><Link href="/ai-lab/prompt-tokens">{cs ? "Začít s promptem" : "Start with a prompt"}<ArrowRight size={15} /></Link></div>}
    </section>
    <div className={styles.examples}><button type="button" onClick={() => setShowExamples((value) => !value)} aria-expanded={showExamples}>{cs ? "Ukázat nápady na první experiment" : "Show ideas for a first experiment"}<ArrowRight size={14} /></button>{showExamples && <p>{cs ? "Zkuste vysvětlit nové téma dvěma modely, porovnat stejnou otázku při různých hodnotách teploty nebo nahrát vlastní dokument do RAG." : "Try explaining a new topic with two models, comparing one question at different temperatures, or uploading a document to RAG."}</p>}</div>
  </div>;
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className={styles.metric}><div>{icon}<span>{label}</span></div><strong>{value}</strong><small>{note}</small></div>;
}
