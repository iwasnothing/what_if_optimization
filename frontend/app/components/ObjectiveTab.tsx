import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  X,
  Target,
} from "lucide-react";
import { glassInput, glassButton, glassCard } from "../lib/constants";
import type {
  ConfigState,
  Objective,
} from "../types";

interface ObjectiveTabProps {
  config: ConfigState;
  onConfigChange: (config: Partial<ConfigState>) => void;
}

export default function ObjectiveTab({
  config,
  onConfigChange,
}: ObjectiveTabProps) {
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);

  const addObjective = () => {
    const newObjective: Objective = {
      id: Date.now(),
      name: "",
      description: "",
    };
    setEditingObjective(newObjective);
  };

  const saveObjective = () => {
    if (!editingObjective || !editingObjective.name.trim()) return;
    onConfigChange({
      objectives: [...config.objectives, editingObjective],
    });
    setEditingObjective(null);
  };

  const cancelObjective = () => {
    setEditingObjective(null);
  };

  const removeObjective = (id: number) => {
    onConfigChange({
      objectives: config.objectives.filter((o) => o.id !== id),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-400" />
          Objectives
        </h3>
        <button onClick={addObjective} className={`${glassButton} text-xs py-1.5`}>
          <Plus className="w-3 h-3" /> Add Objective
        </button>
      </div>

      {/* New/Edit Objective Form */}
      {editingObjective && (
        <div className={`${glassCard} border-purple-500/30`}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Name</label>
              <input
                type="text"
                value={editingObjective.name}
                onChange={(e) =>
                  setEditingObjective({
                    ...editingObjective,
                    name: e.target.value,
                  })
                }
                className={`${glassInput} w-full text-sm`}
                placeholder="Objective name"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Description</label>
              <textarea
                value={editingObjective.description}
                onChange={(e) =>
                  setEditingObjective({
                    ...editingObjective,
                    description: e.target.value,
                  })
                }
                className={`${glassInput} w-full text-sm h-20 resize-none`}
                placeholder="Objective description"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveObjective}
                className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelObjective}
                className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objectives List */}
      <div className="space-y-2">
        {config.objectives.length === 0 ? (
          <p className="text-xs text-white/40 italic py-4 text-center">
            No objectives defined
          </p>
        ) : (
          config.objectives.map((objective) => (
            <div key={objective.id} className={`${glassCard}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Target className="w-4 h-4 text-purple-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/90">{objective.name}</div>
                    <div className="text-xs text-white/50">{objective.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => removeObjective(objective.id)}
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
  );
}
