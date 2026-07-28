import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react';

interface KeyboardProps {
  onNoteOn: (note: number, velocity: number) => void;
  onNoteOff: (note: number) => void;
}

interface PianoKey {
  note: number;
  isBlack: boolean;
  label: string;
  noteOffset: number;
}

const NUM_KEYS = 88;
const START_MIDI_NOTE = 21; // A0 (MIDI 21) up to C8 (MIDI 108)

const generatePianoKeys = (): PianoKey[] => {
  const labels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const blackOffsets = [1, 3, 6, 8, 10];
  
  return Array.from({ length: NUM_KEYS }).map((_, idx) => {
    const note = START_MIDI_NOTE + idx;
    const noteOffsetInOctave = note % 12;
    const isBlack = blackOffsets.includes(noteOffsetInOctave);
    const label = labels[noteOffsetInOctave];
    
    return {
      note,
      isBlack,
      label,
      noteOffset: idx
    };
  });
};

const PIANO_KEYS_88 = generatePianoKeys();

// Maps computer keyboard keys to MIDI offsets relative to baseMidiNote (up to 2 octaves)
const COMPUTER_KEY_MAP: { [key: string]: number } = {
  'a': 0,  // C
  'w': 1,  // C#
  's': 2,  // D
  'e': 3,  // D#
  'd': 4,  // E
  'f': 5,  // F
  't': 6,  // F#
  'g': 7,  // G
  'y': 8,  // G#
  'h': 9,  // A
  'u': 10, // A#
  'j': 11, // B
  'k': 12, // C
  'o': 13, // C#
  'l': 14, // D
  'p': 15, // D#
  'ç': 16, // E
  ';': 16, // fallback
  'z': 17, // F
  'x': 18, // F#
  'c': 19, // G
  'v': 20, // G#
  'b': 21, // A
  'n': 22, // A#
  'm': 23, // B
  ',': 24, // C
};

export const Keyboard: React.FC<KeyboardProps> = ({ onNoteOn, onNoteOff }) => {
  const [baseOctave, setBaseOctave] = useState<number>(4); // Default C4 (MIDI 60)
  const [activeKeys, setActiveKeys] = useState<Set<number>>(new Set());
  const [channelsTarget, setChannelsTarget] = useState<boolean[]>([true, false, false, false]); // Layer routing

  const baseMidiNote = baseOctave * 12 + 12; // C4 is 60 (4 * 12 + 12 = 60)

  // Track computer keyboard press state to prevent repeat triggers
  const [pressedComputerKeys, setPressedComputerKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const isTyping = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses if typing in input/textarea/select fields
      if (isTyping(e.target) || isTyping(document.activeElement)) {
        return;
      }

      const key = e.key.toLowerCase();
      const offset = COMPUTER_KEY_MAP[key];

      if (offset !== undefined && !pressedComputerKeys.has(key)) {
        const note = baseMidiNote + offset;
        
        // Ensure note falls within the 81-key range
        if (note >= START_MIDI_NOTE && note < START_MIDI_NOTE + NUM_KEYS) {
          setPressedComputerKeys(prev => {
            const next = new Set(prev);
            next.add(key);
            return next;
          });

          triggerNoteOn(note);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const offset = COMPUTER_KEY_MAP[key];

      if (offset !== undefined && pressedComputerKeys.has(key)) {
        const note = baseMidiNote + offset;
        
        setPressedComputerKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });

        triggerNoteOff(note);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [baseMidiNote, pressedComputerKeys]);

  // Handle external MIDI inputs that were dispatched as custom events
  useEffect(() => {
    const handleMidiOn = (e: Event) => {
      const { note, velocity } = (e as CustomEvent).detail;
      triggerNoteOn(note, velocity);
    };

    const handleMidiOff = (e: Event) => {
      const { note } = (e as CustomEvent).detail;
      triggerNoteOff(note);
    };

    window.addEventListener('synth-midi-on', handleMidiOn);
    window.addEventListener('synth-midi-off', handleMidiOff);

    return () => {
      window.removeEventListener('synth-midi-on', handleMidiOn);
      window.removeEventListener('synth-midi-off', handleMidiOff);
    };
  }, [channelsTarget]);

  const triggerNoteOn = (note: number, velocity: number = 100) => {
    if (note < START_MIDI_NOTE || note >= START_MIDI_NOTE + NUM_KEYS) return;

    setActiveKeys(prev => {
      const next = new Set(prev);
      next.add(note);
      return next;
    });

    onNoteOn(note, velocity);

    // Custom event to coordinate multichannels
    const customEvent = new CustomEvent('keyboard-note-on', {
      detail: { note, velocity, targets: channelsTarget }
    });
    window.dispatchEvent(customEvent);
  };

  const triggerNoteOff = (note: number) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.delete(note);
      return next;
    });

    onNoteOff(note);

    const customEvent = new CustomEvent('keyboard-note-off', {
      detail: { note, targets: channelsTarget }
    });
    window.dispatchEvent(customEvent);
  };

  const shiftOctave = (direction: number) => {
    setBaseOctave(prev => {
      const next = prev + direction;
      return Math.max(1, Math.min(6, next)); // Restrict from C1 to C6 bases within 81 keys
    });
  };

  const toggleChannelTarget = (index: number) => {
    setChannelsTarget(prev => {
      const next = [...prev];
      next[index] = !next[index];
      
      // Ensure at least one channel is active
      if (next.filter(Boolean).length === 0) {
        next[index] = true;
      }
      return next;
    });
  };

  const renderWhiteKeys = () => {
    const whiteKeys = PIANO_KEYS_88.filter(k => !k.isBlack);
    return whiteKeys.map((k, index) => {
      const note = k.note;
      const isActive = activeKeys.has(note);
      
      const relativeOffset = note - baseMidiNote;
      const keyEntry = Object.entries(COMPUTER_KEY_MAP).find(([key, offset]) => offset === relativeOffset && key !== ';');
      const keyboardLabel = keyEntry ? keyEntry[0].toUpperCase() : '';

      return (
        <button
          key={note}
          onMouseDown={() => triggerNoteOn(note)}
          onMouseUp={() => triggerNoteOff(note)}
          onMouseLeave={() => activeKeys.has(note) && triggerNoteOff(note)}
          onTouchStart={(e) => { e.preventDefault(); triggerNoteOn(note); }}
          onTouchEnd={(e) => { e.preventDefault(); triggerNoteOff(note); }}
          className={`h-20 flex-1 border-r border-zinc-250 last:border-r-0 rounded-b shadow transition-all flex flex-col justify-end items-center pb-2 select-none relative outline-none ${
            isActive
              ? 'bg-emerald-400 border-emerald-500 text-black h-[78px] shadow-inner'
              : 'bg-white text-black hover:bg-zinc-100'
          }`}
          id={`key-white-${note}`}
          style={{ minWidth: '8px' }}
        >
          {keyboardLabel && (
            <span className={`text-[11px] font-mono font-black select-none mb-1 ${isActive ? 'text-black' : 'text-zinc-400'}`}>
              {keyboardLabel}
            </span>
          )}
          <span className={`text-[11px] font-mono select-none ${isActive ? 'text-black/80 font-bold' : 'text-zinc-300'}`}>
            {k.label}{Math.floor(note / 12) - 1}
          </span>
        </button>
      );
    });
  };

  const renderBlackKeys = () => {
    let whiteIndex = 0;
    const totalWhiteKeys = 52; // 88 keys starting from A0 has exactly 52 white keys
    const whiteColWidthPct = 100 / totalWhiteKeys;

    return PIANO_KEYS_88.map((k, index) => {
      if (!k.isBlack) {
        whiteIndex++;
        return null;
      }

      // Percentage offset calculated relative to white column positions
      const leftOffset = (whiteIndex * whiteColWidthPct) - (whiteColWidthPct * 0.35);
      const note = k.note;
      const isActive = activeKeys.has(note);

      const relativeOffset = note - baseMidiNote;
      const keyEntry = Object.entries(COMPUTER_KEY_MAP).find(([key, offset]) => offset === relativeOffset && key !== ';');
      const keyboardLabel = keyEntry ? keyEntry[0].toUpperCase() : '';

      return (
        <button
          key={note}
          onMouseDown={() => triggerNoteOn(note)}
          onMouseUp={() => triggerNoteOff(note)}
          onMouseLeave={() => activeKeys.has(note) && triggerNoteOff(note)}
          onTouchStart={(e) => { e.preventDefault(); triggerNoteOn(note); }}
          onTouchEnd={(e) => { e.preventDefault(); triggerNoteOff(note); }}
          style={{ left: `${leftOffset}%`, width: `${whiteColWidthPct * 0.7}%` }}
          className={`h-12 absolute z-10 border border-black rounded-b flex flex-col justify-end items-center pb-1.5 shadow outline-none select-none ${
            isActive
              ? 'bg-emerald-400 border-emerald-500 text-black shadow-inner'
              : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-350'
          }`}
          id={`key-black-${note}`}
        >
          {keyboardLabel && (
            <span className={`text-[11px] font-mono font-bold select-none ${isActive ? 'text-black' : 'text-zinc-300'}`}>
              {keyboardLabel}
            </span>
          )}
        </button>
      );
    });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-xl flex flex-col gap-3">
      {/* Visual Keys Roll */}
      <div className="relative select-none touch-none mt-1 w-full overflow-hidden border border-zinc-950 rounded">
        <div className="flex relative w-full">
          {renderWhiteKeys()}
          {renderBlackKeys()}
        </div>
      </div>

      {/* Keyboard Controls Bar (Now at the bottom) */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-zinc-800/60 pt-2">
        {/* Octave Shifters */}
        <div className="flex items-center gap-2 select-none">
          <span className="text-xs font-mono font-bold text-zinc-400">OITAVA:</span>
          
          <button
            onClick={() => shiftOctave(-1)}
            disabled={baseOctave <= 1}
            className="p-1 px-2 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white border-b-2 border-b-zinc-950 disabled:opacity-40 disabled:hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono font-black text-emerald-400 min-w-[2rem] text-center bg-black px-2 py-1 rounded border border-zinc-750">
            C{baseOctave}
          </span>

          <button
            onClick={() => shiftOctave(1)}
            disabled={baseOctave >= 6}
            className="p-1 px-2 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white border-b-2 border-b-zinc-950 disabled:opacity-40 disabled:hover:bg-zinc-800 transition cursor-pointer flex items-center justify-center"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Helper text */}
        <div className="text-[12px] font-mono text-zinc-300 text-center uppercase tracking-wider select-none">
          * Use o teclado do PC para tocar ou conecte um controlador MIDI USB!
        </div>
      </div>
    </div>
  );
};
