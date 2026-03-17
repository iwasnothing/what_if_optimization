import { Play, CheckCircle2, Clock, FileText, RotateCcw } from "lucide-react";
import { glassPanel, glassButton, glassInput, glassCard } from "../lib/constants";
import type { ConfigState, Scenario } from "../types";

interface ManipulationGridProps {
  config: ConfigState;
  scenarios: Scenario[];
  onCreateScenario: () => void;
  onUpdateScenario: (id: number, updates: Partial<Scenario>) => void;
  onRunOptimization: (id: number) => void;
  onViewResults: (scenario: Scenario) => void;
}

export default function ManipulationGrid({
  config,
  scenarios,
  onCreateScenario,
  onUpdateScenario,
  onRunOptimization,
  onViewResults,
}: ManipulationGridProps) {
  return (
    <section className={`${glassPanel} flex-1 flex flex-col min-w-[800px]`}>
      <div className="p-5 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          Scenarios Table
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateScenario}
            className={`${glassButton} text-xs py-1.5 bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30`}
          >
            <Play className="w-3 h-3" /> Create Scenario
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-5">
        {config.scenarioParameters.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50">
            <FileText className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">
              Please define scenario parameters in the Control Center first
            </p>
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-black/20">
              <table className="min-w-full divide-y divide-white/10">
                <TableHeader config={config} />
                <TableBody
                  config={config}
                  scenarios={scenarios}
                  onUpdateScenario={onUpdateScenario}
                  onRunOptimization={onRunOptimization}
                  onViewResults={onViewResults}
                />
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TableHeader({ config }: { config: ConfigState }) {
  return (
    <thead className="bg-white/5 backdrop-blur-md">
      <tr>
        <th className="px-4 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider w-48">
          Scenario Name
        </th>
        {config.scenarioParameters.map((param) => (
          <th
            key={param.id}
            className="px-4 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider"
          >
            <div className="flex flex-col gap-1">
              <span className="text-cyan-400">{param.name}</span>
              <span className="text-white/40 text-[9px]">
                {param.description}
              </span>
            </div>
          </th>
        ))}
        <th className="px-4 py-4 text-left text-xs font-semibold text-purple-400 uppercase tracking-wider w-48">
          Actions
        </th>
      </tr>
    </thead>
  );
}

interface TableBodyProps {
  config: ConfigState;
  scenarios: Scenario[];
  onUpdateScenario: (id: number, updates: Partial<Scenario>) => void;
  onRunOptimization: (id: number) => void;
  onViewResults: (scenario: Scenario) => void;
}

function TableBody({
  config,
  scenarios,
  onUpdateScenario,
  onRunOptimization,
  onViewResults,
}: TableBodyProps) {
  return (
    <tbody className="divide-y divide-white/5 bg-transparent">
      {scenarios.length === 0 ? (
        <tr>
          <td colSpan={config.scenarioParameters.length + 2} className="px-4 py-8">
            <div className="text-center text-white/50 text-sm">
              No scenarios created yet. Click "Create Scenario" to add one.
            </div>
          </td>
        </tr>
      ) : (
        scenarios.map((scenario) => (
          <tr
            key={scenario.id}
            className="hover:bg-white/5 transition-colors duration-300"
          >
            {/* Scenario Name */}
            <td className="px-4 py-4 whitespace-nowrap">
              <input
                type="text"
                value={scenario.name}
                onChange={(e) =>
                  onUpdateScenario(scenario.id, { name: e.target.value })
                }
                className={`${glassInput} w-full text-sm`}
                placeholder="Scenario name"
              />
            </td>

            {/* Parameter Values */}
            {config.scenarioParameters.map((param) => (
              <td key={param.id} className="px-4 py-4 whitespace-nowrap">
                <input
                  type="number"
                  value={scenario.parameterValues[param.name] ?? param.defaultValue ?? 0}
                  onChange={(e) =>
                    onUpdateScenario(scenario.id, {
                      parameterValues: {
                        ...scenario.parameterValues,
                        [param.name]: Number(e.target.value),
                      },
                    })
                  }
                  className={`${glassInput} w-24 text-xs font-mono text-center`}
                  placeholder={`${param.defaultValue ?? 0}`}
                />
              </td>
            ))}

            {/* Actions */}
            <td className="px-4 py-4 whitespace-nowrap">
              <div className="flex items-center gap-2">
                {scenario.isRunning ? (
                  <div
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-300 text-xs"
                  >
                    <Clock className="w-3 h-3 animate-spin" />
                    Running...
                  </div>
                ) : scenario.isCompleted ? (
                  <>
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-xs"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </div>
                    <button
                      onClick={() => onRunOptimization(scenario.id)}
                      className={`${glassButton} text-xs py-1.5 bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30`}
                      title="Re-run scenario"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onRunOptimization(scenario.id)}
                    className={`${glassButton} text-xs py-1.5 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
                  >
                    <Play className="w-3 h-3" /> Run
                  </button>
                )}

                {scenario.isCompleted && scenario.optimizationResult && (
                  <button
                    onClick={() => onViewResults(scenario)}
                    className={`${glassButton} text-xs py-1.5 bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30`}
                  >
                    Results
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))
      )}
    </tbody>
  );
}
