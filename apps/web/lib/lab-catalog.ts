export type LabGroup = "foundations" | "knowledge" | "applications" | "operations";

export interface LabEntry {
  slug: string;
  group: LabGroup;
  cs: string;
  en: string;
  summaryCs: string;
  summaryEn: string;
}

export const labGroups: { id: LabGroup; cs: string; en: string; descriptionCs: string; descriptionEn: string }[] = [
  { id: "foundations", cs: "Základy", en: "Foundations", descriptionCs: "Od textu k dalšímu tokenu", descriptionEn: "From text to the next token" },
  { id: "knowledge", cs: "Znalosti a RAG", en: "Knowledge & RAG", descriptionCs: "Jak model dostává podklady", descriptionEn: "How evidence reaches a model" },
  { id: "applications", cs: "Aplikace", en: "Applications", descriptionCs: "Model propojený s pravidly a nástroji", descriptionEn: "Models connected to rules and tools" },
  { id: "operations", cs: "Provoz modelů", en: "Model operations", descriptionCs: "Čas, paměť a cena každého běhu", descriptionEn: "Time, memory and cost of each run" },
];

export const labEntries: LabEntry[] = [
  { slug: "tokenizer", group: "foundations", cs: "Tokenizace", en: "Tokenization", summaryCs: "Skutečná ID tokenů pro text, kód a JSON.", summaryEn: "Real token IDs for text, code and JSON." },
  { slug: "transformer", group: "foundations", cs: "Transformer", en: "Transformer", summaryCs: "Výpočet attention krok za krokem.", summaryEn: "Attention calculation step by step." },
  { slug: "generation", group: "foundations", cs: "Generování", en: "Generation", summaryCs: "Výběr dalšího tokenu a vliv samplingu.", summaryEn: "Next-token choice and sampling controls." },
  { slug: "prompt-tokens", group: "foundations", cs: "Prompt a tokeny", en: "Prompt & tokens", summaryCs: "Zprávy a parametry skutečného požadavku.", summaryEn: "Messages and settings of a real request." },
  { slug: "context", group: "foundations", cs: "Kontext", en: "Context", summaryCs: "Rozpočet kontextového okna a ořez historie.", summaryEn: "Context budget and history trimming." },
  { slug: "embeddings", group: "foundations", cs: "Embeddingy", en: "Embeddings", summaryCs: "Podobnost více textů ve vektorovém prostoru.", summaryEn: "Similarity of several texts in vector space." },
  { slug: "chunking", group: "knowledge", cs: "Chunking", en: "Chunking", summaryCs: "Dělení dokumentu a překryv úryvků.", summaryEn: "Document splitting and chunk overlap." },
  { slug: "retrieval", group: "knowledge", cs: "Vyhledávání", en: "Retrieval", summaryCs: "Lexikální, vektorové a hybridní hledání.", summaryEn: "Lexical, vector and hybrid search." },
  { slug: "reranking", group: "knowledge", cs: "Reranking", en: "Reranking", summaryCs: "Jak se mění pořadí nalezených úryvků.", summaryEn: "How retrieved passages change order." },
  { slug: "rag", group: "knowledge", cs: "RAG pipeline", en: "RAG pipeline", summaryCs: "Celá cesta dokumentu k odpovědi s citacemi.", summaryEn: "The full path from document to cited answer." },
  { slug: "retrieval-evals", group: "knowledge", cs: "Kvalita retrievalu", en: "Retrieval quality", summaryCs: "Recall@K, Precision@K a MRR pro testovací dotazy.", summaryEn: "Recall@K, Precision@K and MRR for test queries." },
  { slug: "grounding", group: "knowledge", cs: "Grounding", en: "Grounding", summaryCs: "Tvrzení odpovědi proti zdrojovým podkladům.", summaryEn: "Answer claims checked against evidence." },
  { slug: "structured-output", group: "applications", cs: "Strukturované výstupy", en: "Structured output", summaryCs: "Schéma a kontrola JSON odpovědi.", summaryEn: "JSON schema and output validation." },
  { slug: "tools", group: "applications", cs: "Volání nástrojů", en: "Tool calling", summaryCs: "Jedno volání nástroje bez agentní smyčky.", summaryEn: "One tool call without an agent loop." },
  { slug: "agents", group: "applications", cs: "Agenti", en: "Agents", summaryCs: "Stav, rozhodnutí a nástroj v každém kroku.", summaryEn: "State, decision and tool at each step." },
  { slug: "mcp", group: "applications", cs: "MCP", en: "MCP", summaryCs: "Klient, server, nástroje a zdroje.", summaryEn: "Client, server, tools and resources." },
  { slug: "safety", group: "applications", cs: "Bezpečnost", en: "Safety", summaryCs: "Nedůvěryhodné instrukce a hranice oprávnění.", summaryEn: "Untrusted instructions and permission boundaries." },
  { slug: "flappy", group: "applications", cs: "Flappy AI", en: "Flappy AI", summaryCs: "Rozhodnutí agentů ve hře.", summaryEn: "Agent decisions in a game." },
  { slug: "routing", group: "operations", cs: "Směrování modelů", en: "Model routing", summaryCs: "Výběr modelu podle úlohy, ceny a rychlosti.", summaryEn: "Choose models by task, cost and speed." },
  { slug: "inference", group: "operations", cs: "Inference", en: "Inference", summaryCs: "První token, streaming a rychlost výstupu.", summaryEn: "First token, streaming and output speed." },
  { slug: "cache", group: "operations", cs: "Cache", en: "Cache", summaryCs: "Opakovaný požadavek a ušetřená práce.", summaryEn: "Repeated requests and avoided work." },
  { slug: "kv-cache", group: "operations", cs: "KV cache", en: "KV cache", summaryCs: "Paměť a opakované použití stavů attention.", summaryEn: "Memory and reuse of attention states." },
  { slug: "quantization", group: "operations", cs: "Kvantizace", en: "Quantization", summaryCs: "Velikost, paměť a kvalita různých přesností.", summaryEn: "Size, memory and quality at different precisions." },
  { slug: "fine-tuning", group: "operations", cs: "Fine-tuning", en: "Fine-tuning", summaryCs: "Prompt, RAG a trénovací příklady vedle sebe.", summaryEn: "Prompts, RAG and training examples side by side." },
];

export const labHref = (slug: string) => `/ai-lab/${slug}`;
