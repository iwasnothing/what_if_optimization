import { Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { glassPanel } from "../lib/constants";
import type { LogEntry, PortfolioResult, OptimizationResult } from "../types";

interface ImpactViewerProps {
  portfolioResults: PortfolioResult[];
  optimizationResult: OptimizationResult | null;
  logs: LogEntry[];
}

export default function ImpactViewer({
  portfolioResults,
  optimizationResult,
  logs,
}: ImpactViewerProps) {
  return (
    <aside className={`${glassPanel} w-full lg:w-[380px] shrink-0 flex flex-col`}>
      <div className="p-5 border-b border-white/10 bg-white/5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-pink-400" />
          Impact Viewer
        </h2>
      </div>

      <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
        {optimizationResult ? (
          <OptimizationDisplay result={optimizationResult} />
        ) : (
          <PortfolioResultsDisplay results={portfolioResults} />
        )}
        <SimulationLog logs={logs} />
      </div>
    </aside>
  );
}

interface OptimizationDisplayProps {
  result: OptimizationResult;
}

function OptimizationDisplay({ result }: OptimizationDisplayProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">
        Optimization Results
      </h3>

      <ResultCard
        label="Objective Value"
        value={result.objectiveValue.toFixed(2)}
        color="purple"
      />

      {result.constraintViolations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Constraint Violations
          </h4>
          <div className="space-y-1">
            {result.constraintViolations.map((violation, index) => (
              <div
                key={index}
                className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300"
              >
                {violation}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-white/70">
          Portfolio Variables
        </h4>
        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
          {result.portfolioResults.map((result) => (
            <ResultItem
              key={result.variableName}
              name={result.variableName}
              value={result.value}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PortfolioResultsDisplayProps {
  results: PortfolioResult[];
}

function PortfolioResultsDisplay({ results }: PortfolioResultsDisplayProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">
        Portfolio Variables
      </h3>

      {results.length === 0 ? (
        <div className="text-center text-white/40 py-8">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No portfolio variables yet. Define aggregations first.</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
          {results.map((result) => (
            <ResultItem
              key={result.variableName}
              name={result.variableName}
              value={result.value}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ResultItemProps {
  name: string;
  value: number;
}

function ResultItem({ name, value }: ResultItemProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20 border border-white/10 hover:bg-white/5 transition-all">
      <span className="text-sm text-white/80">{name}</span>
      <span className="text-sm font-mono text-white/90">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: string;
  color: "emerald" | "red" | "purple" | "blue" | "amber";
  trend?: "up" | "down";
}

function ResultCard({ label, value, color, trend }: ResultCardProps) {
  const colorClass = color === "emerald"
    ? "emerald"
    : color === "red"
    ? "red"
    : color === "purple"
    ? "purple"
    : color === "blue"
    ? "blue"
    : "amber";

  const bgClass = color === "emerald"
    ? "emerald-500/10"
    : color === "red"
    ? "red-500/10"
    : color === "purple"
    ? "purple-500/10"
    : color === "blue"
    ? "blue-500/10"
    : "amber-500/10";

  return (
    <div
      className={`bg-black/20 border border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden`}
    >
      <div
        className={`absolute top-0 right-0 w-16 h-16 ${bgClass} rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2`}
      />
      <span className="text-xs text-white/60 mb-2">{label}</span>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />}
        {trend === "down" && <TrendingDown className="w-4 h-4 text-red-400 mb-1" />}
      </div>
    </div>
  );
}

interface SimulationLogProps {
  logs: LogEntry[];
}

function SimulationLog({ logs }: SimulationLogProps) {
  return (
    <div className="space-y-4 flex-1 flex flex-col min-h-[200px]">
      <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">
        Activity Log
      </h3>
      <div className="flex-1 bg-black/20 border border-white/10 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/40">
            <p className="text-xs">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            {logs.map((log, index) => <LogEntry key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}

interface LogEntryProps {
  log: LogEntry;
}

function LogEntry({ log }: LogEntryProps) {
  return (
    <div className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-3 h-3 rounded-full border border-white/30 bg-slate-900 group-[.is-active]:bg-purple-500 text-slate-500 group-[.is-active]:text-purple-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] text-xs p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
        <time className="font-mono text-[9px] text-purple-300/70 mb-1 block">
          {log.time}
        </time>
        <span className="text-white/80">{log.message}</span>
      </div>
    </div>
  );
}
