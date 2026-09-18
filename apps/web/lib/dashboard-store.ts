"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RunRecord } from "./types";
import { recentRuns } from "./fixtures";

const RUNS_KEY = "llmlab.dashboard.runs";
const FIXTURES_KEY = "llmlab.dashboard.showFixtures";

function readRuns(): RunRecord[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(RUNS_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter(isRunRecord) : [];
  } catch {
    return [];
  }
}

function isRunRecord(value: unknown): value is RunRecord {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<RunRecord>;
  return typeof run.id === "string" && typeof run.date === "string" && typeof run.model === "string" &&
    typeof run.prompt === "string" && typeof run.quality === "number" && typeof run.passRate === "number" &&
    (typeof run.cost === "number" || run.cost === null) && typeof run.latency === "number" &&
    run.status === "completed" && (run.mode === "fixture" || run.mode === "local" || run.mode === "cloud");
}

export function useDashboardData() {
  const [userRuns, setUserRuns] = useState<RunRecord[]>([]);
  const [showFixtures, setShowFixtures] = useState(true);

  useEffect(() => {
    queueMicrotask(() => {
      setUserRuns(readRuns());
      setShowFixtures(window.localStorage.getItem(FIXTURES_KEY) !== "false");
    });
  }, []);

  const addUserRun = useCallback((run: RunRecord) => {
    setUserRuns((current) => {
      if (current.some((item) => item.id === run.id)) return current;
      const next = [run, ...current];
      window.localStorage.setItem(RUNS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeUserRun = useCallback((id: string) => {
    setUserRuns((current) => {
      const next = current.filter((run) => run.id !== id);
      window.localStorage.setItem(RUNS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearFixtures = useCallback(() => {
    setShowFixtures(false);
    window.localStorage.setItem(FIXTURES_KEY, "false");
  }, []);

  const restoreFixtures = useCallback(() => {
    setShowFixtures(true);
    window.localStorage.setItem(FIXTURES_KEY, "true");
  }, []);

  const visibleRuns = useMemo(
    () => showFixtures ? [...userRuns, ...recentRuns] : userRuns,
    [showFixtures, userRuns],
  );

  return { userRuns, visibleRuns, showFixtures, addUserRun, removeUserRun, clearFixtures, restoreFixtures };
}
