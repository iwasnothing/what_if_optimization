import { useState } from "react";
import {
  Plus,
  Trash2,
  Save,
  X,
  ShieldCheck,
} from "lucide-react";
import { glassInput, glassButton, glassCard } from "../lib/constants";
import type {
  ConfigState,
  Constraint,
} from "../types";

interface ConstraintTabProps {
  config: ConfigState;
  onConfigChange: (config: Partial<ConfigState>) => void;
}

export default function ConstraintTab({
  config,
  onConfigChange,
}: ConstraintTabProps) {
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null);

  const addConstraint = () => {
    const newConstraint: Constraint = {
      id: Date.now(),
      name: "",
      description: "",
    };
    setEditingConstraint(newConstraint);
  };

  const saveConstraint = () => {
    if (!editingConstraint || !editingConstraint.name.trim()) return;
    onConfigChange({
      constraints: [...config.constraints, editingConstraint],
    });
    setEditingConstraint(null);
  };

  const cancelConstraint = () => {
    setEditingConstraint(null);
  };

  const removeConstraint = (id: number) => {
    onConfigChange({
      constraints: config.constraints.filter((c) => c.id !== id),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          Constraints
        </h3>
        <button onClick={addConstraint} className={`${glassButton} text-xs py-1.5`}>
          <Plus className="w-3 h-3" /> Add Constraint
        </button>
      </div>

      {/* New/Edit Constraint Form */}
      {editingConstraint && (
        <div className={`${glassCard} border-amber-500/30`}>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Name</label>
              <input
                type="text"
                value={editingConstraint.name}
                onChange={(e) =>
                  setEditingConstraint({
                    ...editingConstraint,
                    name: e.target.value,
                  })
                }
                className={`${glassInput} w-full text-sm`}
                placeholder="Constraint name"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/50 block mb-1">Description</label>
              <textarea
                value={editingConstraint.description}
                onChange={(e) =>
                  setEditingConstraint({
                    ...editingConstraint,
                    description: e.target.value,
                  })
                }
                className={`${glassInput} w-full text-sm h-20 resize-none`}
                placeholder="Constraint description"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveConstraint}
                className={`${glassButton} flex-1 py-2 bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30`}
              >
                <Save className="w-3 h-3" /> Save
              </button>
              <button
                onClick={cancelConstraint}
                className={`${glassButton} py-2 bg-red-500/20 border-red-500/50 hover:bg-red-500/30`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Constraints List */}
      <div className="space-y-2">
        {config.constraints.length === 0 ? (
          <p className="text-xs text-white/40 italic py-4 text-center">
            No constraints defined
          </p>
        ) : (
          config.constraints.map((constraint) => (
            <div key={constraint.id} className={`${glassCard}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white/90">{constraint.name}</div>
                    <div className="text-xs text-white/50">{constraint.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => removeConstraint(constraint.id)}
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
