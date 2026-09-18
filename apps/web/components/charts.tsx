"use client";

import ReactECharts from "echarts-for-react";
import { useApp } from "@/components/app-provider";
import { qualityTrend } from "@/lib/fixtures";

function useChartColors() {
  const { resolvedTheme } = useApp();
  return resolvedTheme === "dark"
    ? { inkSoft: "#aab5bf", line: "#35404a", grid: "#27313a", action: "#7da2ff", success: "#62d3a5", surface: "#151b21", muted: "#687580", pareto: "#c1cad2", tooltip: "#1b222a" }
    : { inkSoft: "#5f6469", line: "#d4d0c7", grid: "#e5e2db", action: "#275efe", success: "#167956", surface: "#fbfaf6", muted: "#b7bcc1", pareto: "#303944", tooltip: "#ffffff" };
}

export function QualityTrendChart() {
  const colors = useChartColors();
  return <ReactECharts style={{ height: 260 }} option={{
    animationDuration: 260,
    grid: { left: 46, right: 14, top: 20, bottom: 38 },
    tooltip: { trigger: "axis", valueFormatter: (value: unknown) => `${value}%`, backgroundColor: colors.tooltip, borderColor: colors.line, textStyle: { color: colors.inkSoft } },
    xAxis: { type: "category", boundaryGap: false, data: ["Aug 12", "Aug 14", "Aug 16", "Aug 18", "Aug 20", "Aug 22", "Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07", "Sep 08", "Sep 09", "Sep 10", "Sep 11", "Sep 12"], axisLine: { lineStyle: { color: colors.line } }, axisTick: { show: false }, axisLabel: { color: colors.inkSoft, interval: 3, fontFamily: "IBM Plex Mono" } },
    yAxis: { type: "value", min: 60, max: 100, axisLabel: { color: colors.inkSoft, formatter: "{value}%", fontFamily: "IBM Plex Mono" }, splitLine: { lineStyle: { color: colors.grid } } },
    series: [{ type: "line", data: qualityTrend, smooth: 0.18, symbolSize: 6, lineStyle: { width: 2, color: colors.action }, itemStyle: { color: colors.surface, borderColor: colors.action, borderWidth: 2 }, areaStyle: { color: colors.action, opacity: 0.06 } }],
  }} />;
}

export function CostQualityChart({ compact = false }: { compact?: boolean }) {
  const colors = useChartColors();
  const gray = [[0.002, 0.71], [0.003, 0.76], [0.0043, 0.881], [0.005, 0.84], [0.006, 0.86], [0.008, 0.88], [0.012, 0.872], [0.015, 0.89], [0.019, 0.9], [0.025, 0.91]];
  const current = [[0.0021, 0.847], [0.0041, 0.914], [0.0062, 0.892], [0.011, 0.903]];
  return <ReactECharts style={{ height: compact ? 220 : 260 }} option={{
    animationDuration: 260,
    grid: { left: 50, right: 18, top: 22, bottom: 46 },
    tooltip: { trigger: "item", formatter: (params: { value: number[]; seriesName: string }) => `${params.seriesName}<br/>$${params.value[0]} / req<br/>${(params.value[1] * 100).toFixed(1)}% quality`, backgroundColor: colors.tooltip, borderColor: colors.line, textStyle: { color: colors.inkSoft } },
    xAxis: { type: "log", name: "Cost / request (USD)", nameLocation: "middle", nameGap: 30, min: 0.001, max: 0.04, nameTextStyle: { color: colors.inkSoft }, axisLabel: { color: colors.inkSoft, fontFamily: "IBM Plex Mono" }, splitLine: { lineStyle: { color: colors.grid } }, axisLine: { lineStyle: { color: colors.line } } },
    yAxis: { type: "value", name: "Quality", min: 0.65, max: 1, nameTextStyle: { color: colors.inkSoft }, axisLabel: { color: colors.inkSoft, formatter: (value: number) => `${Math.round(value * 100)}%`, fontFamily: "IBM Plex Mono" }, splitLine: { lineStyle: { color: colors.grid } } },
    series: [
      { name: "Other experiments", type: "scatter", data: gray, symbolSize: 8, itemStyle: { color: colors.muted } },
      { name: "Current runs", type: "scatter", data: current, symbolSize: 13, itemStyle: { color: colors.action, borderColor: colors.surface, borderWidth: 2 } },
      { name: "Pareto frontier", type: "line", data: [[0.0012, 0.7], [0.0021, 0.847], [0.0041, 0.914], [0.02, 0.955]], symbol: "none", lineStyle: { color: colors.pareto, width: 1.5, type: "dashed" } },
    ],
  }} />;
}

export function TrainingChart({ epochs = 8 }: { epochs?: number }) {
  const colors = useChartColors();
  const allTrain = [0.82, 0.61, 0.46, 0.35, 0.28, 0.22, 0.17, 0.13, 0.1, 0.08, 0.06, 0.05];
  const allValidation = [0.86, 0.66, 0.53, 0.44, 0.4, 0.39, 0.41, 0.45, 0.5, 0.56, 0.61, 0.68];
  return <ReactECharts style={{ height: 280 }} option={{
    animationDuration: 240,
    grid: { left: 48, right: 18, top: 28, bottom: 38 },
    tooltip: { trigger: "axis", backgroundColor: colors.tooltip, borderColor: colors.line, textStyle: { color: colors.inkSoft } },
    legend: { top: 0, right: 0, textStyle: { color: colors.inkSoft } },
    xAxis: { type: "category", name: "Epoch", nameTextStyle: { color: colors.inkSoft }, data: allTrain.slice(0, epochs).map((_, index) => index + 1), axisLine: { lineStyle: { color: colors.line } }, axisLabel: { color: colors.inkSoft } },
    yAxis: { type: "value", name: "Loss", nameTextStyle: { color: colors.inkSoft }, min: 0, max: 1, splitLine: { lineStyle: { color: colors.grid } }, axisLabel: { color: colors.inkSoft } },
    series: [
      { name: "Train", type: "line", data: allTrain.slice(0, epochs), symbolSize: 6, lineStyle: { color: colors.action, width: 2 }, itemStyle: { color: colors.action } },
      { name: "Validation", type: "line", data: allValidation.slice(0, epochs), symbolSize: 6, lineStyle: { color: colors.success, width: 2 }, itemStyle: { color: colors.success } },
    ],
  }} />;
}

export function EmbeddingChart({ points }: { points: { name: string; value: [number, number]; score: number }[] }) {
  const colors = useChartColors();
  return <ReactECharts style={{ height: 320 }} option={{
    animationDuration: 260,
    grid: { left: 25, right: 25, top: 20, bottom: 25 },
    tooltip: { formatter: (params: { data: { name: string; score: number } }) => `${params.data.name}<br/>similarity ${params.data.score.toFixed(3)}`, backgroundColor: colors.tooltip, borderColor: colors.line, textStyle: { color: colors.inkSoft } },
    xAxis: { type: "value", min: -1, max: 1, axisLabel: { show: false }, splitLine: { lineStyle: { color: colors.grid } } },
    yAxis: { type: "value", min: -1, max: 1, axisLabel: { show: false }, splitLine: { lineStyle: { color: colors.grid } } },
    series: [{ type: "scatter", data: points.map((point, index) => ({ ...point, symbolSize: index === 0 ? 20 : 12, itemStyle: { color: index === 0 ? colors.success : colors.action, borderColor: colors.surface, borderWidth: 2 }, label: { show: true, formatter: point.name, position: "top", color: colors.inkSoft, fontSize: 11 } })) }],
  }} />;
}
