import React from 'react';
import { DemoMode, SculptTool } from '../../types/telemetry';
import {
  Sparkles,
  Activity,
  Layers,
  Box,
  Video,
  RotateCcw,
  RefreshCw,
  Home,
  PenTool,
  Eraser,
} from 'lucide-react';

interface TopBarProps {
  connected: boolean;
  activeMode: DemoMode;
  onModeSelect: (mode: DemoMode) => void;
  trackerActive: boolean;
  onToggleTracker: () => void;
  onRecenter: () => void;
  onResetAll: () => void;
  onExitToMenu: () => void;
  sculptTool: SculptTool;
  onToggleTool: () => void;
  onSpawnPhysics?: (shape: 'cube' | 'sphere' | 'gear') => void;
  onConnect?: () => void;
}

const MODES: { id: DemoMode; label: string; icon: any }[] = [
  { id: 'SCULPT', label: '1. 3D Sculpt', icon: Sparkles },
  { id: 'TEXTURE_LAB', label: '2. Haptic Lab', icon: Activity },
  { id: 'CAD_SLICER', label: '3. CAD Slicer', icon: Layers },
  { id: 'PHYSICS', label: '4. Physics Arena', icon: Box },
];

export const TopBar: React.FC<TopBarProps> = ({
  connected,
  activeMode,
  onModeSelect,
  trackerActive,
  onToggleTracker,
  onRecenter,
  onResetAll,
  onExitToMenu,
  sculptTool,
  onToggleTool,
  onSpawnPhysics,
  onConnect,
}) => {
  return (
    <header className="glass-panel z-20 flex items-center justify-between px-6 py-3.5 border-b border-slate-700/80 shadow-2xl gap-4 select-none">
      {/* Left: Menu & Hardware Status */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={onExitToMenu}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 hover:border-slate-500 shadow-md transition-all active:scale-95"
          title="Return to Start Menu"
        >
          <Home className="w-5 h-5 text-sky-400" />
          <span>Menu</span>
        </button>

        {/* Minimalist Hardware Status Indicator */}
        <button
          onClick={onConnect}
          className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-mono transition-all ${
            connected
              ? 'bg-slate-900/80 border border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/20 border border-amber-400/80 text-amber-200 animate-pulse hover:bg-amber-500/30 shadow-lg shadow-amber-500/20'
          }`}
          title={connected ? 'Arduino Nano connected on COM6/COM7' : 'Click to connect Arduino Nano on COM6/COM7'}
        >
          <span
            className={`w-3 h-3 rounded-full ${
              connected
                ? 'bg-emerald-400 shadow-md shadow-emerald-400/50'
                : 'bg-amber-400 animate-ping'
            }`}
          />
          <span className="font-bold tracking-wide">
            {connected ? 'NANO ONLINE' : 'CLICK TO CONNECT NANO'}
          </span>
        </button>
      </div>

      {/* Center: BIG BOLD MODE SELECTOR */}
      <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-slate-700 shadow-inner gap-2">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm md:text-base font-extrabold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/30 scale-[1.03] ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Controls: Big Sculpt/Remove, Tracker, Recenter, Reset */}
      <div className="flex items-center gap-3">
        {/* Sculpt / Remove Big Chunky Toggle */}
        {activeMode === 'SCULPT' && (
          <div className="flex items-center bg-slate-900 p-1 rounded-2xl border border-slate-700 shadow-md">
            <button
              onClick={() => sculptTool !== 'DRAW' && onToggleTool()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                sculptTool === 'DRAW'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/40 ring-1 ring-white/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span>SCULPT</span>
            </button>
            <button
              onClick={() => sculptTool !== 'ERASE' && onToggleTool()}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all ${
                sculptTool === 'ERASE'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 ring-1 ring-white/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span>REMOVE</span>
            </button>
          </div>
        )}

        {/* Physics Spawners */}
        {activeMode === 'PHYSICS' && onSpawnPhysics && (
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => onSpawnPhysics('cube')}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-all border border-sky-500/40"
            >
              + Cube
            </button>
            <button
              onClick={() => onSpawnPhysics('sphere')}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all border border-purple-500/40"
            >
              + Sphere
            </button>
            <button
              onClick={() => onSpawnPhysics('gear')}
              className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all border border-amber-500/40"
            >
              + Gear
            </button>
          </div>
        )}

        {/* Optical Webcam Blue Tracker Toggle */}
        <button
          onClick={onToggleTracker}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-md ${
            trackerActive
              ? 'bg-sky-500/25 text-sky-200 border-sky-400 shadow-sky-500/20'
              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
          }`}
          title="Toggle 60 FPS Blue LED Optical Tracking"
        >
          <Video className={`w-4 h-4 ${trackerActive ? 'text-sky-400' : ''}`} />
          <span>{trackerActive ? 'Blue Cam: ON' : 'Blue Cam'}</span>
        </button>

        {/* Recenter Button */}
        <button
          onClick={onRecenter}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 hover:border-sky-500/50 shadow-md transition-all active:scale-95"
          title="Zero / Calibrate Wand (or press Spacebar / Long-press wand button)"
        >
          <RotateCcw className="w-4 h-4 text-sky-400" />
          <span>Recenter (Z)</span>
        </button>

        {/* Full Reset: World + MCU */}
        <button
          onClick={onResetAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-rose-600/25 hover:bg-rose-600/35 text-rose-200 border border-rose-500 shadow-md transition-all active:scale-95"
          title="Resets 3D world (strokes/physics) and recalibrates Arduino Nano MCU"
        >
          <RefreshCw className="w-4 h-4 text-rose-400" />
          <span>Reset All</span>
        </button>
      </div>
    </header>
  );
};
