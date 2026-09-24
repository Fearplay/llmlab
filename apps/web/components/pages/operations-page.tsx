"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/ui";
import { errorMessage, fetchJson, formatCost, type OperationsSummary, type PriceCatalog } from "./live-api";
import styles from "./live-pages.module.css";

interface ProviderStatus { id: string; configured: boolean; reachable: boolean | null }

export function OperationsPage() {
  const { locale } = useApp();
  const cs = locale === "cs";
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [catalog, setCatalog] = useState<PriceCatalog | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [summaryResult, priceResult, providersResult] = await Promise.allSettled([
      fetchJson<OperationsSummary>("/api/v1/operations/summary"),
      fetchJson<PriceCatalog>("/api/v1/prices"),
      fetchJson<ProviderStatus[]>("/api/v1/providers"),
    ]);
    if (summaryResult.status === "fulfilled") { setSummary(summaryResult.value); setSummaryError(null); }
    else setSummaryError(errorMessage(summaryResult.reason, locale));
    if (priceResult.status === "fulfilled") { setCatalog(priceResult.value); setPriceError(null); }
    else setPriceError(errorMessage(priceResult.reason, locale));
    if (providersResult.status === "fulfilled") setProviders(providersResult.value);
    setLoading(false);
  }, [locale]);
  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  const maxDayRuns = Math.max(1, ...(summary?.by_day ?? []).map((item) => item.runs));
  const maxDayCost = Math.max(0.000001, ...(summary?.by_day ?? []).map((item) => item.estimated_usd));
  const maxModelTokens = Math.max(1, ...(summary?.by_model ?? []).map((item) => item.input_tokens + item.output_tokens));
  const prices = Object.entries(catalog?.prices ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const connected = providers.filter((item) => item.configured && item.reachable === true).length;

  return <div className={styles.layout}>
    <PageHeader title={cs ? "Cena a provoz" : "Cost & operations"} description={cs ? "Sleduj počet běhů, nahlášené tokeny a odhad API poplatků podle ověřeného ceníku." : "Track runs, reported tokens, and estimated API fees from a verified price list."} actions={<button className={styles.secondaryButton} onClick={() => void refresh()}>{cs ? "Obnovit" : "Refresh"}</button>} />
    {loading && <div className={styles.empty} role="status">{cs ? "Načítám provozní data…" : "Loading usage data…"}</div>}
    {summaryError && <div className={styles.empty} role="alert">{summaryError}</div>}
    {priceError && <div className={styles.empty} role="alert">{cs ? "Ceník není dostupný: " : "Price list unavailable: "}{priceError}</div>}
    {summary && <>
      <div className={styles.metricGrid}>
        <Metric label={cs ? "Uložené běhy včetně hry" : "Saved runs including game"} value={String(summary.runs)} />
        <Metric label={cs ? "Známý odhad API poplatků" : "Known estimated API fees"} value={summary.runs ? formatCost(summary.estimated_usd, locale) : "—"} />
        <Metric label={cs ? "Vstupní / výstupní tokeny" : "Input / output tokens"} value={`${summary.input_tokens.toLocaleString(locale)} / ${summary.output_tokens.toLocaleString(locale)}`} />
        <Metric label={cs ? "Připojení poskytovatelé" : "Connected providers"} value={providers.length ? `${connected}/${providers.length}` : "—"} />
      </div>
      <p className={styles.intro}>{summary.unknown_calls > 0 ? cs ? `${summary.unknown_calls} volání má neznámou cenu a není zahrnuto do součtu. ` : `${summary.unknown_calls} calls have unknown prices and are excluded from the total. ` : ""}{cs ? "Lokální modely mají nulový poplatek API; výpočet nezahrnuje elektřinu ani hardware. Jde o odhad, nikoliv fakturu." : "Local models have no API fee; electricity and hardware are excluded. This is an estimate, not an invoice."}</p>
      <div className={styles.grid}>
        <section className={styles.panel}><div className={styles.panelHead}><h2>{cs ? "Běhy po dnech" : "Runs by day"}</h2></div><div className={styles.panelBody}>{summary.by_day.length ? <div className={styles.chartList} aria-label={cs ? "Graf běhů po dnech" : "Daily runs chart"}>{summary.by_day.map((item) => <div className={styles.chartRow} key={item.date}><span>{item.date}</span><div className={styles.chartTrack}><span style={{ width: `${Math.max(2, item.runs / maxDayRuns * 100)}%` }} /></div><strong>{item.runs}</strong></div>)}</div> : <div className={styles.empty}>{cs ? "Zatím žádné běhy. Graf se naplní po prvním experimentu." : "No runs yet. The chart will appear after your first experiment."}</div>}</div></section>
        <section className={styles.panel}><div className={styles.panelHead}><h2>{cs ? "Tokeny podle modelu" : "Tokens by model"}</h2></div><div className={styles.panelBody}>{summary.by_model.length ? <div className={styles.chartList} aria-label={cs ? "Graf spotřeby modelů" : "Model usage chart"}>{summary.by_model.map((item) => <div className={styles.chartRow} key={item.model_key}><span title={item.model_key}>{item.model_key}</span><div className={styles.chartTrack}><span style={{ width: `${Math.max(2, (item.input_tokens + item.output_tokens) / maxModelTokens * 100)}%` }} /></div><strong>{(item.input_tokens + item.output_tokens).toLocaleString(locale)}</strong></div>)}</div> : <div className={styles.empty}>{cs ? "Zatím žádná spotřeba tokenů." : "No token usage yet."}</div>}</div></section>
      </div>
      {summary.by_day.length > 0 && <section className={styles.panel}><div className={styles.panelHead}><h2>{cs ? "Známý odhad ceny po dnech" : "Known cost estimate by day"}</h2></div><div className={styles.panelBody}><div className={styles.chartList} aria-label={cs ? "Graf odhadu ceny po dnech" : "Daily cost estimate chart"}>{summary.by_day.map((item) => <div className={styles.chartRow} key={item.date}><span>{item.date}</span><div className={styles.chartTrack}><span style={{ width: `${item.estimated_usd > 0 ? Math.max(2, item.estimated_usd / maxDayCost * 100) : 0}%` }} /></div><strong>{formatCost(item.estimated_usd, locale)}</strong></div>)}</div></div></section>}
      {summary.by_model.length > 0 && <section className={styles.panel}><div className={styles.panelHead}><h2>{cs ? "Spotřeba po modelech" : "Usage by model"}</h2></div><div className={`${styles.panelBody} ${styles.tableScroll}`}><table className={styles.priceTable}><thead><tr><th>{cs ? "Model" : "Model"}</th><th>{cs ? "Volání" : "Calls"}</th><th>{cs ? "Vstup" : "Input"}</th><th>{cs ? "Výstup" : "Output"}</th><th>{cs ? "Známý odhad" : "Known estimate"}</th><th>{cs ? "Neznámá cena" : "Unknown price"}</th></tr></thead><tbody>{summary.by_model.map((item) => <tr key={item.model_key}><td>{item.model_key}</td><td>{item.calls}</td><td>{item.input_tokens.toLocaleString(locale)}</td><td>{item.output_tokens.toLocaleString(locale)}</td><td>{formatCost(item.estimated_usd, locale)}</td><td>{item.unknown_calls}</td></tr>)}</tbody></table></div></section>}
    </>}
    {catalog && <section className={styles.panel}><div className={styles.panelHead}><h2>{cs ? "Ceník API modelů" : "API model prices"}</h2><span className={styles.status}>{catalog.version}</span></div><div className={`${styles.panelBody} ${styles.tableScroll}`}>
      <p className={styles.inlineNote}>{cs ? "Sazby v USD za milion textových tokenů. Model bez ověřené sazby má neznámou cenu." : "USD per million text tokens. A model without a verified rate has an unknown price."}</p>
      {prices.length ? <table className={styles.priceTable}><thead><tr><th>{cs ? "Model" : "Model"}</th><th>{cs ? "Vstup" : "Input"}</th><th>{cs ? "Výstup" : "Output"}</th><th>{cs ? "Cache vstup" : "Cached input"}</th><th>{cs ? "Tarif" : "Tier"}</th><th>{cs ? "Zdroj" : "Source"}</th></tr></thead><tbody>{prices.map(([key, price]) => <tr key={key}><td>{key}</td><td>${price.input_per_million_usd}</td><td>${price.output_per_million_usd}</td><td>{price.cached_input_per_million_usd === null ? "—" : `$${price.cached_input_per_million_usd}`}</td><td>{price.tier}</td><td><a href={price.source} target="_blank" rel="noopener noreferrer">{cs ? "Oficiální ceník" : "Official price list"}</a></td></tr>)}</tbody></table> : <div className={styles.empty}>{cs ? "Žádné ověřené sazby v katalogu." : "No verified rates in the catalog."}</div>}
      {catalog.limitations && <p className={styles.inlineNote}>{catalog.limitations}</p>}
    </div></section>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className={styles.metric}><span>{label}</span><strong>{value}</strong></div>; }
