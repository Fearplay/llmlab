export type AgentRun = {
  id: string;
  kind: "agent" | "safety";
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "cancel_requested";
  model_key: string;
  spec: Record<string, unknown>;
  results: Record<string, unknown>[];
  trace: Record<string, unknown>[];
  metrics: Record<string, unknown>;
  usage: { input_tokens?: number; output_tokens?: number; cost_usd?: number | null };
  progress: number;
  error: string | null;
  created_at: string;
};

export async function agentApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/agent${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    throw new Error(typeof detail === "string" ? detail : `HTTP ${response.status}`);
  }
  return body as T;
}
