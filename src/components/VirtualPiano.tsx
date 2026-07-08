import React from 'react';
import { ActiveNote } from '../types';

interface VirtualPianoProps {
  activeMidis: Set<number>;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  baseOctave: number; // oitava base, ex: 3 ou 4
  setBaseOctave: (octave: number) => void;
  useFlat: boolean;
}

export default function VirtualPiano({
  activeMidis,
  onNoteOn,
  onNoteOff,
  baseOctave,
  setBaseOctave,
  useFlat,
}: VirtualPianoProps) {
  
  // Notas naturais em uma oitava (teclas brancas)
  const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const NOTE_LABELS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Função para verificar se a nota é preta
  const isBlackKey = (noteInOctave: number) => {
    return [1, 3, 6, 8, 10].includes(noteInOctave); // C#, D#, F#, G#, A#
  };

  // Mapear nota relativa na oitava para nome em português
  const getNoteLabel = (noteInOctave: number): string => {
    const mapSharp: Record<number, string> = {
      0: 'C', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E',
      5: 'F', 6: 'F#', 7: 'G', 8: 'G#', 9: 'A',
      10: 'A#', 11: 'B'
    };
    const mapFlat: Record<number, string> = {
      0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E',
      5: 'F', 6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A',
      10: 'Bb', 11: 'B'
    };
    const map = useFlat ? mapFlat : mapSharp;
    return map[noteInOctave] || '';
  };

  // Vamos montar 3 oitavas completas de teclas
  // Oitava 1: baseOctave
  // Oitava 2: baseOctave + 1
  // Oitava 3: baseOctave + 2
  // Tecla extra no final: C da oitava baseOctave + 3 (para fechar a escala)
  const startMidi = baseOctave * 12 + 12; // Ex: se baseOctave=3, inicia em C4 (midi 60)
  
  // Lista de teclas brancas para desenhar
  const whiteKeys: { midi: number; label: string }[] = [];
  // Lista de teclas pretas para desenhar
  const blackKeys: { midi: number; label: string; leftOffsetPercent: number }[] = [];

  // Gerar chaves para 3 oitavas (total de 22 teclas brancas, de C a C)
  let whiteIndex = 0;
  for (let octOffset = 0; octOffset <= 3; octOffset++) {
    const currentOctave = baseOctave + octOffset;
    
    for (let i = 0; i < 12; i++) {
      const midiVal = currentOctave * 12 + 12 + i;
      
      // Limitar a exatamente 3 oitavas + C final (22 teclas brancas)
      if (octOffset === 3 && i > 0) break;

      const isBlack = isBlackKey(i);
      const label = `${getNoteLabel(i)}${currentOctave + 1}`;

      if (!isBlack) {
        whiteKeys.push({ midi: midiVal, label });
        whiteIndex++;
      } else {
        // Calcular posição relativa horizontal baseada no número de teclas brancas inseridas até agora
        // Cada tecla branca ocupa 100% / 22 de largura
        // A tecla preta fica em cima da divisão, ou seja, em (whiteIndex) * largura_branca
        // Ajustamos para centralizar a tecla preta subtraindo metade de sua largura estimada (3% do total)
        const leftPercent = (whiteIndex * (100 / 22)) - (3 / 2);
        blackKeys.push({ midi: midiVal, label, leftOffsetPercent: leftPercent });
      }
    }
  }

  // Manipuladores de eventos de toque e clique do mouse
  const handleMouseDown = (midi: number) => {
    onNoteOn(midi);
  };

  const handleMouseUp = (midi: number) => {
    onNoteOff(midi);
  };

  return (
    <div className="w-full bg-[#0D0D0D] border border-white/10 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase flex items-center">
          <span className="w-3 h-3 bg-accent shadow-[0_0_8px_var(--accent)] mr-2.5" />
          Teclado Virtual
        </h3>

        {/* Seleção de Oitavas */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setBaseOctave(Math.max(1, baseOctave - 1))}
            disabled={baseOctave <= 1}
            className="px-3 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
          >
            Oitava -
          </button>
          <span className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-accent bg-[#0A0A0A] border border-white/10 uppercase">
            C{baseOctave + 1} - C{baseOctave + 4}
          </span>
          <button
            onClick={() => setBaseOctave(Math.min(6, baseOctave + 1))}
            disabled={baseOctave >= 6}
            className="px-3 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
          >
            Oitava +
          </button>
        </div>
      </div>

      {/* Piano Wrapper */}
      <div className="relative w-full h-44 select-none bg-[#050505] border border-black/40">
        {/* Camada das Teclas Brancas */}
        <div className="absolute top-0 left-0 w-full h-full flex">
          {whiteKeys.map((key) => {
            const isActive = activeMidis.has(key.midi);
            const activeClass = 'bg-accent border-accent shadow-[0_0_15px_var(--accent)] text-black font-extrabold';

            return (
              <button
                key={`white-key-${key.midi}`}
                onMouseDown={() => handleMouseDown(key.midi)}
                onMouseUp={() => handleMouseUp(key.midi)}
                onMouseLeave={() => activeMidis.has(key.midi) ? null : handleMouseUp(key.midi)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleMouseDown(key.midi);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleMouseUp(key.midi);
                }}
                style={{ width: `${100 / 22}%` }}
                className={`h-full border-r border-black/30 transition-all duration-75 flex flex-col justify-end pb-3 items-center text-[10px] font-mono font-semibold cursor-pointer ${
                  isActive 
                    ? activeClass 
                    : 'bg-white hover:bg-white/95 text-black/40 active:bg-white/90'
                }`}
              >
                <span className="pointer-events-none">{key.label.replace(/[0-9]/g, '')}</span>
              </button>
            );
          })}
        </div>

        {/* Camada das Teclas Pretas */}
        <div className="absolute top-0 left-0 w-full h-[60%] pointer-events-none">
          {blackKeys.map((key) => {
            const isActive = activeMidis.has(key.midi);
            const activeClass = 'bg-accent border-accent shadow-[0_0_15px_var(--accent)] text-black font-extrabold';

            return (
              <button
                key={`black-key-${key.midi}`}
                onMouseDown={() => handleMouseDown(key.midi)}
                onMouseUp={() => handleMouseUp(key.midi)}
                onMouseLeave={() => activeMidis.has(key.midi) ? null : handleMouseUp(key.midi)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleMouseDown(key.midi);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleMouseUp(key.midi);
                }}
                style={{
                  left: `${key.leftOffsetPercent}%`,
                  width: '3%'
                }}
                className={`absolute top-0 h-full border-b border-r border-l border-black/50 pointer-events-auto transition-all duration-75 flex flex-col justify-end pb-2 items-center text-[8px] font-mono cursor-pointer ${
                  isActive 
                    ? activeClass
                    : 'bg-[#151515] hover:bg-[#202020] text-white/30 active:bg-black'
                }`}
              >
                <span className="pointer-events-none">{key.label.replace(/[0-9]/g, '')}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
          Mapeamento diatônico otimizado de C a C com sensibilidade de toque simulada.
        </p>
      </div>
    </div>
  );
}
