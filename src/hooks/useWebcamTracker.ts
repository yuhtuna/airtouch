import { useState, useRef, useEffect, useCallback } from 'react';
import { OneEuroFilter3D } from '../lib/oneEuroFilter';

interface UseWebcamTrackerProps {
  onPositionUpdate: (pos: [number, number, number]) => void;
  onLog: (msg: string) => void;
}

export function useWebcamTracker({ onPositionUpdate, onLog }: UseWebcamTrackerProps) {
  const [active, setActive] = useState(false);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);
  const filterRef = useRef(new OneEuroFilter3D(1.2, 0.02, 1.0));

  const stopTracker = useCallback(() => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setTrackingConfidence(0);
    onLog('Webcam Optical Tracker stopped.');
  }, [onLog]);

  const startTracker = useCallback(async () => {
    // 1. Guard against unsupported or non-secure contexts (e.g. HTTP on local network)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onLog('Webcam Optical Tracker unavailable: secure context (HTTPS / localhost) required.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 },
        },
      });

      // Handle unexpected stream termination (e.g. hardware unplug, OS revocation)
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', () => {
          onLog('Webcam video stream terminated.');
          stopTracker();
        });
      }

      if (!videoRef.current) {
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;
        videoRef.current = video;
      }

      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        canvasRef.current = canvas;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      filterRef.current.reset();
      setActive(true);
      onLog('Webcam 60 FPS Optical Blob Tracker active (Blue LED Mode).');

      const processFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const monitor = monitorCanvasRef.current;

        if (!video || !canvas || video.readyState < 2) {
          animIdRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          let sumX = 0;
          let sumY = 0;
          let count = 0;

          // Stride of 2 pixels (8 bytes) for high-precision 60 FPS performance
          for (let i = 0; i < data.length; i += 8) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Robust Multi-Threshold Blue LED Emitter Filter:
            // 1. Classical blue emission (fringe and diffused light):
            const isBlueDominant = (b > 85 && b > r * 1.25 + 10 && b > g * 1.1 + 8);
            // 2. High-intensity blue emitter core:
            const isBrightBlue = (b > 150 && (b - r) > 15 && (b - g) > 8);
            // 3. Overexposed LED Center (Lens bloom where Blue is highest channel):
            const isOverexposedEmitter = (b >= 200 && b >= r && b >= g && (b > r + 3 || b > g + 3));

            if (isBlueDominant || isBrightBlue || isOverexposedEmitter) {
              const pixelIndex = i / 4;
              const px = pixelIndex % canvas.width;
              const py = Math.floor(pixelIndex / canvas.width);
              sumX += px;
              sumY += py;
              count++;
            }
          }

          let blobX = 0;
          let blobY = 0;
          let mirroredX = 0;
          // High sensitivity threshold: locks on at 6+ sampled pixels
          const detected = count >= 6;

          if (detected) {
            blobX = sumX / count;
            blobY = sumY / count;
            // Mirror X so physical wand rightward movement translates rightward in 3D scene
            mirroredX = canvas.width - blobX;

            const rawX = (mirroredX - canvas.width / 2) / 45.0; // Stage X mapping
            const rawY = -(blobY - canvas.height / 2) / 45.0; // Stage Y mapping

            // Robust 3D Depth Z Mapping:
            // Since apparent area scales with 1/distance^2, apparent radius = sqrt(count * 2 / PI)
            // Far (~1 meter): count ~ 12 -> radius ~ 2.7 -> rawZ ~ -1.6m
            // Arm-length (~60cm): count ~ 45 -> radius ~ 5.3 -> rawZ ~ 0.0m (World Origin)
            // Close (~25cm): count ~ 140 -> radius ~ 9.4 -> rawZ ~ +2.8m
            const apparentRadius = Math.sqrt((count * 2.0) / Math.PI);
            const rawZ = Math.max(-3.5, Math.min(3.0, (apparentRadius - 5.0) * 0.7));

            // Smooth using 1-Euro Filter with zero perceived latency
            const [smoothX, smoothY, smoothZ] = filterRef.current.filter(
              rawX,
              rawY,
              rawZ,
              performance.now()
            );

            onPositionUpdate([smoothX, smoothY, smoothZ]);
            setTrackingConfidence(Math.min(100, Math.round(count * 1.5)));
          } else {
            setTrackingConfidence(0);
          }

          // Live Picture-in-Picture camera monitor with tracking crosshairs (mirrored view)
          if (monitor) {
            const mCtx = monitor.getContext('2d');
            if (mCtx) {
              mCtx.save();
              mCtx.translate(monitor.width, 0);
              mCtx.scale(-1, 1);
              mCtx.drawImage(canvas, 0, 0, monitor.width, monitor.height);
              mCtx.restore();

              if (detected) {
                const scaleX = monitor.width / canvas.width;
                const scaleY = monitor.height / canvas.height;
                const targetX = mirroredX * scaleX;
                const targetY = blobY * scaleY;
                const visualRadius = Math.max(10, Math.min(32, Math.sqrt(count / Math.PI) * scaleX * 2));

                // Outer electric blue target ring
                mCtx.strokeStyle = '#0ea5e9';
                mCtx.lineWidth = 2.5;
                mCtx.beginPath();
                mCtx.arc(targetX, targetY, visualRadius, 0, Math.PI * 2);
                mCtx.stroke();

                // Cyan targeting crosshair
                mCtx.strokeStyle = '#38bdf8';
                mCtx.lineWidth = 1.5;
                mCtx.beginPath();
                mCtx.moveTo(targetX - visualRadius - 6, targetY);
                mCtx.lineTo(targetX + visualRadius + 6, targetY);
                mCtx.moveTo(targetX, targetY - visualRadius - 6);
                mCtx.lineTo(targetX, targetY + visualRadius + 6);
                mCtx.stroke();

                // Live status text badge showing blue pixel count
                mCtx.fillStyle = '#38bdf8';
                mCtx.font = 'bold 9px monospace';
                mCtx.fillText(`BLUE LOCK: ${count}px`, 6, monitor.height - 6);
              } else {
                mCtx.fillStyle = '#f59e0b';
                mCtx.font = 'bold 9px monospace';
                mCtx.fillText('AIM BLUE LED AT CAMERA...', 6, monitor.height - 6);
              }
            }
          }
        }

        animIdRef.current = requestAnimationFrame(processFrame);
      };

      animIdRef.current = requestAnimationFrame(processFrame);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        onLog('Webcam access denied. Please grant camera permission in browser.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        onLog('No camera hardware found on this system.');
      } else {
        onLog(`Webcam error: ${err.message}`);
      }
      stopTracker();
    }
  }, [onPositionUpdate, onLog, stopTracker]);

  useEffect(() => {
    return () => {
      stopTracker();
    };
  }, [stopTracker]);

  return { active, trackingConfidence, monitorCanvasRef, startTracker, stopTracker };
}
