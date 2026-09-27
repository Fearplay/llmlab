"use client";

import { useState, type ChangeEvent } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel } from "@/components/ui";
import { errorMessage, fetchJson } from "./live-api";
import styles from "./provider-settings.module.css";

const keys = ["llmlab.locale", "llmlab.mode", "llmlab.reduceMotion", "llmlab.theme",
  "llmlab.projectName", "llmlab.selectedModel", "llmlab.recentModels",
  "llmlab.promptVersions", "llmlab.learningProgress.v1", "llmlab.promptLibrary.v1",
  "llmlab.savedViews.v1", "llmlab.glossaryNotes.v1", "llmlab.plainLanguage.v1",
  "llmlab.flappyChallenges.v1"];

type Preview = { created_at: string; counts: Record<string, number>; browser_items: number; checkpoint: boolean };

function browserData(): Record<string, string> {
  return Object.fromEntries(keys.flatMap((key) => {
    const value = localStorage.getItem(key);
    return value === null ? [] : [[key, value]];
  }));
}

function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function exportFile(): Promise<Blob> {
  const response = await fetch("/api/v1/backups/export", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ browser: browserData() }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response.blob();
}

export function BackupControls() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected); setPreview(null); setError("");
    if (!selected) return;
    const form = new FormData(); form.append("file", selected);
    try { setPreview(await fetchJson<Preview>("/api/v1/backups/inspect", { method: "POST", body: form })); }
    catch (cause) { setError(errorMessage(cause, locale)); }
  };

  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      download(await exportFile(), `llmlab-backup-${new Date().toISOString().slice(0, 10)}.zip`);
      setMessage(cs ? "Záloha se stahuje." : "Backup download started.");
    } catch (cause) { setError(errorMessage(cause, locale)); }
    finally { setBusy(false); }
  };

  const restore = async () => {
    if (!file || !preview) return;
    setBusy(true); setError(""); setMessage("");
    try {
      download(await exportFile(), `llmlab-before-restore-${new Date().toISOString().slice(0, 10)}.zip`);
      const form = new FormData(); form.append("file", file);
      const result = await fetchJson<{ restored: boolean; browser: Record<string, string> }>(
        "/api/v1/backups/restore", { method: "POST", body: form });
      if (!result.restored) throw new Error("Restore did not complete");
      for (const key of keys) localStorage.removeItem(key);
      for (const [key, value] of Object.entries(result.browser)) {
        if (keys.includes(key)) localStorage.setItem(key, value);
      }
      window.location.reload();
    } catch (cause) { setError(errorMessage(cause, locale)); setBusy(false); }
  };

  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>{cs ? "Záloha celé laboratoře" : "Back up the entire lab"}</h2><p>{cs ? "Přenese historii, datasety, dokumenty, uložené prompty, postup učením a Flappy checkpoint. API klíče a stažené modely zůstávají mimo." : "Transfer runs, datasets, documents, saved prompts, learning progress and the Flappy checkpoint. API keys and downloaded models are excluded."}</p></div></div>
    <div className={styles.settingBody}>
      <button className={styles.primaryButton} onClick={() => void save()} disabled={busy}>{cs ? "Stáhnout úplnou zálohu" : "Download full backup"}</button>
      <label className={styles.field}><HelpLabel label={cs ? "Vybrat zálohu ZIP pro obnovu" : "Choose ZIP backup to restore"} helpKey="settings.backupImport" /><input type="file" accept=".zip,application/zip" onChange={(event) => void choose(event)} disabled={busy} /></label>
      {preview && <div><p>{cs ? "Obsah zálohy" : "Backup contents"}: {Object.entries(preview.counts).filter(([, count]) => count > 0).map(([name, count]) => `${name}: ${count}`).join(" · ") || (cs ? "prázdná databáze" : "empty database")}</p><p>{cs ? "Položky prohlížeče" : "Browser items"}: {preview.browser_items} · Flappy checkpoint: {preview.checkpoint ? (cs ? "ano" : "yes") : (cs ? "ne" : "no")}</p><p className={styles.helpText}>{cs ? "Obnova nahradí současná data. Nejprve se automaticky stáhne jejich záloha." : "Restore replaces current data. A backup of the current state downloads first."}</p><button className={styles.primaryButton} onClick={() => void restore()} disabled={busy}>{cs ? "Zálohovat a obnovit" : "Back up and restore"}</button></div>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  </section>;
}
