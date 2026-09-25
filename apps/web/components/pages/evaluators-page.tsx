"use client";

import { ArrowRight, Braces, CheckCheck, CircleHelp, Scale, WholeWord } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader } from "@/components/ui";
import { errorMessage, fetchJson, type ExperimentRecord } from "./live-api";
import styles from "./evaluators-page.module.css";

const methods = [
  { id: "exact_match", icon: WholeWord, cs: "Přesná shoda", en: "Exact match", csText: "Porovná celý text odpovědi s referencí po sjednocení velikosti písmen a mezer. Hodí se pro krátké jednoznačné odpovědi.", enText: "Compares the whole answer with a reference after normalizing case and spacing. Best for short, unambiguous answers." },
  { id: "partial_match", icon: Scale, cs: "Částečná shoda", en: "Partial match", csText: "Měří, kolik slov očekávané odpovědi se vyskytuje ve výstupu. Delší správnou větu tak nepenalizuje, ale neumí ověřit význam ani odhalit rozpor.", enText: "Measures how many reference words appear in the output. It accepts a longer answer, but cannot verify meaning or detect contradictions." },
  { id: "contains", icon: CheckCheck, cs: "Obsahuje text", en: "Contains text", csText: "Zkontroluje, zda odpověď obsahuje očekávaný text. Vhodné pro klíčová fakta nebo požadovanou frázi.", enText: "Checks whether the answer contains expected text. Useful for key facts or required phrases." },
  { id: "json_schema", icon: Braces, cs: "JSON schéma", en: "JSON schema", csText: "Přečte odpověď jako JSON a ověří ji proti vašemu schématu. Testuje strukturu, nikoli pravdivost hodnot.", enText: "Parses the answer as JSON and validates it against your schema. Tests structure, not factual accuracy." },
];

export function EvaluatorsPage() {
  const { locale, models } = useApp();
  const cs = locale === "cs";
  const [latest, setLatest] = useState<ExperimentRecord | null>(null);
  const [method, setMethod] = useState<"semantic" | "relevance" | "groundedness" | "llm_judge" | "custom_prompt">("relevance");
  const [modelKey, setModelKey] = useState("");
  const [question, setQuestion] = useState(cs ? "Jak dlouho lze vrátit zboží?" : "How long can goods be returned?");
  const [answer, setAnswer] = useState(cs ? "Zboží lze vrátit do 30 dnů." : "Goods can be returned within 30 days.");
  const [expected, setExpected] = useState("");
  const [evidence, setEvidence] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<{ method: string; score: number | null; passed: boolean | null; model_key: string; reason: string; prompt: string | null; fixture: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchJson<ExperimentRecord[]>("/api/v1/experiments")
      .then((runs) => setLatest(runs.find((run) => run.kind === "evaluation") ?? null))
      .catch(() => undefined);
  }, []);
  const grades = (latest?.results ?? []).flatMap((item) => item.grade ? [item.grade] : []);
  const measured = grades.length ? grades.reduce((sum, grade) => sum + (grade.score ?? 0), 0) / grades.length : null;
  const capable = models.filter((model) => model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes(method === "semantic" ? "embeddings" : "generation") : model.capabilities?.[method === "semantic" ? "embeddings" : "generation"]));
  const activeModel = capable.some((model) => model.key === modelKey) ? modelKey : capable[0]?.key ?? "";
  const evaluate = async () => {
    if (!activeModel || !answer.trim()) return;
    setWorking(true); setError(null);
    try {
      setResult(await fetchJson<typeof result & object>("/api/v1/evaluations/advanced", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evaluator: method, question, answer, expected, evidence: evidence.split(/\n\s*\n/).filter(Boolean), model_key: activeModel, prompt: prompt.trim() || null }) }));
    } catch (caught) { setError(errorMessage(caught, locale)); setResult(null); }
    finally { setWorking(false); }
  };
  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "VYHODNOCENÍ" : "SCORING"} title={cs ? "Jak hodnotíme odpovědi" : "How answers are scored"} description={cs ? "Metriku zvolíte u každé otázky v datasetu. Výsledek se počítá až ze skutečné odpovědi modelu." : "Choose a metric for each dataset case. Scores are calculated only from the model’s real answer."} />
    <div className={styles.intro}><CircleHelp size={19} /><p>{cs ? "Skóre je pomůcka, nikoli verdikt o pravdivosti. Bez referenční odpovědi nebo schématu aplikace kvalitu neodhaduje. Volitelný AI hodnotitel v Aréně ukazuje názor modelu zvlášť." : "A score is a guide, not a verdict on truth. Without a reference or schema, the app does not infer answer quality. The optional AI judge in Arena is shown separately as a model opinion."}</p></div>
    <div className={styles.grid}>{methods.map(({ id, icon: Icon, cs: nameCs, en, csText, enText }) => <article key={id} className={styles.card}><div><Icon size={20} /><span>{id}</span></div><h2>{cs ? nameCs : en}</h2><p>{cs ? csText : enText}</p></article>)}</div>
    <section className={styles.workbench}><div><span className={styles.kicker}>{cs ? "ŽIVÝ EXPERIMENT" : "LIVE EXPERIMENT"}</span><h2>{cs ? "Vyzkoušet pokročilý evaluátor" : "Try an advanced evaluator"}</h2><p>{cs ? "Skóre a zdůvodnění pochází od zvoleného modelu. U sémantické metriky jde o kosinovou podobnost embeddingů." : "The selected model provides the score and reason. Semantic scoring uses cosine similarity of embeddings."}</p></div><div className={styles.workbenchGrid}>
      <label>{cs ? "Metoda" : "Method"}<select value={method} onChange={(event) => { setMethod(event.target.value as typeof method); setResult(null); }}><option value="semantic">{cs ? "Sémantická podobnost" : "Semantic similarity"}</option><option value="relevance">{cs ? "Relevance odpovědi" : "Answer relevance"}</option><option value="groundedness">Groundedness</option><option value="llm_judge">LLM-as-a-judge</option><option value="custom_prompt">{cs ? "Vlastní prompt" : "Custom prompt"}</option></select></label>
      <label>{cs ? "Model hodnotitele" : "Evaluator model"}<select value={activeModel} onChange={(event) => setModelKey(event.target.value)}>{capable.map((model) => <option value={model.key} key={model.key}>{model.provider} · {model.id}</option>)}</select></label>
      <label>{cs ? "Otázka" : "Question"}<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} /></label>
      <label>{cs ? "Odpověď" : "Answer"}<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={2} /></label>
      <label>{cs ? "Očekávaná odpověď" : "Reference answer"}<textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={2} /></label>
      <label>{cs ? "Podklady (oddělte prázdným řádkem)" : "Evidence (separate with a blank line)"}<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={2} /></label>
      {method === "custom_prompt" && <label className={styles.full}>{cs ? "Instrukce hodnotiteli" : "Evaluator instruction"}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} /></label>}
    </div><Button onClick={() => void evaluate()} disabled={!activeModel || !answer.trim() || (method === "semantic" && !expected.trim()) || (method === "groundedness" && !evidence.trim()) || (method === "custom_prompt" && !prompt.trim())} loading={working}>{cs ? "Vyhodnotit" : "Evaluate"}</Button>{!capable.length && <p>{cs ? "Pro tuto metodu není dostupný vhodný model." : "No suitable model is available for this method."}</p>}{error && <Notice tone="danger" title={cs ? "Evaluace selhala" : "Evaluation failed"}>{error}</Notice>}{result && <div className={styles.outcome}><strong>{result.score === null ? "—" : `${Math.round(result.score * 100)} %`}</strong><span>{result.method} · {result.model_key}</span><p>{result.reason}</p>{result.prompt && <details><summary>{cs ? "Zobrazit přesný prompt hodnotitele" : "Show exact evaluator prompt"}</summary><pre>{result.prompt}</pre></details>}<small>{cs ? "Názor modelu není objektivní pravda." : "A model opinion is not objective truth."}</small></div>}</section>
    <section className={styles.last}><div><span>{cs ? "POSLEDNÍ EVALUACE" : "LATEST EVALUATION"}</span><h2>{latest?.name ?? (cs ? "Zatím žádná evaluace" : "No evaluation yet")}</h2><p>{measured === null ? (cs ? "Vytvořte dataset a spusťte ho s vybraným modelem." : "Create a dataset and run it with a selected model.") : `${grades.length} ${cs ? "ohodnocených odpovědí" : "scored answers"} · ${(measured * 100).toFixed(1)} %`}</p></div><Link href="/datasets">{cs ? "Otevřít datasety" : "Open datasets"}<ArrowRight size={15} /></Link></section>
  </div>;
}
