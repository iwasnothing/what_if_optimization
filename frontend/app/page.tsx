"use client";

import { useState, useCallback } from "react";
import {
  FileText,
  Settings,
  Calculator,
  ShieldCheck,
  Target,
  Upload as UploadIcon,
} from "lucide-react";
import type { LogEntry, ConfigState, Scenario, CSVData, OptimizationResult, PortfolioResult } from "./types";
import AnimatedBackground from "./components/AnimatedBackground";
import CustomScrollbar from "./components/CustomScrollbar";
import Header from "./components/Header";
import InputTab from "./components/InputTab";
import FormulaTab from "./components/FormulaTab";
import ConstraintTab from "./components/ConstraintTab";
import ObjectiveTab from "./components/ObjectiveTab";
import ManipulationGrid from "./components/ManipulationGrid";
import ImpactViewer from "./components/ImpactViewer";
import { parseCSV } from "./lib/helpers";
import { glassPanel } from "./lib/constants";

const initialLogs: LogEntry[] = [];

// Get backend URL dynamically based on browser's host
const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Use the same host as the browser, but backend port 8080
    return `${protocol}//${hostname}:8080`;
  }
  return "http://localhost:8080";
};

const initialConfig: ConfigState = {
  scenarioParameters: [],
  rowLevelInputVariables: [],
  rowLevelIntermediateVariables: [],
  portfolioLevelIntermediateVariables: [],
  constraints: [],
  objectives: [],
};

const initialScenarios: Scenario[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState("input");
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [config, setConfig] = useState<ConfigState>(initialConfig);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);

  const addLog = useCallback((message: string) => {
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    setLogs((prev) =>
      [{ id: Date.now(), time: timeString, message }, ...prev].slice(0, 50)
    );
  }, []);

  const handleCSVUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setCsvFileName(file.name);
      setConfig(initialConfig);
      setScenarios([]);
      addLog(`CSV file "${file.name}" uploaded with ${parsed.rows.length} rows`);
    };
    reader.readAsText(file);
  }, [addLog]);

  const handleConfigChange = useCallback(
    (newConfig: Partial<ConfigState>) => {
      setConfig((prev) => ({ ...prev, ...newConfig }));
    },
    [addLog]
  );

  const handleCreateScenario = useCallback(() => {
    const scenarioId = Date.now();
    const newScenario: Scenario = {
      id: scenarioId,
      name: `Scenario ${scenarios.length + 1}`,
      parameterValues: config.scenarioParameters.reduce(
        (acc, p) => ({ ...acc, [p.name]: p.defaultValue ?? 0 }),
        {} as Record<string, number>
      ),
      inputVariableOverrides: {},
    };
    setScenarios((prev) => [...prev, newScenario]);
    addLog(`Created scenario "${newScenario.name}"`);
  }, [scenarios, config.scenarioParameters, addLog]);

  const handleUpdateScenario = useCallback(
    (id: number, updates: Partial<Scenario>) => {
      setScenarios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
    },
    []
  );

  const handleRunOptimization = useCallback(
    async (id: number) => {
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, isRunning: true } : s
        )
      );

      const scenario = scenarios.find((s) => s.id === id);
      if (scenario) {
        addLog(`Running optimization for scenario "${scenario.name}"...`);

        try {
          // Convert CSV rows to the format expected by the backend
          const csvDataPayload = csvData ? {
            columns: csvData.columns,
            rows: csvData.rows.map(row => ({ data: row })),
          } : null;

          const response = await fetch(`${getBackendUrl()}/api/run_scenario`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              config,
              scenario,
              csvData: csvDataPayload,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result: OptimizationResult = await response.json();

          setScenarios((prev) =>
            prev.map((s) =>
              s.id === id
                ? {
                    ...s,
                    isRunning: false,
                    isCompleted: true,
                    optimizationResult: result,
                  }
                : s
            )
          );
          addLog(`Optimization completed for scenario "${scenario.name}"`);
        } catch (error) {
          console.error("Optimization error:", error);
          addLog(`Error running optimization: ${error instanceof Error ? error.message : "Unknown error"}`);
          setScenarios((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, isRunning: false } : s
            )
          );
        }
      }
    },
    [scenarios, addLog, config, csvData]
  );

  // Get latest optimization result for ImpactViewer
  const latestResult = scenarios
    .filter((s) => s.isCompleted && s.optimizationResult)
    .sort((a, b) => b.id - a.id)[0]?.optimizationResult || null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-purple-500/30 overflow-hidden relative">
      <AnimatedBackground />
      <div className="relative z-10 flex flex-col h-screen p-4 md:p-6 gap-6 max-w-[1800px] mx-auto">
        {/* TOP BAR */}
        <Header
          currentScenario={scenarios.length > 0 ? `${scenarios.length} scenarios` : "No scenarios"}
          csvFileName={csvFileName}
          onCSVUpload={handleCSVUpload}
        />

        {/* MAIN WORKSPACE */}
        <div className="flex-1 flex lg:flex-row gap-6 min-h-0">
          {/* LEFT PANE - 4 TABS (FULL HEIGHT) */}
          <div className={`${glassPanel} w-full lg:w-[480px] shrink-0 flex flex-col`}>
            <div className="p-4 border-b border-white/10 bg-white/5">
              <div className="flex gap-2 overflow-x-auto">
                <button
                  onClick={() => setActiveTab("input")}
                  className={`flex-1 items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === "input"
                      ? "bg-purple-500/30 text-white border-purple-500/50"
                      : "text-white/50 hover:bg-white/10"
                  }`}
                >
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="hidden sm:inline">Input</span>
                </button>
                <button
                  onClick={() => setActiveTab("formula")}
                  className={`flex-1 items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === "formula"
                      ? "bg-purple-500/30 text-white border-purple-500/50"
                      : "text-white/50 hover:bg-white/10"
                  }`}
                >
                  <Calculator className="w-5 h-5 text-green-400" />
                  <span className="hidden sm:inline">Formula</span>
                </button>
                <button
                  onClick={() => setActiveTab("constraint")}
                  className={`flex-1 items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === "constraint"
                      ? "bg-purple-500/30 text-white border-purple-500/50"
                      : "text-white/50 hover:bg-white/10"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span className="hidden sm:inline">Constraint</span>
                </button>
                <button
                  onClick={() => setActiveTab("objective")}
                  className={`flex-1 items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === "objective"
                      ? "bg-purple-500/30 text-white border-purple-500/50"
                      : "text-white/50 hover:bg-white/10"
                  }`}
                >
                  <Target className="w-5 h-5 text-purple-400" />
                  <span className="hidden sm:inline">Objective</span>
                </button>
              </div>
            </div>

            {/* Tab Content (FULL HEIGHT) */}
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex-col gap-4">
              {activeTab === "input" && (
                <InputTab
                  csvData={csvData}
                  config={config}
                  onConfigChange={handleConfigChange}
                />
              )}
              {activeTab === "formula" && (
                <FormulaTab
                  csvData={csvData}
                  config={config}
                  onConfigChange={handleConfigChange}
                />
              )}
              {activeTab === "constraint" && (
                <ConstraintTab
                  config={config}
                  onConfigChange={handleConfigChange}
                />
              )}
              {activeTab === "objective" && (
                <ObjectiveTab
                  config={config}
                  onConfigChange={handleConfigChange}
                />
              )}
            </div>
          </div>

          {/* CENTRAL PANEL - SCENARIOS TABLE */}
          <div className="flex-1 flex flex-col">
            <ManipulationGrid
              config={config}
              scenarios={scenarios}
              onCreateScenario={handleCreateScenario}
              onUpdateScenario={handleUpdateScenario}
              onRunOptimization={handleRunOptimization}
            />
          </div>

          {/* RIGHT PANE - IMPACT VIEWER (FULL HEIGHT) */}
          <div className="flex-1 flex flex-col">
            <ImpactViewer
              portfolioResults={latestResult?.portfolioResults || []}
              optimizationResult={latestResult}
              logs={logs}
            />
          </div>
        </div>

        <CustomScrollbar />
      </div>
    </div>
  );
}
