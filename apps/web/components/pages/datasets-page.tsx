"use client";

import { Check, FileJson, Plus, Upload, X } from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, DefinitionTerm, Notice, PageHeader, Panel, ProvenanceStrip, TableHeading } from "@/components/ui";
import { datasetRows } from "@/lib/fixtures";

type DatasetRow = Record<string, string>;

export function DatasetsPage() {
  const { t } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DatasetRow[]>(datasetRows);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const invalidRows = useMemo(() => rows.filter((row) => !row.input || !row.expected), [rows]);
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setCreated(false); setError(null);
    try {
      const parsed = parseDataset(await file.text(), file.name);
      if (!parsed.length) throw new Error("Dataset contains no rows.");
      setRows(parsed);
    } catch (reason) {
      setRows([]); setError(reason instanceof Error ? reason.message : "Dataset could not be parsed.");
    }
  };

  return <><PageHeader title={t("datasets.title")} description={t("datasets.subtitle")} actions={<Button onClick={() => inputRef.current?.click()}><Upload size={15} />{t("datasets.import")}</Button>} /><ProvenanceStrip mode="fixture" tail="support-v4 · 500 cases · version 4" />
    <div className="dataset-summary"><Panel><div className="dataset-title"><FileJson size={28} /><div><h2>{t("datasets.active")}</h2><p>{t("datasets.cases")} · {t("datasets.versions")}</p></div></div></Panel><Panel><dl className="definition-list horizontal"><div><DefinitionTerm label={t("datasets.languages")} /><dd>EN 72% · CZ 28%</dd></div><div><DefinitionTerm label={t("datasets.slices")} /><dd>{t("datasets.sliceSummary")}</dd></div><div><DefinitionTerm label={t("datasets.updated")} /><dd className="mono">2026-09-12 14:32</dd></div></dl></Panel></div>
    <div className="content-grid one-one"><Panel title={t("datasets.import")}><button className="drop-zone" onClick={() => inputRef.current?.click()}><Upload size={24} /><strong>{t("datasets.drop")}</strong><span>{t("datasets.browse")}</span></button><input ref={inputRef} hidden type="file" accept=".csv,.json,.jsonl,application/json,text/csv" onChange={onFile} />{fileName ? <div className="file-row"><FileJson size={15} /><span>{fileName}</span><button onClick={() => { setFileName(null); setRows(datasetRows); setError(null); }} aria-label="Remove file"><X size={14} /></button></div> : <p className="empty-hint">{t("datasets.noFile")}</p>}{error && <Notice tone="danger" title="Invalid dataset">{error}</Notice>}</Panel>
      <Panel title={t("datasets.validation")}><div className="validation-grid"><div><span className="status-mark success"><Check size={12} /></span><strong className="mono">{rows.length - invalidRows.length}</strong><small>{t("datasets.valid")}</small></div><div><span className="status-mark danger"><X size={12} /></span><strong className="mono">{invalidRows.length}</strong><small>{t("datasets.invalid")}</small></div></div><Button onClick={() => setCreated(true)} disabled={!rows.length || invalidRows.length > 0}><Plus size={14} />{t("datasets.createVersion")}</Button>{created && <p className="success-message"><Check size={15} />{t("datasets.versionCreated")}</p>}</Panel></div>
    <Panel title={`${t("datasets.preview")} · ${rows.length} ${t("common.rows")}`}><div className="table-scroll"><table><thead><tr><TableHeading label="ID" /><TableHeading label={t("datasets.input")} /><TableHeading label={t("datasets.expected")} /><TableHeading label={t("dashboard.category")} /><TableHeading label={t("datasets.difficulty")} /></tr></thead><tbody>{rows.slice(0, 20).map((row, index) => <tr key={row.id || index}><td className="mono">{row.id || `ROW-${index + 1}`}</td><td>{row.input || <span className="negative">{t("common.missing")}</span>}</td><td className="mono">{row.expected || <span className="negative">{t("common.missing")}</span>}</td><td>{row.category || "—"}</td><td>{row.difficulty || "—"}</td></tr>)}</tbody></table></div></Panel>
  </>;
}

function parseDataset(text: string, name: string): DatasetRow[] {
  const trimmed = text.trim();
  if (name.toLowerCase().endsWith(".jsonl")) return trimmed.split(/\r?\n/).filter(Boolean).map((line) => normalizeRow(JSON.parse(line)));
  if (name.toLowerCase().endsWith(".json")) {
    const value = JSON.parse(trimmed);
    if (!Array.isArray(value)) throw new Error("JSON root must be an array.");
    return value.map(normalizeRow);
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsv(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, splitCsv(line)[index] ?? ""]))).map(normalizeRow);
}

function splitCsv(line: string) {
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

function normalizeRow(value: unknown): DatasetRow {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  return { id: String(row.id ?? ""), input: String(row.input ?? row.question ?? ""), expected: String(row.expected ?? row.expected_output ?? ""), category: String(row.category ?? ""), difficulty: String(row.difficulty ?? "") };
}
