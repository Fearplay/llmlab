"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/ui";

const lessons = {
  cs: [
    { title: "První prompt", text: "Model dostane zadání a předpovídá pokračování. Napiš jednu jasnou otázku a prohlédni odpověď.", task: "Napiš otázku vlastními slovy.", href: "/ai-lab/prompt-tokens" },
    { title: "Systémová instrukce", text: "Odděl trvalé pravidlo od otázky. Zkus třeba požadovat stručnou odpověď a potom pravidlo změň.", task: "Porovnej stejnou otázku se dvěma instrukcemi.", href: "/ai-lab/prompt-tokens" },
    { title: "Tokeny a kontext", text: "Token je část textu, kterou model zpracuje. Kontextové okno omezuje, kolik vstupu a výstupu pojme najednou.", task: "Přidej delší text a sleduj odhad vstupních tokenů.", href: "/ai-lab/prompt-tokens" },
    { title: "Teplota a top-p", text: "Tyto hodnoty ovlivňují výběr dalších tokenů. Vyšší náhodnost může dát pestřejší odpověď, ne nové znalosti.", task: "Změň vždy jen jeden posuvník a spusť prompt znovu.", href: "/ai-lab/prompt-tokens" },
    { title: "Strukturovaný JSON", text: "Schéma říká, jaký tvar má mít odpověď. Platný JSON ještě nezaručuje správná fakta.", task: "Zapni JSON schéma u modelu, který ho podporuje.", href: "/ai-lab/prompt-tokens" },
    { title: "Porovnání modelů", text: "Stejné zadání pošli několika modelům. Vedle odpovědi sleduj čas, spotřebu a cenu.", task: "Porovnej dva modely na stejné otázce.", href: "/arena" },
    { title: "RAG a důkazy", text: "RAG nejprve najde úryvky dokumentu a pak je předá modelu. Každé tvrzení si zkontroluj proti citaci.", task: "Nahraj dokument a zeptej se na konkrétní údaj.", href: "/ai-lab/rag" },
    { title: "Evaluace a bezpečnost", text: "Měř přesnou nebo částečnou shodu a testuj hranice instrukcí. Skóre samo nenahradí kontrolu důkazů.", task: "Vytvoř testovací případ a prohlédni chyby.", href: "/evaluators" },
    { title: "Agenti a učení", text: "Agent volá nástroje v několika krocích. Ve Flappy AI uvidíš rozhodnutí pravidelného, jazykového i trénovaného agenta.", task: "Spusť epizodu a otevři replay rozhodnutí.", href: "/ai-lab/flappy" },
  ],
  en: [
    { title: "Your first prompt", text: "A model receives a task and predicts a continuation. Write one clear question and inspect the answer.", task: "Ask a question in your own words.", href: "/ai-lab/prompt-tokens" },
    { title: "System instruction", text: "Separate a lasting rule from the question. Try asking for a short answer, then change the rule.", task: "Compare one question with two instructions.", href: "/ai-lab/prompt-tokens" },
    { title: "Tokens and context", text: "A token is a piece of text the model processes. The context window limits how much input and output fit at once.", task: "Add a longer text and watch the input token estimate.", href: "/ai-lab/prompt-tokens" },
    { title: "Temperature and top-p", text: "These values affect which tokens can be chosen next. More randomness can vary the answer, but adds no knowledge.", task: "Change one slider at a time and run again.", href: "/ai-lab/prompt-tokens" },
    { title: "Structured JSON", text: "A schema describes the answer's shape. Valid JSON does not guarantee correct facts.", task: "Enable JSON schema with a model that supports it.", href: "/ai-lab/prompt-tokens" },
    { title: "Compare models", text: "Send the same task to several models. Inspect answers, time, usage, and price side by side.", task: "Compare two models on one question.", href: "/arena" },
    { title: "RAG and evidence", text: "RAG retrieves document excerpts before asking a model to answer. Check each claim against a citation.", task: "Upload a document and ask for a specific fact.", href: "/ai-lab/rag" },
    { title: "Evaluation and safety", text: "Measure exact or partial matches and test instruction boundaries. A score cannot replace checking evidence.", task: "Create a test case and inspect failures.", href: "/evaluators" },
    { title: "Agents and learning", text: "An agent calls tools in several steps. Flappy AI shows decisions from rules, language models, and a trained agent.", task: "Run an episode and inspect its replay.", href: "/ai-lab/flappy" },
  ],
};

export function DocsPage() {
  const { locale } = useApp();
  return <>
    <PageHeader title={locale === "cs" ? "Základy LLM" : "LLM foundations"} description={locale === "cs" ? "Devět krátkých lekcí. Každou si můžeš hned vyzkoušet na dostupném modelu." : "Nine short lessons. Try each one with an available model."} />
    <ol className="lesson-path">{lessons[locale].map((lesson, index) => <li key={lesson.title} className="lesson-step">
      <span className="lesson-number mono">{String(index + 1).padStart(2, "0")}</span>
      <div><h2>{lesson.title}</h2><p>{lesson.text}</p><span className="lesson-task">{lesson.task}</span></div>
      <Link href={lesson.href} className="lesson-open">{locale === "cs" ? "Vyzkoušet" : "Try it"}<ArrowRight size={16} /></Link>
    </li>)}</ol>
  </>;
}
