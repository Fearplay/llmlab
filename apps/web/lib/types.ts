export type Locale = "en" | "cs";
export type ExecutionMode = "fixture" | "local" | "cloud";
export type ThemePreference = "system" | "light" | "dark";
export type RunStatus =
  | "queued"
  | "running"
  | "cancel_requested"
  | "cancelled"
  | "completed"
  | "failed";

export interface ProviderCapabilities {
  generation: boolean;
  embeddings: boolean;
  structured_output: boolean;
  streaming: boolean;
  tool_calling: boolean;
  token_usage: boolean;
}

export interface ProviderRecord {
  id: string;
  name: string;
  mode: Exclude<ExecutionMode, "fixture">;
  configured: boolean;
  reachable: boolean | null;
  detail: string;
  capabilities: ProviderCapabilities;
}

export interface Metric {
  key: string;
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "negative" | "neutral";
  description: string;
}

export interface RunRecord {
  id: string;
  date: string;
  model: string;
  prompt: string;
  quality: number;
  passRate: number;
  cost: number | null;
  latency: number;
  status: RunStatus;
  mode: ExecutionMode;
}

export interface RegressionRecord {
  id: string;
  title: string;
  run: string;
  delta: number;
  category: string;
  severity: "high" | "medium" | "low";
  status: "open" | "reviewed";
}

export interface RagChunk {
  id: number;
  title: string;
  source: string;
  chunk: number;
  score: number;
  text: string;
  relevant: boolean;
}

export interface CompareMetric {
  label: string;
  baseline: string;
  candidate: string;
  delta: string;
  threshold: string;
  result: "pass" | "fail" | "neutral";
}

export interface CompareCase {
  id: string;
  slice: string;
  baseline: number;
  candidate: number;
  delta: number;
  finding: string;
  expected: string;
  prompt: string;
  baselineOutput: string;
  candidateOutput: string;
  evidence: string;
  source: string;
}

export interface TraceItem {
  id: string;
  type: "message" | "retrieval" | "model" | "tool_call" | "tool_result" | "evaluation";
  title: string;
  detail: string;
  duration: string;
  status: "complete" | "warning";
}
