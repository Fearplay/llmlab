"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel } from "@/components/ui";
import { errorMessage, fetchJson } from "./live-api";
import styles from "./provider-settings.module.css";

type Check = { status: string; detail?: string; model_key?: string | null };
type Preflight = { api: Check; ollama: Check; generation: Check; embedding: Check;
  providers: Array<{ id: string; configured: boolean; reachable: boolean; detail: string }> };

export function PreflightControls() {
  const { locale, models, selectedModel } = useApp();
  const cs = locale === "cs";
  const [embeddingKey, setEmbeddingKey] = useState("");
  const [result, setResult] = useState<Preflight | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const embeddingModels = models.filter((item) => item.available &&
    (Array.isArray(item.capabilities) ? item.capabilities.includes("embeddings") : item.capabilities?.embeddings));
  const check = async () => {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ generation_model_key: selectedModel?.key ?? "",
        embedding_model_key: embeddingKey });
      setResult(await fetchJson<Preflight>(`/api/v1/preflight?${query}`));
    } catch (cause) { setError(errorMessage(cause, locale)); }
    finally { setBusy(false); }
  };
  const label = (status: string) => status === "ready" ? (cs ? "připraveno" : "ready")
    : status === "not_selected" ? (cs ? "nevybráno" : "not selected")
    : status === "wrong_capability" ? (cs ? "model tuto úlohu neumí" : "model lacks this capability")
    : (cs ? "nedostupné" : "unavailable");
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>{cs ? "Kontrola před pokusem" : "Check before a run"}</h2><p>{cs ? "Ověří API, Ollamu a vybrané modely bez generování odpovědi." : "Check the API, Ollama and selected models without generating an answer."}</p></div></div>
    <div className={styles.settingBody}>
      <label className={styles.field}><HelpLabel label={cs ? "Embeddingový model pro RAG (volitelné)" : "Embedding model for RAG (optional)"} helpKey="settings.preflightEmbedding" /><select value={embeddingKey} onChange={(event) => setEmbeddingKey(event.target.value)}><option value="">{cs ? "Bez RAG kontroly" : "No RAG check"}</option>{embeddingModels.map((item) => <option key={item.key} value={item.key}>{item.key}</option>)}</select></label>
      <button className={styles.primaryButton} onClick={() => void check()} disabled={busy}>{busy ? (cs ? "Kontroluji…" : "Checking…") : (cs ? "Zkontrolovat připravenost" : "Check readiness")}</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {result && <div role="status"><p>API: {label(result.api.status)} · Ollama: {label(result.ollama.status)} · {cs ? "Generování" : "Generation"}: {label(result.generation.status)} · Embedding: {label(result.embedding.status)}</p>
        {result.ollama.status !== "ready" && <p className={styles.helpText}>{cs ? "Spusťte Ollamu a ověřte její adresu v nastavení API." : "Start Ollama and check its API address."} {result.ollama.detail}</p>}
        {result.generation.status === "unavailable" && <p className={styles.helpText}>{cs ? "Vyberte dostupný model v horní liště nebo nastavte klíč poskytovatele." : "Choose an available model in the top bar or configure its provider key."}</p>}
        {result.embedding.status === "unavailable" && <p className={styles.helpText}>{cs ? "Nainstalujte vybraný embeddingový model nebo zvolte jiný." : "Install the selected embedding model or choose another."}</p>}
      </div>}
    </div>
  </section>;
}
