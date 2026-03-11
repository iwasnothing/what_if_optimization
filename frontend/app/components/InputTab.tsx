import { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Layers,
  Settings,
} from "lucide-react";
import { glassInput, glassButton, glassCard } from "../lib/constants";
import type {
  CSVData,
  ConfigState,
  ScenarioParameter,
  RowLevelInputVariable,
  DataType,
} from "../types";

interface InputTabProps {
  csvData: CSVData | null;
  config: ConfigState;
  onConfigChange: (config: Partial<ConfigState>) => void;
}

export default function InputTab({
  csvData,
  config,
  onConfigChange,
}: InputTabProps) {
  // Scenario Parameters
  const [expandedScenarioParam, setExpandedScenarioParam] = useState<number | null>(null);
  const [editingScenarioParam, setEditingScenarioParam] = useState<ScenarioParameter | null>(null);

  // Input Variables
  const [expandedInputVar, setExpandedInputVar] = useState<number | null>(null);
  const [editingInputVar, setEditingInputVar] = useState<RowLevelInputVariable | null>(null);

  // Scenario Parameters handlers
  const addScenarioParameter = () => {
    const newParam: ScenarioParameter = {
      id: Date.now(),
      name: "",
      description: "",
      defaultValue: 0,
    };
    setEditingScenarioParam(newParam);
    setExpandedScenarioParam(newParam.id);
  };

  const saveScenarioParameter = () => {
    if (!editingScenarioParam || !editingScenarioParam.name.trim()) return;
    onConfigChange({
      scenarioParameters: [...config.scenarioParameters, editingScenarioParam],
    });
    setEditingScenarioParam(null);
    setExpandedScenarioParam(null);
  };

  const cancelScenarioParameter = () => {
    setEditingScenarioParam(null);
    setExpandedScenarioParam(null);
  };

  const removeScenarioParameter = (id: number) => {
    onConfigChange({
      scenarioParameters: config.scenarioParameters.filter((p) => p.id !== id),
    });
  };

  // Input Variables handlers
  const addInputVariable = () => {
    if (!csvData || csvData.columns.length === 0) return;
    const newVar: RowLevelInputVariable = {
      id: Date.now(),
      name: "",
      description: "",
      column: csvData.columns[0],
      dataType: "integer",
    };
    setEditingInputVar(newVar);
    setExpandedInputVar(newVar.id);
  };

  const saveInputVariable = () => {
    if (!editingInputVar || !editingInputVar.name.trim()) return;
    onConfigChange({
      rowLevelInputVariables: [...config.rowLevelInputVariables, editingInputVar],
    });
    setEditingInputVar(null);
    setExpandedInputVar(null);
  };

  const cancelInputVariable = () => {
    setEditingInputVar(null);
    setExpandedInputVar(null);
  };

  const removeInputVariable = (id: number) => {
    onConfigChange({
      rowLevelInputVariables: config.rowLevelInputVariables.filter((v) => v.id !== id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Scenario Parameters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            Scenario Parameters
          </h3>
          <button onClick={addScenarioParameter} className={`${glassButton} text-xs py-1.5`}>
            <Plus className="w-3 h-3" /> Add Parameter
          </button>
        </div>

        {/* New/Edit Scenario Parameter Form */}
        {editingScenarioParam && (
          <div className={`${glassCard} border-cyan-500/30`}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingScenarioParam.name}
                  onChange={(e) =>
                    setEditingScenarioParam({ ...editingScenarioParam, name: e.target.value })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Parameter name"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Description</label>
                <input
                  type="text"
                  value={editingScenarioParam.description}
                  onChange={(e) =>
                    setEditingScenarioParam({ ...editingScenarioParam, description: e.target.value })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Parameter description"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveScenarioParameter}
                  className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={cancelScenarioParameter}
                  className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scenario Parameters List */}
        <div className="space-y-2">
          {config.scenarioParameters.length === 0 ? (
            <p className="text-xs text-white/40 italic py-4 text-center">
              No scenario parameters defined
            </p>
          ) : (
            config.scenarioParameters.map((param) => (
              <div key={param.id} className={`${glassCard}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Settings className="w-4 h-4 text-cyan-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white/90">{param.name}</div>
                      <div className="text-xs text-white/50">{param.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => removeScenarioParameter(param.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Row Level Input Variables Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Row Level Input Variables
          </h3>
          <button
            onClick={addInputVariable}
            disabled={!csvData || csvData.columns.length === 0}
            className={`${glassButton} text-xs py-1.5 ${
              !csvData || csvData.columns.length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Plus className="w-3 h-3" /> Add Variable
          </button>
        </div>

        {!csvData && (
          <p className="text-xs text-white/40 italic py-4 text-center">
            Please upload a CSV file first to define input variables
          </p>
        )}

        {/* New/Edit Input Variable Form */}
        {editingInputVar && (
          <div className={`${glassCard} border-blue-500/30`}>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingInputVar.name}
                  onChange={(e) =>
                    setEditingInputVar({ ...editingInputVar, name: e.target.value })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable name"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Description</label>
                <input
                  type="text"
                  value={editingInputVar.description}
                  onChange={(e) =>
                    setEditingInputVar({ ...editingInputVar, description: e.target.value })
                  }
                  className={`${glassInput} w-full text-sm`}
                  placeholder="Variable description"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">CSV Column</label>
                <select
                  value={editingInputVar.column}
                  onChange={(e) =>
                    setEditingInputVar({ ...editingInputVar, column: e.target.value })
                  }
                  className={`${glassInput} w-full text-sm appearance-none`}
                >
                  {csvData?.columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Data Type</label>
                <select
                  value={editingInputVar.dataType}
                  onChange={(e) =>
                    setEditingInputVar({ ...editingInputVar, dataType: e.target.value as DataType })
                  }
                  className={`${glassInput} w-full text-sm appearance-none`}
                >
                  <option value="integer">Integer</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>

              {/* Range for integer type */}
              {editingInputVar.dataType === "integer" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Min</label>
                    <input
                      type="number"
                      value={editingInputVar.min ?? ""}
                      onChange={(e) =>
                        setEditingInputVar({
                          ...editingInputVar,
                          min: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className={`${glassInput} w-full text-sm`}
                      placeholder="No min"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Max</label>
                    <input
                      type="number"
                      value={editingInputVar.max ?? ""}
                      onChange={(e) =>
                        setEditingInputVar({
                          ...editingInputVar,
                          max: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className={`${glassInput} w-full text-sm`}
                      placeholder="No max"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveInputVariable}
                  className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
                >
                  <Save className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={cancelInputVariable}
                  className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input Variables List */}
        {csvData && (
          <div className="space-y-2">
            {config.rowLevelInputVariables.length === 0 ? (
              <p className="text-xs text-white/40 italic py-4 text-center">
                No input variables defined
              </p>
            ) : (
              config.rowLevelInputVariables.map((variable) => (
                <div key={variable.id} className={`${glassCard}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white/90">{variable.name}</div>
                        <div className="text-xs text-white/50">{variable.description}</div>
                        <div className="text-[10px] text-white/40 mt-1">
                          {variable.column} · {variable.dataType}
                          {variable.dataType === "integer" && (
                            <> · [{variable.min ?? "-∞"}, {variable.max ?? "∞"}]</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeInputVariable(variable.id)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
