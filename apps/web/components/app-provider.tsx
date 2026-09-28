"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate } from "@/lib/i18n";
import type { ExecutionMode, Locale, ThemePreference } from "@/lib/types";

export interface CatalogModel {
  key: string;
  provider: string;
  id: string;
  mode: "local" | "cloud";
  capabilities: string[] | Record<string, boolean>;
  available: boolean;
  context_window?: number | null;
}

function isGenerative(model: CatalogModel) {
  return Array.isArray(model.capabilities)
    ? model.capabilities.includes("generation")
    : model.capabilities?.generation === true;
}

interface AppContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  mode: ExecutionMode;
  setMode: (mode: ExecutionMode) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  theme: ThemePreference;
  resolvedTheme: Exclude<ThemePreference, "system">;
  setTheme: (value: ThemePreference) => void;
  projectName: string | null;
  setProjectName: (value: string | null) => void;
  plainLanguage: boolean;
  setPlainLanguage: (value: boolean) => void;
  models: CatalogModel[];
  modelError: string | null;
  modelsLoading: boolean;
  selectedModelKey: string | null;
  selectedModel: CatalogModel | null;
  recentModelKeys: string[];
  setSelectedModelKey: (key: string) => void;
  refreshModels: (force?: boolean) => Promise<void>;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mode, setModeState] = useState<ExecutionMode>("local");
  const [reduceMotion, setReduceMotionState] = useState(false);
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [projectName, setProjectNameState] = useState<string | null>(null);
  const [plainLanguage, setPlainLanguageState] = useState(false);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModelKey, setSelectedModelKeyState] = useState<string | null>(null);
  const [recentModelKeys, setRecentModelKeys] = useState<string[]>([]);

  const refreshModels = useCallback(async (force = false) => {
    setModelsLoading(true);
    try {
      const response = await fetch(force ? "/api/v1/models?refresh=true" : "/api/v1/models", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { models?: CatalogModel[] };
      if (!Array.isArray(data.models)) throw new Error("Invalid model catalog");
      setModels(data.models.filter((model) => model && typeof model.key === "string" && typeof model.id === "string"));
      setModelError(null);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Model catalog unavailable");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void refreshModels()); }, [refreshModels]);

  useEffect(() => {
    const hydratePreferences = () => {
      const storedLocale = window.localStorage.getItem("llmlab.locale") as Locale | null;
      const storedMode = window.localStorage.getItem("llmlab.mode") as ExecutionMode | null;
      const storedMotion = window.localStorage.getItem("llmlab.reduceMotion");
      const storedTheme = window.localStorage.getItem("llmlab.theme") as ThemePreference | null;
      const storedProjectName = window.localStorage.getItem("llmlab.projectName");
      const browserLocale: Locale = navigator.language.toLowerCase().startsWith("cs") ? "cs" : "en";
      setLocaleState(storedLocale === "cs" || storedLocale === "en" ? storedLocale : browserLocale);
      if (storedMode === "fixture" || storedMode === "local" || storedMode === "cloud") setModeState(storedMode);
      setSelectedModelKeyState(window.localStorage.getItem("llmlab.selectedModel"));
      try {
        const recent = JSON.parse(window.localStorage.getItem("llmlab.recentModels") ?? "[]") as unknown;
        if (Array.isArray(recent)) setRecentModelKeys(recent.filter((item): item is string => typeof item === "string").slice(0, 6));
      } catch { /* Corrupt local preference: use catalog order. */ }
      setReduceMotionState(storedMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setThemeState(storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system");
      setProjectNameState(storedProjectName?.trim() || null);
      setPlainLanguageState(window.localStorage.getItem("llmlab.plainLanguage.v1") === "true");
    };
    queueMicrotask(hydratePreferences);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const next = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      setResolvedTheme(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    document.documentElement.dataset.hydrated = "true";
  }, [locale, reduceMotion]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem("llmlab.locale", next);
    document.documentElement.lang = next;
  }, []);

  const setMode = useCallback((next: ExecutionMode) => {
    setModeState(next);
    window.localStorage.setItem("llmlab.mode", next);
  }, []);

  const setSelectedModelKey = useCallback((key: string) => {
    const model = models.find((item) => item.key === key && item.available && isGenerative(item));
    if (!model) return;
    setSelectedModelKeyState(key);
    setMode(model.mode);
    window.localStorage.setItem("llmlab.selectedModel", key);
    setRecentModelKeys((current) => {
      const next = [key, ...current.filter((item) => item !== key)].slice(0, 6);
      window.localStorage.setItem("llmlab.recentModels", JSON.stringify(next));
      return next;
    });
  }, [models, setMode]);

  const selectedModel = models.find((item) => item.key === selectedModelKey && item.available && isGenerative(item) && item.mode === mode)
    ?? models.find((item) => item.available && isGenerative(item) && item.mode === mode)
    ?? null;

  const setReduceMotion = useCallback((next: boolean) => {
    setReduceMotionState(next);
    window.localStorage.setItem("llmlab.reduceMotion", String(next));
    document.documentElement.dataset.reduceMotion = String(next);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem("llmlab.theme", next);
  }, []);

  const setProjectName = useCallback((next: string | null) => {
    const normalized = next?.trim() || null;
    setProjectNameState(normalized);
    if (normalized) window.localStorage.setItem("llmlab.projectName", normalized);
    else window.localStorage.removeItem("llmlab.projectName");
  }, []);
  const setPlainLanguage = useCallback((next: boolean) => {
    setPlainLanguageState(next);
    window.localStorage.setItem("llmlab.plainLanguage.v1", String(next));
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);
  const value = useMemo(() => ({ locale, setLocale, mode, setMode, reduceMotion, setReduceMotion, theme, resolvedTheme, setTheme, projectName, setProjectName, plainLanguage, setPlainLanguage, models, modelError, modelsLoading, selectedModelKey, selectedModel, recentModelKeys, setSelectedModelKey, refreshModels, t }), [locale, setLocale, mode, setMode, reduceMotion, setReduceMotion, theme, resolvedTheme, setTheme, projectName, setProjectName, plainLanguage, setPlainLanguage, models, modelError, modelsLoading, selectedModelKey, selectedModel, recentModelKeys, setSelectedModelKey, refreshModels, t]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </QueryClientProvider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
