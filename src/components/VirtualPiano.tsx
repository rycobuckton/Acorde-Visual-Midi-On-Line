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

  // Número de oitavas dinâmico para o teclado virtual
  const [octaveCount, setOctaveCount] = React.useState<number>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_piano_octaves');
      return saved ? parseInt(saved, 10) : 3;
    } catch {
      return 3;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_piano_octaves', String(octaveCount));
    } catch (e) {
      console.error(e);
    }
  }, [octaveCount]);

  const handleSetOctaveCount = (count: number) => {
    setOctaveCount(count);
    if (baseOctave + count > 8) {
      setBaseOctave(8 - count);
    }
  };

  // Gerar chaves para octaveCount oitavas
  const numWhiteKeys = octaveCount * 7 + 1;
  const whiteKeys: { midi: number; label: string }[] = [];
  const blackKeys: { midi: number; label: string; leftOffsetPercent: number }[] = [];

  let whiteIndex = 0;
  for (let octOffset = 0; octOffset <= octaveCount; octOffset++) {
    const currentOctave = baseOctave + octOffset;
    
    for (let i = 0; i < 12; i++) {
      const midiVal = currentOctave * 12 + 12 + i;
      
      // Limitar a exatamente octaveCount oitavas + C final
      if (octOffset === octaveCount && i > 0) break;

      const isBlack = isBlackKey(i);
      const label = `${getNoteLabel(i)}${currentOctave + 1}`;

      if (!isBlack) {
        whiteKeys.push({ midi: midiVal, label });
        whiteIndex++;
      } else {
        // Calcular posição relativa horizontal baseada no número de teclas brancas inseridas até agora
        const leftPercent = (whiteIndex * (100 / numWhiteKeys)) - ((60 / numWhiteKeys) / 2);
        blackKeys.push({ midi: midiVal, label, leftOffsetPercent: leftPercent });
      }
    }
  }

  // Set local para controlar quais notas foram pressionadas especificamente por este teclado virtual (com Ref para evitar closures desatualizadas)
  const [virtualPressedMidis, setVirtualPressedMidis] = React.useState<Set<number>>(new Set());
  const virtualPressedRef = React.useRef<Set<number>>(new Set());

  const handlePressStart = (midi: number) => {
    if (!virtualPressedRef.current.has(midi)) {
      virtualPressedRef.current.add(midi);
      setVirtualPressedMidis(new Set(virtualPressedRef.current));
      onNoteOn(midi);
    }
  };

  const handlePressEnd = (midi: number) => {
    if (virtualPressedRef.current.has(midi)) {
      virtualPressedRef.current.delete(midi);
      setVirtualPressedMidis(new Set(virtualPressedRef.current));
      onNoteOff(midi);
    }
  };

  const handleMouseLeave = (midi: number) => {
    if (virtualPressedRef.current.has(midi)) {
      handlePressEnd(midi);
    }
  };

  // Handler de Toque Unificado (Suporta Glissando, Multi-toques ilimitados e resolve travamento no Tablet)
  const handleTouchChange = (e: React.TouchEvent) => {
    e.preventDefault();
    const activeMidisFromTouch = new Set<number>();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element) {
        let current: HTMLElement | null = element as HTMLElement;
        while (current) {
          if (current.id === "virtual-piano-section") {
            break; // Parar se subiu demais
          }
          const midiStr = current.getAttribute('data-midi');
          if (midiStr) {
            activeMidisFromTouch.add(parseInt(midiStr, 10));
            break;
          }
          current = current.parentElement;
        }
      }
    }

    const currentPressed = virtualPressedRef.current;

    // 1. Ligar novas notas que acabaram de ser tocadas
    activeMidisFromTouch.forEach((midi) => {
      if (!currentPressed.has(midi)) {
        onNoteOn(midi);
      }
    });

    // 2. Desligar notas que foram soltas ou cujos dedos saíram da tecla
    currentPressed.forEach((midi) => {
      if (!activeMidisFromTouch.has(midi)) {
        onNoteOff(midi);
      }
    });

    // 3. Atualizar estados sincronizados
    virtualPressedRef.current = activeMidisFromTouch;
    setVirtualPressedMidis(new Set(activeMidisFromTouch));
  };

  // Segurança global para mouseup (evita notas presas se soltar o clique fora da janela do navegador)
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (virtualPressedRef.current.size > 0) {
        virtualPressedRef.current.forEach((midi) => {
          onNoteOff(midi);
        });
        virtualPressedRef.current.clear();
        setVirtualPressedMidis(new Set());
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [onNoteOff]);

  return (
    <div translate="no" className="notranslate w-full bg-[#0D0D0D] border border-white/10 p-6 select-none">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase flex items-center">
          <span className="w-3 h-3 bg-accent shadow-[0_0_8px_var(--accent)] mr-2.5" />
          Teclado Virtual (Multitouch & Deslizável)
        </h3>

        {/* Controles de Oitavas e Tamanho do Piano */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Controle do Número de Oitavas (Teclas) */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleSetOctaveCount(Math.max(1, octaveCount - 1))}
              disabled={octaveCount <= 1}
              className="px-2.5 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
              title="Diminuir número de oitavas do teclado"
            >
              Teclas -
            </button>
            <span className="px-2 py-1.5 text-[10px] font-mono font-bold text-white bg-[#0A0A0A] border border-white/10 uppercase">
              {octaveCount} {octaveCount === 1 ? 'Oitava' : 'Oitavas'}
            </span>
            <button
              onClick={() => handleSetOctaveCount(Math.min(5, octaveCount + 1))}
              disabled={octaveCount >= 5}
              className="px-2.5 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
              title="Aumentar número de oitavas do teclado"
            >
              Teclas +
            </button>
          </div>

          <div className="hidden sm:block w-px h-4 bg-white/10" />

          {/* Seleção de Oitavas (Transposição) */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setBaseOctave(Math.max(1, baseOctave - 1))}
              disabled={baseOctave <= 1}
              className="px-3 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
              title="Transpor oitava para a esquerda (mais grave)"
            >
              Oitava -
            </button>
            <span className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest text-accent bg-[#0A0A0A] border border-white/10 uppercase">
              C{baseOctave + 1} - C{baseOctave + 1 + octaveCount}
            </span>
            <button
              onClick={() => setBaseOctave(Math.min(8 - octaveCount, baseOctave + 1))}
              disabled={baseOctave >= 8 - octaveCount}
              className="px-3 py-1.5 text-[10px] font-mono uppercase bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-35 transition cursor-pointer"
              title="Transpor oitava para a direita (mais agudo)"
            >
              Oitava +
            </button>
          </div>
        </div>
      </div>

      {/* Piano Wrapper com suporte total a gestos multitoque e glissando */}
      <div 
        id="virtual-piano-wrapper"
        onTouchStart={handleTouchChange}
        onTouchMove={handleTouchChange}
        onTouchEnd={handleTouchChange}
        onTouchCancel={handleTouchChange}
        className="relative w-full h-44 select-none bg-[#050505] border border-black/40 touch-none"
      >
        {/* Camada das Teclas Brancas */}
        <div className="absolute top-0 left-0 w-full h-full flex">
          {whiteKeys.map((key) => {
            const isActive = activeMidis.has(key.midi);
            const activeClass = 'bg-accent border-accent shadow-[0_0_15px_var(--accent)] text-black font-extrabold';

            return (
              <button
                key={`white-key-${key.midi}`}
                data-midi={key.midi}
                onMouseDown={() => handlePressStart(key.midi)}
                onMouseUp={() => handlePressEnd(key.midi)}
                onMouseLeave={() => handleMouseLeave(key.midi)}
                style={{ width: `${100 / numWhiteKeys}%` }}
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
                data-midi={key.midi}
                onMouseDown={() => handlePressStart(key.midi)}
                onMouseUp={() => handlePressEnd(key.midi)}
                onMouseLeave={() => handleMouseLeave(key.midi)}
                style={{
                  left: `${key.leftOffsetPercent}%`,
                  width: `${60 / numWhiteKeys}%`
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
          Arraste o dedo pelas teclas para fazer glissando. Suporte completo a multitoque sem teclas travadas.
        </p>
      </div>
    </div>
  );
}
