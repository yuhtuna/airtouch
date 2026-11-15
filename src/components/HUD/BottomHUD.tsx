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
}) => {
  return (
    <footer className="pointer-events-none z-20 absolute bottom-6 inset-x-6 flex items-end justify-between select-none">
      {/* Left: Orientation & Angular Readout */}
      <div className="pointer-events-auto glass-panel px-5 py-3.5 rounded-2xl flex items-center gap-6 shadow-2xl border border-slate-700/80 bg-slate-950/85">
        <div className="flex flex-col">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Wand Angles
          </span>
          <div className="flex items-center gap-3.5 mt-1 font-mono text-sm">
            <div>
              <span className="text-slate-400 mr-1.5 font-bold">R</span>
              <b className="text-sky-400 font-extrabold">{telemetry.roll.toFixed(1)}°</b>
            </div>
            <div className="w-[1px] h-4 bg-slate-700" />
            <div>
              <span className="text-slate-400 mr-1.5 font-bold">P</span>
              <b className="text-purple-400 font-extrabold">{telemetry.pitch.toFixed(1)}°</b>
            </div>
            <div className="w-[1px] h-4 bg-slate-700" />
            <div>
              <span className="text-slate-400 mr-1.5 font-bold">Y</span>
              <b className="text-emerald-400 font-extrabold">{telemetry.yaw.toFixed(1)}°</b>
            </div>
          </div>
        </div>

        <div className="w-[1px] h-9 bg-slate-800" />

        {/* Tracking Source Status */}
        <div className="flex flex-col">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Tracking Source
          </span>
          <div className="flex items-center gap-2 mt-1 font-mono text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                trackingSource === 'WEBCAM'
                  ? 'bg-emerald-400 shadow-md shadow-emerald-400/50 animate-pulse'
                  : trackingSource === 'COASTING'
                  ? 'bg-amber-400 shadow-md shadow-amber-400/50 animate-pulse'
                  : trackingSource === 'IMU_RAYCASTER'
                  ? 'bg-sky-400 shadow-md shadow-sky-400/50'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-bold text-slate-100">
              {trackingSource === 'WEBCAM'
                ? '60 FPS Optical + IMU Fused'
                : trackingSource === 'COASTING'
                ? 'Inertial Coasting (IMU)'
                : trackingSource === 'IMU_RAYCASTER'
                ? 'IMU Laser Ray'
                : 'Demo Simulation'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: BIG CLEAR ACTION GUIDANCE CARD */}
      <div className="pointer-events-auto glass-panel px-6 py-3 rounded-2xl flex flex-col items-center gap-1.5 shadow-2xl border border-slate-700/80 bg-slate-950/90 max-w-2xl text-center">
        {/* Mode Action Headline */}
        <div>
          {activeMode === 'SCULPT' && (
            <div className="text-sm font-extrabold text-sky-400 flex items-center justify-center gap-2">
              <span>MODE 1: 3D SCULPTING — FREEHAND AIR-DRAWING</span>
            </div>
          )}
          {activeMode === 'TEXTURE_LAB' && (
            <div className="text-sm font-extrabold text-purple-400 flex items-center justify-center gap-2">
              <span>MODE 2: HAPTIC TEXTURE LAB — TACTILE SIMULATION</span>
            </div>
          )}
          {activeMode === 'CAD_SLICER' && (
            <div className="text-sm font-extrabold text-amber-400 flex items-center justify-center gap-2">
              <span>MODE 3: CAD SLICER — GEARBOX CROSS-SECTION INSPECTOR</span>
            </div>
          )}
          {activeMode === 'PHYSICS' && (
            <div className="text-sm font-extrabold text-emerald-400 flex items-center justify-center gap-2">
              <span>MODE 4: PHYSICS ARENA — INTERACTIVE IMPACT COLLISION</span>
            </div>
          )}
        </div>

        {/* Clear Action Instruction */}
        <div className="text-xs md:text-sm font-medium text-slate-200 leading-snug">
          {activeMode === 'SCULPT' && (
            <span>
              Hold <b className="text-rose-400 font-bold">Wand Trigger</b> (or click canvas) to{' '}
              <b className="text-sky-300 font-bold">{sculptTool === 'DRAW' ? 'extrude 3D tube' : 'erase strokes'}</b>. Twist wrist to scale brush size.
            </span>
          )}
          {activeMode === 'TEXTURE_LAB' && (
            <span>
              Hover wand tip over the <b className="text-purple-300 font-bold">4 material spheres</b> (Ice, Sandpaper, Metal, Rubber) to feel distinct physical vibrations on your Arduino Nano.
            </span>
          )}
          {activeMode === 'CAD_SLICER' && (
            <span>
              <b className="text-amber-300 font-bold">Tilt wand wrist</b> to rotate real-time 3D slicing knife plane. <b className="text-rose-400 font-bold">Hold trigger</b> to explode gearbox.
            </span>
          )}
          {activeMode === 'PHYSICS' && (
            <span>
              Click buttons to spawn shapes, then <b className="text-emerald-300 font-bold">swing your wand tip like a bat</b> to strike them! Feel physical haptic recoil on impact.
            </span>
          )}
        </div>

        {/* Persistent Keyboard & Wand Hardware Controls */}
        <div className="text-xs text-slate-400 font-mono flex items-center gap-2.5 border-t border-slate-800 pt-1.5 w-full justify-center">
          <span><b className="text-sky-300 font-bold">Double-Click Button</b> / <b className="text-sky-300 font-bold">Tab / 1-4</b>: Mode</span>
          <span className="text-slate-600">•</span>
          <span><b className="text-sky-300 font-bold">Long-Press (&gt;1s)</b> / <b className="text-sky-300 font-bold">Space</b>: Recenter</span>
          <span className="text-slate-600">•</span>
          <span><b className="text-sky-300 font-bold">W / S or Wheel</b>: Depth (Z)</span>
        </div>
      </div>

      {/* Right: Primary Trigger & Dial Brush Status */}
      <div className="pointer-events-auto glass-panel px-5 py-3.5 rounded-2xl flex items-center gap-6 shadow-2xl border border-slate-700/80 bg-slate-950/85">
        {/* Trigger State */}
        <div className="flex flex-col">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Primary Trigger
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`h-3 w-3 rounded-full ${
                telemetry.btn === 1
                  ? 'bg-rose-500 shadow-md shadow-rose-500/60 animate-pulse'
                  : 'bg-slate-600'
              }`}
            />
            <span className={`text-sm font-black font-mono ${telemetry.btn === 1 ? 'text-rose-400' : 'text-slate-300'}`}>
              {telemetry.btn === 1 ? 'HELD (ACTIVE)' : 'RELEASED'}
            </span>
          </div>
        </div>

        <div className="w-[1px] h-9 bg-slate-800" />

        {/* Dial Brush Status */}
        <div className="flex flex-col">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Wrist Dial Radius
          </span>
          <div className="mt-1 font-mono text-sm">
            <span className="text-sky-400 font-black text-base">{brushRadius.toFixed(1)}x</span>
            <span className="text-slate-400 text-xs ml-1.5">scale</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
