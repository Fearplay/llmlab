"use client";

import { Check, Database, FolderPen, KeyRound, Languages, MonitorCog, SunMoon } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, ModeSelector, PageHeader, Panel } from "@/components/ui";

export function SettingsPage() {
  const { t, locale, setLocale, mode, setMode, reduceMotion, setReduceMotion, theme, setTheme, projectName, setProjectName } = useApp();
  const [projectDraft, setProjectDraft] = useState("");
  const [projectSaved, setProjectSaved] = useState(false);
  const visibleProjectName = projectDraft || projectName || t("app.project");
  const saveProject = () => {
    setProjectName(visibleProjectName);
    setProjectDraft("");
    setProjectSaved(true);
  };
  return <>
    <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
    <div className="settings-layout">
      <Panel title={t("settings.projectIdentity")} className="settings-project-panel"><div className="setting-row project-setting"><FolderPen size={19} /><div><strong>{t("settings.projectName")}</strong><p>{t("settings.projectNameText")}</p></div><div className="project-name-control"><input aria-label={t("settings.projectName")} value={visibleProjectName} onChange={(event) => { setProjectDraft(event.target.value); setProjectSaved(false); }} onKeyDown={(event) => { if (event.key === "Enter" && visibleProjectName.trim()) saveProject(); }} /><Button onClick={saveProject} disabled={!visibleProjectName.trim()}>{t("app.save")}</Button>{projectSaved && <span className="status-text success"><Check size={12} />{t("settings.projectSaved")}</span>}</div></div></Panel>
      <Panel title={t("settings.language")}><div className="setting-row"><Languages size={19} /><div><strong>{t("settings.interfaceLanguage")}</strong><p>{t("settings.browserDefault")}</p></div><div className="segmented"><button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>English</button><button className={locale === "cs" ? "active" : ""} onClick={() => setLocale("cs")}>Čeština</button></div></div></Panel>
      <Panel title={t("settings.defaultMode")}><div className="setting-row"><MonitorCog size={19} /><div><strong>{t("settings.executionSource")}</strong><p>{t("settings.provenanceAlways")}</p></div><ModeSelector value={mode} onChange={setMode} /></div></Panel>
      <Panel title={t("settings.appearance")} helpKey="settings.theme"><div className="setting-row"><SunMoon size={19} /><div><strong>{t("settings.colorTheme")}</strong><p>{t("settings.themeText")}</p></div><div className="segmented" aria-label={t("settings.colorTheme")}>{(["system", "light", "dark"] as const).map((item) => <button key={item} className={theme === item ? "active" : ""} onClick={() => setTheme(item)} aria-pressed={theme === item}>{t(`settings.${item}`)}</button>)}</div></div><label className="setting-row setting-divider"><MonitorCog size={19} /><div><strong>{t("settings.reduceMotion")}</strong><p>{t("settings.motionText")}</p></div><input className="switch" type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /></label></Panel>
      <Panel title={t("settings.data")} className="settings-data-panel"><div className="privacy-block"><KeyRound size={19} /><div><strong>{t("settings.serverSecrets")}</strong><p>{t("settings.dataText")}</p><code>OPENAI_API_KEY · ANTHROPIC_API_KEY · GEMINI_API_KEY</code></div></div><div className="privacy-block"><Database size={19} /><div><strong>{t("settings.persistence")}</strong><p>{t("settings.persistenceText")}</p><span className="status-text success"><Check size={13} />{t("settings.noTelemetry")}</span></div></div></Panel>
      <Panel title={t("settings.apiContract")}><div className="api-contract"><code>REST /api/v1</code><code>SSE /api/v1/runs/:id/events</code><code>CLI schema_version: 1</code><span className="mode-badge mode-fixture">{t("settings.fixtureReady")}</span></div></Panel>
    </div>
  </>;
}
