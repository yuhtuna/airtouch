import { useState, useRef, useCallback, useEffect } from 'react';
import { WandTelemetry } from '../types/telemetry';
import { parseTelemetryLine } from '../lib/serialProtocol';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING';

interface UseSerialProps {
  onTelemetry: (data: WandTelemetry) => void;
  onLog: (msg: string) => void;
}

export function useSerial({ onTelemetry, onLog }: UseSerialProps) {
  const onTelemetryRef = useRef(onTelemetry);
  const onLogRef = useRef(onLog);

  useEffect(() => {
    onTelemetryRef.current = onTelemetry;
    onLogRef.current = onLog;
  });

  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const isTransitioningRef = useRef(false);
  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const readingPromiseRef = useRef<Promise<void> | null>(null);
  const lastWriteTimeRef = useRef(0);

  const disconnect = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setStatus('DISCONNECTING');

    const port = portRef.current;
    portRef.current = null; // Detach reference to prevent re-entrant calls

    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (e) {}
      abortControllerRef.current = null;
    }

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch (err) {}
      readerRef.current = null;
    }

    if (readingPromiseRef.current) {
      try {
        await readingPromiseRef.current;
      } catch (err) {}
      readingPromiseRef.current = null;
    }

    if (writerRef.current) {
      try {
        await writerRef.current.close();
      } catch (err) {}
      writerRef.current = null;
    }

    if (port) {
      try {
        await port.close();
      } catch (err: any) {
        console.warn('Disconnect port close:', err);
      }
    }

    setStatus('DISCONNECTED');
    isTransitioningRef.current = false;
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
    if (isTransitioningRef.current || portRef.current) return;

    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    isTransitioningRef.current = true;
    setStatus('CONNECTING');

    try {
      let port: any = null;

      // Smart port resolution: check previously authorized ports first (e.g. COM6 or COM7)
      try {
        const authorizedPorts: any[] = await (navigator as any).serial.getPorts();
        if (authorizedPorts && authorizedPorts.length > 0) {
          for (const p of authorizedPorts) {
            try {
              await p.open({ baudRate: 115200 });
              port = p;
              break;
            } catch (openErr) {
              // Port busy or different COM port; try next candidate
            }
          }
        }
      } catch (e) {}

      // If no pre-authorized port could be opened, prompt user with native browser device picker
      if (!port) {
        port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 115200 });
      }

      portRef.current = port;

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

      setStatus('CONNECTED');
      onLog('Connected to AirTouch Arduino Nano (115200 baud).');

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
                onTelemetryRef.current(telemetry);
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
          } catch (e) {}
          readerRef.current = null;
        }
      };

      readingPromiseRef.current = readLoop();
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        // User dismissed native port prompt — cleanly restore disconnected state
        setStatus('DISCONNECTED');
      } else {
        onLog(`Serial connection error: ${err.message}`);
        isTransitioningRef.current = false;
        await disconnect();
      }
    } finally {
      isTransitioningRef.current = false;
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

  const connected = status === 'CONNECTED';

  return { connected, status, connect, disconnect, sendCommand };
}
