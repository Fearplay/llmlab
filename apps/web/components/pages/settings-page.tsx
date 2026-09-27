"use client";

import { KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { HelpLabel, ModeSelector, PageHeader } from "@/components/ui";
import { errorMessage, fetchJson } from "./live-api";
import styles from "./provider-settings.module.css";
import { BackupControls } from "./backup-controls";
import { PreflightControls } from "./preflight-controls";

const cloudProviders = [
  { id: "openai", name: "OpenAI", env: "OPENAI_API_KEY" },
  { id: "anthropic", name: "Anthropic", env: "ANTHROPIC_API_KEY" },
  { id: "gemini", name: "Gemini", env: "GEMINI_API_KEY" },
  { id: "openai_compatible", name: "OpenAI-compatible", env: "OPENAI_COMPATIBLE_API_KEY" },
] as const;
interface SecretStatus { keyring_available: boolean; providers: Record<string, { configured: boolean; source: "keyring" | "env" | "missing" }> }

export function SettingsPage() {
  const { locale, setLocale, mode, setMode, reduceMotion, setReduceMotion, theme, setTheme, projectName, setProjectName, refreshModels, plainLanguage, setPlainLanguage } = useApp();
  const cs = locale === "cs";
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [secrets, setSecrets] = useState<SecretStatus | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(true);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [secretMessage, setSecretMessage] = useState<string | null>(null);

  const refreshSecrets = useCallback(async () => {
    setSecretLoading(true);
    try {
      setSecrets(await fetchJson<SecretStatus>("/api/v1/settings/providers"));
      setSecretError(null);
    } catch (caught) {
      setSecretError(errorMessage(caught, locale));
    } finally { setSecretLoading(false); }
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void refreshSecrets()); }, [refreshSecrets]);

  const saveSecret = async (provider: string) => {
    const value = drafts[provider]?.trim();
    if (!value) return;
    setBusyProvider(provider); setSecretError(null); setSecretMessage(null);
    try {
      await fetchJson(`/api/v1/settings/providers/${provider}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
      setDrafts((current) => ({ ...current, [provider]: "" }));
      setSecretMessage(cs ? `Klíč pro ${provider} je uložen v systémovém úložišti.` : `The ${provider} key is saved in the system credential store.`);
      await refreshSecrets();
      void refreshModels(true);
    } catch (caught) { setSecretError(errorMessage(caught, locale)); }
    finally { setBusyProvider(null); }
  };
  const removeSecret = async (provider: string) => {
    setBusyProvider(provider); setSecretError(null); setSecretMessage(null);
    try {
      await fetchJson(`/api/v1/settings/providers/${provider}`, { method: "DELETE" });
      setSecretMessage(cs ? `Uložený klíč pro ${provider} byl odstraněn.` : `The saved ${provider} key was removed.`);
      await refreshSecrets();
      void refreshModels(true);
    } catch (caught) { setSecretError(errorMessage(caught, locale)); }
    finally { setBusyProvider(null); }
  };

  const nameValue = nameDraft ?? projectName ?? (cs ? "Moje laboratoř" : "My laboratory");
  return <div className={styles.layout}>
    <PageHeader title={cs ? "Nastavení" : "Settings"} description={cs ? "Připoj modely a uprav rozhraní. Klíče zůstávají na tomto počítači v API službě." : "Connect models and adjust the interface. Keys stay with the API service on this computer."} />
    <section id="api-keys" className={styles.panel}><div className={styles.panelHeading}><KeyRound size={20} /><div><h2>{cs ? "Cloudové API klíče" : "Cloud API keys"}</h2><p>{cs ? "Klíč se do prohlížeče nikdy nevrací. Zobrazujeme pouze to, zda je služba nastavená." : "A saved key is never returned to the browser. We show only whether the service is configured."}</p></div><button className={styles.iconButton} onClick={() => void refreshSecrets()} aria-label={cs ? "Obnovit stav klíčů" : "Refresh key status"}><RefreshCw size={16} /></button></div>
      {secretLoading && <p className={styles.message} role="status">{cs ? "Načítám stav klíčů…" : "Loading key status…"}</p>}
      {secretError && <p className={styles.error} role="alert">{secretError}</p>}
      {secretMessage && <p className={styles.success} role="status">{secretMessage}</p>}
      {secrets && <div className={styles.secretList}>{cloudProviders.map((provider) => {
        const status = secrets.providers[provider.id];
        const source = status?.source ?? "missing";
        return <div className={styles.secretRow} key={provider.id}><div className={styles.secretName}><strong>{provider.name}</strong><span className={styles.status} data-state={status?.configured ? "connected" : "unconfigured"}>{status?.configured ? cs ? "Nastaveno" : "Configured" : cs ? "Nenastaveno" : "Not configured"}</span><small>{source === "keyring" ? cs ? "Systémové úložiště klíčů" : "System credential store" : source === "env" ? cs ? "Proměnná prostředí / .env" : "Environment / .env" : cs ? "Klíč chybí" : "No key"}</small></div>
          {secrets.keyring_available ? <div className={styles.secretControls}><label className={styles.secretInput}><HelpLabel label={cs ? "Nový klíč" : "New key"} helpKey="field.apiKey" /><input type="password" autoComplete="off" value={drafts[provider.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))} placeholder={cs ? "Vlož API klíč" : "Paste API key"} /></label><button className={styles.primaryButton} disabled={!drafts[provider.id]?.trim() || busyProvider !== null} onClick={() => void saveSecret(provider.id)}>{busyProvider === provider.id ? cs ? "Ukládám…" : "Saving…" : cs ? "Uložit" : "Save"}</button>{source === "keyring" && <button className={styles.secondaryButton} disabled={busyProvider !== null} onClick={() => void removeSecret(provider.id)}>{cs ? "Odebrat" : "Remove"}</button>}</div> : <p className={styles.helpText}>{cs ? `Systémové úložiště klíčů není dostupné. Nastav ${provider.env} v souboru .env a restartuj API.` : `The system credential store is unavailable. Set ${provider.env} in .env and restart the API.`}</p>}
        </div>;
      })}</div>}
      <p className={styles.helpText}>{cs ? "Připojení OpenAI-compatible potřebuje také OPENAI_COMPATIBLE_BASE_URL v .env. Po změně klíče obnov nabídku modelů nahoře; aplikace to po uložení udělá sama." : "OpenAI-compatible also needs OPENAI_COMPATIBLE_BASE_URL in .env. The model catalog refreshes after you save a key."}</p>
    </section>
    <div className={styles.settingsGrid}>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{cs ? "Název laboratoře" : "Laboratory name"}</h2><p>{cs ? "Zobrazuje se v přehledu a nastavení tohoto prohlížeče." : "Shown in the overview and settings on this browser."}</p></div></div><div className={styles.settingBody}><label className={styles.field}><HelpLabel label={cs ? "Název projektu" : "Project name"} helpKey="field.projectName" /><input value={nameValue} onChange={(event) => { setNameDraft(event.target.value); setNameSaved(false); }} /></label><button className={styles.primaryButton} disabled={!nameValue.trim()} onClick={() => { setProjectName(nameValue); setNameDraft(null); setNameSaved(true); }}>{cs ? "Uložit název" : "Save name"}</button>{nameSaved && <span className={styles.success}>{cs ? "Název uložen" : "Name saved"}</span>}</div></section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{cs ? "Jazyk a vzhled" : "Language and appearance"}</h2><p>{cs ? "Tato nastavení platí jen v tomto prohlížeči." : "These preferences apply only in this browser."}</p></div></div><div className={styles.settingBody}><div className={styles.settingLine}><HelpLabel label={cs ? "Jazyk" : "Language"} helpKey="field.language" /><div className={styles.segmented}><button aria-pressed={locale === "cs"} onClick={() => setLocale("cs")}>Čeština</button><button aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button></div></div><div className={styles.settingLine}><HelpLabel label={cs ? "Barevné téma" : "Color theme"} helpKey="settings.theme" /><div className={styles.segmented}>{(["system", "light", "dark"] as const).map((item) => <button key={item} aria-pressed={theme === item} onClick={() => setTheme(item)}>{item === "system" ? cs ? "Systém" : "System" : item === "light" ? cs ? "Světlé" : "Light" : cs ? "Tmavé" : "Dark"}</button>)}</div></div><label className={styles.settingLine}><HelpLabel label={cs ? "Omezit animace" : "Reduce motion"} helpKey="field.reduceMotion" /><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /></label><label className={styles.settingLine}><HelpLabel label={cs ? "V porovnání používat běžné názvy" : "Use plain labels in comparisons"} helpKey="settings.plainLanguage" /><input type="checkbox" checked={plainLanguage} onChange={(event) => setPlainLanguage(event.target.checked)} /></label></div></section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{cs ? "Výchozí režim" : "Default mode"}</h2><p>{cs ? "Lokálně používá Ollamu; cloud vyžaduje připojeného poskytovatele. Ukázku vyber jen pro cvičení." : "Local uses Ollama; cloud needs a connected provider. Choose Demo only for practice."}</p></div></div><div className={styles.settingBody}><ModeSelector value={mode} onChange={setMode} /></div></section>
      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>{cs ? "Data" : "Data"}</h2><p>{cs ? "Běhy a dokumenty se ukládají do lokální databáze LLMLab. API klíče nejsou součástí historie." : "Runs and documents are stored in the local LLMLab database. API keys are never part of run history."}</p></div></div><div className={styles.settingBody}><p className={styles.helpText}>{cs ? "Pokud používáš .env, změny klíčů se projeví po restartu API služby. Systémové úložiště klíčů má přednost před .env." : "If you use .env, restart the API after changing keys. The system credential store takes precedence over .env."}</p></div></section>
    </div>
    <BackupControls />
    <PreflightControls />
  </div>;
}
