"use client";

import { Check, GitCompareArrows, Save } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, PageHeader, Panel, ProvenanceStrip, Select } from "@/components/ui";

const currentPrompt = `You are a customer support assistant.\n\nAnswer using only the supplied policy context. Cite the policy section after each factual claim. If the answer cannot be determined, say so explicitly.\n\nQUESTION\n{{question}}\n\nCONTEXT\n{{context}}`;
const baselinePrompt = `You are a customer support assistant.\n\nAnswer the customer question.\n\nQUESTION\n{{question}}\n\nCONTEXT\n{{context}}`;

export function PromptsPage() {
  const { t } = useApp();
  const [text, setText] = useState(currentPrompt);
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState("v18");
  const changeVersion = (next: string) => {
    setVersion(next);
    setText(next === "v17" ? baselinePrompt : currentPrompt);
    setSaved(false);
  };
  return <><PageHeader title={t("prompts.title")} description={t("prompts.subtitle")} actions={<Button onClick={() => setSaved(true)}><Save size={15} />{t("prompts.saveVersion")}</Button>} /><ProvenanceStrip mode="fixture" tail={`prompt-${version} · sha256 4bf5…99c1`} />
    {saved && <div className="success-banner"><Check size={16} />{t("prompts.saved")}</div>}
    <div className="prompt-layout"><Panel title={t("prompts.systemPrompt")} aside={<Select value={version} onChange={changeVersion} ariaLabel={t("prompts.version")}><option value="v18">v18 · {t("common.active")}</option><option value="v17">v17 · {t("common.baseline")}</option></Select>}><textarea className="prompt-editor mono" value={text} onChange={(event) => { setText(event.target.value); setSaved(false); }} spellCheck={false} /><div className="editor-footer"><span>{text.length} {t("common.characters")}</span><span>~{Math.ceil(text.length / 4)} {t("common.estimatedTokens")}</span></div></Panel>
      <div className="prompt-side"><Panel title={t("prompts.variables")}><dl className="definition-list"><div><dt className="mono">{"{{question}}"}</dt><dd>{t("prompts.userInput")}</dd></div><div><dt className="mono">{"{{context}}"}</dt><dd>{t("prompts.retrievedEvidence")}</dd></div></dl></Panel><Panel title={t("prompts.diff")} aside={<GitCompareArrows size={15} />}><pre className="diff mono"><span className="removed">- Answer the customer question.</span>{"\n"}<span className="added">+ Answer using only the supplied policy context.</span>{"\n"}<span className="added">+ Cite the policy section after each factual claim.</span>{"\n"}<span className="added">+ If the answer cannot be determined, say so explicitly.</span></pre></Panel></div>
    </div>
  </>;
}
