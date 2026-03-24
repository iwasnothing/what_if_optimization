"use client";

import { useState } from "react";
import { X, BarChart3, Target, Download, ChevronLeft, Table2 } from "lucide-react";
import { glassPanel, glassButton } from "../lib/constants";
import type { CSVData, ConfigState, Scenario } from "../types";
import RowInputEChart from "./RowInputEChart";

interface ResultsDashboardProps {
  csvData: CSVData;
  config: ConfigState;
  scenario: Scenario;
  onClose: () => void;
}

interface ParsedVariableValue {
  variableName: string;
  variableType: "row_input" | "row_intermediate" | "portfolio";
  rowIndex?: number;
  groupKey?: string;
  value: number;
}

export default function ResultsDashboard({
  csvData,
  config,
  scenario,
  onClose,
}: ResultsDashboardProps) {
  const [resultsView, setResultsView] = useState<"table" | "chart">("table");
  const optimizationResult = scenario.optimizationResult;

  // Parse variable values from portfolioResults
  const parseVariableValues = (): ParsedVariableValue[] => {
    if (!optimizationResult) return [];

    return optimizationResult.portfolioResults.map((result) => {
      const { variableName, value } = result;
      // Parse variableName to extract type, name, and index/group
      // Format examples: "staff_count[0]", "revenue[All]", "profit[1]"
      const match = variableName.match(/^(\w+)\[(.+)\]$/);
      if (match) {
        const [, name, indexOrGroup] = match;
        const isRowIndex = /^\d+$/.test(indexOrGroup);

        // Determine variable type by checking config
        const isRowInput = config.rowLevelInputVariables.some((v) => v.name === name);
        const isRowIntermediate = config.rowLevelIntermediateVariables.some((v) => v.name === name);

        let variableType: "row_input" | "row_intermediate" | "portfolio" = "portfolio";
        if (isRowIndex) {
          variableType = isRowInput ? "row_input" : isRowIntermediate ? "row_intermediate" : "portfolio";
        }

        return {
          variableName: name,
          variableType,
          rowIndex: isRowIndex ? parseInt(String(indexOrGroup).trim(), 10) : undefined,
          groupKey: isRowIndex ? undefined : indexOrGroup,
          value,
        };
      }
      return {
        variableName,
        variableType: "portfolio",
        groupKey: "All",
        value,
      };
    });
  };

  const parsedValues = parseVariableValues();

  // Get row-level input variable values for each row
  const getRowInputValues = (rowIndex: number) => {
    const result: Record<string, number> = {};
    parsedValues
      .filter(
        (v) =>
          v.variableType === "row_input" &&
          v.rowIndex !== undefined &&
          Number(v.rowIndex) === rowIndex
      )
      .forEach((v) => {
        result[v.variableName] = v.value;
      });
    return result;
  };

  // Get row-level intermediate variable values for each row
  const getRowIntermediateValues = (rowIndex: number) => {
    const result: Record<string, number> = {};
    parsedValues
      .filter(
        (v) =>
          v.variableType === "row_intermediate" &&
          v.rowIndex !== undefined &&
          Number(v.rowIndex) === rowIndex
      )
      .forEach((v) => {
        result[v.variableName] = v.value;
      });
    return result;
  };

  // Get portfolio variable values
  const getPortfolioValues = () => {
    const result: Record<string, number> = {};
    parsedValues
      .filter((v) => v.variableType === "portfolio")
      .forEach((v) => {
        const key = v.groupKey === "All" ? v.variableName : `${v.variableName}[${v.groupKey}]`;
        result[key] = v.value;
      });
    return result;
  };

  // Get input variable column mappings
  const getInputVariableColumnMap = (): Record<string, string> => {
    const map: Record<string, string> = {};
    config.rowLevelInputVariables.forEach((v) => {
      map[v.name] = v.column;
    });
    return map;
  };

  const inputColumnMap = getInputVariableColumnMap();
  const portfolioValues = getPortfolioValues();
  const inputVariableNames = config.rowLevelInputVariables.map((v) => v.name);
  const intermediateVariableNames = config.rowLevelIntermediateVariables.map((v) => v.name);
  const unmappedInputVariables = config.rowLevelInputVariables.filter((v) => {
    const mappedColumn = inputColumnMap[v.name];
    return !csvData.columns.includes(mappedColumn);
  });

  // Check if a column should be replaced with CP-SAT result
  const shouldReplaceColumn = (column: string): boolean => {
    return Object.values(inputColumnMap).includes(column);
  };

  // Get the variable name for a column
  const getVariableNameForColumn = (column: string): string | undefined => {
    return Object.keys(inputColumnMap).find((name) => inputColumnMap[name] === column);
  };

  const getResultTableHeaders = () => {
    return [
      ...csvData.columns,
      ...unmappedInputVariables.map((v) => v.name),
      ...intermediateVariableNames,
    ];
  };

  const getResultTableRows = () => {
    return csvData.rows.map((row, rowIndex) => {
      const rowInputValues = getRowInputValues(rowIndex);
      const rowIntermediateValues = getRowIntermediateValues(rowIndex);

      const rowData: Record<string, string | number> = {};

      csvData.columns.forEach((col) => {
        const varName = getVariableNameForColumn(col);
        if (varName) {
          rowData[col] = rowInputValues[varName] ?? 0;
          return;
        }
        rowData[col] = row[col] ?? "";
      });

      unmappedInputVariables.forEach((variable) => {
        rowData[variable.name] = rowInputValues[variable.name] ?? 0;
      });

      intermediateVariableNames.forEach((variableName) => {
        rowData[variableName] = rowIntermediateValues[variableName] ?? 0;
      });

      return rowData;
    });
  };

  const getChartRowLabel = (rowIndex: number) => {
    const row = csvData.rows[rowIndex];
    const firstCol = csvData.columns[0];
    if (firstCol && row[firstCol] !== undefined && row[firstCol] !== "") {
      return String(row[firstCol]);
    }
    return `Row ${rowIndex + 1}`;
  };

  const chartRowLabels = csvData.rows.map((_, rowIndex) => getChartRowLabel(rowIndex));
  const rowInputValueMatrix = csvData.rows.map((_, rowIndex) =>
    inputVariableNames.map((name) => getRowInputValues(rowIndex)[name] ?? 0)
  );

  // Export data as CSV
  const exportCSV = () => {
    if (!csvData.rows.length) return;

    const headers = getResultTableHeaders();
    const rows = getResultTableRows();

    const escapeCsvCell = (value: string | number) => {
      const cell = String(value ?? "");
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };

    const csvRows = [
      headers.map(escapeCsvCell).join(","),
      ...rows.map((rowData) =>
        headers.map((header) => escapeCsvCell(rowData[header] ?? "")).join(",")
      ),
    ];

    // Download
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `optimization_results_${scenario.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`${glassPanel} w-full max-w-7xl max-h-[90vh] flex flex-col rounded-3xl`}>
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className={`${glassButton} p-2 bg-white/10 hover:bg-white/20`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-purple-400" />
                Results Dashboard
              </h2>
              <p className="text-sm text-white/60 mt-1">
                Scenario: {scenario.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className={`${glassButton} flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 text-sm`}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className={`${glassButton} p-2 bg-white/10 hover:bg-white/20`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content — min-h-0 + overflow-hidden so nested overflow-auto gets a vertical scrollbar */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-6">
          <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            {/* Left side: objective & portfolio summary */}
            <div className="lg:col-span-5 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 bg-black/20 border border-white/10 rounded-2xl p-5 overflow-auto custom-scrollbar">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Objective & Portfolio Values
                </h3>
                <div className="space-y-3">
                  {optimizationResult && (
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                      <p className="text-xs text-white/60 uppercase tracking-wider mb-1">
                        Objective Value
                      </p>
                      <p className="text-2xl font-mono font-bold text-white">
                        {optimizationResult.objectiveValue.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {Object.keys(portfolioValues).length > 0 ? (
                    Object.entries(portfolioValues).map(([name, value]) => (
                      <div
                        key={name}
                        className="bg-black/30 border border-white/10 rounded-xl p-4"
                      >
                        <p className="text-xs text-white/60 uppercase tracking-wider mb-1">
                          {name}
                        </p>
                        <p className="text-lg font-mono font-bold text-white">
                          {value.toFixed(2)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/60">No portfolio variables in this result.</p>
                  )}

                  {optimizationResult?.constraintViolations &&
                    optimizationResult.constraintViolations.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                        <p className="text-xs text-red-300 uppercase tracking-wider mb-2">
                          Constraint Violations
                        </p>
                        <ul className="space-y-1">
                          {optimizationResult.constraintViolations.map((violation, idx) => (
                            <li key={idx} className="text-xs text-red-200">
                              • {violation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </div>

            {/* Right side: result data table or row-input bar chart */}
            <div className="lg:col-span-7 min-h-0 overflow-hidden bg-black/20 border border-white/10 rounded-2xl flex flex-col">
              <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {resultsView === "table" ? (
                    <Table2 className="w-5 h-5 text-blue-400" />
                  ) : (
                    <BarChart3 className="w-5 h-5 text-blue-400" />
                  )}
                  {resultsView === "table"
                    ? "Optimized Data Table"
                    : "Row input variables (optimized values)"}
                </h3>
                <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                  <button
                    type="button"
                    title="Table view"
                    aria-pressed={resultsView === "table"}
                    onClick={() => setResultsView("table")}
                    className={`${glassButton} p-2 rounded-lg ${
                      resultsView === "table"
                        ? "bg-blue-500/25 border-blue-400/50 text-white"
                        : "bg-transparent border-transparent text-white/50 hover:text-white/80"
                    }`}
                  >
                    <Table2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Bar chart — row-level CP-SAT inputs"
                    aria-pressed={resultsView === "chart"}
                    onClick={() => setResultsView("chart")}
                    className={`${glassButton} p-2 rounded-lg ${
                      resultsView === "chart"
                        ? "bg-blue-500/25 border-blue-400/50 text-white"
                        : "bg-transparent border-transparent text-white/50 hover:text-white/80"
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div
                className={
                  resultsView === "table"
                    ? "flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto custom-scrollbar overscroll-contain"
                    : "flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden flex flex-col custom-scrollbar overscroll-contain"
                }
              >
                {resultsView === "table" ? (
                <table className="min-w-max w-full border-separate border-spacing-0">
                  <thead className="bg-white/5 backdrop-blur-md">
                    <tr>
                      {csvData.columns.map((col) => {
                        const varName = getVariableNameForColumn(col);
                        const isReplaced = shouldReplaceColumn(col);
                        return (
                          <th
                            key={col}
                            className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                              isReplaced ? "text-purple-400 bg-purple-500/10" : "text-white/60"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span>{col}</span>
                              {isReplaced && (
                                <span className="text-[9px] text-purple-300/70">
                                  ({varName} - CP-SAT)
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      {/* Input Variables (CP-SAT values replacing columns) */}
                      {unmappedInputVariables.map((v) => {
                        return (
                          <th
                            key={`input-${v.id}`}
                            className="px-4 py-3 text-left text-xs font-semibold text-purple-400 uppercase tracking-wider bg-purple-500/10"
                          >
                            <div className="flex flex-col gap-0.5">
                              <span>{v.name}</span>
                              <span className="text-[9px] text-purple-300/70">
                                (CP-SAT Result)
                              </span>
                            </div>
                          </th>
                        );
                      })}
                      {/* Intermediate Variables */}
                      {config.rowLevelIntermediateVariables.map((v) => (
                        <th
                          key={`inter-${v.id}`}
                          className="px-4 py-3 text-left text-xs font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-500/10"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span>{v.name}</span>
                            <span className="text-[9px] text-cyan-300/70">
                              (Calculated)
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {csvData.rows.map((row, rowIndex) => {
                      const rowInputValues = getRowInputValues(rowIndex);
                      const rowIntermediateValues = getRowIntermediateValues(rowIndex);

                      return (
                        <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
                          {/* Original columns - replace input variable columns with CP-SAT values */}
                          {csvData.columns.map((col) => {
                            const varName = getVariableNameForColumn(col);
                            const isReplaced = shouldReplaceColumn(col);
                            const displayValue = isReplaced && varName
                              ? (rowInputValues[varName] ?? 0).toFixed(2)
                              : (row[col] ?? "");
                            return (
                              <td
                                key={col}
                                className={`px-4 py-3 whitespace-nowrap text-sm ${
                                  isReplaced
                                    ? "text-purple-300 font-mono bg-purple-500/5"
                                    : "text-white/80"
                                }`}
                              >
                                {displayValue}
                              </td>
                            );
                          })}
                          {/* Unmapped input variables */}
                          {unmappedInputVariables.map((v) => {
                            return (
                              <td
                                key={`input-cell-${v.id}`}
                                className="px-4 py-3 whitespace-nowrap text-sm text-purple-300 font-mono bg-purple-500/5"
                              >
                                {(rowInputValues[v.name] ?? 0).toFixed(2)}
                              </td>
                            );
                          })}
                          {/* Intermediate variables */}
                          {config.rowLevelIntermediateVariables.map((v) => (
                            <td
                              key={`inter-cell-${v.id}`}
                              className="px-4 py-3 whitespace-nowrap text-sm text-cyan-300 font-mono bg-cyan-500/5"
                            >
                              {(rowIntermediateValues[v.name] ?? 0).toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                ) : (
                  <div className="flex-1 min-h-0 min-w-min h-full flex flex-col p-4 box-border">
                    {inputVariableNames.length === 0 ? (
                      <p className="text-sm text-white/60">No row-level input variables configured.</p>
                    ) : csvData.rows.length === 0 ? (
                      <p className="text-sm text-white/60">No data rows.</p>
                    ) : (
                      <RowInputEChart
                        rowLabels={chartRowLabels}
                        inputVariableNames={inputVariableNames}
                        valueMatrix={rowInputValueMatrix}
                        className="h-full min-h-[240px]"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
