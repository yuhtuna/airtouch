import React from 'react';
import { WandTelemetry, DemoMode, SculptTool, TrackingSource } from '../../types/telemetry';

interface BottomHUDProps {
  telemetry: WandTelemetry;
  brushRadius: number;
  activeMode: DemoMode;
  sculptTool: SculptTool;
  trackingSource: TrackingSource;
  onToggleTool: () => void;
  onSpawn?: (shape: 'cube' | 'sphere' | 'cylinder' | 'gear') => void;
}

export const BottomHUD: React.FC<BottomHUDProps> = ({
  telemetry,
  brushRadius,
  activeMode,
  sculptTool,
  trackingSource,
  onToggleTool,
  onSpawn,
}) => {
  return (
    <footer className="pointer-events-none z-20 absolute bottom-5 inset-x-6 flex items-end justify-between">
      {/* Left: Orientation & Angular Readout */}
      <div className="pointer-events-auto glass-panel p-3.5 rounded-xl flex items-center gap-5 shadow-2xl">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Wand Angles
          </span>
          <div className="flex items-center gap-3 mt-1 font-mono text-xs">
            <div>
              <span className="text-slate-500 mr-1">R</span>
              <b className="text-sky-400 font-bold">{telemetry.roll.toFixed(1)}°</b>
            </div>
            <div className="w-[1px] h-3 bg-slate-700" />
            <div>
              <span className="text-slate-500 mr-1">P</span>
              <b className="text-purple-400 font-bold">{telemetry.pitch.toFixed(1)}°</b>
            </div>
            <div className="w-[1px] h-3 bg-slate-700" />
            <div>
              <span className="text-slate-500 mr-1">Y</span>
              <b className="text-emerald-400 font-bold">{telemetry.yaw.toFixed(1)}°</b>
            </div>
          </div>
        </div>

        <div className="w-[1px] h-8 bg-slate-800" />

        {/* Tracking Source Status */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Tracking Source
          </span>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                trackingSource === 'WEBCAM'
                  ? 'bg-emerald-400'
                  : trackingSource === 'IMU_RAYCASTER'
                  ? 'bg-sky-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-200">
              {trackingSource === 'WEBCAM'
                ? '60 FPS Webcam'
                : trackingSource === 'IMU_RAYCASTER'
                ? 'IMU Laser Ray'
                : 'Demo Sim'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Mode Specific Hint Pill & Tool Toggle */}
      <div className="pointer-events-auto glass-panel px-4 py-2 rounded-xl flex flex-col items-center gap-1 text-xs font-medium text-slate-300 shadow-xl border border-slate-700/60">
        <div>
        {activeMode === 'SCULPT' && (
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTool}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                sculptTool === 'DRAW'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}
            >
              Tool: {sculptTool} (Click to toggle)
            </button>
            <span className="text-slate-400">
              Hold <b className="text-rose-400">Trigger</b> to {sculptTool === 'DRAW' ? 'extrude 3D tube' : 'erase stroke'} • Twist wrist for radius
            </span>
          </div>
        )}
        {activeMode === 'TEXTURE_LAB' && (
          <span>Hover wand tip over material spheres to experience physical surface waveforms & LED sync</span>
        )}
        {activeMode === 'CAD_SLICER' && (
          <span>Tilt wand wrist to rotate cross-section clipping plane • Hold trigger to explode parts</span>
        )}
        {activeMode === 'PHYSICS' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Spawn:</span>
            <button
              onClick={() => onSpawn?.('cube')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-all pointer-events-auto"
            >
              + Cube
            </button>
            <button
              onClick={() => onSpawn?.('sphere')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all pointer-events-auto"
            >
              + Sphere
            </button>
            <button
              onClick={() => onSpawn?.('gear')}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all pointer-events-auto"
            >
              + Gear
            </button>
            <span className="text-slate-400 ml-1">Bat them around with the wand!</span>
          </div>
        )}
        </div>
        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 border-t border-slate-800/80 pt-1 w-full justify-center">
          <span><b className="text-sky-300">Double-Click Button</b> or <b className="text-sky-300">Tab / 1-4</b>: Switch Mode</span>
          <span className="text-slate-600">•</span>
          <span><b className="text-sky-300">Long-Press (&gt;1s)</b> or <b className="text-sky-300">Space</b>: Recenter</span>
        </div>
      </div>

      {/* Right: Trigger & Dial Status */}
      <div className="pointer-events-auto glass-panel p-3.5 rounded-xl flex items-center gap-5 shadow-2xl">
        {/* Trigger State */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Primary Trigger
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                telemetry.btn === 1 ? 'bg-rose-500 shadow-rose-500/50 shadow-sm animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="font-mono text-xs font-semibold">
              {telemetry.btn === 1 ? (
                <span className="text-rose-400">ACTIVE</span>
              ) : (
                <span className="text-slate-400">HOVER</span>
              )}
            </span>
          </div>
        </div>

        <div className="w-[1px] h-8 bg-slate-800" />

        {/* Brush Dial */}
        <div className="flex flex-col">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Wrist Dial (Roll)
          </span>
          <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
            <span className="text-amber-400 font-bold">{brushRadius.toFixed(2)}x</span>
            <span className="text-[11px] text-slate-500">radius</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
