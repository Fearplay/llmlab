"use client";

import { Braces, Check, FileText, GitCompareArrows, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, Notice, PageHeader, Panel, Select } from "@/components/ui";

const storageKey = "llmlab.promptVersions";

interface PromptVersion {
  id: string;
  text: string;
}

function meaningfulLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function PromptsPage() {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState("");
  const [customVersions, setCustomVersions] = useState<PromptVersion[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as PromptVersion[];
        if (Array.isArray(parsed)) setCustomVersions(parsed.filter((item) => /^v\d+$/.test(item.id) && typeof item.text === "string"));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    });
  }, []);

  const variables = useMemo(() => Array.from(new Set(Array.from(text.matchAll(/{{\s*([\w.-]+)\s*}}/g), (match) => match[1]))), [text]);
  const diff = useMemo(() => {
    const base = meaningfulLines(customVersions.find((item) => item.id === version)?.text ?? "");
    const active = meaningfulLines(text);
    return {
      removed: base.filter((line) => !active.includes(line)),
      added: active.filter((line) => !base.includes(line)),
    };
  }, [text, version, customVersions]);

  const changeVersion = (next: string) => {
    if (!next) { setVersion(""); setText(""); setSaved(false); return; }
    const selected = customVersions.find((item) => item.id === next);
    if (!selected) return;
    setVersion(next);
    setText(selected.text);
    setSaved(false);
  };

  const saveVersion = () => {
    if (!text.trim()) return;
    const nextNumber = Math.max(0, ...customVersions.map((item) => Number(item.id.slice(1)) || 0)) + 1;
    const nextVersion = { id: `v${nextNumber}`, text };
    const nextVersions = [nextVersion, ...customVersions];
    setCustomVersions(nextVersions);
    setVersion(nextVersion.id);
    window.localStorage.setItem(storageKey, JSON.stringify(nextVersions));
    setSaved(true);
  };

  const variableDescription = (name: string) => name === "question" ? t("prompts.userInput") : name === "context" ? t("prompts.retrievedEvidence") : t("prompts.customVariable");

  return <>
    <PageHeader title={t("prompts.title")} description={t("prompts.subtitle")} actions={<Button onClick={saveVersion} disabled={!text.trim()}><Save size={15} />{t("prompts.saveVersion")}</Button>} />
    <Notice tone="info" title={t("prompts.versioningTitle")}>{`${t("prompts.versioningText")} ${t("prompts.storedLocally")}`}</Notice>
    <div className="prompt-guide" aria-label={t("prompts.title")}>
      <div><FileText size={16} /><span><strong>{t("prompts.guideInstruction")}</strong>{t("prompts.guideInstructionText")}</span></div>
      <div><Braces size={16} /><span><strong>{t("prompts.guideVariables")}</strong>{t("prompts.guideVariablesText")}</span></div>
      <div><GitCompareArrows size={16} /><span><strong>{t("prompts.guideDiff")}</strong>{t("prompts.guideDiffText")}</span></div>
    </div>
    {saved && <div className="success-banner"><Check size={16} />{t("prompts.saved")}</div>}
    <div className="prompt-layout">
      <Panel title={t("prompts.systemPrompt")} aside={<Select value={version} onChange={changeVersion} ariaLabel={t("prompts.version")}>
        <option value="">{t("prompts.newPrompt")}</option>
        {customVersions.map((item) => <option key={item.id} value={item.id}>{item.id} · {t("common.active")}</option>)}
      </Select>}>
        <textarea className="prompt-editor mono" value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} placeholder={t("prompts.placeholder")} spellCheck={false} />
        <div className="editor-footer"><span>{text.length} {t("common.characters")}</span><span>~{Math.ceil(text.length / 4)} {t("common.estimatedTokens")}</span></div>
      </Panel>
      <div className="prompt-side">
        <Panel title={t("prompts.variables")}>
          {variables.length ? <dl className="definition-list">{variables.map((name) => <div key={name}><dt className="mono">{`{{${name}}}`}</dt><dd>{variableDescription(name)}</dd></div>)}</dl> : <p className="muted-block">{t("prompts.noVariables")}</p>}
        </Panel>
        <Panel title={t("prompts.diff")} aside={<GitCompareArrows size={15} />}>
          {diff.removed.length || diff.added.length ? <pre className="diff mono">{diff.removed.map((line) => <span className="removed" key={`-${line}`}>- {line}</span>)}{diff.added.map((line) => <span className="added" key={`+${line}`}>+ {line}</span>)}</pre> : <p className="muted-block">{t("prompts.noChanges")}</p>}
        </Panel>
      </div>
    </div>
  </>;
}
