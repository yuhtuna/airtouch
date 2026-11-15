import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

import { WandTelemetry, DemoMode, Stroke, StrokePoint, SculptTool, TrackingSource } from './types/telemetry';
import { useSerial } from './hooks/useSerial';
import { useWebcamTracker } from './hooks/useWebcamTracker';
import { Wand3D } from './components/Wand3D';
import { TopBar } from './components/HUD/TopBar';
import { BottomHUD } from './components/HUD/BottomHUD';
import { EventLog } from './components/HUD/EventLog';
import { StartScreen } from './components/StartScreen';
import { RotatingBackground } from './components/RotatingBackground';
import { WorldOriginCursor } from './components/WorldOriginCursor';

import { SculptMode } from './modes/SculptMode';
import { TextureLabMode } from './modes/TextureLabMode';
import { CADSlicerMode } from './modes/CADSlicerMode';
import { PhysicsSandboxMode, PhysicsObject } from './modes/PhysicsSandboxMode';
import { HAPTIC_PATTERNS } from './lib/hapticPatterns';
import { audioHaptics } from './lib/audioHaptics';
import { DepthSensorFusion } from './lib/sensorFusion';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [activeMode, setActiveMode] = useState<DemoMode>('SCULPT');
  const [sculptTool, setSculptTool] = useState<SculptTool>('DRAW');
  const [manualTriggerHeld, setManualTriggerHeld] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    'AirTouch Spatial Studio active.',
    'Ready for Arduino Nano hardware or interactive browser simulation.',
  ]);

  // Wand Spatial State Refs for Zero-latency useFrame rendering
  const wandPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const wandRotRef = useRef<[number, number, number]>([0, 0, 0]);
  const wandTipPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0.68));
  const lastOpticalPosRef = useRef<[number, number, number] | null>(null);
  const opticalConfidenceRef = useRef(0);
  const trackerActiveRef = useRef(false);
  const depthNudgeRef = useRef(0);
  const recalibrateDepthRef = useRef<() => void>(() => {});
  const depthFusionRef = useRef(new DepthSensorFusion());
  const opticalOffsetRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastOpticalRawPosRef = useRef<[number, number, number]>([0, 0, 0]);
  const lastOpticalSeenTimeRef = useRef<number>(0);
  const lastValidTipPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0.68));
  const trackingStateRef = useRef<'OPTICAL_LOCKED' | 'COASTING' | 'IMU_RAYCAST'>('IMU_RAYCAST');

  // Telemetry HUD state
  const [telemetry, setTelemetry] = useState<WandTelemetry>({
    roll: 0,
    pitch: 0,
    yaw: 0,
    ax: 0,
    ay: 0,
    az: 9.8,
    btn: 0,
    clickEvent: 0,
  });

  const [brushRadius, setBrushRadius] = useState(1.0);
  const lastDetentIndexRef = useRef(0);

  // Sculpt Mode State
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  // Physics Mode State
  const [physicsObjects, setPhysicsObjects] = useState<PhysicsObject[]>([
    { id: '1', shape: 'cube', position: [-0.8, 2.0, -1], color: '#38bdf8' },
    { id: '2', shape: 'sphere', position: [0.8, 2.5, -1], color: '#a855f7' },
    { id: '3', shape: 'gear', position: [0.0, 3.0, -1.2], color: '#f59e0b' },
  ]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 18)]);
  }, []);

  // Button state refs for long-press and event dispatching
  const lastBtnStateRef = useRef(false);
  const btnPressStartRef = useRef(0);
  const hasLongPressedRef = useRef(false);

  const cycleModeRef = useRef<() => void>(() => {});
  const handleRecenterRef = useRef<() => void>(() => {});
  const handleUndoRef = useRef<() => void>(() => {});

  // Web Serial Hook
  const { connected, connect, disconnect, sendCommand } = useSerial({
    onTelemetry: (data) => {
      setTelemetry(data);

      // 1. Update orientation [pitch, yaw, roll]
      wandRotRef.current = [data.pitch, data.yaw, data.roll];

      // 2. High-frequency state prediction via DepthSensorFusion
      const fusedZ = depthFusionRef.current.updateIMU(
        data.ax,
        data.ay,
        data.az,
        data.pitch,
        data.yaw,
        data.roll,
        performance.now()
      );

      const now = performance.now();
      const timeSinceOptical = now - lastOpticalSeenTimeRef.current;
      const isOpticalActive =
        trackerActiveRef.current &&
        lastOpticalSeenTimeRef.current > 0 &&
        timeSinceOptical <= 300;

      const targetEuler = new THREE.Euler(
        (data.pitch * Math.PI) / 180,
        (data.yaw * Math.PI) / 180,
        (data.roll * Math.PI) / 180,
        'YXZ'
      );
      const tipOffset = new THREE.Vector3(0, 0, 0.68).applyEuler(targetEuler);

      if (isOpticalActive) {
        // High-frequency depth prediction: update tip Z with fused depth
        const activeZ = fusedZ + depthNudgeRef.current;
        wandTipPosRef.current.z = activeZ;

        // Wand handle follows kinematics (beacon at local [0, 0, 0.68])
        wandPosRef.current = [
          wandTipPosRef.current.x - tipOffset.x,
          wandTipPosRef.current.y - tipOffset.y,
          wandTipPosRef.current.z - tipOffset.z,
        ];
      } else {
        // IMU Raycaster fallback mode (when optical tracking is inactive / lost > 300ms)
        const radYaw = (data.yaw * Math.PI) / 180;
        const radPitch = (data.pitch * Math.PI) / 180;
        const rayDistance = 2.8;
        const imuRayPos: [number, number, number] = [
          Math.sin(radYaw) * rayDistance,
          -Math.sin(radPitch) * rayDistance + 0.3,
          -Math.cos(radYaw) * Math.cos(radPitch) * rayDistance + 2.2 + depthNudgeRef.current,
        ];

        // Smoothly lerp towards IMU raycast position to prevent sudden snaps
        const curPos = new THREE.Vector3(...wandPosRef.current);
        const targetRay = new THREE.Vector3(...imuRayPos);
        curPos.lerp(targetRay, 0.15);
        wandPosRef.current = [curPos.x, curPos.y, curPos.z];

        // Tip position follows handle in raycast mode
        wandTipPosRef.current.set(
          curPos.x + tipOffset.x,
          curPos.y + tipOffset.y,
          curPos.z + tipOffset.z
        );
      }

      // 4. Dynamic brush scaling from wrist roll (1x to 5x)
      const dialScale = Math.max(0.5, Math.min(5.0, 1.0 + data.roll / 40.0));
      setBrushRadius(+dialScale.toFixed(2));

      // 5. Discrete 15-degree Detent Dial Crossing Algorithm
      const currentDetent = Math.floor((data.roll + 7.5) / 15.0);
      if (currentDetent !== lastDetentIndexRef.current) {
        lastDetentIndexRef.current = currentDetent;
        sendCommand(HAPTIC_PATTERNS.DETENT_CLICK);
        audioHaptics.playDetentClick();
      }

      // 6. Gesture: Sharp Left Flick for Undo
      if (data.ax < -18.0 && data.btn === 0) {
        handleUndoRef.current();
      }

      // 7. Button Interactions:
      // Double Click -> Cycle Next Demo Mode
      if (data.clickEvent === 2) {
        cycleModeRef.current();
      }

      // Long Press (>1000ms) -> Recenter
      const btnNow = data.btn === 1;
      const wasPressed = lastBtnStateRef.current;
      lastBtnStateRef.current = btnNow;

      if (btnNow && !wasPressed) {
        btnPressStartRef.current = performance.now();
        hasLongPressedRef.current = false;
      } else if (btnNow && wasPressed) {
        if (!hasLongPressedRef.current && (performance.now() - btnPressStartRef.current) > 1000) {
          hasLongPressedRef.current = true;
          handleRecenterRef.current();
          addLog('Button Long Press (>1s): Wand recentered.');
        }
      }
    },
    onLog: addLog,
  });

  // Haptic trigger helper
  const triggerHaptic = useCallback(
    (pwm: number, ms: number) => {
      sendCommand(`H,${pwm},${ms}\n`);
    },
    [sendCommand]
  );

  // Recenter wand IMU and position
  const handleRecenter = useCallback(() => {
    depthNudgeRef.current = 0;
    recalibrateDepthRef.current();
    depthFusionRef.current.reset(0);
    // Lock optical offset to current camera position so wand centers at (0, 0, 0)
    opticalOffsetRef.current = [
      lastOpticalRawPosRef.current[0],
      lastOpticalRawPosRef.current[1],
      0,
    ];
    wandTipPosRef.current.set(0, 0, 0);
    lastValidTipPosRef.current.set(0, 0, 0);

    // Zero orientation refs, HUD state, and brush scale immediately
    wandRotRef.current = [0, 0, 0];
    setTelemetry((prev) => ({
      ...prev,
      roll: 0,
      pitch: 0,
      yaw: 0,
    }));
    setBrushRadius(1.0);

    const targetEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const tipOffset = new THREE.Vector3(0, 0, 0.68).applyEuler(targetEuler);
    wandPosRef.current = [-tipOffset.x, -tipOffset.y, -tipOffset.z];

    sendCommand('Z\n', true);
    triggerHaptic(160, 40);
    audioHaptics.playCollisionThud(0.8);
    addLog('Wand calibrated, neutral depth set & recentered (Z).');
  }, [sendCommand, triggerHaptic, addLog]);

  // Mode cycling callback
  const cycleMode = useCallback(() => {
    const modes: DemoMode[] = ['SCULPT', 'TEXTURE_LAB', 'CAD_SLICER', 'PHYSICS'];
    setActiveMode((prev) => {
      const nextIdx = (modes.indexOf(prev) + 1) % modes.length;
      const nextMode = modes[nextIdx];
      triggerHaptic(200, 60);
      audioHaptics.playDetentClick();
      addLog(`Button: Switched mode to ${nextMode}`);
      return nextMode;
    });
  }, [triggerHaptic, addLog]);

  // Undo gesture handler
  const handleUndo = useCallback(() => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      triggerHaptic(220, 40);
      audioHaptics.playDetentClick();
      addLog('Gesture: Sharp Left Flick -> Last stroke undone.');
      return prev.slice(0, prev.length - 1);
    });
  }, [triggerHaptic, addLog]);

  // Sync refs for event closures
  useEffect(() => {
    cycleModeRef.current = cycleMode;
    handleRecenterRef.current = handleRecenter;
    handleUndoRef.current = handleUndo;
  }, [cycleMode, handleRecenter, handleUndo]);

  // Clear Canvas
  const handleClear = useCallback(() => {
    setStrokes([]);
    setPhysicsObjects([]);
    triggerHaptic(180, 50);
    audioHaptics.playCollisionThud(0.6);
    addLog('Canvas cleared.');
  }, [triggerHaptic, addLog]);

  // Spawn Physics Object
  const handleSpawn = useCallback((shape: 'cube' | 'sphere' | 'cylinder' | 'gear') => {
    const colors = ['#38bdf8', '#a855f7', '#10b981', '#f59e0b', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newObj: PhysicsObject = {
      id: Math.random().toString(36).substring(2, 9),
      shape,
      position: [wandPosRef.current[0], wandPosRef.current[1] + 1.2, wandPosRef.current[2] - 0.5],
      color: randomColor,
    };
    setPhysicsObjects((prev) => [...prev, newObj]);
    triggerHaptic(200, 40);
    audioHaptics.playCollisionThud(1.0);
    addLog(`Spawned 3D ${shape}.`);
  }, [triggerHaptic, addLog]);

  // Optical Webcam Tracker Hook
  const {
    active: trackerActive,
    trackingConfidence,
    monitorCanvasRef,
    startTracker,
    stopTracker,
    recalibrateNeutralDepth,
  } = useWebcamTracker({
    getFusionMetrics: () => depthFusionRef.current.getMetrics(),
    onPositionUpdate: (pos, opticalTilt, metrics) => {
      const now = performance.now();
      lastOpticalRawPosRef.current = pos;

      if (metrics?.detected && metrics.confidence >= 15) {
        lastOpticalSeenTimeRef.current = now;
        trackingStateRef.current = 'OPTICAL_LOCKED';

        // 1. Position update with Recenter offset
        const posX = pos[0] - opticalOffsetRef.current[0];
        const posY = pos[1] - opticalOffsetRef.current[1];
        const rawOpticalZ = pos[2];

        // 2. Optical depth anchors the state observer
        const fusedZ = depthFusionRef.current.updateOptical(rawOpticalZ, metrics.confidence, now);
        const targetZ = fusedZ + depthNudgeRef.current;

        const adjustedTip: [number, number, number] = [posX, posY, targetZ];
        lastOpticalPosRef.current = adjustedTip;

        // 3. Update Tip Position directly (where the optical beacon is)
        wandTipPosRef.current.set(posX, posY, targetZ);
        lastValidTipPosRef.current.copy(wandTipPosRef.current);

        // 4. Optical blob tilt fallback when hardware IMU is not streaming
        if (
          opticalTilt &&
          (!connected ||
            (wandRotRef.current[0] === 0 &&
              wandRotRef.current[1] === 0 &&
              wandRotRef.current[2] === 0))
        ) {
          wandRotRef.current = opticalTilt;
        }

        // 5. Kinematic handle position
        const targetEuler = new THREE.Euler(
          (wandRotRef.current[0] * Math.PI) / 180,
          (wandRotRef.current[1] * Math.PI) / 180,
          (wandRotRef.current[2] * Math.PI) / 180,
          'YXZ'
        );
        const tipOffset = new THREE.Vector3(0, 0, 0.68).applyEuler(targetEuler);
        wandPosRef.current = [
          posX - tipOffset.x,
          posY - tipOffset.y,
          targetZ - tipOffset.z,
        ];
      } else {
        // Not detected in this camera frame:
        const timeSinceOptical = now - lastOpticalSeenTimeRef.current;
        if (lastOpticalSeenTimeRef.current > 0 && timeSinceOptical <= 300) {
          // COASTING STATE: Brief occlusion / frame dropout (<= 300ms)
          // Hold X and Y steady at last known optical position.
          // Dead-reckon Z depth using fused dynamic state!
          trackingStateRef.current = 'COASTING';
          const fusedZ = depthFusionRef.current.getDepth() + depthNudgeRef.current;
          wandTipPosRef.current.set(
            lastValidTipPosRef.current.x,
            lastValidTipPosRef.current.y,
            fusedZ
          );

          const targetEuler = new THREE.Euler(
            (wandRotRef.current[0] * Math.PI) / 180,
            (wandRotRef.current[1] * Math.PI) / 180,
            (wandRotRef.current[2] * Math.PI) / 180,
            'YXZ'
          );
          const tipOffset = new THREE.Vector3(0, 0, 0.68).applyEuler(targetEuler);
          wandPosRef.current = [
            wandTipPosRef.current.x - tipOffset.x,
            wandTipPosRef.current.y - tipOffset.y,
            wandTipPosRef.current.z - tipOffset.z,
          ];
        } else {
          trackingStateRef.current = 'IMU_RAYCAST';
        }
      }
    },
    onLog: addLog,
  });

  // Automatically unlatch trigger if hardware disconnects while button held
  useEffect(() => {
    if (!connected) {
      setTelemetry((prev) => ({
        ...prev,
        btn: 0,
        clickEvent: 0,
      }));
      setManualTriggerHeld(false);
    }
  }, [connected]);

  // Keep optical tracking refs synced for zero-latency frame access
  useEffect(() => {
    recalibrateDepthRef.current = recalibrateNeutralDepth;
    trackerActiveRef.current = trackerActive;
    opticalConfidenceRef.current = trackingConfidence;
  }, [recalibrateNeutralDepth, trackerActive, trackingConfidence]);

  // Full Reset: World (strokes, physics) AND MCU (calibration, haptics)
  const handleResetAll = useCallback(() => {
    setStrokes([]);
    setPhysicsObjects([
      { id: '1', shape: 'cube', position: [-0.8, 2.0, -1], color: '#38bdf8' },
      { id: '2', shape: 'sphere', position: [0.8, 2.5, -1], color: '#a855f7' },
      { id: '3', shape: 'gear', position: [0.0, 3.0, -1.2], color: '#f59e0b' },
    ]);
    opticalOffsetRef.current = [0, 0, 0];
    lastOpticalRawPosRef.current = [0, 0, 0];
    lastOpticalSeenTimeRef.current = 0;
    depthNudgeRef.current = 0;
    wandPosRef.current = [0, 0, 0];
    wandRotRef.current = [0, 0, 0];
    wandTipPosRef.current.set(0, 0, 0);
    lastValidTipPosRef.current.set(0, 0, 0);
    depthFusionRef.current.reset(0);
    setBrushRadius(1.0);
    setTelemetry((prev) => ({
      ...prev,
      roll: 0,
      pitch: 0,
      yaw: 0,
    }));
    recalibrateDepthRef.current();
    sendCommand('Z\n', true);
    triggerHaptic(200, 100);
    audioHaptics.playCollisionThud(1.0);
    addLog('Full Reset: 3D world strokes/physics cleared & Arduino Nano MCU recalibrated.');
  }, [sendCommand, triggerHaptic, addLog]);

  // Exit to Menu (Cleanly shuts down webcam stream)
  const handleExitToMenu = useCallback(() => {
    setIsStarted(false);
    stopTracker();
    addLog('Returned to Start Menu. Camera tracker paused.');
  }, [stopTracker, addLog]);

  // Start Workspace Handler
  const handleStartWorkspace = useCallback(() => {
    setIsStarted(true);
    triggerHaptic(180, 70);
    audioHaptics.playCollisionThud(0.8);
    addLog('Workspace started. Dual tracking active.');

    if (!connected) {
      connect();
    }
    if (!trackerActive) {
      startTracker();
    }
  }, [connected, connect, trackerActive, startTracker, triggerHaptic, addLog]);

  // Export STL
  const handleExportSTL = useCallback(() => {
    if (strokes.length === 0) {
      alert('No strokes to export! Draw something in 3D Sculpt mode first.');
      return;
    }

    const exporter = new STLExporter();
    const group = new THREE.Group();

    strokes.forEach((stroke) => {
      if (stroke.points.length < 3) return;
      try {
        const pts = stroke.points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
        const curve = new THREE.CatmullRomCurve3(pts);
        const geom = new THREE.TubeGeometry(curve, stroke.points.length * 4, stroke.points[0].radius, 8, false);
        const mesh = new THREE.Mesh(geom);
        group.add(mesh);
      } catch (e) {
        console.warn('Skipping stroke in STL export:', e);
      }
    });

    const result = exporter.parse(group, { binary: true });
    const buffer = result instanceof DataView ? (result.buffer as ArrayBuffer) : result;
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AirTouch_Sculpt_${Date.now()}.stl`;
    link.click();
    addLog('Exported 3D sculpt to binary STL file.');
  }, [strokes, addLog]);

  // Global Keyboard Shortcuts (Space: Recenter, E: Toggle Tool, Tab/M: Cycle Mode, 1-4: Select Mode, C: Clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleRecenter();
      } else if (e.code === 'KeyE') {
        setSculptTool((prev) => (prev === 'DRAW' ? 'ERASE' : 'DRAW'));
      } else if (e.code === 'Tab' || e.code === 'KeyM') {
        e.preventDefault();
        cycleMode();
      } else if (e.code === 'Digit1') {
        setActiveMode('SCULPT');
        addLog('Mode: 3D SCULPT');
      } else if (e.code === 'Digit2') {
        setActiveMode('TEXTURE_LAB');
        addLog('Mode: HAPTIC LAB');
      } else if (e.code === 'Digit3') {
        setActiveMode('CAD_SLICER');
        addLog('Mode: CAD SLICER');
      } else if (e.code === 'Digit4') {
        setActiveMode('PHYSICS');
        addLog('Mode: PHYSICS ARENA');
      } else if (e.code === 'KeyC') {
        handleClear();
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        depthNudgeRef.current += 0.25;
        const total = depthNudgeRef.current >= 0 ? `+${depthNudgeRef.current.toFixed(2)}` : depthNudgeRef.current.toFixed(2);
        addLog(`Depth: Pushed Forward (+0.25m, Nudge: ${total}m)`);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        depthNudgeRef.current -= 0.25;
        const total = depthNudgeRef.current >= 0 ? `+${depthNudgeRef.current.toFixed(2)}` : depthNudgeRef.current.toFixed(2);
        addLog(`Depth: Pulled Backward (-0.25m, Nudge: ${total}m)`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRecenter, cycleMode, handleClear, addLog]);

  // Active Disconnected Simulation Loop (Completely disabled when in menu OR when hardware connected OR when testing optical tracker)
  useEffect(() => {
    if (!isStarted || connected || trackerActive) return;

    let animId: number;
    let time = 0;

    const simulate = () => {
      animId = requestAnimationFrame(simulate);
      time += 0.02;

      // Natural wand floating motion
      const simPitch = Math.sin(time * 0.8) * 16;
      const simYaw = Math.cos(time * 0.5) * 22;
      const simRoll = Math.sin(time * 1.1) * 14;

      wandRotRef.current = [simPitch, simYaw, simRoll];

      wandPosRef.current = [
        Math.sin(time * 0.7) * 1.4,
        Math.cos(time * 0.9) * 0.5 + 0.2,
        Math.sin(time * 0.4) * 0.8,
      ];

      const targetEuler = new THREE.Euler(
        (simPitch * Math.PI) / 180,
        (simYaw * Math.PI) / 180,
        (simRoll * Math.PI) / 180,
        'YXZ'
      );
      const tipOffset = new THREE.Vector3(0, 0, 0.68).applyEuler(targetEuler);
      wandTipPosRef.current.set(
        wandPosRef.current[0] + tipOffset.x,
        wandPosRef.current[1] + tipOffset.y,
        wandPosRef.current[2] + tipOffset.z
      );

      setTelemetry((prev) => ({
        ...prev,
        pitch: +simPitch.toFixed(1),
        yaw: +simYaw.toFixed(1),
        roll: +simRoll.toFixed(1),
        ax: +(Math.sin(time) * 1.5).toFixed(2),
        ay: +(Math.cos(time) * 1.2).toFixed(2),
        az: 9.8,
      }));
    };

    animId = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animId);
  }, [isStarted, connected, trackerActive]);

  // Stroke management
  const handleAddCompletedStroke = useCallback((newStroke: Stroke) => {
    setStrokes((prev) => [...prev, newStroke]);
  }, []);

  const handleEraseAtTip = useCallback((tipPos: THREE.Vector3, radius: number) => {
    setStrokes((prev) =>
      prev.filter((stroke) =>
        !stroke.points.some((p) => new THREE.Vector3(p.x, p.y, p.z).distanceTo(tipPos) < radius)
      )
    );
  }, []);

  // Primary trigger: physical hardware button OR browser click-to-trigger
  const isTriggerHeld = telemetry.btn === 1 || manualTriggerHeld;

  // Tracking Source Calculation with Confidence Model & Coasting Hysteresis
  const trackingSource: TrackingSource = (trackerActive && trackingConfidence > 15)
    ? 'WEBCAM'
    : (trackerActive && lastOpticalSeenTimeRef.current > 0 && (performance.now() - lastOpticalSeenTimeRef.current) <= 300)
    ? 'COASTING'
    : connected
    ? 'IMU_RAYCASTER'
    : 'SIMULATION';

  return (
    <div
      className="relative w-screen h-screen bg-[#090d16] text-slate-100 flex flex-col overflow-hidden select-none"
      onMouseDown={(e) => {
        // Left click on canvas triggers drawing / action if not clicking HUD
        if ((e.target as HTMLElement).tagName === 'CANVAS') {
          setManualTriggerHeld(true);
        }
      }}
      onMouseUp={() => setManualTriggerHeld(false)}
      onWheel={(e) => {
        // Smooth mouse wheel depth zoom
        depthNudgeRef.current += e.deltaY * -0.002;
      }}
    >
      {/* Top Glassmorphic Navigation Bar (Shown when in workspace) */}
      {isStarted && (
        <TopBar
          connected={connected}
          activeMode={activeMode}
          onModeSelect={setActiveMode}
          trackerActive={trackerActive}
          onToggleTracker={trackerActive ? stopTracker : startTracker}
          onRecenter={handleRecenter}
          onResetAll={handleResetAll}
          onExitToMenu={handleExitToMenu}
          sculptTool={sculptTool}
          onToggleTool={() => setSculptTool((prev) => (prev === 'DRAW' ? 'ERASE' : 'DRAW'))}
          onSpawnPhysics={handleSpawn}
          onConnect={connect}
        />
      )}

      {/* Main 3D Canvas */}
      <div className="relative flex-1 w-full h-full">
        <Canvas
          shadows
          camera={{ position: [0, 2.2, 7.5], fov: 48 }}
          gl={{ antialias: true, alpha: true, localClippingEnabled: true }}
        >
          <color attach="background" args={['#090d16']} />
          <fog attach="fog" args={['#090d16', 8, 30]} />

          {/* Cinematic Studio Lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[5, 10, 6]}
            intensity={2.2}
            color="#38bdf8"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-6, -1, -4]} intensity={2.0} color="#a855f7" />

          {/* Grid Stage */}
          <gridHelper args={[24, 24, '#1e293b', '#0f172a']} position={[0, -2.4, 0]} />

          <React.Suspense fallback={null}>
            {/* When in menu, render rotating futuristic gyro background */}
            {!isStarted ? (
              <RotatingBackground />
            ) : (
              <>
                {/* Blender-Style World Origin Circle & Dynamic Z-Depth Drop-Line */}
                <WorldOriginCursor wandTipPosRef={wandTipPosRef} />

                {/* 3D Wand Mesh */}
                <Wand3D
                  positionRef={wandPosRef}
                  rotationRef={wandRotRef}
                  isPressed={isTriggerHeld}
                  brushRadius={brushRadius}
                />

                {/* Active Demo Modes */}
                {activeMode === 'SCULPT' && (
                  <SculptMode
                    wandTipPosRef={wandTipPosRef}
                    isTriggerHeld={isTriggerHeld}
                    brushRadius={brushRadius}
                    tool={sculptTool}
                    strokes={strokes}
                    onAddCompletedStroke={handleAddCompletedStroke}
                    onEraseAtTip={handleEraseAtTip}
                    triggerHaptic={triggerHaptic}
                  />
                )}

                {activeMode === 'TEXTURE_LAB' && (
                  <TextureLabMode
                    wandTipPosRef={wandTipPosRef}
                    sendSerial={sendCommand}
                    triggerHaptic={triggerHaptic}
                  />
                )}

                {activeMode === 'CAD_SLICER' && (
                  <CADSlicerMode
                    wandRotRef={wandRotRef}
                    wandTipPosRef={wandTipPosRef}
                    isTriggerPressed={isTriggerHeld}
                    triggerHaptic={triggerHaptic}
                  />
                )}

                {activeMode === 'PHYSICS' && (
                  <PhysicsSandboxMode
                    wandTipPosRef={wandTipPosRef}
                    objects={physicsObjects}
                    triggerHaptic={triggerHaptic}
                  />
                )}
              </>
            )}
          </React.Suspense>

          {/* Smooth OrbitControls for Camera Navigation */}
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.05}
            maxPolarAngle={Math.PI / 2 + 0.1}
          />
        </Canvas>

        {/* Start Screen Overlay when not started */}
        {!isStarted && (
          <StartScreen
            onStart={handleStartWorkspace}
            connected={connected}
            trackerActive={trackerActive}
          />
        )}

        {/* Live Picture-in-Picture Webcam Monitor (Bottom Right) */}
        {isStarted && trackerActive && (
          <div className="z-20 absolute bottom-24 right-6 w-44 glass-panel rounded-lg p-2 shadow-2xl flex flex-col gap-1 border border-slate-700/70">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                CAM TRACKER
              </span>
              <span className="text-emerald-400 font-semibold">{trackingConfidence}%</span>
            </div>
            <canvas
              ref={monitorCanvasRef}
              width={160}
              height={120}
              className="w-full h-auto rounded bg-black/60 border border-slate-800"
            />
          </div>
        )}

        {/* Floating Event Log Drawer */}
        {isStarted && <EventLog logs={logs} />}

        {/* Bottom Glassmorphic Telemetry HUD */}
        {isStarted && (
          <BottomHUD
            telemetry={{
              ...telemetry,
              btn: isTriggerHeld ? 1 : 0,
            }}
            brushRadius={brushRadius}
            activeMode={activeMode}
            sculptTool={sculptTool}
            trackingSource={trackingSource}
            onToggleTool={() => setSculptTool((prev) => (prev === 'DRAW' ? 'ERASE' : 'DRAW'))}
            onSpawn={handleSpawn}
          />
        )}
      </div>
    </div>
  );
}
