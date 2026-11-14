import { useState, useRef, useCallback } from 'react';
import { DemoMode, SculptTool } from '../types/telemetry';

interface UseVoiceCommandsProps {
  onModeChange: (mode: DemoMode) => void;
  onToolChange: (tool: SculptTool) => void;
  onRecenter: () => void;
  onClear: () => void;
  onSpawn: (shape: 'cube' | 'sphere' | 'cylinder' | 'gear') => void;
  onExportSTL: () => void;
  onLog: (msg: string) => void;
}

export function useVoiceCommands({
  onModeChange,
  onToolChange,
  onRecenter,
  onClear,
  onSpawn,
  onExportSTL,
  onLog,
}: UseVoiceCommandsProps) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastIdx = event.results.length - 1;
        const transcript = event.results[lastIdx][0].transcript.trim().toLowerCase();
        onLog(`🎙 Voice: "${transcript}"`);

        if (transcript.includes('erase')) {
          onToolChange('ERASE');
          onLog('Sculpt Tool: ERASE mode active.');
        } else if (transcript.includes('draw')) {
          onToolChange('DRAW');
          onLog('Sculpt Tool: DRAW mode active.');
        } else if (transcript.includes('sculpt')) {
          onModeChange('SCULPT');
        } else if (transcript.includes('texture')) {
          onModeChange('TEXTURE_LAB');
        } else if (transcript.includes('slicer') || transcript.includes('slice')) {
          onModeChange('CAD_SLICER');
        } else if (transcript.includes('physics')) {
          onModeChange('VOICE_PHYSICS');
        } else if (transcript.includes('clear')) {
          onClear();
        } else if (transcript.includes('recenter') || transcript.includes('calibrate') || transcript.includes('zero')) {
          onRecenter();
        } else if (transcript.includes('export') || transcript.includes('stl')) {
          onExportSTL();
        } else if (transcript.includes('cube') || transcript.includes('box')) {
          onSpawn('cube');
        } else if (transcript.includes('sphere') || transcript.includes('ball')) {
          onSpawn('sphere');
        } else if (transcript.includes('cylinder')) {
          onSpawn('cylinder');
        } else if (transcript.includes('gear')) {
          onSpawn('gear');
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.warn('Speech error:', e.error);
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            setListening(false);
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      onLog('Voice recognition listening. Say "Sculpt mode", "Erase mode", "Spawn gear"...');
    } catch (err: any) {
      onLog(`Speech error: ${err.message}`);
    }
  }, [onModeChange, onToolChange, onRecenter, onClear, onSpawn, onExportSTL, onLog]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.stop();
      setListening(false);
      onLog('Voice recognition stopped.');
    }
  }, [onLog]);

  const toggleVoice = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  return { listening, toggleVoice };
}
