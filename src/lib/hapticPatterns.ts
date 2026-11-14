import { MaterialPreset } from '../types/telemetry';

export const HAPTIC_PATTERNS = {
  DETENT_CLICK: 'H,140,15\n',
  SCULPT_EXTRUDE: 'H,85,45\n',
  COLLISION_THUD: 'H,200,80\n',
  HEAVY_IMPACT: 'H,255,65\n',
  RECENTER_CONFIRM: 'H,160,35\n',
  UNDO_PULSE: 'H,220,40\n',
  STOP: 'H,0,0\n',
};

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'ice',
    name: 'Ice',
    color: '#93c5fd',
    roughness: 0.05,
    metalness: 0.1,
    hapticCmd: 'H,35,20\n',
    ledColor: [147, 197, 253],
    description: 'Ultra-low friction glide',
  },
  {
    id: 'sandpaper',
    name: 'Coarse Sandpaper',
    color: '#d97706',
    roughness: 0.95,
    metalness: 0.0,
    hapticCmd: 'H,190,50\n',
    ledColor: [217, 119, 6],
    description: 'High-frequency granular friction',
  },
  {
    id: 'metal',
    name: 'Corrugated Metal',
    color: '#94a3b8',
    roughness: 0.35,
    metalness: 0.85,
    hapticCmd: 'H,220,18\n',
    ledColor: [148, 163, 184],
    description: 'Rhythmic detent ridges',
  },
  {
    id: 'rubber',
    name: 'Soft Rubber',
    color: '#10b981',
    roughness: 0.7,
    metalness: 0.05,
    hapticCmd: 'H,80,75\n',
    ledColor: [16, 185, 129],
    description: 'Viscoelastic cushioned drag',
  },
];
