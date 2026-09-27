"use client";

import { Cloud, HardDrive, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp, type CatalogModel } from "@/components/app-provider";
import { PageHeader } from "@/components/ui";
import { errorMessage, fetchJson } from "./live-api";
import styles from "./provider-settings.module.css";

interface ProviderStatus { id: string; mode: "local" | "cloud"; configured: boolean; reachable: boolean; detail: string }
interface Catalog { providers: ProviderStatus[]; models: CatalogModel[] }
const names: Record<string, string> = { ollama: "Ollama", openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini", openai_compatible: "OpenAI-compatible" };

export function ProvidersPage() {
  const { locale, refreshModels } = useApp();
  const cs = locale === "cs";
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const next = await fetchJson<Catalog>(force ? "/api/v1/models?refresh=true" : "/api/v1/models");
      setCatalog(next);
      setError(null);
      void refreshModels(force);
    } catch (caught) { setError(errorMessage(caught, locale)); }
    finally { setLoading(false); }
  }, [locale, refreshModels]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  return <div className={styles.layout}>
    <PageHeader title={cs ? "Poskytovatelé" : "Providers"} description={cs ? "Tady uvidíš, které služby opravdu odpovídají a jaké modely jsou právě dostupné." : "See which services respond and which models are actually available right now."} actions={<button type="button" className={styles.secondaryButton} onClick={() => void refresh(true)} disabled={loading}><RefreshCw size={15} />{cs ? "Znovu ověřit" : "Check again"}</button>} />
    {loading && <div className={styles.info} role="status">{cs ? "Ověřuji připojení a načítám modely…" : "Checking connections and loading models…"}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {!loading && catalog && <div className={styles.providerGrid}>{catalog.providers.filter((item) => item.id !== "fixture").map((provider) => {
      const providerModels = catalog.models.filter((model) => model.provider === provider.id && model.available);
      const generation = providerModels.filter((model) => Array.isArray(model.capabilities) ? model.capabilities.includes("generation") : model.capabilities?.generation);
      const embeddings = providerModels.filter((model) => Array.isArray(model.capabilities) ? model.capabilities.includes("embeddings") : model.capabilities?.embeddings);
      const status = provider.reachable ? "connected" : provider.configured ? "unreachable" : "unconfigured";
      return <section className={styles.providerCard} key={provider.id}>
        <div className={styles.providerHeading}><span className={styles.providerIcon}>{provider.mode === "local" ? <HardDrive size={22} /> : <Cloud size={22} />}</span><div><h2>{names[provider.id] ?? provider.id}</h2><small>{provider.mode === "local" ? cs ? "Na tvém počítači" : "On this computer" : cs ? "Cloudové API" : "Cloud API"}</small></div><span className={styles.status} data-state={status}>{status === "connected" ? cs ? "Připojeno" : "Connected" : status === "unconfigured" ? cs ? "Nenastaveno" : "Not configured" : cs ? "Nedostupné" : "Unavailable"}</span></div>
        <div className={styles.providerMetrics}><div><strong>{generation.length}</strong><span>{cs ? "modelů pro odpovědi" : "answer models"}</span></div><div><strong>{embeddings.length}</strong><span>{cs ? "embedding modelů" : "embedding models"}</span></div></div>
        {providerModels.length > 0 ? <div className={styles.modelChips}>{providerModels.slice(0, 8).map((model) => <span key={model.key}>{model.id}</span>)}{providerModels.length > 8 && <span>+{providerModels.length - 8}</span>}</div> : <p className={styles.providerHint}>{provider.id === "ollama" ? cs ? "Spusť Ollamu a nainstaluj generativní model. Potom klikni na Znovu ověřit." : "Start Ollama and install a generation model, then check again." : status === "unconfigured" ? cs ? "Přidej API klíč v nastavení. Po uložení se modely objeví zde i v horní nabídce." : "Add an API key in Settings. Models will then appear here and in the top bar." : cs ? "Služba teď nevrací modely. Zkontroluj klíč, síť a detail níže." : "The service is not returning models. Check the key, network, and detail below."}</p>}
        {status === "unreachable" && <p className={styles.detail}>{provider.detail}</p>}
        {provider.mode === "cloud" && <Link href="/settings#api-keys" className={styles.textLink}>{cs ? "Nastavit připojení" : "Configure connection"}</Link>}
      </section>;
    })}</div>}
    {!loading && catalog?.providers.length === 0 && <div className={styles.info}>{cs ? "API zatím nehlásí žádného poskytovatele." : "The API reports no providers yet."}</div>}
    <p className={styles.footnote}>{cs ? "Seznam vzniká z odpovědí poskytovatelů. Model, který není dostupný, není možné z této stránky spustit." : "This list comes from provider responses. An unavailable model cannot be started from this page."}</p>
  </div>;
}
