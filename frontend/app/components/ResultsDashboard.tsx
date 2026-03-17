import { X, BarChart3, Target, ShieldCheck, TrendingUp, Download, ChevronLeft } from "lucide-react";
import { glassPanel, glassButton } from "../lib/constants";
import type { CSVData, ConfigState, Scenario, OptimizationResult } from "../types";

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
          rowIndex: isRowIndex ? parseInt(indexOrGroup) : undefined,
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
      .filter((v) => v.variableType === "row_input" && v.rowIndex === rowIndex)
      .forEach((v) => {
        result[v.variableName] = v.value;
      });
    return result;
  };

  // Get row-level intermediate variable values for each row
  const getRowIntermediateValues = (rowIndex: number) => {
    const result: Record<string, number> = {};
    parsedValues
      .filter((v) => v.variableType === "row_intermediate" && v.rowIndex === rowIndex)
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

  // Check if a column should be replaced with CP-SAT result
  const shouldReplaceColumn = (column: string): boolean => {
    return Object.values(inputColumnMap).includes(column);
  };

  // Get the variable name for a column
  const getVariableNameForColumn = (column: string): string | undefined => {
    return Object.keys(inputColumnMap).find((name) => inputColumnMap[name] === column);
  };

  // Export data as CSV
  const exportCSV = () => {
    if (!csvData.rows.length) return;

    // Prepare headers
    const originalColumns = csvData.columns.filter((col) => !shouldReplaceColumn(col));
    const inputVariableNames = config.rowLevelInputVariables.map((v) => v.name);
    const intermediateVariableNames = config.rowLevelIntermediateVariables.map((v) => v.name);

    const headers = [
      ...originalColumns,
      ...inputVariableNames,
      ...intermediateVariableNames,
    ];

    // Prepare rows
    const csvRows = [
      headers.join(","),
      ...csvData.rows.map((row, rowIndex) => {
        const rowValues: string[] = [];

        // Original column values (excluding replaced input columns)
        originalColumns.forEach((col) => {
          const val = row[col];
          rowValues.push(typeof val === "string" ? `"${val}"` : String(val ?? ""));
        });

        // Input variable values (CP-SAT results)
        inputVariableNames.forEach((varName) => {
          const rowInputValues = getRowInputValues(rowIndex);
          const val = rowInputValues[varName] ?? 0;
          rowValues.push(String(val));
        });

        // Intermediate variable values
        intermediateVariableNames.forEach((varName) => {
          const rowIntermediateValues = getRowIntermediateValues(rowIndex);
          const val = rowIntermediateValues[varName] ?? 0;
          rowValues.push(String(val));
        });

        return rowValues.join(",");
      }),
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-8">
            {/* Objective Value */}
            {optimizationResult && (
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <Target className="w-8 h-8 text-purple-400" />
                  <div>
                    <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                      Objective Value
                    </h3>
                    <p className="text-3xl font-bold text-white">
                      {optimizationResult.objectiveValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Optimized Data Table
              </h3>
              <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
                <table className="min-w-full">
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
                      {config.rowLevelInputVariables.map((v) => {
                        const columnMapped = inputColumnMap[v.name];
                        const isMapped = csvData.columns.includes(columnMapped);
                        if (isMapped) return null; // Skip if column is already in CSV
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
                          {config.rowLevelInputVariables.map((v) => {
                            const columnMapped = inputColumnMap[v.name];
                            const isMapped = csvData.columns.includes(columnMapped);
                            if (isMapped) return null;
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
              </div>
            </div>

            {/* Portfolio Variables */}
            {Object.keys(portfolioValues).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Portfolio Variables
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(portfolioValues).map(([name, value]) => (
                    <div
                      key={name}
                      className="bg-black/20 border border-white/10 rounded-xl p-4 hover:bg-white/5 transition-all"
                    >
                      <p className="text-xs text-white/60 uppercase tracking-wider mb-1">
                        {name}
                      </p>
                      <p className="text-xl font-mono font-bold text-white">
                        {value.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Constraints */}
            {config.constraints.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Constraints
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {config.constraints.map((constraint) => (
                    <div
                      key={constraint.id}
                      className="bg-black/20 border border-white/10 rounded-xl p-4"
                    >
                      <p className="text-sm font-semibold text-white/80 mb-1">
                        {constraint.name}
                      </p>
                      <p className="text-xs text-white/60">{constraint.description}</p>
                    </div>
                  ))}
                </div>
                {optimizationResult?.constraintViolations && optimizationResult.constraintViolations.length > 0 && (
                  <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <p className="text-sm font-semibold text-red-400 mb-2">
                      Constraint Violations
                    </p>
                    <ul className="space-y-1">
                      {optimizationResult.constraintViolations.map((violation, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-red-300"
                        >
                          • {violation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
