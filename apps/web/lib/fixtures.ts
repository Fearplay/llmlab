import type {
  CompareCase,
  CompareMetric,
  ProviderRecord,
  RagChunk,
  RegressionRecord,
  RunRecord,
  TraceItem,
} from "./types";

export const qualityTrend = [
  76.2, 77.1, 78.4, 81.3, 82.1, 83.8, 82.5, 84.6, 85.2, 86.7, 87.3, 88.9,
  89.2, 89.8, 90.1, 89.7, 91.2, 90.8, 91.4,
];

export const recentRuns: RunRecord[] = [
  { id: "run_0191", date: "Sep 12, 14:32", model: "model-medium", prompt: "v18", quality: 91.4, passRate: 89.8, cost: 0.0041, latency: 1.28, status: "completed", mode: "fixture" },
  { id: "run_0184", date: "Sep 10, 10:15", model: "model-medium", prompt: "v17", quality: 88.1, passRate: 86.2, cost: 0.0043, latency: 1.31, status: "completed", mode: "fixture" },
  { id: "run_0178", date: "Sep 08, 09:10", model: "model-small", prompt: "v18", quality: 84.7, passRate: 82.9, cost: 0.0021, latency: 0.86, status: "completed", mode: "fixture" },
  { id: "run_0166", date: "Sep 05, 16:05", model: "model-medium", prompt: "v16", quality: 87.3, passRate: 85.1, cost: 0.004, latency: 1.24, status: "completed", mode: "fixture" },
  { id: "run_0159", date: "Sep 02, 09:33", model: "model-medium", prompt: "v15", quality: 83.9, passRate: 81, cost: 0.0038, latency: 1.22, status: "completed", mode: "fixture" },
];

export const regressions: RegressionRecord[] = [
  { id: "CS-0042", title: "Refund policy edge case", run: "run_0191", delta: -1, category: "Grounding", severity: "high", status: "open" },
  { id: "CS-0176", title: "Multi-step account fix", run: "run_0191", delta: -1, category: "Correctness", severity: "high", status: "open" },
  { id: "CS-0281", title: "Unsupported product feature", run: "run_0191", delta: -0.667, category: "Completeness", severity: "medium", status: "open" },
  { id: "CS-0319", title: "Policy citation", run: "run_0184", delta: -0.667, category: "Grounding", severity: "medium", status: "open" },
  { id: "CS-0447", title: "Escalation criteria", run: "run_0184", delta: -0.667, category: "Safety", severity: "low", status: "reviewed" },
];

export const ragChunks: RagChunk[] = [
  { id: 1, title: "Footwear Return Policy", source: "docs/returns_footwear.md", chunk: 3, score: 0.872, relevant: true, text: "Footwear items may be returned within 30 days of delivery for a full refund, provided they are in new and unworn condition with the original packaging." },
  { id: 2, title: "General Return Policy", source: "docs/returns_general.md", chunk: 1, score: 0.811, relevant: true, text: "Most items can be returned within 30 days of delivery. Certain categories have different return windows." },
  { id: 3, title: "Footwear Exchanges", source: "docs/returns_footwear.md", chunk: 5, score: 0.764, relevant: true, text: "You can exchange footwear for a different size or color within 30 days of delivery. Exchange shipping is free." },
  { id: 4, title: "Non-returnable Items", source: "docs/policies_exclusions.md", chunk: 2, score: 0.718, relevant: false, text: "Final-sale items, customized products, and worn footwear are not eligible for return." },
  { id: 5, title: "Refund Processing Time", source: "docs/refunds.md", chunk: 4, score: 0.693, relevant: false, text: "Once we receive your return, refunds are processed within 5–7 business days to the original payment method." },
];

export const compareMetrics: CompareMetric[] = [
  { label: "Correctness", baseline: "0.872", candidate: "0.869", delta: "−0.003", threshold: "≥ 0.850", result: "neutral" },
  { label: "Relevance", baseline: "0.841", candidate: "0.847", delta: "+0.006", threshold: "≥ 0.800", result: "pass" },
  { label: "Faithfulness", baseline: "0.918", candidate: "0.912", delta: "−0.006", threshold: "≥ 0.850", result: "neutral" },
  { label: "JSON validity", baseline: "0.997", candidate: "0.998", delta: "+0.001", threshold: "≥ 0.990", result: "pass" },
  { label: "Cost / request", baseline: "$0.012", candidate: "$0.011", delta: "−$0.001", threshold: "≤ $0.020", result: "pass" },
  { label: "p95 latency", baseline: "2.31 s", candidate: "2.18 s", delta: "−0.13 s", threshold: "≤ 4.00 s", result: "pass" },
  { label: "Regression rate", baseline: "—", candidate: "5.0%", delta: "+5.0 pp", threshold: "≤ 2.0%", result: "fail" },
];

export const compareCases: CompareCase[] = [
  {
    id: "CS-0042", slice: "Returns & Refunds", baseline: 1, candidate: 0, delta: -1,
    finding: "Incorrect refund window", expected: "Unworn footwear can be returned within 30 days.",
    prompt: "I bought sneakers 45 days ago and they do not fit. Can I still get a refund? The shoes are unworn and in the original box.",
    baselineOutput: "Footwear may be returned within 30 days of delivery. Since 45 days have passed, the refund window has closed, but an exchange may still be reviewed.",
    candidateOutput: "Yes. Unworn footwear can be returned within 60 days when it has the original packaging.",
    evidence: "The candidate claims 60 days, contradicting the 30-day source policy.",
    source: "Footwear items may be returned within 30 days of delivery for a full refund when new, unworn, and in the original packaging.",
  },
  {
    id: "CS-0176", slice: "Order Tracking", baseline: 1, candidate: 0, delta: -1,
    finding: "Missed tracking steps", expected: "Ask for order ID, then open tracking.",
    prompt: "Where is my order?", baselineOutput: "Share your order ID and I will check its latest carrier scan.",
    candidateOutput: "Your order should arrive soon.", evidence: "Candidate does not request the identifier required to perform tracking.",
    source: "Order tracking requires a valid order identifier before carrier status can be retrieved.",
  },
  {
    id: "CS-0281", slice: "Product Info", baseline: 0.667, candidate: 0, delta: -0.667,
    finding: "Hallucinated feature", expected: "State that offline sync is unavailable.",
    prompt: "Does the mobile app sync offline?", baselineOutput: "Offline sync is not available in the current mobile app.",
    candidateOutput: "Yes, changes sync automatically after reconnecting.", evidence: "No source supports offline synchronization.",
    source: "The mobile application requires an active network connection for data updates.",
  },
  {
    id: "CS-0319", slice: "Shipping", baseline: 1, candidate: 0.333, delta: -0.667,
    finding: "Incorrect delivery time", expected: "Standard delivery takes 3–5 business days.",
    prompt: "How long is standard shipping?", baselineOutput: "Standard delivery takes 3–5 business days.",
    candidateOutput: "Standard shipping normally takes 7–10 business days.", evidence: "Candidate conflicts with the published shipping window.",
    source: "Standard delivery: 3–5 business days. Express delivery: 1–2 business days.",
  },
  {
    id: "CS-0447", slice: "Returns & Refunds", baseline: 1, candidate: 0.333, delta: -0.667,
    finding: "Wrong eligibility rule", expected: "Custom products cannot be returned.",
    prompt: "Can I return an engraved bottle?", baselineOutput: "Engraved products are customized and cannot be returned.",
    candidateOutput: "You can return it within 30 days if unused.", evidence: "Customization exclusion overrides the general 30-day policy.",
    source: "Customized and engraved products are final sale and are not eligible for return.",
  },
];

export const providers: ProviderRecord[] = [
  { id: "fixture", name: "Fixture engine", mode: "local", configured: true, reachable: true, detail: "Deterministic seeded outputs", capabilities: { generation: true, embeddings: true, structured_output: true, streaming: true, tool_calling: true, token_usage: true } },
  { id: "ollama", name: "Ollama", mode: "local", configured: true, reachable: null, detail: "Check local service", capabilities: { generation: true, embeddings: true, structured_output: true, streaming: true, tool_calling: true, token_usage: true } },
  { id: "openai", name: "OpenAI", mode: "cloud", configured: false, reachable: null, detail: "OPENAI_API_KEY missing", capabilities: { generation: true, embeddings: true, structured_output: true, streaming: true, tool_calling: true, token_usage: true } },
  { id: "anthropic", name: "Anthropic", mode: "cloud", configured: false, reachable: null, detail: "ANTHROPIC_API_KEY missing", capabilities: { generation: true, embeddings: false, structured_output: true, streaming: true, tool_calling: true, token_usage: true } },
  { id: "gemini", name: "Gemini", mode: "cloud", configured: false, reachable: null, detail: "GEMINI_API_KEY missing", capabilities: { generation: true, embeddings: true, structured_output: true, streaming: true, tool_calling: true, token_usage: true } },
];

export const agentTrace: TraceItem[] = [
  { id: "t1", type: "message", title: "User request", detail: "Where is order #A-2048 and can I change its address?", duration: "0 ms", status: "complete" },
  { id: "t2", type: "tool_call", title: "order_lookup", detail: '{"order_id":"A-2048"}', duration: "18 ms", status: "complete" },
  { id: "t3", type: "tool_result", title: "Tool result", detail: "Processing · address change allowed until dispatch", duration: "42 ms", status: "complete" },
  { id: "t4", type: "tool_call", title: "policy_search", detail: '{"query":"address change processing order"}', duration: "13 ms", status: "complete" },
  { id: "t5", type: "tool_result", title: "Policy evidence", detail: "Address may be edited before carrier handoff.", duration: "35 ms", status: "complete" },
  { id: "t6", type: "model", title: "Final response", detail: "The order is still processing, so its address can be changed now.", duration: "612 ms", status: "complete" },
  { id: "t7", type: "evaluation", title: "Trajectory evaluation", detail: "Goal complete · tools correct · 0 redundant calls", duration: "84 ms", status: "complete" },
];

export const datasetRows = [
  { id: "CS-0001", input: "I want my money back", expected: "refund", category: "refund", difficulty: "easy" },
  { id: "CS-0002", input: "My parcel has not arrived", expected: "shipping", category: "shipping", difficulty: "medium" },
  { id: "CS-0003", input: "I cannot sign in after changing my password", expected: "account", category: "account", difficulty: "hard" },
  { id: "CS-0004", input: "Why was my card charged twice?", expected: "payment", category: "payment", difficulty: "hard" },
];

