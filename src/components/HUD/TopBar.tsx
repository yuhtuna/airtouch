import React from 'react';
import { DemoMode } from '../../types/telemetry';
import { Sparkles, Activity, Layers, Box, Mic, Video, RotateCcw, Plug, Unplug } from 'lucide-react';

interface TopBarProps {
  connected: boolean;
  activeMode: DemoMode;
  onModeSelect: (mode: DemoMode) => void;
  voiceActive: boolean;
  onToggleVoice: () => void;
  trackerActive: boolean;
  onToggleTracker: () => void;
  onRecenter: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const MODES: { id: DemoMode; label: string; icon: any }[] = [
  { id: 'SCULPT', label: '3D Sculpt', icon: Sparkles },
  { id: 'TEXTURE_LAB', label: 'Haptic Lab', icon: Activity },
  { id: 'CAD_SLICER', label: 'CAD Slicer', icon: Layers },
  { id: 'VOICE_PHYSICS', label: 'Physics', icon: Box },
];

export const TopBar: React.FC<TopBarProps> = ({
  connected,
  activeMode,
  onModeSelect,
  voiceActive,
  onToggleVoice,
  trackerActive,
  onToggleTracker,
  onRecenter,
  onConnect,
  onDisconnect,
}) => {
  return (
    <header className="glass-panel z-20 flex items-center justify-between px-6 py-3 border-b border-slate-700/60 shadow-lg">
      {/* Brand & Connection Indicator */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                connected ? 'bg-emerald-400 shadow-emerald-500/50 shadow-md' : 'bg-amber-400 animate-pulse'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">AirTouch</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                ESP32-S3 SENSE
              </span>
            </div>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-lg border border-slate-700/50">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isSelected = activeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onModeSelect(mode.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="flex items-center gap-3">
        {/* Voice Toggle */}
        <button
          onClick={onToggleVoice}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            voiceActive
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 shadow-sm'
              : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Toggle Web Speech recognition"
        >
          <Mic className={`w-3.5 h-3.5 ${voiceActive ? 'text-indigo-400 animate-pulse' : ''}`} />
          <span>{voiceActive ? 'Voice: On' : 'Voice'}</span>
        </button>

        {/* Optical Webcam Tracker Toggle */}
        <button
          onClick={onToggleTracker}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            trackerActive
              ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500 shadow-sm'
              : 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-800'
          }`}
          title="Toggle 60 FPS Optical Tip Tracking"
        >
          <Video className={`w-3.5 h-3.5 ${trackerActive ? 'text-emerald-400' : ''}`} />
          <span>{trackerActive ? '60 FPS Active' : 'Tracker'}</span>
        </button>

        {/* Recenter Button */}
        <button
          onClick={onRecenter}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-800 transition-all"
          title="Zero / Calibrate IMU and position (or press Spacebar)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
          <span>Recenter (Z)</span>
        </button>

        {/* Connect / Disconnect */}
        {!connected ? (
          <button
            onClick={onConnect}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white shadow-md shadow-sky-500/20 transition-all"
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Connect Wand</span>
          </button>
        ) : (
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all"
          >
            <Unplug className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        )}
      </div>
    </header>
  );
};
