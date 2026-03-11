import { Activity, Save, ChevronDown, FileText, Upload } from "lucide-react";
import { glassButton, glassPanel } from "../lib/constants";

interface HeaderProps {
  currentScenario: string;
  csvFileName: string;
  onCSVUpload: (file: File) => void;
}

export default function Header({ currentScenario, csvFileName, onCSVUpload }: HeaderProps) {
  return (
    <header className={`${glassPanel} flex-row items-center justify-between p-4 px-6 shrink-0`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Activity className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
            Resource Allocation "What-If"
          </h1>
          <p className="text-xs text-white/50 font-medium">
            {csvFileName ? `File: ${csvFileName}` : "Strategic Simulation Workspace"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {csvFileName ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">{csvFileName}</span>
          </div>
        ) : (
          <label className={`${glassButton} cursor-pointer border-purple-500/30 bg-purple-500/10`}>
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onCSVUpload(file);
                }
              }}
            />
          </label>
        )}
        <div className="relative group">
          <button
            className={`${glassButton} border-purple-500/30 bg-purple-500/10`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
            {currentScenario}
            <ChevronDown className="w-4 h-4 ml-2 opacity-70" />
          </button>
        </div>
        <button className={glassButton}>
          <Save className="w-4 h-4" /> Save
        </button>
      </div>
    </header>
  );
}
