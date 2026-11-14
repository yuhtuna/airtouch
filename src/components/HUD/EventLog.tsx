import React, { useState } from 'react';
import { Terminal, ChevronUp, ChevronDown } from 'lucide-react';

interface EventLogProps {
  logs: string[];
}

export const EventLog: React.FC<EventLogProps> = ({ logs }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="z-20 absolute top-16 right-6 w-80 glass-panel rounded-xl overflow-hidden shadow-2xl transition-all">
      {/* Drawer Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/70 border-b border-slate-700/60 cursor-pointer hover:bg-slate-900 transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-sky-400" />
          <span>Wand Event Stream</span>
        </div>
        <button className="text-slate-400 hover:text-slate-200">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {/* Drawer Content */}
      {!collapsed && (
        <div className="p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px] text-slate-400">
          {logs.map((log, index) => (
            <div
              key={index}
              className={`leading-relaxed ${
                log.includes('Gesture')
                  ? 'text-amber-300 font-semibold'
                  : log.includes('Voice')
                  ? 'text-indigo-300'
                  : log.includes('Connected')
                  ? 'text-emerald-300'
                  : ''
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
