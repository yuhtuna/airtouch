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
      onLog('Webcam 60 FPS Optical Blob Tracker active.');

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

          // Stride of 4 pixels (16 bytes) for 60 FPS performance
          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Robust Blue & Cyan Optical Beacon Filter:
            // Catches pure blue LEDs (b > 130, b > r, b >= g * 0.8), electric cyan beacons, and overexposed glowing cores
            const isBlue = (b > 130 && (b - r) > 30 && b >= g * 0.8);
            const isCyanOrWhiteCore = ((g + b) > 300 && (g + b) - (r * 1.4) > 40);
            if (isBlue || isCyanOrWhiteCore) {
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
          const detected = count > 8;

          if (detected) {
            blobX = sumX / count;
            blobY = sumY / count;
            // Mirror X so physical wand rightward movement translates rightward in 3D scene
            mirroredX = canvas.width - blobX;

            const rawX = (mirroredX - canvas.width / 2) / 45.0; // Stage X mapping
            const rawY = -(blobY - canvas.height / 2) / 45.0; // Stage Y mapping

            // Apparent radius to Depth Z (more pixels = closer wand)
            const apparentRadius = Math.sqrt(count / Math.PI);
            const rawZ = Math.max(-2.5, Math.min(3.5, (apparentRadius - 6.0) * 0.35));

            // Smooth using 1-Euro Filter
            const [smoothX, smoothY, smoothZ] = filterRef.current.filter(
              rawX,
              rawY,
              rawZ,
              performance.now()
            );

            onPositionUpdate([smoothX, smoothY, smoothZ]);
            setTrackingConfidence(Math.min(100, count * 3));
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

                // Glowing green target crosshair
                mCtx.strokeStyle = '#10b981';
                mCtx.lineWidth = 2;
                mCtx.beginPath();
                mCtx.arc(targetX, targetY, 8, 0, Math.PI * 2);
                mCtx.stroke();

                mCtx.beginPath();
                mCtx.moveTo(targetX - 12, targetY);
                mCtx.lineTo(targetX + 12, targetY);
                mCtx.moveTo(targetX, targetY - 12);
                mCtx.lineTo(targetX, targetY + 12);
                mCtx.stroke();
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
