import React from 'react';
import { DemoMode, SculptTool, SculptTarget } from '../../types/telemetry';
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
  Wand2,
  CircleDot,
  Grid,
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
  onSelectTool: (tool: SculptTool) => void;
  sculptTarget: SculptTarget;
  onToggleTarget: () => void;
  onResetClay: () => void;
  wireframe: boolean;
  onToggleWireframe: () => void;
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
  onSelectTool,
  sculptTarget,
  onToggleTarget,
  onResetClay,
  wireframe,
  onToggleWireframe,
  onSpawnPhysics,
  onConnect,
}) => {
  return (
    <header className="glass-panel z-20 flex items-center justify-between px-6 py-3 border-b border-slate-700/80 shadow-2xl gap-3 select-none flex-wrap">
      {/* Left: Menu & Hardware Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExitToMenu}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 hover:border-slate-500 shadow-md transition-all active:scale-95"
          title="Return to Start Menu"
        >
          <Home className="w-4 h-4 text-sky-400" />
          <span>Menu</span>
        </button>

        {/* Minimalist Hardware Status Indicator */}
        <button
          onClick={onConnect}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
            connected
              ? 'bg-slate-900/80 border border-emerald-500/40 text-emerald-300'
              : 'bg-amber-500/20 border border-amber-400/80 text-amber-200 animate-pulse hover:bg-amber-500/30 shadow-lg shadow-amber-500/20'
          }`}
          title={connected ? 'Arduino Nano connected on COM6' : 'Click to connect Arduino Nano on COM6'}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected
                ? 'bg-emerald-400 shadow-md shadow-emerald-400/50'
                : 'bg-amber-400 animate-ping'
            }`}
          />
          <span className="font-bold tracking-wide">
            {connected ? 'NANO ONLINE' : 'CONNECT NANO'}
          </span>
        </button>
      </div>

      {/* Center: BIG BOLD MODE SELECTOR */}
      <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-700 shadow-inner gap-1.5">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isSelected = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeSelect(mode.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-extrabold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-xl shadow-sky-500/30 scale-[1.02] ring-1 ring-white/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Controls: Sculpt Tools, Clay/Air Target, Tracker, Recenter, Reset */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Sculpting Controls Bar */}
        {activeMode === 'SCULPT' && (
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-2xl border border-slate-700 shadow-inner">
            {/* Target Selector: CLAY BALL vs AIR DRAW */}
            <button
              onClick={onToggleTarget}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                sculptTarget === 'CLAY'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/40 ring-1 ring-white/30'
                  : 'bg-sky-600 text-white shadow-md shadow-sky-600/40 ring-1 ring-white/30'
              }`}
              title="Toggle between Blender Clay Ball vs Freehand 3D Air Drawing"
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>{sculptTarget === 'CLAY' ? 'CLAY BALL' : 'AIR DRAW'}</span>
            </button>

            <div className="w-[1px] h-5 bg-slate-800" />

            {/* Tool Toggles: SCULPT (DRAW), CARVE (ERASE), SMOOTH */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSelectTool('DRAW')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  sculptTool === 'DRAW'
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/40 ring-1 ring-white/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Inflate / Add Clay (Press wand button to sculpt)"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>SCULPT</span>
              </button>

              <button
                onClick={() => onSelectTool('ERASE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  sculptTool === 'ERASE'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/40 ring-1 ring-white/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Carve / Depress Clay (Press wand button to carve)"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>CARVE</span>
              </button>

              {sculptTarget === 'CLAY' && (
                <button
                  onClick={() => onSelectTool('SMOOTH')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                    sculptTool === 'SMOOTH'
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/40 ring-1 ring-white/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Smooth / Level surface (Press wand button to smooth)"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>SMOOTH</span>
                </button>
              )}
            </div>

            {/* Extra Clay Controls */}
            {sculptTarget === 'CLAY' && (
              <>
                <div className="w-[1px] h-5 bg-slate-800" />
                <button
                  onClick={onResetClay}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all"
                  title="Reset clay back to smooth sphere"
                >
                  Reset Clay
                </button>
                <button
                  onClick={onToggleWireframe}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    wireframe
                      ? 'bg-sky-500/30 text-sky-200 border-sky-400'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Toggle wireframe topology"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
              </>
            )}
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
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-md ${
            trackerActive
              ? 'bg-sky-500/25 text-sky-200 border-sky-400 shadow-sky-500/20'
              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
          }`}
          title="Toggle 60 FPS Blue LED Optical Tracking"
        >
          <Video className={`w-3.5 h-3.5 ${trackerActive ? 'text-sky-400' : ''}`} />
          <span>{trackerActive ? 'Blue Cam: ON' : 'Blue Cam'}</span>
        </button>

        {/* Recenter Button */}
        <button
          onClick={onRecenter}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 hover:border-sky-500/50 shadow-md transition-all active:scale-95"
          title="Zero / Calibrate Wand (Spacebar)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Recenter (Z)</span>
        </button>

        {/* Full Reset: World + MCU */}
        <button
          onClick={onResetAll}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600/25 hover:bg-rose-600/35 text-rose-200 border border-rose-500 shadow-md transition-all active:scale-95"
          title="Resets 3D world and recalibrates Arduino Nano MCU"
        >
          <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
          <span>Reset All</span>
        </button>
      </div>
    </header>
  );
};
