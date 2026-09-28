"use client";

import { Check, ChevronDown, CircleAlert, Info, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "./app-provider";
import { getHelpContent, type HelpContext } from "@/lib/help-content";
import type { ExecutionMode } from "@/lib/types";

export function InfoTip({ label, helpKey, context = "control" }: { label: string; helpKey?: string; context?: HelpContext }) {
  const { locale } = useApp();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const copy = getHelpContent(helpKey, label, locale, context);
  const [position, setPosition] = useState({ left: 0, top: 0, above: false });

  const updatePosition = useCallback(() => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 28);
    const half = width / 2;
    const above = window.innerHeight - rect.bottom < 230 && rect.top > 230;
    setPosition({
      left: Math.max(14 + half, Math.min(window.innerWidth - 14 - half, rect.left + rect.width / 2)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
    });
  }, []);

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", closeOutside, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", closeOutside, true); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open, updatePosition]);

  const popover = open && typeof document !== "undefined" ? createPortal(
    <span id={id} className={`info-tip-popover info-tip-portal ${position.above ? "is-above" : ""}`} role="tooltip" style={{ left: position.left, top: position.top }}><strong>{copy.title}</strong><span>{copy.description}</span><em><b>{locale === "cs" ? "Příklad" : "Example"}</b>{copy.example}</em></span>,
    document.body,
  ) : null;

  return <>
    <span ref={root} className={`info-tip ${open ? "is-open" : ""}`}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) setOpen(false); }}
      onFocus={show}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      {/* The role button preserves the enclosing label's association with its input. */}
      <span role="button" tabIndex={0} className="info-tip-trigger"
        aria-label={locale === "cs" ? `Více informací: ${copy.title}` : `More information: ${copy.title}`}
        aria-expanded={open} aria-describedby={open ? id : undefined}
        onPointerDown={(event) => { if (event.pointerType === "touch") event.preventDefault(); event.stopPropagation(); }}
        onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.focus(); show(); }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); show(); } }}>
        <Info size={13} strokeWidth={2.2} />
      </span>
    </span>
    {popover}
  </>;
}

export function Combobox({ value, options, onChange, ariaLabel, helpKey, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; ariaLabel: string; helpKey: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filtering, setFiltering] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const filtered = options.filter((option) => option.toLowerCase().includes(value.toLowerCase()));
  const visibleOptions = filtering ? filtered : options;

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, []);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    setActiveIndex(0);
    setFiltering(false);
  };

  return <><div className={`combobox ${open ? "is-open" : ""}`} ref={root}>
    <input aria-label={ariaLabel} role="combobox" aria-autocomplete="list" aria-controls={id} aria-expanded={open} aria-activedescendant={open && visibleOptions[activeIndex] ? `${id}-${activeIndex}` : undefined} value={value} disabled={disabled} autoComplete="off" onFocus={() => { if (!disabled) { setFiltering(false); setOpen(true); } }} onChange={(event) => { onChange(event.target.value); setActiveIndex(0); setFiltering(true); setOpen(true); }} onKeyDown={(event) => {
      if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, visibleOptions.length - 1)); }
      if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
      if (event.key === "Enter" && open && visibleOptions[activeIndex]) { event.preventDefault(); choose(visibleOptions[activeIndex]); }
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    }} />
    <button type="button" className="combobox-toggle" aria-label={`${ariaLabel}: ${open ? "close options" : "open options"}`} aria-expanded={open} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { setFiltering(false); setActiveIndex(0); setOpen((value) => !value); }}><ChevronDown size={14} /></button>
    {open && visibleOptions.length > 0 && <div className="combobox-menu" id={id} role="listbox" aria-label={`${ariaLabel} options`}>{visibleOptions.map((option, index) => <button type="button" id={`${id}-${index}`} role="option" aria-selected={option === value} className={index === activeIndex ? "active" : ""} key={option} onMouseEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}><span>{option}</span>{option === value && <Check size={13} />}</button>)}</div>}
  </div><InfoTip label={ariaLabel} helpKey={helpKey} context="field" /></>;
}

export function HelpLabel({ label, helpKey }: { label: string; helpKey: string }) {
  const { locale } = useApp();
  const copy = getHelpContent(helpKey, label, locale, "field");
  return <span className="field-help-label"><span className="field-help-title"><span>{label}</span><InfoTip label={label} helpKey={helpKey} context="field" /></span><small className="field-help-example" aria-hidden="true">{locale === "cs" ? "Příklad: " : "Example: "}{copy.example}</small></span>;
}

export function RunStatus({ status }: { status: string }) {
  const normalized = status === "completed" ? "complete" : status;
  return <span className="run-status" data-status={status}>{normalized}</span>;
}

export function AnswerReveal({ answer, locale, initiallyOpen = false, code = false }: { answer: string; locale: "cs" | "en"; initiallyOpen?: boolean; code?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return <div className={`answer-reveal ${code ? "is-code" : ""}`}>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">{open ? "▾" : "▸"}</span>{locale === "cs" ? open ? "Skrýt odpověď" : "Zobrazit odpověď" : open ? "Hide answer" : "Show answer"}</button>
    {open && <pre id={id}>{answer}</pre>}
  </div>;
}

export function MetricLabel({ label, helpKey }: { label: string; helpKey?: string }) {
  return <span className="metric-help-label"><span>{label}</span><InfoTip label={label} helpKey={helpKey} context="metric" /></span>;
}

export function TableHeading({ label, helpKey }: { label: string; helpKey?: string }) {
  return <th><MetricLabel label={label} helpKey={helpKey} /></th>;
}

export function DefinitionTerm({ label, helpKey }: { label: string; helpKey?: string }) {
  return <dt><MetricLabel label={label} helpKey={helpKey} /></dt>;
}

export function PageHeader({ eyebrow, title, description, actions, helpKey }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode; helpKey?: string }) {
  return (
    <div className="page-header">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<div className="page-title-row"><h1>{title}</h1><InfoTip label={title} helpKey={helpKey} context="section" /></div><p>{description}</p></div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Button({ children, variant = "primary", loading = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger"; loading?: boolean }) {
  return <button {...props} className={`button button-${variant} ${props.className ?? ""}`} disabled={loading || props.disabled}>{loading && <LoaderCircle className="spin" size={15} />}{children}</button>;
}

export function ModeSelector({ value, onChange, includeFixture = true }: { value: ExecutionMode; onChange: (value: ExecutionMode) => void; includeFixture?: boolean }) {
  const { t } = useApp();
  const values: ExecutionMode[] = includeFixture ? ["fixture", "local", "cloud"] : ["local", "cloud"];
  return <div className="control-with-help"><div className="segmented">{values.map((item) => <button key={item} className={value === item ? "active" : ""} onClick={() => onChange(item)} aria-pressed={value === item}>{t(`app.${item}`)}</button>)}</div><InfoTip label={t("app.mode")} helpKey="common.executionMode" /></div>;
}

export function ProvenanceStrip({ mode, model = "model-medium", provider = "OpenAI-compatible", tail = "support-v4 · prompt-v18" }: { mode: ExecutionMode; model?: string; provider?: string; tail?: string }) {
  const { t } = useApp();
  return <div className="provenance" aria-label="Result provenance"><span className={`mode-badge mode-${mode}`}>{t(`app.${mode}`)}</span><i /><span>{provider}</span><i /><span className="mono">{model}</span><i /><span>{tail}</span><InfoTip label="Result provenance" helpKey="common.provenance" context="metric" /><span className="provenance-note">{mode === "fixture" ? t("app.comingFromFixture") : ""}</span></div>;
}

export function Panel({ title, aside, children, className = "", helpKey }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string; helpKey?: string }) {
  return <section className={`panel ${className}`}>{title && <header className="panel-header"><div className="panel-title-row"><h2>{title}</h2><InfoTip label={title} helpKey={helpKey} context="section" /></div>{aside}</header>}<div className="panel-body">{children}</div></section>;
}

export function Select({ value, onChange, children, ariaLabel, helpKey, disabled = false }: { value: string; onChange?: (value: string) => void; children: React.ReactNode; ariaLabel: string; helpKey: string; disabled?: boolean }) {
  return <div className="control-with-help"><div className="select-wrap"><select aria-label={ariaLabel} value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value)}>{children}</select><ChevronDown size={14} /></div><InfoTip label={ariaLabel} helpKey={helpKey} context="field" /></div>;
}

export function StatusMark({ result }: { result: "pass" | "fail" | "neutral" }) {
  if (result === "pass") return <span className="status-mark success" aria-label="Pass"><Check size={12} /></span>;
  if (result === "fail") return <span className="status-mark danger" aria-label="Fail"><X size={12} /></span>;
  return <span className="status-mark neutral" aria-label="No gate">—</span>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "danger" | "warning" | "success"; title: string; children: React.ReactNode }) {
  return <div className={`notice notice-${tone}`}><CircleAlert size={18} /><div><strong>{title}</strong><p>{children}</p></div></div>;
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><h2 id="dialog-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>{children}</section></div>;
}

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "red" | "gray" }) {
  return <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}
