"use client";

import {
  Activity,
  Beaker,
  Bot,
  Braces,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  Languages,
  Menu,
  MessageSquareText,
  Moon,
  Network,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareStack,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "./app-provider";

const primary = [
  { href: "/", key: "overview", icon: Gauge },
  { href: "/experiments", key: "experiments", icon: FlaskConical },
  { href: "/datasets", key: "datasets", icon: Database },
  { href: "/knowledge-base", key: "knowledgeBase", icon: SquareStack },
  { href: "/prompts", key: "prompts", icon: MessageSquareText },
  { href: "/providers", key: "providers", icon: Network },
  { href: "/evaluators", key: "evaluators", icon: SlidersHorizontal },
];

const labs = [
  { href: "/ai-lab/prompt-tokens", key: "promptTokens", icon: Braces },
  { href: "/ai-lab/embeddings", key: "embeddings", icon: Sparkles },
  { href: "/ai-lab/rag", key: "rag", icon: SquareStack },
  { href: "/ai-lab/grounding", key: "grounding", icon: Activity },
  { href: "/ai-lab/safety", key: "safety", icon: ShieldCheck },
  { href: "/ai-lab/agents", key: "agents", icon: Bot },
  { href: "/ai-lab/training", key: "training", icon: ChartNoAxesCombined },
];

function ModeBadge() {
  const { mode, t } = useApp();
  return <span className={`mode-badge mode-${mode}`}>{t(`app.${mode}`)}</span>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, resolvedTheme, setTheme, projectName, t } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(pathname.startsWith("/ai-lab"));
  const [query, setQuery] = useState("");
  const destinations = [...primary, ...labs, { href: "/reviews", key: "reviews" }, { href: "/settings", key: "settings" }, { href: "/docs", key: "documentation" }];
  const searchResults = query.trim() ? destinations.filter((item) => `${t(`nav.${item.key}`)} ${item.href}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">{t("common.skip")}</a>
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
      {mobileOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link href="/" className="brand" onClick={() => setMobileOpen(false)}>LLMLab</Link>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <p className="brand-description">{t("app.description").split("\n").map((line) => <span key={line}>{line}<br /></span>)}</p>

        <nav className="nav" aria-label="Primary navigation">
          {primary.map(({ href, key, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${active(href) ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <Icon size={18} strokeWidth={1.8} /><span>{t(`nav.${key}`)}</span>
            </Link>
          ))}
          <button className={`nav-link nav-group ${pathname.startsWith("/ai-lab") ? "group-active" : ""}`} onClick={() => setLabsOpen((value) => !value)} aria-expanded={labsOpen}>
            <Beaker size={18} strokeWidth={1.8} /><span>{t("nav.aiLab")}</span>{labsOpen ? <ChevronDown className="nav-chevron" size={15} /> : <ChevronRight className="nav-chevron" size={15} />}
          </button>
          {labsOpen && (
            <div className="nav-subgroup">
              {labs.map(({ href, key, icon: Icon }) => (
                <Link key={href} href={href} className={`nav-link nav-sublink ${active(href) ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                  <Icon size={15} /><span>{t(`nav.${key}`)}</span>
                </Link>
              ))}
            </div>
          )}
          <Link href="/reviews" className={`nav-link ${active("/reviews") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
            <FileText size={18} strokeWidth={1.8} /><span>{t("nav.reviews")}</span>
          </Link>
        </nav>

        <div className="nav-footer">
          <Link href="/settings" className={`nav-link ${active("/settings") ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Settings size={18} /><span>{t("nav.settings")}</span></Link>
          <Link href="/docs" className={`nav-link ${active("/docs") ? "active" : ""}`} onClick={() => setMobileOpen(false)}><CircleHelp size={18} /><span>{t("nav.documentation")}</span></Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>{projectName ?? t("app.project")}</span><ChevronRight size={14} /><strong>{pathname === "/" ? t("nav.overview") : t(`nav.${routeKey(pathname)}`)}</strong></div>
          <div className="search-shell">
            <label className="global-search"><Search size={16} /><span className="sr-only">{t("app.search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && searchResults[0]) { router.push(searchResults[0].href); setQuery(""); } }} placeholder={t("app.search")} /></label>
            {query && <div className="search-results">{searchResults.length ? searchResults.map((item) => <Link key={item.href} href={item.href} onClick={() => setQuery("")}><span>{t(`nav.${item.key}`)}</span><small className="mono">{item.href}</small></Link>) : <span>{t("common.noResults")}</span>}</div>}
          </div>
          <ModeBadge />
          <button className="icon-button theme-toggle" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label={resolvedTheme === "dark" ? t("settings.switchLight") : t("settings.switchDark")} title={resolvedTheme === "dark" ? t("settings.switchLight") : t("settings.switchDark")}>{resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
          <div className="locale-switch" aria-label={t("settings.language")}>
            <Languages size={15} aria-hidden="true" />
            <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>EN</button>
            <span>/</span>
            <button className={locale === "cs" ? "active" : ""} onClick={() => setLocale("cs")} aria-pressed={locale === "cs"}>CZ</button>
          </div>
          <Link href="/settings" className="avatar" aria-label={t("common.userMenu")}>U</Link>
        </header>
        <main id="main-content" className="page-content">{children}</main>
      </div>
    </div>
  );
}

function routeKey(pathname: string) {
  if (pathname === "/knowledge-base") return "knowledgeBase";
  if (pathname === "/docs") return "documentation";
  if (pathname.includes("prompt-tokens")) return "promptTokens";
  if (pathname.includes("embeddings")) return "embeddings";
  if (pathname.includes("rag")) return "rag";
  if (pathname.includes("grounding")) return "grounding";
  if (pathname.includes("safety")) return "safety";
  if (pathname.includes("agents")) return "agents";
  if (pathname.includes("training")) return "training";
  if (pathname.startsWith("/experiments")) return "experiments";
  return pathname.split("/")[1] || "overview";
}
