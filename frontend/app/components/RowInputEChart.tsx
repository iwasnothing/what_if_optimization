"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

/** Human-readable axis/tooltip values (avoids FP noise and odd scientific notation). */
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

export interface RowInputEChartProps {
  /** One label per CSV row (legend / series name). */
  rowLabels: string[];
  /** X-axis categories: row-level input variable names. */
  inputVariableNames: string[];
  /** valueMatrix[rowIndex][varIndex] — tuned value for that row and variable. */
  valueMatrix: number[][];
  className?: string;
}

export default function RowInputEChart({
  rowLabels,
  inputVariableNames,
  valueMatrix,
  className = "",
}: RowInputEChartProps) {
  const option = useMemo((): EChartsOption => {
    const multiRow = rowLabels.length > 1;

    const singleVarManyRows = inputVariableNames.length === 1 && rowLabels.length > 1;
    const xName = singleVarManyRows ? "Row" : "Row-level input variable";
    const xRotate = singleVarManyRows
      ? rowLabels.length > 12
      : inputVariableNames.length > 5;

    const legendShow = singleVarManyRows ? false : multiRow;
    const legendTop = legendShow ? 8 : 0;
    const gridTop = legendShow ? 52 : 16;
    const xCount = singleVarManyRows ? rowLabels.length : inputVariableNames.length;
    const gridBottom = xCount > 8 ? 52 : 28;
    const useXDataZoom = !singleVarManyRows && xCount > 10;

    const valDim = inputVariableNames[0] ?? "value";

    const flatValues = singleVarManyRows
      ? rowLabels.map((_, i) => Number(valueMatrix[i]?.[0] ?? 0)).filter(Number.isFinite)
      : valueMatrix.flat().filter((v) => Number.isFinite(v));

    const dataMin = flatValues.length ? Math.min(...flatValues) : 0;
    const dataMax = flatValues.length ? Math.max(...flatValues) : 0;
    let yMin: number | undefined;
    let yMax: number | undefined;
    if (flatValues.length === 0) {
      yMin = undefined;
      yMax = undefined;
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

    const yAxis: EChartsOption["yAxis"] = {
      type: "value",
      name: "Optimized value",
      nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
      scale: false,
      min: yMin,
      max: yMax,
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
      axisLabel: {
        color: "rgba(255,255,255,0.65)",
        formatter: (value: number) => formatChartNumber(value),
      },
    };

    const base: Pick<
      EChartsOption,
      "color" | "backgroundColor" | "textStyle" | "tooltip" | "legend" | "grid" | "dataZoom"
    > = {
      color: [
        "#60a5fa",
        "#a78bfa",
        "#34d399",
        "#fbbf24",
        "#f472b6",
        "#22d3ee",
        "#fb923c",
        "#4ade80",
        "#e879f9",
        "#38bdf8",
      ],
      backgroundColor: "transparent",
      textStyle: { color: "rgba(255,255,255,0.85)" },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(15,23,42,0.92)",
        borderColor: "rgba(255,255,255,0.12)",
        textStyle: { color: "#e2e8f0" },
        valueFormatter: (value) => formatChartNumber(Number(value)),
      },
      legend: {
        show: legendShow,
        type: "scroll",
        orient: "horizontal",
        top: legendTop,
        left: "center",
        textStyle: { color: "rgba(255,255,255,0.75)" },
        pageTextStyle: { color: "rgba(255,255,255,0.6)" },
      },
      grid: {
        left: "3%",
        right: "4%",
        top: gridTop,
        bottom: gridBottom,
        containLabel: true,
      },
      dataZoom: useXDataZoom
        ? [
            {
              type: "slider",
              xAxisIndex: 0,
              filterMode: "none",
              height: 22,
              bottom: 6,
              borderColor: "transparent",
              backgroundColor: "rgba(255,255,255,0.06)",
              fillerColor: "rgba(96,165,250,0.25)",
              handleStyle: { color: "#93c5fd" },
              textStyle: { color: "rgba(255,255,255,0.5)" },
            },
          ]
        : [],
    };

    if (singleVarManyRows) {
      const source = rowLabels.map((rowId, i) => ({
        rowId,
        [valDim]: Number(valueMatrix[i]?.[0] ?? 0),
      }));

      return {
        ...base,
        dataset: [
          {
            dimensions: ["rowId", valDim],
            source,
          },
        ],
        xAxis: {
          type: "category",
          name: xName,
          nameLocation: "middle",
          nameGap: 28,
          nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
          axisLabel: {
            color: "rgba(255,255,255,0.7)",
            interval: rowLabels.length > 24 ? "auto" : 0,
            rotate: xRotate ? 35 : 0,
            hideOverlap: true,
          },
        },
        yAxis,
        series: [
          {
            type: "bar",
            name: valDim,
            datasetIndex: 0,
            encode: { x: "rowId", y: valDim },
            emphasis: { focus: "series" },
            large: false,
          },
        ],
      };
    }

    const xCategories = inputVariableNames;
    const series: EChartsOption["series"] = rowLabels.map((rowLabel, rowIndex) => ({
      name: rowLabel,
      type: "bar" as const,
      emphasis: { focus: "series" as const },
      data: inputVariableNames.map((_, vi) => valueMatrix[rowIndex]?.[vi] ?? 0),
      large: false,
    }));

    return {
      ...base,
      xAxis: {
        type: "category",
        name: xName,
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: "rgba(255,255,255,0.5)", fontSize: 11 },
        data: xCategories,
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
        axisLabel: {
          color: "rgba(255,255,255,0.7)",
          interval: inputVariableNames.length > 24 ? "auto" : 0,
          rotate: xRotate ? 35 : 0,
          hideOverlap: true,
        },
      },
      yAxis,
      series,
    };
  }, [rowLabels, inputVariableNames, valueMatrix]);

  if (inputVariableNames.length === 0 || rowLabels.length === 0) {
    return null;
  }

  const singleVarManyRows = inputVariableNames.length === 1 && rowLabels.length > 1;
  const minPixelWidth = singleVarManyRows
    ? Math.max(480, rowLabels.length * 36)
    : undefined;

  return (
    <div
      className={`${className} h-full min-h-[200px] ${minPixelWidth ? "shrink-0" : "w-full"}`}
      style={
        minPixelWidth
          ? { width: minPixelWidth, minWidth: minPixelWidth, maxWidth: "none" }
          : undefined
      }
    >
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate={false}
        onChartReady={(chart) => {
          chart.resize();
          requestAnimationFrame(() => chart.resize());
        }}
      />
    </div>
  );
}
