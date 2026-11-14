import React from 'react';
import { WandTelemetry, DemoMode, SculptTool, TrackingSource } from '../../types/telemetry';

interface BottomHUDProps {
  telemetry: WandTelemetry;
  brushRadius: number;
  activeMode: DemoMode;
  sculptTool: SculptTool;
  trackingSource: TrackingSource;
  onToggleTool: () => void;
}

export const BottomHUD: React.FC<BottomHUDProps> = ({
  telemetry,
  brushRadius,
  activeMode,
  sculptTool,
  trackingSource,
  onToggleTool,
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
      <div className="pointer-events-auto glass-panel px-4 py-2 rounded-full flex items-center gap-3 text-xs font-medium text-slate-300 shadow-xl border border-slate-700/60">
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
        {activeMode === 'VOICE_PHYSICS' && (
          <span>Say <b className="text-sky-300">"Spawn gear"</b> or <b className="text-sky-300">"Spawn sphere"</b> to create physics bodies</span>
        )}
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
