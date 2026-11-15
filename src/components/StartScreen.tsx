import React from 'react';
import { Play, Sparkles, Cpu, Eye, RotateCcw } from 'lucide-react';

interface StartScreenProps {
  onStart: () => void;
  connected: boolean;
  trackerActive: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  connected,
  trackerActive,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm select-none p-6 animate-fade-in">
      {/* Central Glassmorphic Card */}
      <div className="glass-panel max-w-xl w-full p-8 md:p-10 rounded-3xl border border-sky-500/30 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-sky-500/20 blur-3xl pointer-events-none rounded-full" />

        {/* Brand Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono font-semibold mb-4">
          <Cpu className="w-3.5 h-3.5 text-sky-400" />
          <span>ARDUINO NANO SPATIAL CONTROLLER</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
          Air<span className="text-sky-400">Touch</span>
        </h1>
        <p className="text-slate-300 text-sm md:text-base max-w-md leading-relaxed mb-8">
          Mid-air 3D spatial computing powered by 60 FPS blue optical tracking, 100 Hz IMU orientation, and vibrotactile haptics.
        </p>

        {/* Big Start Experience Button */}
        <button
          onClick={onStart}
          className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-lg shadow-xl shadow-sky-500/25 transition-all transform hover:scale-[1.03] active:scale-[0.98] mb-8"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>START WORKSPACE</span>
        </button>

        {/* Controls Quick Reference Grid */}
        <div className="grid grid-cols-2 gap-3 w-full text-left text-xs text-slate-300 font-mono">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-100 block">Wand / Mouse</b>
              <span>Hold trigger to draw, slice, or bat 3D models</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
            <Eye className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-100 block">Double-Click</b>
              <span>Cycle between 3D Sculpt, Haptic, CAD, and Physics</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
            <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-100 block">Long-Press (&gt;1s)</b>
              <span>Zero and recalibrate wand orientation</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5">
            <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <b className="text-slate-100 block">Full Sync</b>
              <span>On-screen buttons match wand hardware 1:1</span>
            </div>
          </div>
        </div>

        {/* Status Line */}
        <div className="flex items-center gap-4 mt-6 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            {connected ? 'Arduino Nano Online' : 'Nano Auto-Detect (COM6/COM7)'}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${trackerActive ? 'bg-sky-400' : 'bg-slate-500'}`} />
            {trackerActive ? 'Blue Cam Active' : 'Webcam Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};
