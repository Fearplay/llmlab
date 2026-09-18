"use client";

import { Check, Database, KeyRound, Languages, MonitorCog, SunMoon } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ModeSelector, PageHeader, Panel } from "@/components/ui";

export function SettingsPage() {
  const { t, locale, setLocale, mode, setMode, reduceMotion, setReduceMotion, theme, setTheme } = useApp();
  return <>
    <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
    <div className="settings-layout">
      <Panel title={t("settings.language")}><div className="setting-row"><Languages size={19} /><div><strong>{t("settings.interfaceLanguage")}</strong><p>{t("settings.browserDefault")}</p></div><div className="segmented"><button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>English</button><button className={locale === "cs" ? "active" : ""} onClick={() => setLocale("cs")}>Čeština</button></div></div></Panel>
      <Panel title={t("settings.defaultMode")}><div className="setting-row"><MonitorCog size={19} /><div><strong>{t("settings.executionSource")}</strong><p>{t("settings.provenanceAlways")}</p></div><ModeSelector value={mode} onChange={setMode} /></div></Panel>
      <Panel title={t("settings.appearance")} helpKey="settings.theme"><div className="setting-row"><SunMoon size={19} /><div><strong>{t("settings.colorTheme")}</strong><p>{t("settings.themeText")}</p></div><div className="segmented" aria-label={t("settings.colorTheme")}>{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} onClick={() => setTheme(item)} aria-pressed={theme === item}>{t(`settings.${item}`)}</button>)}</div></div><label className="setting-row setting-divider"><MonitorCog size={19} /><div><strong>{t("settings.reduceMotion")}</strong><p>{t("settings.motionText")}</p></div><input className="switch" type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /></label></Panel>
      <Panel title={t("settings.data")}><div className="privacy-block"><KeyRound size={19} /><div><strong>{t("settings.serverSecrets")}</strong><p>{t("settings.dataText")}</p><code>OPENAI_API_KEY · ANTHROPIC_API_KEY · GEMINI_API_KEY</code></div></div><div className="privacy-block"><Database size={19} /><div><strong>{t("settings.persistence")}</strong><p>{t("settings.persistenceText")}</p><span className="status-text success"><Check size={13} />{t("settings.noTelemetry")}</span></div></div></Panel>
      <Panel title={t("settings.apiContract")}><div className="api-contract"><code>REST /api/v1</code><code>SSE /api/v1/runs/:id/events</code><code>CLI schema_version: 1</code><span className="mode-badge mode-fixture">{t("settings.fixtureReady")}</span></div></Panel>
    </div>
  </>;
}
