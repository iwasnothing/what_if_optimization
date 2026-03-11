import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  X,
  Calculator,
  Layout,
  Tag,
} from "lucide-react";
import { glassInput, glassButton, glassCard } from "../lib/constants";
import type {
  ConfigState,
  RowLevelIntermediateVariable,
  PortfolioLevelIntermediateVariable,
  AggregateFunction,
  ComparisonOperator,
  IfCondition,
} from "../types";

interface FormulaTabProps {
  csvData: { columns: string[] } | null;
  config: ConfigState;
  onConfigChange: (config: Partial<ConfigState>) => void;
}

export default function FormulaTab({
  csvData,
  config,
  onConfigChange,
}: FormulaTabProps) {
  // Row Level Intermediate Variables
  const [editingRowIntermediate, setEditingRowIntermediate] =
    useState<RowLevelIntermediateVariable | null>(null);

  // Portfolio Level Intermediate Variables
  const [editingPortfolioIntermediate, setEditingPortfolioIntermediate] =
    useState<PortfolioLevelIntermediateVariable | null>(null);
  const [selectedSourceVariables, setSelectedSourceVariables] = useState<string[]>([]);
  const [hasGroupBy, setHasGroupBy] = useState(false);
  const [hasIfCondition, setHasIfCondition] = useState(false);
  const [ifCondition, setIfCondition] = useState<IfCondition>({
    column: "",
    operator: "=",
    value: "",
  });

  // Available variables for formulas
  const availableVariables = [
    ...config.rowLevelInputVariables.map((v) => v.name),
    ...config.scenarioParameters.map((p) => p.name),
    ...config.rowLevelIntermediateVariables.map((v) => v.name),
  ];

  // Row Level handlers
  const addRowIntermediate = () => {
    const newVar: RowLevelIntermediateVariable = {
      id: Date.now(),
      name: "",
      description: "",
      formula: "",
    };
    setEditingRowIntermediate(newVar);
  };

  const saveRowIntermediate = () => {
    if (!editingRowIntermediate || !editingRowIntermediate.name.trim()) return;
    onConfigChange({
      rowLevelIntermediateVariables: [
        ...config.rowLevelIntermediateVariables,
        editingRowIntermediate,
      ],
    });
    setEditingRowIntermediate(null);
  };

  const cancelRowIntermediate = () => {
    setEditingRowIntermediate(null);
  };

  const removeRowIntermediate = (id: number) => {
    onConfigChange({
      rowLevelIntermediateVariables: config.rowLevelIntermediateVariables.filter(
        (v) => v.id !== id
      ),
    });
  };

  // Portfolio Level handlers
  const addPortfolioIntermediate = () => {
    const newVar: PortfolioLevelIntermediateVariable = {
      id: Date.now(),
      name: "",
      description: "",
      aggregateFunction: "sum",
      sourceVariables: [],
    };
    setEditingPortfolioIntermediate(newVar);
    setSelectedSourceVariables([]);
    setHasGroupBy(false);
    setHasIfCondition(false);
    setIfCondition({ column: "", operator: "=", value: "" });
  };

  const savePortfolioIntermediate = () => {
    if (
      !editingPortfolioIntermediate ||
      !editingPortfolioIntermediate.name.trim() ||
      selectedSourceVariables.length === 0
    )
      return;

    const finalVar: PortfolioLevelIntermediateVariable = {
      ...editingPortfolioIntermediate,
      sourceVariables: selectedSourceVariables,
      groupByColumn: hasGroupBy ? editingPortfolioIntermediate.groupByColumn : undefined,
      ifCondition: hasIfCondition ? ifCondition : undefined,
    };

    onConfigChange({
      portfolioLevelIntermediateVariables: [
        ...config.portfolioLevelIntermediateVariables,
        finalVar,
      ],
    });
    setEditingPortfolioIntermediate(null);
    setSelectedSourceVariables([]);
    setHasGroupBy(false);
    setHasIfCondition(false);
    setIfCondition({ column: "", operator: "=", value: "" });
  };

  const cancelPortfolioIntermediate = () => {
    setEditingPortfolioIntermediate(null);
    setSelectedSourceVariables([]);
    setHasGroupBy(false);
    setHasIfCondition(false);
    setIfCondition({ column: "", operator: "=", value: "" });
  };

  const removePortfolioIntermediate = (id: number) => {
    onConfigChange({
      portfolioLevelIntermediateVariables: config.portfolioLevelIntermediateVariables.filter(
        (v) => v.id !== id
      ),
    });
  };

  const toggleSourceVariable = (varName: string) => {
    setSelectedSourceVariables((prev) =>
      prev.includes(varName)
        ? prev.filter((v) => v !== varName)
        : [...prev, varName]
    );
  };

  return (
    <div className="space-y-6">
      {/* Row Level Intermediate Variables Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-green-400" />
            Row Level Intermediate Variables
          </h3>
          <button onClick={addRowIntermediate} className={`${glassButton} text-xs py-1.5`}>
            <Plus className="w-3 h-3" /> Add Variable
          </button>
        </div>

        {/* New/Edit Row Intermediate Variable Form */}
        {editingRowIntermediate && (
          <div className={`${glassCard} border-green-500/30`}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingRowIntermediate.name}
                  onChange={(e) =>
                    setEditingRowIntermediate({
                      ...editingRowIntermediate,
                      name: e.target.value,
                    })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable name"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Description</label>
                <input
                  type="text"
                  value={editingRowIntermediate.description}
                  onChange={(e) =>
                    setEditingRowIntermediate({
                      ...editingRowIntermediate,
                      description: e.target.value,
                    })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable description"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">
                  Formula (linear combination of input variables, parameters, and numbers)
                </label>
                <input
                  type="text"
                  value={editingRowIntermediate.formula}
                  onChange={(e) =>
                    setEditingRowIntermediate({
                      ...editingRowIntermediate,
                      formula: e.target.value,
                    })
                  }
                  className={`${glassInput} w-full text-xs font-mono`}
                  placeholder="e.g., [Price] * [Quantity] + [TaxRate] * 100"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Operators: +, -, *, () · Boolean variables treated as 0 or 1
                </p>
                {availableVariables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {availableVariables.map((v) => (
                      <span
                        key={v}
                        className="px-1.5 py-0.5 bg-green-500/10 rounded text-[9px] text-green-300 cursor-pointer hover:bg-green-500/20"
                        onClick={() =>
                          setEditingRowIntermediate({
                            ...editingRowIntermediate,
                            formula: (editingRowIntermediate.formula || "") + `[${v}]`,
                          })
                        }
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveRowIntermediate}
                  className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={cancelRowIntermediate}
                  className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Row Intermediate Variables List */}
        <div className="space-y-2">
          {config.rowLevelIntermediateVariables.length === 0 ? (
            <p className="text-xs text-white/40 italic py-4 text-center">
              No row level intermediate variables defined
            </p>
          ) : (
            config.rowLevelIntermediateVariables.map((variable) => (
              <div key={variable.id} className={`${glassCard}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Calculator className="w-4 h-4 text-green-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white/90">{variable.name}</div>
                      <div className="text-xs text-white/50">{variable.description}</div>
                      <div className="text-[10px] text-white/40 mt-1 font-mono">
                        {variable.formula}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeRowIntermediate(variable.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Portfolio Level Intermediate Variables Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Layout className="w-4 h-4 text-pink-400" />
            Portfolio Level Intermediate Variables
          </h3>
          <button
            onClick={addPortfolioIntermediate}
            className={`${glassButton} text-xs py-1.5`}
          >
            <Plus className="w-3 h-3" /> Add Variable
          </button>
        </div>

        {/* New/Edit Portfolio Intermediate Variable Form */}
        {editingPortfolioIntermediate && (
          <div className={`${glassCard} border-pink-500/30`}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingPortfolioIntermediate.name}
                  onChange={(e) =>
                    setEditingPortfolioIntermediate({
                      ...editingPortfolioIntermediate,
                      name: e.target.value,
                    })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable name"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Description</label>
                <input
                  type="text"
                  value={editingPortfolioIntermediate.description}
                  onChange={(e) =>
                    setEditingPortfolioIntermediate({
                      ...editingPortfolioIntermediate,
                      description: e.target.value,
                    })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable description"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">
                  Aggregation Function
                </label>
                <select
                  value={editingPortfolioIntermediate.aggregateFunction}
                  onChange={(e) =>
                    setEditingPortfolioIntermediate({
                      ...editingPortfolioIntermediate,
                      aggregateFunction: e.target.value as AggregateFunction,
                    })
                  }
                  className={`${glassInput} w-full text-sm appearance-none`}
                >
                  <option value="sum">Sum</option>
                  <option value="min">Min</option>
                  <option value="max">Max</option>
                </select>
              </div>

              {/* Source Variables Selection */}
              <div>
                <label className="text-[10px] text-white/50 block mb-1">
                  Source Variables (select one or more)
                </label>
                <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar">
                  {[
                    ...config.rowLevelInputVariables.map((v) => v.name),
                    ...config.rowLevelIntermediateVariables.map((v) => v.name),
                  ].map((v) => (
                    <button
                      key={v}
                      onClick={() => toggleSourceVariable(v)}
                      className={`w-full text-left px-2 py-1 rounded text-xs flex items-center gap-2 ${
                        selectedSourceVariables.includes(v)
                          ? "bg-pink-500/20 text-pink-300"
                          : "bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional: Group By */}
              <div>
                <label className="flex items-center gap-2 text-[10px] text-white/50">
                  <input
                    type="checkbox"
                    checked={hasGroupBy}
                    onChange={(e) => setHasGroupBy(e.target.checked)}
                    className="rounded"
                  />
                  Add "Group By" clause
                </label>
                {hasGroupBy && (
                  <select
                    value={editingPortfolioIntermediate.groupByColumn || ""}
                    onChange={(e) =>
                      setEditingPortfolioIntermediate({
                        ...editingPortfolioIntermediate,
                        groupByColumn: e.target.value,
                      })
                    }
                    className={`${glassInput} w-full text-sm appearance-none mt-1`}
                  >
                    <option value="">Select column...</option>
                    {csvData?.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Optional: If Condition */}
              <div>
                <label className="flex items-center gap-2 text-[10px] text-white/50">
                  <input
                    type="checkbox"
                    checked={hasIfCondition}
                    onChange={(e) => setHasIfCondition(e.target.checked)}
                    className="rounded"
                  />
                  Add "If" condition
                </label>
                {hasIfCondition && (
                  <div className="grid grid-cols-3 gap-1 mt-1">
                    <select
                      value={ifCondition.column}
                      onChange={(e) =>
                        setIfCondition({ ...ifCondition, column: e.target.value })
                      }
                      className={`${glassInput} text-xs appearance-none`}
                    >
                      <option value="">Column</option>
                      {csvData?.columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    <select
                      value={ifCondition.operator}
                      onChange={(e) =>
                        setIfCondition({
                          ...ifCondition,
                          operator: e.target.value as ComparisonOperator,
                        })
                      }
                      className={`${glassInput} text-xs appearance-none`}
                    >
                      <option value="=">=</option>
                      <option value="!=">!=</option>
                      <option value=">">&gt;</option>
                      <option value="<">&lt;</option>
                      <option value=">=">&gt;=</option>
                      <option value="<=">&lt;=</option>
                    </select>
                    <input
                      type="text"
                      value={ifCondition.value}
                      onChange={(e) =>
                        setIfCondition({ ...ifCondition, value: e.target.value })
                      }
                      className={`${glassInput} text-xs`}
                      placeholder="Value"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={savePortfolioIntermediate}
                  className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={cancelPortfolioIntermediate}
                  className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Portfolio Intermediate Variables List */}
        <div className="space-y-2">
          {config.portfolioLevelIntermediateVariables.length === 0 ? (
            <p className="text-xs text-white/40 italic py-4 text-center">
              No portfolio level intermediate variables defined
            </p>
          ) : (
            config.portfolioLevelIntermediateVariables.map((variable) => (
              <div key={variable.id} className={`${glassCard}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Layout className="w-4 h-4 text-pink-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white/90">{variable.name}</div>
                      <div className="text-xs text-white/50">{variable.description}</div>
                      <div className="text-[10px] text-white/40 mt-1">
                        {variable.aggregateFunction}({variable.sourceVariables.join(", ")})
                        {variable.groupByColumn && ` · group by ${variable.groupByColumn}`}
                        {variable.ifCondition && ` · if ${variable.ifCondition.column} ${variable.ifCondition.operator} ${variable.ifCondition.value}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removePortfolioIntermediate(variable.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
