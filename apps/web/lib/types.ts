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

export interface RagSearchResult {
  chunk_id: string;
  document_id: string;
  title: string;
  section: string;
  path: string;
  language: string;
  version: string;
  synthetic: boolean;
  excerpt: string;
  dense_score: number;
  lexical_score: number;
  fused_score: number;
  reranker_score: number | null;
}

export interface RagStatus {
  ready: boolean;
  corpus_id: string;
  corpus_version: string;
  synthetic: boolean;
  document_count: number;
  chunk_count: number;
  embedding_model: string;
  requested_embedding_model: string;
  embedding_warning: string | null;
  vector_dimensions: number;
  indexed_at: string;
  fingerprint: string;
  reranker_enabled: boolean;
  reranker_model: string;
  documents: KnowledgeDocument[];
}

export interface KnowledgeDocument {
  document_id: string;
  title: string;
  version: string;
  effective_date: string;
  language: string;
  audience: string;
  status: string;
  synthetic: boolean;
  path: string;
  chunk_count: number;
}

export interface RagRunResult {
  answer: string;
  question: string;
  query_language: string;
  mode: ExecutionMode;
  provider: string;
  model: string;
  fixture: boolean;
  corpus: { id: string; version: string; synthetic: boolean };
  retrieval: {
    embedding_model: string;
    vector_dimensions: number;
    top_k: number;
    score_threshold: number;
    generation_skipped: boolean;
    dense_weight: number;
    lexical_weight: number;
    reranker_enabled: boolean;
  };
  results: RagSearchResult[];
  sources: Array<RagSearchResult & { score: number }>;
  context: string;
  final_prompt: string;
  usage: { input_tokens: number; output_tokens: number; cached_tokens: number; cost_usd: number | null };
  timings_ms: Record<string, number>;
  latency_ms: number;
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
