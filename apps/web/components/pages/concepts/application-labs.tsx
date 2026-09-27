"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Experiment, Field, Note, Panel, Readout, type LabLocale } from "./concept-lab";
import styles from "./application-labs.module.css";

const initialSchema = '{"type":"object","properties":{"answer":{"type":"string"},"confidence":{"type":"number"}},"required":["answer","confidence"]}';
function inspectJson(text: string, schemaText: string) {
  try {
    const schema = JSON.parse(schemaText) as { type?: string; required?: string[]; properties?: Record<string, { type?: string }> };
    const value = JSON.parse(text) as unknown;
    if (schema.type === "object" && (!value || typeof value !== "object" || Array.isArray(value))) return "Expected an object";
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in record)) return `Missing: ${key}`;
    for (const [key, rule] of Object.entries(schema.properties ?? {})) if (key in record && rule.type && typeof record[key] !== rule.type) return `${key}: expected ${rule.type}`;
    return "";
  } catch (error) { return error instanceof Error ? error.message : "Invalid JSON"; }
}
function StructuredLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const { selectedModel } = useApp();
  const [schema, setSchema] = useState(initialSchema);
  const [output, setOutput] = useState('{"answer":"Vrácení trvá nejvýše 30 dní.","confidence":0.9}');
  const [prompt, setPrompt] = useState(cs ? "Vrať stručnou odpověď ve formátu JSON." : "Return a short answer as JSON.");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const validation = inspectJson(output, schema);
  const runLive = async () => {
    if (!selectedModel) return;
    setRunning(true); setError("");
    try {
      const parsed = JSON.parse(schema) as Record<string, unknown>;
      const response = await fetch("/api/v1/generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedModel.mode, provider: selectedModel.provider, model: selectedModel.id, messages: [{ role: "user", content: prompt }], response_schema: parsed, max_tokens: 256 }) });
      const data = await response.json() as { text?: string; detail?: string };
      if (!response.ok || typeof data.text !== "string") throw new Error(data.detail ?? `HTTP ${response.status}`);
      setOutput(data.text);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setRunning(false); }
  };
  return <Experiment controls={<Panel title={cs ? "Schéma a požadavek" : "Schema and request"}><Field helpKey="prompt.structured" label="JSON schema"><textarea rows={8} value={schema} onChange={(event) => setSchema(event.target.value)} /></Field><Field helpKey="prompt.message" label="Prompt"><textarea rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></Field><button className={styles.action} type="button" disabled={!selectedModel || running} onClick={() => void runLive()}>{running ? cs ? "Čekám na model…" : "Waiting for model…" : cs ? "Spustit dostupný model" : "Run available model"}</button>{!selectedModel && <Note>{cs ? "Bez připojeného modelu můžeš upravit a ověřit ukázkovou odpověď." : "Without a connected model, edit and validate the sample answer."}</Note>}{error && <p role="alert" className={styles.error}>{error}</p>}</Panel>} result={<Panel title={cs ? "Odpověď a kontrola" : "Answer and validation"}><Field helpKey="field.structuredOutput" label={cs ? "Výstup" : "Output"}><textarea rows={9} value={output} onChange={(event) => setOutput(event.target.value)} /></Field><Readout label={cs ? "Platnost vůči schématu" : "Schema validity"} value={validation ? cs ? "Neplatné" : "Invalid" : cs ? "Platné" : "Valid"} detail={validation || undefined} /><Note>{cs ? "Platný JSON kontroluje tvar odpovědi, ne pravdivost tvrzení. Lokální kontrola ověřuje povinná pole a jednoduché typy." : "Valid JSON checks the answer's shape, not its factual accuracy. The local check covers required fields and simple types."}</Note></Panel>} />;
}

type ToolName = "calculator" | "read_file" | "search_database";
function executeTool(name: ToolName, args: Record<string, unknown>) {
  if (name === "calculator") {
    const a = Number(args.a), b = Number(args.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Arguments a and b must be numbers");
    return { value: a + b };
  }
  if (name === "read_file") {
    if (args.name !== "policy.txt") throw new Error("Only policy.txt exists in this sandbox");
    return { content: "Returns are accepted within 30 days." };
  }
  if (typeof args.query !== "string") throw new Error("query must be a string");
  return { rows: args.query.toLowerCase().includes("order") ? [{ id: "order-42", state: "shipped" }] : [] };
}
function ToolsLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [tool, setTool] = useState<ToolName>("calculator");
  const [argumentsText, setArgumentsText] = useState('{"a":12,"b":30}');
  const [trace, setTrace] = useState<{ args: unknown; result?: unknown; answer?: string; error?: string } | null>(null);
  const select = (name: ToolName) => { setTool(name); setTrace(null); setArgumentsText(name === "calculator" ? '{"a":12,"b":30}' : name === "read_file" ? '{"name":"policy.txt"}' : '{"query":"order"}'); };
  const run = () => {
    try {
      const args = JSON.parse(argumentsText) as unknown;
      if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Arguments must be an object");
      const result = executeTool(tool, args as Record<string, unknown>);
      const answer = tool === "calculator" ? `${cs ? "Součet je" : "The sum is"} ${(result as { value: number }).value}.` : tool === "read_file" ? cs ? "Vrácení je možné do 30 dnů." : "Returns are possible within 30 days." : cs ? "Nalezené záznamy jsou zobrazené ve výsledku nástroje." : "The matched records are shown in the tool result.";
      setTrace({ args, result, answer });
    } catch (caught) { setTrace({ args: argumentsText, error: caught instanceof Error ? caught.message : String(caught) }); }
  };
  return <Experiment controls={<Panel title={cs ? "Jedno volání nástroje" : "One tool call"}><Field helpKey="field.concept" label={cs ? "Vybraný nástroj" : "Selected tool"}><select value={tool} onChange={(event) => select(event.target.value as ToolName)}><option value="calculator">calculator(a, b)</option><option value="read_file">read_file(name)</option><option value="search_database">search_database(query)</option></select></Field><Field helpKey="field.concept" label={cs ? "Argumenty jako JSON" : "Arguments as JSON"}><textarea rows={5} value={argumentsText} onChange={(event) => setArgumentsText(event.target.value)} /></Field><button className={styles.action} type="button" onClick={run}>{cs ? "Spustit jeden krok" : "Run one step"}</button><Note>{cs ? "Jde o bezpečný lokální sandbox. Model ani skutečné soubory se nevolají; cílem je vidět hranici zpráva → nástroj → odpověď." : "This is a safe local sandbox. No model or real files are called; the goal is to see the message → tool → answer boundary."}</Note></Panel>} result={<Panel title={cs ? "Průběh zpráv" : "Message trace"}><ol className={styles.trace}><li><strong>{cs ? "Zpráva modelu" : "Model message"}</strong><pre>{JSON.stringify({ tool, arguments: trace?.args ?? "…" }, null, 2)}</pre></li><li><strong>{cs ? "Výsledek nástroje" : "Tool result"}</strong><pre>{trace ? JSON.stringify(trace.error ? { error: trace.error } : trace.result, null, 2) : "—"}</pre></li><li><strong>{cs ? "Finální odpověď" : "Final answer"}</strong><p>{trace?.answer ?? "—"}</p></li></ol></Panel>} />;
}

const mcpActions = ["server/discover", "tools/list", "resources/list", "tools/call", "resources/read"] as const;
type McpAction = typeof mcpActions[number];
function mcpResponse(action: McpAction) {
  if (action === "server/discover") return { protocolVersions: ["2026-07-28"], capabilities: { tools: {}, resources: {} }, serverInfo: { name: "llmlab-demo", version: "1.0" } };
  if (action === "tools/list") return { tools: [{ name: "calculator", description: "Add two numbers", inputSchema: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } } }], ttlMs: 60000, cacheScope: "private" };
  if (action === "resources/list") return { resources: [{ uri: "lab://policy/returns", name: "Return policy", mimeType: "text/plain" }], ttlMs: 60000, cacheScope: "private" };
  if (action === "tools/call") return { content: [{ type: "text", text: "42" }], isError: false };
  return { contents: [{ uri: "lab://policy/returns", mimeType: "text/plain", text: "Returns within 30 days." }], ttlMs: 60000, cacheScope: "private" };
}
function McpLab({ locale }: { locale: LabLocale }) {
  const cs = locale === "cs";
  const [action, setAction] = useState<McpAction>("server/discover");
  const [history, setHistory] = useState<McpAction[]>(["server/discover"]);
  const request = { jsonrpc: "2.0", id: history.length, method: action, params: { ...(action === "tools/call" ? { name: "calculator", arguments: { a: 12, b: 30 } } : action === "resources/read" ? { uri: "lab://policy/returns" } : {}), _meta: { "io.modelcontextprotocol/clientInfo": { name: "llmlab", version: "1.0" } } } };
  return <Experiment controls={<Panel title={cs ? "Klient MCP" : "MCP client"}><Field helpKey="field.concept" label={cs ? "Operace" : "Operation"}><select value={action} onChange={(event) => setAction(event.target.value as McpAction)}>{mcpActions.map((item) => <option key={item}>{item}</option>)}</select></Field><button className={styles.action} type="button" onClick={() => setHistory((current) => [...current, action])}>{cs ? "Odeslat požadavek" : "Send request"}</button><div className={styles.mcpHistory}>{history.map((item, index) => <span key={index}>{index + 1}. {item}</span>)}</div><Note>{cs ? "Místní simulace používá bezstavový formát MCP 2026-07-28. MCP standardizuje externí schopnosti; rozhodnutí modelu použít nástroj je jiný krok." : "This local simulation uses stateless MCP 2026-07-28. MCP standardizes external capabilities; a model's decision to use a tool is a separate step."}</Note></Panel>} result={<Panel title={cs ? "Požadavek a odpověď serveru" : "Request and server response"}><strong className={styles.traceTitle}>MCP-Protocol-Version: 2026-07-28</strong><pre className={styles.code}>{JSON.stringify(request, null, 2)}</pre><strong className={styles.traceTitle}>{cs ? "Odpověď" : "Response"}</strong><pre className={styles.code}>{JSON.stringify({ jsonrpc: "2.0", id: request.id, result: mcpResponse(action) }, null, 2)}</pre></Panel>} />;
}

export function ApplicationLab({ slug, locale }: { slug: string; locale: LabLocale }) {
  if (slug === "structured-output") return <StructuredLab locale={locale} />;
  if (slug === "tools") return <ToolsLab locale={locale} />;
  if (slug === "mcp") return <McpLab locale={locale} />;
  return null;
}
