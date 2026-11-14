export interface WandTelemetry {
  roll: number;
  pitch: number;
  yaw: number;
  ax: number;
  ay: number;
  az: number;
  btn: number; // 0 = released, 1 = pressed
  clickEvent: number; // 0 = none, 1 = single click, 2 = double click
}

export type DemoMode = 'SCULPT' | 'TEXTURE_LAB' | 'CAD_SLICER' | 'VOICE_PHYSICS';

export type SculptTool = 'DRAW' | 'ERASE';

export type TrackingSource = 'WEBCAM' | 'IMU_RAYCASTER' | 'SIMULATION';

export interface MaterialPreset {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
  hapticCmd: string;
  ledColor: [number, number, number];
  description: string;
}

export interface StrokePoint {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
}

export interface Stroke {
  id: string;
  points: StrokePoint[];
}
