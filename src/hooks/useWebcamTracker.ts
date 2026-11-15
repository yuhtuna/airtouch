import { useState, useRef, useEffect, useCallback } from 'react';
import { OneEuroFilter3D, OneEuroFilter1D } from '../lib/oneEuroFilter';
import { DepthFusionMetrics } from '../lib/sensorFusion';

export interface TrackingMetrics {
  apparentDiameter: number;
  confidence: number;
  detected: boolean;
}

interface UseWebcamTrackerProps {
  onPositionUpdate: (
    pos: [number, number, number],
    opticalTilt?: [number, number, number],
    metrics?: TrackingMetrics
  ) => void;
  onLog: (msg: string) => void;
  getFusionMetrics?: () => DepthFusionMetrics;
}

export function useWebcamTracker({ onPositionUpdate, onLog, getFusionMetrics }: UseWebcamTrackerProps) {
  const [active, setActive] = useState(false);
  const [trackingConfidence, setTrackingConfidence] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animIdRef = useRef<number | null>(null);
  const lastFilteredPosRef = useRef<[number, number, number]>([0, 0, 0]);
  // Custom filter: XY responsive (1.0, 0.02), Z responsive and stable (0.8, 0.03)
  const filterRef = useRef(new OneEuroFilter3D(1.0, 0.02, 0.8, 0.03, 1.0));
  const tiltFilterRef = useRef(new OneEuroFilter1D(0.8, 0.03, 1.0));

  // Auto-calibrated neutral depth baseline based on combined optical size (diameter + radiance energy)
  const neutralDepthMetricRef = useRef(10.0);
  const currentDepthMetricRef = useRef(10.0);
  const currentDiameterRef = useRef(0);
  const hasAutoCalibratedRef = useRef(false);
  const lastConfidenceRef = useRef(0);

  const recalibrateNeutralDepth = useCallback(() => {
    if (currentDepthMetricRef.current > 0) {
      neutralDepthMetricRef.current = currentDepthMetricRef.current;
      hasAutoCalibratedRef.current = true;
      filterRef.current.reset();
      onLog(`Camera Depth Calibrated: Neutral optical baseline locked at ${currentDepthMetricRef.current.toFixed(1)}.`);
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

          let smoothX = 0;
          let smoothY = 0;
          let smoothZ = 0;
          let smoothRoll = 0;
          let apparentDiameter = 0;

          // 1. Locate peak blue emitter core pixel to isolate the primary LED cluster
          let maxScore = 0;
          let peakX = -1;
          let peakY = -1;

          for (let i = 0; i < data.length; i += 4) {
            const b = data[i + 2];
            if (b < 100) continue; // Noise floor

            const r = data[i];
            const g = data[i + 1];
            const maxRG = r > g ? r : g;
            const blueExcess = b - maxRG;

            if (blueExcess > 14) {
              const score = b * blueExcess;
              if (score > maxScore) {
                maxScore = score;
                const pixelIndex = i / 4;
                peakX = pixelIndex % canvas.width;
                peakY = (pixelIndex / canvas.width) | 0;
              }
            }
          }

          let blobX = 0;
          let blobY = 0;
          let mirroredX = 0;
          let detected = false;
          let clusterWeight = 0;
          let rawOpticalPitch = 0;

          // 2. Perform localized connected-component analysis around peak emitter (radius = 26px)
          if (peakX >= 0 && maxScore >= 1600) {
            const radius = 26;
            const minX = Math.max(0, peakX - radius);
            const maxX = Math.min(canvas.width - 1, peakX + radius);
            const minY = Math.max(0, peakY - radius);
            const maxY = Math.min(canvas.height - 1, peakY + radius);

            let sumW = 0;
            let sumWX = 0;
            let sumWY = 0;

            for (let y = minY; y <= maxY; y++) {
              for (let x = minX; x <= maxX; x++) {
                const idx = (y * canvas.width + x) * 4;
                const b = data[idx + 2];
                if (b < 85) continue;

                const r = data[idx];
                const g = data[idx + 1];
                const maxRG = r > g ? r : g;
                const blueExcess = b - maxRG;

                if (blueExcess > 10) {
                  const saturation = Math.max(0.1, Math.min(1.0, blueExcess / 110.0));
                  const brightness = b / 255.0;
                  const weight = brightness * brightness * saturation;

                  sumW += weight;
                  sumWX += x * weight;
                  sumWY += y * weight;
                }
              }
            }

            if (sumW >= 2.0) {
              detected = true;
              clusterWeight = sumW;
              blobX = sumWX / sumW;
              blobY = sumWY / sumW;
              mirroredX = canvas.width - blobX;

              // 3. Central Image Moments for Apparent Major Axis Diameter (Invariant to Tilting)
              let mu20 = 0;
              let mu02 = 0;
              let mu11 = 0;

              for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                  const idx = (y * canvas.width + x) * 4;
                  const b = data[idx + 2];
                  if (b < 85) continue;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const maxRG = r > g ? r : g;
                  const blueExcess = b - maxRG;
                  if (blueExcess > 10) {
                    const weight = (b / 255.0) * (blueExcess / 110.0);
                    const dx = (canvas.width - x) - mirroredX;
                    const dy = -(y - blobY);
                    mu20 += dx * dx * weight;
                    mu02 += dy * dy * weight;
                    mu11 += dx * dy * weight;
                  }
                }
              }

              const deltaMoments = Math.sqrt((mu20 - mu02) ** 2 + 4 * mu11 ** 2);
              const lambda1 = ((mu20 + mu02) + deltaMoments) / 2;
              // Apparent diameter in pixels (Major Axis of the LED physical ellipse)
              apparentDiameter = 4 * Math.sqrt(lambda1 / (sumW + 0.001));
              currentDiameterRef.current = apparentDiameter;

              // Combined optical depth metric: geometric diameter + blue radiance energy
              const blueEnergy = Math.sqrt(sumW);
              const opticalMetric = 0.5 * apparentDiameter + 1.2 * blueEnergy;
              currentDepthMetricRef.current = opticalMetric;

              // Auto-lock neutral depth baseline on first solid detection
              if (!hasAutoCalibratedRef.current && opticalMetric >= 3.0) {
                neutralDepthMetricRef.current = opticalMetric;
                hasAutoCalibratedRef.current = true;
                onLog(`Optical Baseline Auto-Locked: Neutral optical metric at ${opticalMetric.toFixed(1)}.`);
              }

              // Geometric Perspective Depth (Z):
              // Delta from neutral baseline with wide, vivid dynamic range
              const deltaD = opticalMetric - neutralDepthMetricRef.current;
              const rawZ = Math.max(-3.5, Math.min(3.5, deltaD * 0.40));

              const rawX = (mirroredX - canvas.width / 2) / 45.0;
              const rawY = -(blobY - canvas.height / 2) / 45.0;

              // Smooth using 1-Euro Filter (XY responsive, Z rock-solid stable)
              [smoothX, smoothY, smoothZ] = filterRef.current.filter(
                rawX,
                rawY,
                rawZ,
                performance.now()
              );

              // Optical Tilt Angle
              const denom = mu20 + mu02 + 0.001;
              const elongation = deltaMoments / denom;
              let rawOpticalRoll = 0;
              if (elongation > 0.15) {
                rawOpticalRoll = -0.5 * Math.atan2(2 * mu11, mu20 - mu02) * (180 / Math.PI);
                rawOpticalRoll = Math.max(-55, Math.min(55, rawOpticalRoll));
                rawOpticalPitch = (mu02 > mu20 ? 1 : -1) * elongation * 25.0;
              }
              smoothRoll = tiltFilterRef.current.filter(rawOpticalRoll, performance.now());

              const conf = Math.min(100, Math.round(apparentDiameter * 4.5));
              if (!isNaN(smoothX) && !isNaN(smoothY) && !isNaN(smoothZ)) {
                lastFilteredPosRef.current = [smoothX, smoothY, smoothZ];
                onPositionUpdate(
                  [smoothX, smoothY, smoothZ],
                  [rawOpticalPitch, 0, smoothRoll],
                  { apparentDiameter, confidence: conf, detected: true }
                );
              }

              // Throttled confidence update
              if (Math.abs(conf - lastConfidenceRef.current) >= 4) {
                lastConfidenceRef.current = conf;
                setTrackingConfidence(conf);
              }
            }
          }

          if (!detected) {
            currentDiameterRef.current = 0;
            onPositionUpdate(lastFilteredPosRef.current, undefined, {
              apparentDiameter: 0,
              confidence: 0,
              detected: false,
            });
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

              const fusionMetrics = getFusionMetrics ? getFusionMetrics() : null;
              const displayZ = fusionMetrics ? fusionMetrics.fusedZ : smoothZ;

              if (detected) {
                const scaleX = monitor.width / canvas.width;
                const scaleY = monitor.height / canvas.height;
                const targetX = mirroredX * scaleX;
                const targetY = blobY * scaleY;

                // Dynamic target ring radius derived from true geometric apparent diameter
                const visualRadius = Math.max(8, Math.min(46, (apparentDiameter / 2) * scaleX * 2.2));

                // Pulsing glowing core dot
                mCtx.fillStyle = '#38bdf8';
                mCtx.beginPath();
                mCtx.arc(targetX, targetY, Math.max(3, Math.min(9, apparentDiameter * 0.4)), 0, Math.PI * 2);
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
                const normalizedZ = (displayZ + 3.0) / 5.5; // 0 to 1
                const clampedNormZ = Math.max(0, Math.min(1, normalizedZ));
                const needleY = barY + barHeight * (1 - clampedNormZ);

                mCtx.fillStyle = '#38bdf8';
                mCtx.fillRect(barX - 2, needleY - 2, barWidth + 4, 4);

                // Top label: lock diameter
                mCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                mCtx.fillRect(4, 4, 94, 15);
                mCtx.fillStyle = '#38bdf8';
                mCtx.font = 'bold 9px monospace';
                mCtx.fillText(`LOCK: ${apparentDiameter.toFixed(1)}px`, 7, 15);

                // Live status text badge showing geometric diameter AND fused depth
                const zSign = displayZ >= 0 ? '+' : '';
                mCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
                mCtx.fillRect(4, monitor.height - 18, monitor.width - 20, 14);
                mCtx.fillStyle = '#38bdf8';
                mCtx.font = 'bold 9px monospace';
                mCtx.fillText(`Z: ${zSign}${displayZ.toFixed(2)}m (Opt ${smoothZ >= 0 ? '+' : ''}${smoothZ.toFixed(2)}m)`, 7, monitor.height - 7);
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
