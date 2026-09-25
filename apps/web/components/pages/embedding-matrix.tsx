"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { teachingVector } from "@/lib/retrieval-demo";
import styles from "./embedding-matrix.module.css";

function similarity(a: number[], b: number[]) {
  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  return denominator ? dot / denominator : 0;
}
function demoVector(text: string) {
  const result = [...teachingVector(text), ...Array.from({ length: 21 }, () => 0)];
  const normalized = text.toLocaleLowerCase();
  for (let index = 0; index < normalized.length - 1; index++) {
    const slot = (normalized.charCodeAt(index) * 31 + normalized.charCodeAt(index + 1)) % 21;
    result[slot + 3] += 1;
  }
  return result;
}
function project(vectors: number[][]) {
  const n = vectors.length;
  if (!n) return [];
  const dim = vectors[0].length;
  const means = Array.from({ length: dim }, (_, d) => vectors.reduce((sum, row) => sum + row[d], 0) / n);
  const centered = vectors.map((row) => row.map((value, d) => value - means[d]));
  const gram = centered.map((a) => centered.map((b) => a.reduce((sum, value, d) => sum + value * b[d], 0)));
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  for (let axis = 0; axis < 2; axis++) {
    let vector: number[] = Array.from({ length: n }, (_, i) => i === axis ? 1 : .01);
    for (let iteration = 0; iteration < 60; iteration++) {
      const next = gram.map((row) => row.reduce((sum, value, j) => sum + value * vector[j], 0));
      for (const previous of eigenvectors) { const projection = next.reduce((sum, value, j) => sum + value * previous[j], 0); next.forEach((_, j) => { next[j] -= projection * previous[j]; }); }
      const norm = Math.hypot(...next);
      if (norm < 1e-9) break;
      vector = next.map((value) => value / norm);
    }
    eigenvectors.push(vector);
    eigenvalues.push(Math.max(0, vector.reduce((sum, value, i) => sum + value * gram[i].reduce((inner, term, j) => inner + term * vector[j], 0), 0)));
  }
  return vectors.map((_, index) => [eigenvectors[0][index] * Math.sqrt(eigenvalues[0]), eigenvectors[1][index] * Math.sqrt(eigenvalues[1])]);
}
interface Result { name: string; vectors: number[][]; fixture: boolean }
export function EmbeddingMatrix() {
  const { locale, models } = useApp();
  const cs = locale === "cs";
  const [text, setText] = useState(cs ? "Vrácení zboží do 30 dnů\nKdy mohu vrátit nákup?\nExpresní zásilka dorazí zítra" : "Return goods within 30 days\nWhen can I return my order?\nExpress shipping arrives tomorrow");
  const [modelKeys, setModelKeys] = useState<string[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputs = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const available = models.filter((model) => model.available && (Array.isArray(model.capabilities) ? model.capabilities.includes("embeddings") : model.capabilities.embeddings));
  const run = async () => {
    if (inputs.length < 2) return;
    setBusy(true); setError("");
    try {
      if (!modelKeys.length) { setResults([{ name: cs ? "Ukázkové vektory" : "Example vectors", vectors: inputs.map(demoVector), fixture: true }]); return; }
      const values = await Promise.all(modelKeys.map(async (key) => {
        const model = available.find((item) => item.key === key)!;
        const response = await fetch("/api/v1/embeddings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: model.mode, provider: model.provider, model: model.id, inputs }) });
        const data = await response.json() as { vectors?: number[][]; detail?: string };
        if (!response.ok || !data.vectors) throw new Error(data.detail ?? `HTTP ${response.status}`);
        return { name: model.key, vectors: data.vectors, fixture: false };
      }));
      setResults(values);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  };
  return <section className={styles.section}><header><h2>{cs ? "Více vět ve vektorovém prostoru" : "Several sentences in vector space"}</h2><p>{cs ? "Každý model vytváří svůj vlastní prostor. Porovnej matici a dvourozměrnou projekci uvnitř každého modelu." : "Each model creates its own space. Compare the matrix and 2D projection within each model."}</p></header><div className={styles.controls}><label>{cs ? "Jedna věta na řádek (2–8)" : "One sentence per line (2–8)"}<textarea rows={5} value={text} onChange={(event) => setText(event.target.value)} /></label><div className={styles.models}><strong>{cs ? "Modely, nejvýše dva; bez výběru běží ukázka" : "Models, at most two; no selection runs the example"}</strong>{available.map((model) => <label key={model.key}><input type="checkbox" checked={modelKeys.includes(model.key)} onChange={() => setModelKeys((current) => current.includes(model.key) ? current.filter((item) => item !== model.key) : current.length < 2 ? [...current, model.key] : current)} />{model.key}</label>)}</div><button type="button" disabled={busy || inputs.length < 2} onClick={() => void run()}>{busy ? cs ? "Počítám…" : "Calculating…" : cs ? "Porovnat texty" : "Compare texts"}</button></div>{error && <p role="alert" className={styles.error}>{error}</p>}{results.map((result) => { const points = project(result.vectors); const max = Math.max(1, ...points.flat().map(Math.abs)); return <div key={result.name} className={styles.result}><h3>{result.name} {result.fixture && <small>{cs ? "reprodukovatelné ukázkové vektory" : "reproducible example vectors"}</small>}</h3><div className={styles.views}><div className={styles.matrix} role="table" aria-label={cs ? "Matice podobnosti" : "Similarity matrix"}>{inputs.map((left, i) => <div role="row" key={i}><strong role="rowheader" title={left}>{i + 1}. {left}</strong>{inputs.map((_, j) => <span role="cell" key={j} style={{ background: `color-mix(in srgb, var(--blue) ${Math.round(Math.max(0, similarity(result.vectors[i], result.vectors[j])) * 42)}%, var(--paper))` }}>{similarity(result.vectors[i], result.vectors[j]).toFixed(2)}</span>)}</div>)}</div><div className={styles.plot} aria-label={cs ? "Dvourozměrná PCA projekce" : "Two-dimensional PCA projection"}>{points.map(([x, y], i) => <span key={i} title={inputs[i]} style={{ left: `${50 + x / max * 42}%`, top: `${50 - y / max * 42}%` }}>{i + 1}</span>)}</div></div><p>{cs ? "Projekce PCA zplošťuje mnohorozměrná data a může zkreslit vzdálenosti. Čísla označují řádky vlevo." : "PCA flattens high-dimensional data and may distort distances. Numbers refer to the rows on the left."}</p></div>; })}</section>;
}
