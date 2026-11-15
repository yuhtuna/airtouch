import { useState, useRef, useEffect, useCallback } from 'react';
import { OneEuroFilter3D, OneEuroFilter1D } from '../lib/oneEuroFilter';

interface UseWebcamTrackerProps {
  onPositionUpdate: (pos: [number, number, number], opticalTilt?: [number, number, number]) => void;
  onLog: (msg: string) => void;
}

export function useWebcamTracker({ onPositionUpdate, onLog }: UseWebcamTrackerProps) {
  const [active, setActive] = useState(false);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);
  // Custom filter: XY responsive (1.0, 0.02), Z rock-solid stable (0.5, 0.04)
  const filterRef = useRef(new OneEuroFilter3D(1.0, 0.02, 0.5, 0.04, 1.0));
  const tiltFilterRef = useRef(new OneEuroFilter1D(0.8, 0.03, 1.0));

  // Auto-calibrated neutral depth baseline based on Blue Flux Density
  const neutralSqrtDensityRef = useRef(3.5);
  const hasAutoCalibratedRef = useRef(false);
  const currentDensityRef = useRef(0);
  const currentCountRef = useRef(0);
  const lastConfidenceRef = useRef(0);

  const recalibrateNeutralDepth = useCallback(() => {
    if (currentDensityRef.current >= 2.0) {
      neutralSqrtDensityRef.current = Math.sqrt(currentDensityRef.current);
      hasAutoCalibratedRef.current = true;
      onLog(`Camera Depth Calibrated: Neutral Z baseline locked at ${currentDensityRef.current.toFixed(1)} density.`);
    }
  }, [onLog]);

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
      hasAutoCalibratedRef.current = false;
      setActive(true);
      onLog('Webcam 60 FPS Optical Blob Tracker active (Blue LED Mode).');

      const processFrame = () => {
        try {
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

          let sumWeightedX = 0;
          let sumWeightedY = 0;
          let totalDensity = 0;
          let rawPixelCount = 0;
          let smoothX = 0;
          let smoothY = 0;
          let smoothZ = 0;
          let smoothRoll = 0;

          // Process full pixel grid (stride 4 bytes) for subpixel accuracy without aliasing
          for (let i = 0; i < data.length; i += 4) {
            const b = data[i + 2];
            if (b < 85) continue; // Noise floor

            const r = data[i];
            const g = data[i + 1];
            const maxRG = r > g ? r : g;
            const blueExcess = b - maxRG;

            // Robust multi-tier blue filter
            if ((blueExcess > 12 && b > 95) || (b >= 200 && b >= r && b >= g && (b > r + 3 || b > g + 3))) {
              // Density weighting: Core emitter pixels have high weight (up to 1.0)
              const saturation = Math.max(0.1, Math.min(1.0, blueExcess / 110.0));
              const brightness = b / 255.0;
              const weight = brightness * brightness * saturation;

              const pixelIndex = i / 4;
              const px = pixelIndex % canvas.width;
              const py = (pixelIndex / canvas.width) | 0;

              sumWeightedX += px * weight;
              sumWeightedY += py * weight;
              totalDensity += weight;
              rawPixelCount++;
            }
          }

          let blobX = 0;
          let blobY = 0;
          let mirroredX = 0;
          // Locks on when substantial blue flux density is present
          const detected = totalDensity >= 2.2 && rawPixelCount >= 5;
          currentDensityRef.current = totalDensity;
          currentCountRef.current = rawPixelCount;

          if (detected) {
            blobX = sumWeightedX / totalDensity;
            blobY = sumWeightedY / totalDensity;
            mirroredX = canvas.width - blobX;

            const rawX = (mirroredX - canvas.width / 2) / 45.0;
            const rawY = -(blobY - canvas.height / 2) / 45.0;

            // Auto-lock neutral depth baseline on first solid detection
            if (!hasAutoCalibratedRef.current && totalDensity >= 3.5) {
              neutralSqrtDensityRef.current = Math.sqrt(totalDensity);
              hasAutoCalibratedRef.current = true;
              onLog(`Blue Density Auto-Locked: Neutral baseline at ${totalDensity.toFixed(1)}.`);
            }

            // Continuous, Subpixel-Weighted Blue Density Depth (Z):
            // sqrt(totalDensity) represents optical emitter energy flux
            const currentSqrt = Math.sqrt(totalDensity);
            const deltaSqrt = currentSqrt - neutralSqrtDensityRef.current;
            // Clean linear scaling: 2.2 units per sqrt(density) delta
            const rawZ = Math.max(-3.5, Math.min(3.5, deltaSqrt * 2.2));

            // Smooth using 1-Euro Filter (with heavy damping on stationary Z)
            [smoothX, smoothY, smoothZ] = filterRef.current.filter(
              rawX,
              rawY,
              rawZ,
              performance.now()
            );

            // Compute 2D Image Central Moments around centroid to detect optical tilt
            let mu20 = 0;
            let mu02 = 0;
            let mu11 = 0;
            const bMinX = Math.max(0, Math.floor(blobX - 24));
            const bMaxX = Math.min(canvas.width - 1, Math.ceil(blobX + 24));
            const bMinY = Math.max(0, Math.floor(blobY - 24));
            const bMaxY = Math.min(canvas.height - 1, Math.ceil(blobY + 24));

            for (let y = bMinY; y <= bMaxY; y++) {
              for (let x = bMinX; x <= bMaxX; x++) {
                const idx = (y * canvas.width + x) * 4;
                const b = data[idx + 2];
                if (b > 85) {
                  const r = data[idx];
                  const g = data[idx + 1];
                  const maxRG = r > g ? r : g;
                  const excess = b - maxRG;
                  if (excess > 10) {
                    const w = (b / 255.0) * (excess / 110.0);
                    const dx = (canvas.width - x) - mirroredX;
                    const dy = -(y - blobY);
                    mu20 += dx * dx * w;
                    mu02 += dy * dy * w;
                    mu11 += dx * dy * w;
                  }
                }
              }
            }

            const denom = mu20 + mu02 + 0.001;
            const elongation = Math.sqrt((mu20 - mu02) ** 2 + 4 * mu11 ** 2) / denom;
            let rawOpticalRoll = 0;
            let rawOpticalPitch = 0;

            if (elongation > 0.15) {
              // Tilt roll angle in degrees (-55 to +55)
              rawOpticalRoll = -0.5 * Math.atan2(2 * mu11, mu20 - mu02) * (180 / Math.PI);
              rawOpticalRoll = Math.max(-55, Math.min(55, rawOpticalRoll));
              rawOpticalPitch = (mu02 > mu20 ? 1 : -1) * elongation * 25.0;
            }
            smoothRoll = tiltFilterRef.current.filter(rawOpticalRoll, performance.now());

            if (!isNaN(smoothX) && !isNaN(smoothY) && !isNaN(smoothZ)) {
              onPositionUpdate([smoothX, smoothY, smoothZ], [rawOpticalPitch, 0, smoothRoll]);
            }

            // Throttled React state update
            const newConf = Math.min(100, Math.round(totalDensity * 3.5));
            if (Math.abs(newConf - lastConfidenceRef.current) >= 4) {
              lastConfidenceRef.current = newConf;
              setTrackingConfidence(newConf);
            }
          } else {
            if (lastConfidenceRef.current !== 0) {
              lastConfidenceRef.current = 0;
              setTrackingConfidence(0);
            }
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

                // Dynamic target ring radius derived from true blue density
                const visualRadius = Math.max(9, Math.min(44, 8 + Math.sqrt(totalDensity) * 3.8));

                // Pulsing glowing core dot
                mCtx.fillStyle = '#38bdf8';
                mCtx.beginPath();
                mCtx.arc(targetX, targetY, Math.max(3, Math.min(10, Math.sqrt(totalDensity) * 1.2)), 0, Math.PI * 2);
                mCtx.fill();

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

                // Live Vertical Depth Gauge Bar on Right Edge
                const barWidth = 7;
                const barHeight = monitor.height - 24;
                const barX = monitor.width - barWidth - 4;
                const barY = 8;

                mCtx.fillStyle = 'rgba(15, 23, 42, 0.7)';
                mCtx.fillRect(barX, barY, barWidth, barHeight);
                mCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
                mCtx.strokeRect(barX, barY, barWidth, barHeight);

                // Indicator needle (center is 0m, top is +2.5m, bottom is -3.0m)
                const normalizedZ = (smoothZ + 3.0) / 5.5; // 0 to 1
                const clampedNormZ = Math.max(0, Math.min(1, normalizedZ));
                const needleY = barY + barHeight * (1 - clampedNormZ);

                mCtx.fillStyle = '#38bdf8';
                mCtx.fillRect(barX - 2, needleY - 2, barWidth + 4, 4);

                // Live status text badge showing pixel count AND live depth AND tilt
                mCtx.fillStyle = '#38bdf8';
                mCtx.font = 'bold 9px monospace';
                const zSign = smoothZ >= 0 ? '+' : '';
                mCtx.fillText(`LOCK: ${totalDensity.toFixed(1)}D (${rawPixelCount}px) | Z: ${zSign}${smoothZ.toFixed(2)}m`, 6, monitor.height - 6);
              } else {
                mCtx.fillStyle = '#f59e0b';
                mCtx.font = 'bold 9px monospace';
                mCtx.fillText('AIM BLUE LED AT CAMERA...', 6, monitor.height - 6);
              }
            }
          }
        }
      } catch (frameErr) {
        // Safeguard against any unexpected canvas or math errors stopping the animation loop
        console.error('Webcam frame processing error:', frameErr);
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

  return { active, trackingConfidence, monitorCanvasRef, startTracker, stopTracker, recalibrateNeutralDepth };
}
