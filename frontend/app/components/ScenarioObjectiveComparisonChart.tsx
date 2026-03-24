"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Scenario } from "../types";

declare global {
  interface Window {
    __WHAT_IF_COMPARE_CHART_DEBUG__?: {
      isFlatObjectives: boolean;
      dataMin: number;
      dataMax: number;
      yMin?: number;
      yMax?: number;
      names: string[];
      values: Array<number | null>;
    };
  }
}

function formatChartNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e7)) {
    return n.toExponential(2);
  }
  const rounded = Math.round(n * 1e6) / 1e6;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded
    .toFixed(4)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
}

export interface ScenarioObjectiveComparisonChartProps {
  scenarios: Scenario[];
  className?: string;
}

export default function ScenarioObjectiveComparisonChart({
  scenarios,
  className = "",
}: ScenarioObjectiveComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const echartsInstanceRef = useRef<any>(null);
  const [echartsReadyToken, setEchartsReadyToken] = useState(0);
  const [flatOverlayPixels, setFlatOverlayPixels] = useState<{
    width: number;
    height: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    points: Array<{ x: number; y: number }>;
  } | null>(null);

  const chartInstanceKey = useMemo(
    () =>
      scenarios
        .map((s) => `${s.id}:${s.optimizationResult?.objectiveValue ?? ""}`)
        .join("|"),
    [scenarios]
  );

  const flatOverlay = useMemo(() => {
    const names = scenarios.map((s) => s.name || `Scenario ${s.id}`);
    const values = scenarios.map((s) => {
      const raw = s.optimizationResult?.objectiveValue;
      if (raw == null) return null;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    });

    const numericValues = values.filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    if (numericValues.length < 2) return null;
    const dataMin = Math.min(...numericValues);
    const dataMax = Math.max(...numericValues);
    if (dataMin !== dataMax) return null;

    // Mirror the yMin/yMax padding used in the ECharts option for flat objectives.
    const base = Math.abs(dataMin);
    const pad = base === 0 ? 1 : Math.max(base * 0.08, 1e-6);
    return {
      names,
      value: dataMin,
      yMin: dataMin - pad,
      yMax: dataMax + pad,
    };
  }, [scenarios]);

  useLayoutEffect(() => {
    if (!flatOverlay) {
      setFlatOverlayPixels(null);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const instance = echartsInstanceRef.current;
    const names = flatOverlay.names;
    const y = flatOverlay.value;

    const topPx = 48;
    const bottomPx = 40;
    const leftPct = 3;
    const rightPct = 4;

    const plotWpx = rect.width * (1 - (leftPct + rightPct) / 100);
    const plotHpx = rect.height - topPx - bottomPx;
    const denom = (flatOverlay.yMax - flatOverlay.yMin) || 1;

    // Deterministic fallback that gives each category tick a center point.
    const xFallback = names.map((_, i) => {
      return rect.width * (leftPct / 100) + ((i + 0.5) / names.length) * plotWpx;
    });
    const yFallback =
      topPx + ((flatOverlay.yMax - y) / denom) * plotHpx;

    const points = xFallback.map((x) => ({ x, y: yFallback }));

    // If the ECharts instance is ready, use convertToPixel for pixel-perfect
    // alignment; otherwise keep the fallback.
    if (instance) {
      let yPix = instance.convertToPixel({ yAxisIndex: 0 }, y);
      if (!Number.isFinite(yPix)) yPix = yFallback;

      const xRaw = names.map((n) => {
        try {
          return instance.convertToPixel({ xAxisIndex: 0 }, n);
        } catch {
          return NaN;
        }
      });

      for (let i = 0; i < xRaw.length; i++) {
        if (Number.isFinite(xRaw[i])) {
          points[i].x = xRaw[i];
          points[i].y = yPix;
        } else {
          points[i].y = yPix;
        }
      }
    }

    const x1 = points[0]?.x ?? 0;
    const y1 = points[0]?.y ?? 0;
    const x2 = points[points.length - 1]?.x ?? 0;
    const y2 = points[points.length - 1]?.y ?? 0;

    setFlatOverlayPixels({
      width: rect.width,
      height: rect.height,
      x1,
      y1,
      x2,
      y2,
      points,
    });
  }, [flatOverlay, echartsReadyToken]);

  const option = useMemo((): EChartsOption => {
    const names = scenarios.map((s) => s.name || `Scenario ${s.id}`);
    const values = scenarios.map((s) => {
      const raw = s.optimizationResult?.objectiveValue;
      if (raw == null) return null;
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    });
    const lineData = names.map((n, i) =>
      values[i] == null ? null : ([n, values[i]!] as [string, number])
    );
    const numericValues = values.filter(
      (v): v is number => v !== null && Number.isFinite(v)
    );
    const dataMin = numericValues.length ? Math.min(...numericValues) : 0;
    const dataMax = numericValues.length ? Math.max(...numericValues) : 0;
    // Category line series often renders a stub when every Y is identical; use bars
    // so every scenario is visible at the same optimum.
    const isFlatObjectives =
      numericValues.length >= 2 && dataMin === dataMax;
    let yMin: number | undefined;
    let yMax: number | undefined;
    if (numericValues.length === 0) {
      yMin = undefined;
      yMax = undefined;
    } else if (dataMin === dataMax) {
      // Single level (common when optimum is identical across scenarios): expand
      // scale so the line and symbols are not degenerate / clipped.
      const base = Math.abs(dataMin);
      const pad = base === 0 ? 1 : Math.max(base * 0.08, 1e-6);
      yMin = dataMin - pad;
      yMax = dataMax + pad;
    } else if (dataMin < 0 && dataMax > 0) {
      yMin = undefined;
      yMax = undefined;
    } else if (dataMin >= 0) {
      yMin = 0;
      yMax = undefined;
    } else {
      yMin = undefined;
      yMax = 0;
    }

    if (typeof window !== "undefined") {
      window.__WHAT_IF_COMPARE_CHART_DEBUG__ = {
        isFlatObjectives,
        dataMin,
        dataMax,
        yMin,
        yMax,
        names,
        values,
      };
    }

    const xRotate = names.length > 8;

    return {
      // Disable animations so Playwright screenshots capture the fully rendered chart.
      animation: false,
      color: ["#60a5fa"],
      backgroundColor: "transparent",
      textStyle: { color: "rgba(255,255,255,0.85)" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,23,42,0.92)",
        borderColor: "rgba(255,255,255,0.12)",
        textStyle: { color: "#e2e8f0" },
        valueFormatter: (value) => {
          const n = Number(value);
          return Number.isFinite(n) ? formatChartNumber(n) : "—";
        },
      },
      grid: {
        left: "3%",
        right: "4%",
        top: 48,
        bottom: xRotate ? 72 : 40,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        name: "Scenario",
        nameLocation: "middle",
        nameGap: xRotate ? 48 : 32,
        nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
        data: names,
        boundaryGap: isFlatObjectives ? true : false,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.7)",
          rotate: xRotate ? 30 : 0,
          interval: 0,
          hideOverlap: names.length > 12,
          formatter: (val: string) =>
            val.length > 18 ? `${val.slice(0, 16)}…` : val,
        },
      },
      yAxis: {
        type: "value",
        name: "Objective value",
        nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
        min: yMin,
        max: yMax,
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.65)",
          formatter: (value: number) => formatChartNumber(value),
        },
      },
      series: isFlatObjectives
        ? [
            {
              type: "bar",
              name: "Objective",
              data: values,
              barMaxWidth: 40,
              // When all objective values are identical we raise `yAxis.min` above 0.
              // ECharts bars default to base=0, which can get clipped away, so pin the
              // baseline to the visible minimum.
              base: yMin,
              silent: true,
              itemStyle: {
                color: "transparent",
                borderRadius: [6, 6, 0, 0],
                borderWidth: 0,
                borderColor: "transparent",
                opacity: 0,
              },
              emphasis: { focus: "none" },
            },
          ]
        : [
            {
              type: "line",
              name: "Objective",
              data: lineData,
              connectNulls: false,
              smooth: false,
              showSymbol: true,
              symbol: "circle",
              symbolSize: 10,
              lineStyle: { width: 2, color: "#60a5fa" },
              itemStyle: {
                color: "#60a5fa",
                borderWidth: 1,
                borderColor: "#1e293b",
              },
              emphasis: { focus: "series" },
              sampling: "none",
            },
          ],
    };
  }, [scenarios]);

  const scenarioObjective = (s: (typeof scenarios)[0]) => {
    const raw = s.optimizationResult?.objectiveValue;
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const hasAnyPoint = scenarios.some((s) => scenarioObjective(s) != null);
  const resultCount = scenarios.filter((s) => scenarioObjective(s) != null).length;

  if (!hasAnyPoint) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-white/50 text-sm min-h-[320px] ${className}`}
      >
        <p>No optimization results yet.</p>
        <p className="mt-1 text-white/40 text-xs">
          Run optimization on one or more scenarios to see objective values
          here.
        </p>
      </div>
    );
  }

  // Explicit pixel height: height:100% with only min-height on ancestors often
  // resolves to 0, so ECharts initializes a zero-height canvas and draws nothing.
  const chartHeightPx = 360;
  const topPx = 48;
  const bottomPx = 40;
  const plotHpx = chartHeightPx - topPx - bottomPx;

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        style={{
          height: chartHeightPx,
          minHeight: chartHeightPx,
          position: "relative",
          width: "100%",
        }}
      >
        <ReactECharts
          key={chartInstanceKey}
          option={option}
          notMerge
          lazyUpdate={false}
          style={{ width: "100%", height: chartHeightPx }}
          opts={{ renderer: "canvas" }}
          onChartReady={(instance) => {
            echartsInstanceRef.current = instance;
            setEchartsReadyToken((t) => t + 1);
          }}
        />
        {flatOverlayPixels && flatOverlay ? (
          <svg
            aria-hidden
            data-testid="flat-overlay-svg"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
            viewBox={`0 0 ${flatOverlayPixels.width} ${flatOverlayPixels.height}`}
          >
            <line
              x1={flatOverlayPixels.x1}
              y1={flatOverlayPixels.y1}
              x2={flatOverlayPixels.x2}
              y2={flatOverlayPixels.y2}
              stroke="#60a5fa"
              strokeWidth={3}
              strokeOpacity={0.2}
            />
            <line
              x1={flatOverlayPixels.x1}
              y1={flatOverlayPixels.y1}
              x2={flatOverlayPixels.x2}
              y2={flatOverlayPixels.y2}
              stroke="#60a5fa"
              strokeWidth={2}
              strokeOpacity={0.95}
            />
            {flatOverlayPixels.points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={4}
                fill="#60a5fa"
                stroke="#1e293b"
                strokeWidth={1}
                data-testid="flat-overlay-point"
              />
            ))}
          </svg>
        ) : null}
      </div>
      {resultCount < scenarios.length ? (
        <p className="mt-2 text-center text-white/45 text-xs">
          Showing {resultCount} of {scenarios.length} scenarios with objective values — run
          optimization on the rest to fill the chart.
        </p>
      ) : null}
    </div>
  );
}
