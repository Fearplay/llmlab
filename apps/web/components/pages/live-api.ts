export interface UsageData { input_tokens?: number; output_tokens?: number; cached_tokens?: number; cost_usd?: number | null }
export interface ExperimentResult {
  case_id?: string;
  model_key: string;
  status: string;
  output?: string | null;
  error?: string | null;
  latency_ms?: number | null;
  usage?: UsageData;
  grade?: { method?: string; score?: number | null; passed?: boolean | null; model_key?: string; reason?: string; prompt?: string | null; error?: string; expected_facts_found?: string[]; forbidden_facts_found?: string[] } | null;
  cost?: { estimated_usd?: number | null; status?: string; price?: unknown } | null;
  judge?: { model_key?: string; prompt?: Array<{ role: string; content: string }>; opinion?: string; usage?: UsageData; latency_ms?: number; cost?: { estimated_usd?: number | null } } | null;
  order_check?: { reversed_output?: string; same_answer?: boolean; latency_ms?: number; usage?: UsageData; cost?: { estimated_usd?: number | null } } | null;
}
export interface ExperimentRecord {
  id: string;
  kind: string;
  name: string;
  status: string;
  mode?: string;
  provider?: string;
  model?: string;
  spec?: Record<string, unknown>;
  results?: ExperimentResult[];
  metrics?: { models?: Array<{ model_key: string; cases: number; completed: number; quality: number | null; average_latency_ms: number | null; scored_cases: number }>; quality_winner?: string | null; quality_available?: boolean };
  trace?: Record<string, unknown>[];
  usage?: UsageData;
  progress?: number;
  error?: string | null;
  created_at?: string;
  completed_at?: string | null;
}
export interface EpisodeRecord {
  id: string; agent: string; model_key?: string | null; mode?: string; seed?: number;
  status: string; score?: number; frames?: number; decision_count?: number;
  input_tokens?: number; output_tokens?: number; cost_usd?: number | null;
  death_reason?: string | null; error?: string | null; created_at?: string; replay?: unknown;
}
export interface OperationsSummary {
  runs: number; game_episodes?: number; priced_calls: number; unknown_calls: number; estimated_usd: number;
  input_tokens: number; output_tokens: number;
  by_model: Array<{ model_key: string; calls: number; input_tokens: number; output_tokens: number; estimated_usd: number; unknown_calls: number }>;
  by_day: Array<{ date: string; runs: number; estimated_usd: number }>;
}
export interface PriceCatalog {
  version: string; currency: string; unit: string;
  prices: Record<string, { input_per_million_usd: number; output_per_million_usd: number; cached_input_per_million_usd: number | null; tier: string; source: string; verified_at: string }>;
  limitations?: string;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data ? (data as { detail: unknown }).detail : null;
    throw new Error(typeof detail === "string" ? detail : `HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  if (data === null) throw new Error("API returned invalid JSON");
  return data as T;
}

export function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(locale === "cs" ? "cs-CZ" : "en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function formatCost(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) return locale === "cs" ? "neznámá" : "unknown";
  if (value === 0) return "$0";
  return `$${value.toFixed(value < 0.01 ? 5 : 3)}`;
}

export function errorMessage(error: unknown, locale: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Failed to fetch") || message.includes("HTTP 502") || message.includes("HTTP 503")) return locale === "cs" ? "LLMLab API není dostupné. Spusť aplikaci přes start.py a zkus to znovu." : "The LLMLab API is unavailable. Start the app with start.py and try again.";
  if (message === "Not Found" || message.includes("HTTP 404: Not Found")) return locale === "cs" ? "Tato funkce na běžícím API chybí. Restartuj LLMLab pomocí start.py, aby web i API používaly stejnou verzi." : "This endpoint is missing from the running API. Restart LLMLab with start.py so the web app and API use the same version.";
  return message;
}
