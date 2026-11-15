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
  Plus,
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
  { id: 'SCULPT', label: '3D Sculpt', icon: Sparkles },
  { id: 'TEXTURE_LAB', label: 'Haptic Lab', icon: Activity },
  { id: 'CAD_SLICER', label: 'CAD Slicer', icon: Layers },
  { id: 'PHYSICS', label: 'Physics Arena', icon: Box },
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
    <header className="glass-panel z-20 flex items-center justify-between px-5 py-3 border-b border-slate-700/60 shadow-xl gap-4 select-none">
      {/* Left: Menu / Exit & Status Badge */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExitToMenu}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 shadow-sm transition-all"
          title="Return to Start Menu"
        >
          <Home className="w-4 h-4 text-sky-400" />
          <span>Menu</span>
        </button>

        {/* Minimalist Hardware Status Indicator (Clickable to reconnect if needed) */}
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-900/60 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all"
          title={connected ? 'Arduino Nano connected on COM6/COM7' : 'Click to connect Arduino Nano'}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="font-semibold">{connected ? 'Nano Online' : 'Connect Nano'}</span>
        </button>
      </div>

      {/* Center: BIG BOLD MODE SELECTOR */}
      <div className="flex items-center bg-slate-950/70 p-1.5 rounded-2xl border border-slate-800 shadow-inner gap-1.5">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode-Specific Quick Controls: BIG Sculpt / Remove or Physics Spawn */}
      <div className="flex items-center gap-2.5">
        {activeMode === 'SCULPT' && (
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => sculptTool !== 'DRAW' && onToggleTool()}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sculptTool === 'DRAW'
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>SCULPT</span>
            </button>
            <button
              onClick={() => sculptTool !== 'ERASE' && onToggleTool()}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                sculptTool === 'ERASE'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>REMOVE</span>
            </button>
          </div>
        )}

        {activeMode === 'PHYSICS' && onSpawnPhysics && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => onSpawnPhysics('cube')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition-all border border-sky-500/30"
            >
              + Cube
            </button>
            <button
              onClick={() => onSpawnPhysics('sphere')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all border border-purple-500/30"
            >
              + Sphere
            </button>
            <button
              onClick={() => onSpawnPhysics('gear')}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all border border-amber-500/30"
            >
              + Gear
            </button>
          </div>
        )}

        {/* Optical Webcam Blue Tracker Toggle */}
        <button
          onClick={onToggleTracker}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
            trackerActive
              ? 'bg-sky-600/30 text-sky-300 border-sky-500 shadow-md shadow-sky-600/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Toggle 60 FPS Blue LED Optical Tracking"
        >
          <Video className={`w-3.5 h-3.5 ${trackerActive ? 'text-sky-400' : ''}`} />
          <span>{trackerActive ? 'Blue Cam: ON' : 'Blue Cam'}</span>
        </button>

        {/* Recenter Button */}
        <button
          onClick={onRecenter}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-700 text-sky-300 border border-slate-700 hover:border-slate-600 shadow-sm transition-all"
          title="Zero / Calibrate Wand (or press Spacebar / Long-press wand button)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Recenter (Z)</span>
        </button>

        {/* Full Reset: World + MCU */}
        <button
          onClick={onResetAll}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm transition-all"
          title="Resets 3D world (strokes/physics) and recalibrates Arduino Nano MCU"
        >
          <RefreshCw className="w-4 h-4 text-rose-400" />
          <span>Reset All</span>
        </button>
      </div>
    </header>
  );
};
