import { WandTelemetry } from '../types/telemetry';

export function parseTelemetryLine(line: string): WandTelemetry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('T,')) return null;

  const parts = trimmed.split(',');
  if (parts.length < 9) return null;

  const roll = parseFloat(parts[1]);
  const pitch = parseFloat(parts[2]);
  const yaw = parseFloat(parts[3]);
  const ax = parseFloat(parts[4]);
  const ay = parseFloat(parts[5]);
  const az = parseFloat(parts[6]);
  const btn = parseInt(parts[7], 10);
  const clickEvent = parseInt(parts[8], 10);

  if (isNaN(roll) || isNaN(pitch) || isNaN(yaw)) return null;

  return {
    roll,
    pitch,
    yaw,
    ax: isNaN(ax) ? 0 : ax,
    ay: isNaN(ay) ? 0 : ay,
    az: isNaN(az) ? 9.8 : az,
    btn: isNaN(btn) ? 0 : btn,
    clickEvent: isNaN(clickEvent) ? 0 : clickEvent,
  };
}

export function formatHapticCommand(pwm: number, durationMs = 0): string {
  const clamped = Math.max(0, Math.min(255, Math.round(pwm)));
  return `H,${clamped},${Math.round(durationMs)}\n`;
}

export function formatLedColorCommand(r: number, g: number, b: number): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return `C,${cr},${cg},${cb}\n`;
}

export const ZERO_CALIBRATION_COMMAND = 'Z\n';
