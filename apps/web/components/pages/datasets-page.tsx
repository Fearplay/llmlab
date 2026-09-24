"use client";

import { ArrowRight, Database, FileUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader } from "@/components/ui";
import { errorMessage, fetchJson, formatDate, type ExperimentRecord } from "./live-api";
import styles from "./dataset-workspace.module.css";

type Metric = "exact_match" | "partial_match" | "contains" | "json_schema";
interface Case { id: string; input: string; expected?: string | null; evidence?: string[]; schema?: Record<string, unknown> | null; evaluator: Metric }
interface Dataset { id: string; name: string; version: number; cases: Case[]; created_at: string }

export function DatasetsPage() {
  const { locale, selectedModel } = useApp();
  const cs = locale === "cs";
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [name, setName] = useState("");
  const [cases, setCases] = useState<Case[]>([]);
  const [input, setInput] = useState("");
  const [expected, setExpected] = useState("");
  const [evidence, setEvidence] = useState("");
  const [schema, setSchema] = useState("");
  const [evaluator, setEvaluator] = useState<Metric>("partial_match");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [lastRun, setLastRun] = useState<ExperimentRecord | null>(null);

  const refresh = useCallback(async () => {
    try { setDatasets(await fetchJson<Dataset[]>("/api/v1/datasets")); setError(null); }
    catch (caught) { setError(errorMessage(caught, locale)); }
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  const addCase = () => {
    if (!input.trim()) return;
    let parsedSchema: Record<string, unknown> | null = null;
    if (evaluator === "json_schema") {
      try {
        const parsed: unknown = JSON.parse(schema);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        parsedSchema = parsed as Record<string, unknown>;
      } catch { setError(cs ? "Schéma musí být platný JSON objekt." : "Schema must be a valid JSON object."); return; }
    }
    setCases((current) => [...current, { id: `case-${current.length + 1}`, input: input.trim(), expected: expected.trim() || null, evidence: evidence.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean), schema: parsedSchema, evaluator }]);
    setInput(""); setExpected(""); setEvidence(""); setSchema(""); setError(null);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseDataset(await file.text(), file.name);
      if (!parsed.length || parsed.some((item) => !item.input.trim())) throw new Error(cs ? "Soubor neobsahuje platné otázky." : "File has no valid questions.");
      setCases(parsed); setName((current) => current || file.name.replace(/\.[^.]+$/, "")); setError(null);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    event.target.value = "";
  };

  const save = async () => {
    if (!name.trim() || !cases.length) return;
    setWorking(true); setError(null);
    try {
      await fetchJson<Dataset>("/api/v1/datasets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), cases }) });
      setName(""); setCases([]); await refresh();
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setWorking(false); }
  };
  const remove = async (id: string) => {
    setWorking(true);
    try { await fetch(`/api/v1/datasets/${encodeURIComponent(id)}`, { method: "DELETE" }).then((response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); }); await refresh(); }
    catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setWorking(false); }
  };
  const evaluate = async (dataset: Dataset) => {
    if (!selectedModel) return;
    setWorking(true); setError(null);
    try {
      const run = await fetchJson<ExperimentRecord>("/api/v1/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: dataset.name, kind: "evaluation", model_keys: [selectedModel.key], dataset_id: dataset.id }) });
      setLastRun(run);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setWorking(false); }
  };

  return <div className={styles.page}>
    <PageHeader eyebrow={cs ? "EVALUACE" : "EVALUATION"} title={cs ? "Datasety" : "Datasets"} description={cs ? "Uložte vlastní otázky s očekávanou odpovědí nebo JSON schématem. Při evaluaci model odpoví na každou z nich." : "Save your own questions with reference answers or JSON schemas. Evaluation asks a model every question."} />
    {error && <Notice tone="danger" title={cs ? "Akce se nepodařila" : "Action failed"}>{error}</Notice>}
    <div className={styles.grid}>
      <section className={styles.panel}><div className={styles.panelHeader}><h2>{cs ? "Nový dataset" : "New dataset"}</h2><span>{cases.length} {cs ? "případů" : "cases"}</span></div><div className={styles.panelBody}>
        <label className={styles.field}>{cs ? "Název datasetu" : "Dataset name"}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={cs ? "Např. Produktové otázky" : "E.g. Product questions"} /></label>
        <label className={styles.upload}><FileUp size={19} /><span>{cs ? "Importovat CSV, JSON nebo JSONL" : "Import CSV, JSON or JSONL"}</span><input type="file" accept=".csv,.json,.jsonl" onChange={(event) => void onFile(event)} /></label>
        <div className={styles.divider}>{cs ? "NEBO PŘIDEJTE OTÁZKU" : "OR ADD A QUESTION"}</div>
        <label className={styles.field}>{cs ? "Otázka / vstup" : "Question / input"}<textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} /></label>
        <label className={styles.field}>{cs ? "Způsob hodnocení" : "Scoring method"}<select value={evaluator} onChange={(event) => setEvaluator(event.target.value as Metric)}><option value="partial_match">{cs ? "Částečná shoda slov" : "Partial word match"}</option><option value="exact_match">{cs ? "Přesná shoda" : "Exact match"}</option><option value="contains">{cs ? "Odpověď obsahuje text" : "Answer contains text"}</option><option value="json_schema">JSON schema</option></select></label>
        {evaluator === "json_schema" ? <label className={styles.field}>JSON schema<textarea value={schema} onChange={(event) => setSchema(event.target.value)} rows={4} placeholder='{"type":"object","required":["answer"]}' /></label> : <label className={styles.field}>{cs ? "Očekávaná odpověď" : "Expected answer"}<textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={2} /></label>}
        <label className={styles.field}>{cs ? "Podklady pro kontrolu (volitelné, oddělte prázdným řádkem)" : "Evidence (optional, separate with blank lines)"}<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={3} /></label>
        <Button variant="secondary" onClick={addCase} disabled={!input.trim()}><Plus size={14} />{cs ? "Přidat případ" : "Add case"}</Button>
        {cases.length > 0 && <div className={styles.draft}>{cases.map((item, index) => <div key={item.id}><strong>{item.id}</strong><span>{item.input}</span><button type="button" aria-label={cs ? "Odebrat případ" : "Remove case"} onClick={() => setCases((current) => current.filter((_, position) => position !== index))}><Trash2 size={14} /></button></div>)}</div>}
        <Button onClick={() => void save()} loading={working} disabled={!name.trim() || !cases.length}>{cs ? "Uložit dataset" : "Save dataset"}</Button>
      </div></section>
      <section className={styles.panel}><div className={styles.panelHeader}><h2>{cs ? "Uložené datasety" : "Saved datasets"}</h2><span>{datasets.length}</span></div><div className={styles.panelBody}>
        {datasets.length ? <div className={styles.saved}>{datasets.map((dataset) => <article key={dataset.id}><div><Database size={18} /><strong>{dataset.name}</strong></div><p>{dataset.cases.length} {cs ? "případů" : "cases"} · v{dataset.version} · {formatDate(dataset.created_at, locale)}</p><div className={styles.actions}><Button variant="secondary" disabled={!selectedModel || working} onClick={() => void evaluate(dataset)}>{cs ? "Spustit evaluaci" : "Run evaluation"}<ArrowRight size={14} /></Button><button type="button" onClick={() => void remove(dataset.id)} disabled={working} aria-label={`${cs ? "Smazat" : "Delete"} ${dataset.name}`}><Trash2 size={15} /></button></div><details><summary>{cs ? "Zobrazit otázky" : "Show questions"}</summary>{dataset.cases.map((item) => <p key={item.id}><strong>{item.id}</strong> {item.input}</p>)}</details></article>)}</div> : <div className={styles.empty}><Database size={25} /><strong>{cs ? "Žádný uložený dataset" : "No saved dataset"}</strong><p>{cs ? "Vytvořte první sadu otázek vlevo nebo importujte soubor." : "Create your first set of questions on the left or import a file."}</p></div>}
        {!selectedModel && <p className={styles.note}>{cs ? "Pro spuštění evaluace vyberte dostupný model vpravo nahoře." : "Choose an available model in the top right to run an evaluation."}</p>}
        {lastRun && <p className={styles.note}>{cs ? "Evaluace spuštěna." : "Evaluation started."} <Link href="/history">{cs ? "Otevřít historii" : "Open history"}<ArrowRight size={13} /></Link></p>}
      </div></section>
    </div>
  </div>;
}

function parseDataset(text: string, name: string): Case[] {
  const trimmed = text.trim();
  let rows: unknown[];
  if (name.toLowerCase().endsWith(".jsonl")) rows = trimmed.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  else if (name.toLowerCase().endsWith(".json")) {
    const value: unknown = JSON.parse(trimmed);
    if (!Array.isArray(value)) throw new Error("JSON root must be an array.");
    rows = value;
  } else {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = splitCsv(lines[0]);
    rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, splitCsv(line)[index] ?? ""])));
  }
  return rows.map((value, index) => {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const evaluator = ["exact_match", "partial_match", "contains", "json_schema"].includes(String(row.evaluator)) ? String(row.evaluator) as Metric : "partial_match";
    return { id: String(row.id || `case-${index + 1}`), input: String(row.input || row.question || ""), expected: row.expected == null ? null : String(row.expected), evidence: Array.isArray(row.evidence) ? row.evidence.map(String) : [], evaluator, schema: row.schema && typeof row.schema === "object" && !Array.isArray(row.schema) ? row.schema as Record<string, unknown> : null };
  });
}

function splitCsv(line: string): string[] {
  const values: string[] = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim()); return values;
}
