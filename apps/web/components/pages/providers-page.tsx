"use client";

import { Check, Cloud, HardDrive, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Button, InfoTip, MetricLabel, PageHeader, Panel } from "@/components/ui";
import { providers as fixtureProviders } from "@/lib/fixtures";
import type { ProviderRecord } from "@/lib/types";

export function ProvidersPage() {
  const { t } = useApp();
  const { data = fixtureProviders } = useQuery({ queryKey: ["providers"], queryFn: async () => { const response = await fetch("/api/v1/providers"); if (!response.ok) throw new Error("Provider API unavailable"); return response.json() as Promise<ProviderRecord[]>; } });
  const [checking, setChecking] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const check = (id: string) => { setChecking(id); window.setTimeout(() => { setChecking(null); setChecks((current) => ({ ...current, [id]: id === "fixture" })); }, 650); };
  return <><PageHeader title={t("providers.title")} description={t("providers.subtitle")} /><p className="privacy-note"><Cloud size={15} />{t("providers.envHint")}</p><div className="provider-grid">{data.map((provider) => <Panel key={provider.id} className="provider-card"><header className="provider-heading"><span className={`provider-icon ${provider.mode}`} >{provider.mode === "local" ? <HardDrive size={19} /> : <Cloud size={19} />}</span><div><div className="panel-title-row"><h2>{provider.name}</h2><InfoTip label={provider.name} context="section" /></div><span>{provider.detail}</span></div><span className={`mode-badge mode-${provider.mode}`}>{t(`app.${provider.mode}`)}</span></header><div className="capabilities"><Capability label={t("providers.generation")} value={provider.capabilities.generation} /><Capability label={t("providers.embeddings")} value={provider.capabilities.embeddings} /><Capability label={t("providers.structured")} value={provider.capabilities.structured_output} /><Capability label={t("providers.streaming")} value={provider.capabilities.streaming} /><Capability label={t("providers.tools")} value={provider.capabilities.tool_calling} /><Capability label={t("providers.usage")} value={provider.capabilities.token_usage} /></div><footer><span className={provider.configured ? "status-text success" : "status-text muted"}>{provider.configured ? <Check size={12} /> : <X size={12} />}{provider.configured ? t("app.configured") : t("app.notConfigured")}</span><Button variant="secondary" onClick={() => check(provider.id)} loading={checking === provider.id}>{checking === provider.id ? t("providers.checking") : checks[provider.id] ? t("providers.connected") : t("providers.test")}</Button></footer></Panel>)}</div></>;
}

function Capability({ label, value }: { label: string; value: boolean }) {
  return <div><MetricLabel label={label} />{value ? <Check className="positive" size={14} /> : <X className="muted" size={14} />}</div>;
}
