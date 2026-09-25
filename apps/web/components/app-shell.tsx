"use client";

import {
  Beaker,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileText,
  Gauge,
  Languages,
  Menu,
  MessageSquareText,
  Moon,
  Network,
  Search,
  History,
  Wallet,
  Swords,
  Settings,
  SlidersHorizontal,
  Sun,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-provider";
import { labEntries, labGroups, labHref, type LabGroup } from "@/lib/lab-catalog";

const primary = [
  { href: "/", key: "overview", icon: Gauge },
  { href: "/arena", key: "arena", icon: Swords },
  { href: "/datasets", key: "datasets", icon: Database },
  { href: "/prompts", key: "prompts", icon: MessageSquareText },
  { href: "/providers", key: "providers", icon: Network },
  { href: "/evaluators", key: "evaluators", icon: SlidersHorizontal },
];

const checks = [
  { href: "/history", key: "history", icon: History },
  { href: "/operations", key: "operations", icon: Wallet },
];

function ModeBadge() {
  const { mode, t } = useApp();
  return <span className={`mode-badge mode-${mode}`}>{t(`app.${mode}`)}</span>;
}

function ModelPicker() {
  const { locale, mode, models, modelsLoading, modelError, selectedModel, recentModelKeys, setSelectedModelKey, refreshModels } = useApp();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside, true); document.removeEventListener("keydown", closeEscape); };
  }, []);
  const generative = models.filter((item) => Array.isArray(item.capabilities) ? item.capabilities.includes("generation") : item.capabilities?.generation);
  const ordered = [...generative].sort((a, b) => {
    const recentA = recentModelKeys.indexOf(a.key);
    const recentB = recentModelKeys.indexOf(b.key);
    if (recentA >= 0 || recentB >= 0) return (recentA < 0 ? 99 : recentA) - (recentB < 0 ? 99 : recentB);
    const rank = (item: typeof a) => item.available && item.mode === "local" ? 0 : item.available ? 1 : 2;
    return rank(a) - rank(b) || a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
  });
  const visible = ordered.filter((item) => `${item.id} ${item.provider}`.toLowerCase().includes(search.trim().toLowerCase()));
  const label = locale === "cs" ? "Vybrat model" : "Choose model";
  return <div className="model-picker" ref={root}>
    <button className="model-picker-trigger" type="button" aria-label={label} aria-expanded={open} aria-haspopup="listbox" onClick={() => { setSearch(""); setActiveIndex(0); setOpen((value) => !value); }}>
      <span className="model-picker-dot" data-mode={selectedModel?.mode ?? mode} />
      <span className="model-picker-current">{selectedModel ? selectedModel.id : modelsLoading ? (locale === "cs" ? "Načítám modely…" : "Loading models…") : (locale === "cs" ? "Vybrat model" : "Choose model")}</span><ChevronDown size={15} />
    </button>
    {open && <div className="model-picker-popover">
      <label className="model-picker-search"><Search size={15} /><span className="sr-only">{label}</span><input autoFocus value={search} placeholder={locale === "cs" ? "Hledat model…" : "Search models…"} onChange={(event) => { setSearch(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, visible.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
        if (event.key === "Enter" && visible[activeIndex]?.available) { setSelectedModelKey(visible[activeIndex].key); setOpen(false); }
      }} /></label>
      <div role="listbox" aria-label={label} className="model-picker-list">
        {visible.map((item, index) => <button key={item.key} type="button" role="option" aria-selected={selectedModel?.key === item.key} className={index === activeIndex ? "active" : ""} disabled={!item.available} onMouseEnter={() => setActiveIndex(index)} onClick={() => { setSelectedModelKey(item.key); setOpen(false); }}><span><strong>{item.id}</strong><small>{item.provider} · {item.mode === "local" ? (locale === "cs" ? "lokálně" : "local") : "cloud"}</small></span><span className="model-picker-availability">{!item.available ? (locale === "cs" ? "Nedostupný" : "Unavailable") : recentModelKeys.includes(item.key) ? (locale === "cs" ? "Nedávný" : "Recent") : ""}</span></button>)}
        {!modelsLoading && visible.length === 0 && <p className="model-picker-empty">{modelError ? (locale === "cs" ? "Katalog modelů není dostupný. Spusťte API a zkuste obnovit." : "Model catalog unavailable. Start the API and refresh.") : (locale === "cs" ? "Žádný odpovídající model." : "No matching model.")}</p>}
      </div>
      <button className="model-picker-refresh" type="button" onClick={() => void refreshModels(true)}>{locale === "cs" ? "Obnovit nabídku" : "Refresh models"}</button>
    </div>}
  </div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, resolvedTheme, setTheme, t } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(pathname.startsWith("/ai-lab"));
  const activeLab = labEntries.find((item) => pathname === labHref(item.slug));
  const [openGroup, setOpenGroup] = useState<LabGroup | null>(activeLab?.group ?? null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (activeLab) queueMicrotask(() => { setLabsOpen(true); setOpenGroup(activeLab.group); });
  }, [activeLab]);
  const destinations = [
    ...primary.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) })),
    { href: "/ai-lab", label: t("nav.aiLab") },
    ...labEntries.map((item) => ({ href: labHref(item.slug), label: locale === "cs" ? item.cs : item.en })),
    ...[{ href: "/reviews", key: "reviews" }, ...checks, { href: "/settings", key: "settings" }, { href: "/docs", key: "documentation" }].map((item) => ({ href: item.href, label: t(`nav.${item.key}`) })),
  ];
  const searchResults = query.trim() ? destinations.filter((item) => `${item.label} ${item.href}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];

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
          <div className="nav-lab-heading"><Link href="/ai-lab" className={`nav-link ${pathname === "/ai-lab" ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Beaker size={18} strokeWidth={1.8} /><span>{t("nav.aiLab")}</span></Link><button type="button" aria-label={locale === "cs" ? "Rozbalit AI laboratoř" : "Expand AI Lab"} aria-expanded={labsOpen} onClick={() => setLabsOpen((value) => !value)}>{labsOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button></div>
          {labsOpen && (
            <div className="nav-lab-groups">
              {labGroups.map((group) => <div key={group.id} className="nav-lab-group"><button type="button" className="nav-lab-group-trigger" aria-expanded={openGroup === group.id} onClick={() => setOpenGroup((current) => current === group.id ? null : group.id)}><span>{locale === "cs" ? group.cs : group.en}</span>{openGroup === group.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>{openGroup === group.id && <div className="nav-subgroup">{labEntries.filter((item) => item.group === group.id).map((item) => <Link key={item.slug} href={labHref(item.slug)} className={`nav-link nav-sublink ${pathname === labHref(item.slug) ? "active" : ""}`} onClick={() => setMobileOpen(false)}><span>{locale === "cs" ? item.cs : item.en}</span></Link>)}</div>}</div>)}
            </div>
          )}
          <Link href="/reviews" className={`nav-link ${active("/reviews") ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
            <FileText size={18} strokeWidth={1.8} /><span>{t("nav.reviews")}</span>
          </Link>
          {checks.map(({ href, key, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${active(href) ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <Icon size={18} strokeWidth={1.8} /><span>{t(`nav.${key}`)}</span>
            </Link>
          ))}
        </nav>

        <div className="nav-footer">
          <Link href="/settings" className={`nav-link ${active("/settings") ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Settings size={18} /><span>{t("nav.settings")}</span></Link>
          <Link href="/docs" className={`nav-link ${active("/docs") ? "active" : ""}`} onClick={() => setMobileOpen(false)}><CircleHelp size={18} /><span>{t("nav.documentation")}</span></Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs"><strong>{activeLab ? locale === "cs" ? activeLab.cs : activeLab.en : pathname === "/ai-lab" ? t("nav.aiLab") : pathname === "/" ? t("nav.overview") : t(`nav.${routeKey(pathname)}`)}</strong></div>
          <div className="search-shell">
            <label className="global-search"><Search size={16} /><span className="sr-only">{t("app.search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && searchResults[0]) { router.push(searchResults[0].href); setQuery(""); } }} placeholder={t("app.search")} /></label>
            {query && <div className="search-results">{searchResults.length ? searchResults.map((item) => <Link key={item.href} href={item.href} onClick={() => setQuery("")}><span>{item.label}</span><small className="mono">{item.href}</small></Link>) : <span>{t("common.noResults")}</span>}</div>}
          </div>
          <ModelPicker />
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
  if (pathname.includes("flappy")) return "flappy";
  if (pathname.includes("training")) return "training";
  if (pathname.startsWith("/experiments")) return "history";
  return pathname.split("/")[1] || "overview";
}
