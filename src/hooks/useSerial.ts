import { useState, useRef, useCallback, useEffect } from 'react';
import { WandTelemetry } from '../types/telemetry';
import { parseTelemetryLine } from '../lib/serialProtocol';

interface UseSerialProps {
  onTelemetry: (data: WandTelemetry) => void;
  onLog: (msg: string) => void;
}

export function useSerial({ onTelemetry, onLog }: UseSerialProps) {
  const [connected, setConnected] = useState(false);
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readingPromiseRef = useRef<Promise<void> | null>(null);
  const lastWriteTimeRef = useRef(0);

  const disconnect = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (err) {
        // Stream cancel catch
      }
      readerRef.current = null;
    }

    if (readingPromiseRef.current) {
      try {
        await readingPromiseRef.current;
      } catch (err) {
        // Ignore read loop termination
      }
      readingPromiseRef.current = null;
    }

    if (writerRef.current) {
      try {
        await writerRef.current.close();
      } catch (err) {
        // Writer close catch
      }
      writerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch (err: any) {
        console.warn('Disconnect port close:', err);
      }
      portRef.current = null;
    }

    setConnected(false);
    onLog('AirTouch disconnected.');
  }, [onLog]);

  // Listen for hardware unplug / USB disconnect event
  useEffect(() => {
    if (!('serial' in navigator)) return;

    const handleDisconnect = (event: any) => {
      if (portRef.current && event.port === portRef.current) {
        onLog('AirTouch USB cable unplugged.');
        disconnect();
      }
    };

    (navigator as any).serial.addEventListener('disconnect', handleDisconnect);
    return () => {
      (navigator as any).serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [disconnect, onLog]);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setConnected(true);
      onLog('Connected to AirTouch ESP32-S3 (115200 baud).');

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Setup writer with abort signal
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable, { signal }).catch(() => {});
      writerRef.current = textEncoder.writable.getWriter();

      // Setup reader with abort signal
      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable, { signal }).catch(() => {});
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      const readLoop = async () => {
        let buffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const telemetry = parseTelemetryLine(line);
              if (telemetry) {
                onTelemetry(telemetry);
              }
            }
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.warn('Serial read loop error:', err);
          }
        } finally {
          try {
            reader.releaseLock();
          } catch (e) {
            // ignore
          }
          readerRef.current = null;
        }
      };

      readingPromiseRef.current = readLoop();
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        onLog(`Serial error: ${err.message}`);
      }
      disconnect();
    }
  }, [onTelemetry, onLog, disconnect]);

  // Throttled command sending to avoid serial tx queue saturation
  const sendCommand = useCallback(async (cmd: string, force = false) => {
    if (!writerRef.current) return;
    const now = performance.now();
    if (!force && now - lastWriteTimeRef.current < 15) {
      return; // rate limit rapid commands to ~66 Hz
    }
    lastWriteTimeRef.current = now;

    try {
      await writerRef.current.write(cmd);
    } catch (err) {
      console.error('Serial write error:', err);
    }
  }, []);

  return { connected, connect, disconnect, sendCommand };
}
