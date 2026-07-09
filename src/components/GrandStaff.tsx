import React from 'react';
import { ActiveNote, ChordAnalysis } from '../types';

function calculateIntervalFromNoteNames(note1: string, note2: string): number {
  if (!note1 || !note2) return -1;
  const noteValues: Record<string, number> = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
    "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
    "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
  };
  
  const cleanNote1 = note1.replace(/[0-9]/g, '');
  const cleanNote2 = note2.replace(/[0-9]/g, '');

  const value1 = noteValues[cleanNote1];
  const value2 = noteValues[cleanNote2];

  if (value1 === undefined || value2 === undefined) {
    return -1;
  }

  return (value2 - value1 + 12) % 12;
}

function getIntervalName(interval: number, temSetima: boolean, chordName?: string): string {
  const isSus2 = chordName 
    ? (chordName.toLowerCase().includes("sus2") || chordName.toLowerCase().includes("add2") || chordName.toLowerCase() === "2" || chordName.toLowerCase().includes("sus2b"))
    : false;

  const intervalNames: Record<number, string> = {
    0: "T",        // Tônica
    1: isSus2 ? "2b" : "9b",  // 2ª menor / 9ª menor
    2: isSus2 ? "2" : "9",    // 2ª maior / 9ª
    3: "3m",       // 3ª menor
    4: "3",        // 3ª maior
    5: (chordName?.toLowerCase().includes("sus4") || chordName?.toLowerCase().includes("add4")) ? "4" : (temSetima ? "11" : "4"),   // 4ª perfeita / 11ª
    6: (chordName?.toLowerCase().includes("sus4") || chordName?.toLowerCase().includes("add4")) ? "4#" : (temSetima ? "11#" : "4#"), // 4ª aumentada / 11ª aumentada
    7: "5",        // 5ª perfeita
    8: temSetima ? "13b" : "5#", // 6ª menor / 13ª menor
    9: (chordName?.toLowerCase().includes("6") && !chordName?.toLowerCase().includes("13")) ? "6" : (temSetima ? "13" : "6"),   // 6ª maior / 13ª maior
    10: "7",       // 7ª menor
    11: "7M"       // 7ª maior
  };

  return intervalNames[interval] !== undefined ? intervalNames[interval] : interval.toString();
}

function getNoteNameFromMidi(midi: number, useFlat: boolean): string {
  const noteNamesSharp = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const noteNamesFlat  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  
  const octave = Math.floor(midi / 12) - 1;
  const noteName = useFlat ? noteNamesFlat[midi % 12] : noteNamesSharp[midi % 12];
  return `${noteName}${octave}`;
}

interface GrandStaffProps {
  activeNotes: ActiveNote[];
  analysis?: ChordAnalysis | null;
  useFlat: boolean;
}

export default function GrandStaff({ activeNotes, analysis, useFlat }: GrandStaffProps) {
  // Configuração de dimensões da pauta
  const width = 640;
  const height = 330;

  const yTrebleCenter = 95; // B4 é o centro (linha 3 da clave de sol)
  const yBassCenter = 225;  // D3 é o centro (linha 3 da clave de fá)

  const lineSpacing = 16;
  const stepSpacing = lineSpacing / 2; // 8px por semitom diatônico

  // Obter deslocamento diatônico da nota (C -> 0, D -> 1, E -> 2, etc.)
  const getDiatonicOffset = (noteLetter: string): number => {
    const letter = noteLetter.toUpperCase()[0];
    switch (letter) {
      case 'C': return 0;
      case 'D': return 1;
      case 'E': return 2;
      case 'F': return 3;
      case 'G': return 4;
      case 'A': return 5;
      case 'B': return 6;
      default: return 0;
    }
  };

  // Identificar se a nota tem acidente (sustenido ou bemol)
  const getAccidental = (noteName: string): 'sharp' | 'flat' | 'none' => {
    const parts = noteName.replace(/[0-9]/g, ''); // Remove oitava
    if (parts.includes('#')) return 'sharp';
    if (parts.includes('b')) return 'flat';
    return 'none';
  };

  // Mapear notas ativas e calcular posições na pauta
  const sortedNotes = [...activeNotes].sort((a, b) => a.midi - b.midi);

  const notesToDraw = sortedNotes.map(note => {
    // C4 (midi 60) ou acima vai para clave de sol, abaixo vai para clave de fá
    const isTreble = note.midi >= 60;
    const formattedName = getNoteNameFromMidi(note.midi, useFlat);
    const noteLetter = formattedName.replace(/[0-9#b]/g, '');
    const noteOctave = parseInt(formattedName.replace(/[^0-9]/g, ''), 10) || 4;
    const step = (noteOctave - 4) * 7 + getDiatonicOffset(noteLetter);
    const accidental = getAccidental(formattedName);

    // Calcular coordenada Y de acordo com a clave
    let y = 0;
    if (isTreble) {
      y = yTrebleCenter - (step - 6) * stepSpacing; // Centro é B4 (step 6)
    } else {
      y = yBassCenter - (step + 6) * stepSpacing;  // Centro é D3 (step -6)
    }

    return {
      ...note,
      name: formattedName,
      isTreble,
      step,
      accidental,
      y,
      xOffset: 0
    };
  });

  // Ajustar notas muito próximas horizontalmente para não colidirem
  for (let i = 0; i < notesToDraw.length - 1; i++) {
    const current = notesToDraw[i];
    const next = notesToDraw[i + 1];
    
    // Se estão na mesma clave e têm o mesmo Y ou diferença de 1 grau (segundas)
    if (current.isTreble === next.isTreble && Math.abs(current.step - next.step) <= 1) {
      next.xOffset = 24; // Desloca a nota mais aguda para a direita por 24px para mais espaço lateral
    }
  }

  // Função para gerar as linhas suplementares (ledger lines)
  const renderLedgerLines = (step: number, isTreble: boolean, noteX: number, noteY: number) => {
    const lines: React.ReactNode[] = [];
    const lineLen = 28;

    if (isTreble) {
      if (step <= 0) {
        // Abaixo da clave de Sol: D4 (step 1), C4 (step 0), B3 (step -1), A3 (step -2), etc.
        // Linhas suplementares ficam nos degraus pares (0, -2, -4...)
        const target = step % 2 === 0 ? step : step + 1;
        for (let k = 0; k >= target; k -= 2) {
          const ly = yTrebleCenter - (k - 6) * stepSpacing;
          lines.push(
            <line
              key={`treble-ledger-low-${k}`}
              x1={noteX - lineLen / 2}
              y1={ly}
              x2={noteX + lineLen / 2}
              y2={ly}
              stroke="var(--accent)"
              strokeOpacity="0.8"
              strokeWidth="1.5"
            />
          );
        }
      } else if (step >= 12) {
        // Acima da clave de Sol: G5 (step 11), A5 (step 12), B5 (step 13), C6 (step 14), etc.
        // Linhas suplementares nos degraus pares (12, 14, 16...)
        const target = step % 2 === 0 ? step : step - 1;
        for (let k = 12; k <= target; k += 2) {
          const ly = yTrebleCenter - (k - 6) * stepSpacing;
          lines.push(
            <line
              key={`treble-ledger-high-${k}`}
              x1={noteX - lineLen / 2}
              y1={ly}
              x2={noteX + lineLen / 2}
              y2={ly}
              stroke="var(--accent)"
              strokeOpacity="0.8"
              strokeWidth="1.5"
            />
          );
        }
      }
    } else {
      // Clave de Fá
      if (step <= -12) {
        // Abaixo da clave de Fá: F2 (step -11), E2 (step -12), D2 (step -13), C2 (step -14)...
        const target = step % 2 === 0 ? step : step + 1;
        for (let k = -12; k >= target; k -= 2) {
          const ly = yBassCenter - (k + 6) * stepSpacing;
          lines.push(
            <line
              key={`bass-ledger-low-${k}`}
              x1={noteX - lineLen / 2}
              y1={ly}
              x2={noteX + lineLen / 2}
              y2={ly}
              stroke="var(--accent)"
              strokeOpacity="0.8"
              strokeWidth="1.5"
            />
          );
        }
      } else if (step >= 0) {
        // Acima da clave de Fá: B3 (step -1), C4 (step 0), D4 (step 1), E4 (step 2)...
        const target = step % 2 === 0 ? step : step - 1;
        for (let k = 0; k <= target; k += 2) {
          const ly = yBassCenter - (k + 6) * stepSpacing;
          lines.push(
            <line
              key={`bass-ledger-high-${k}`}
              x1={noteX - lineLen / 2}
              y1={ly}
              x2={noteX + lineLen / 2}
              y2={ly}
              stroke="var(--accent)"
              strokeOpacity="0.8"
              strokeWidth="1.5"
            />
          );
        }
      }
    }

    return lines;
  };

  const xBase = 320; // Alinhamento central das notas

  let rootName = '';
  let bassName = '';
  let tonicIntervals: string[] = [];
  let showFifthOmitted = false;

  if (analysis) {
    rootName = analysis.root;
    bassName = analysis.bass;

    const uniquePlayNotes = Array.from(new Set(analysis.notes.map(n => n.replace(/[0-9]/g, ''))));
    const intervalosTonica = uniquePlayNotes
      .map(note => calculateIntervalFromNoteNames(rootName, note))
      .filter(v => v !== -1);

    const temSetima = intervalosTonica.includes(10) || intervalosTonica.includes(11);
    let chordHasSetima = temSetima;
    if (analysis.chordName) {
      const chord = analysis.chordName;
      chordHasSetima = chordHasSetima || chord.includes("7M") || (chord.includes("7") && !chord.includes("m7"));
    }

    let intervalosTonicaFiltrados = [...intervalosTonica];
    if (bassName && rootName && bassName !== rootName) {
      const intervaloBaixoRelTonica = calculateIntervalFromNoteNames(rootName, bassName);
      if (intervaloBaixoRelTonica !== -1) {
        intervalosTonicaFiltrados = intervalosTonicaFiltrados.filter(i => i !== intervaloBaixoRelTonica);
      }
    }

    const uniqueFilteredIntervals = Array.from(new Set(intervalosTonicaFiltrados)).sort((a, b) => a - b);
    tonicIntervals = uniqueFilteredIntervals.map(i => getIntervalName(i, chordHasSetima, analysis.chordName));

    const temQuintaJusta = intervalosTonica.includes(7);

    const chord = analysis.chordName || "";
    const quintaAlterada = chord ? (
      chord.toLowerCase().includes("5#") ||
      chord.toLowerCase().includes("#5") ||
      chord.toLowerCase().includes("5b") ||
      chord.toLowerCase().includes("b5") ||
      chord.toLowerCase().includes("°") ||
      chord.toLowerCase().includes("dim") ||
      chord.toLowerCase().includes("m7b5")
    ) : false;

    showFifthOmitted = chordHasSetima && !temQuintaJusta && !quintaAlterada;
  }

  return (
    <div id="grand-staff-container" translate="no" className="notranslate relative w-full overflow-hidden bg-[#0A0A0A] border border-white/10 shadow-lg p-6">
      <div className="absolute top-2 right-4 flex items-center space-x-1.5">
        <div 
          style={{ 
            backgroundColor: activeNotes.length > 0 ? 'var(--accent)' : 'rgba(255, 255, 255, 0.1)',
            boxShadow: activeNotes.length > 0 ? '0 0 10px var(--accent)' : 'none'
          }}
          className="w-3 h-3 rounded-full transition-all duration-300" 
        />
        <span className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase">
          {activeNotes.length > 0 ? `${activeNotes.length} Notas Ativas` : 'Silêncio'}
        </span>
      </div>

      <div className="w-full overflow-x-auto select-none scrollbar-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height="100%"
          className="min-w-[500px] text-white"
        >
          {/* Definição de Gradientes */}
          <defs>
            <radialGradient id="noteGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="noteGlowBass" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* CHAVE DE PIANO (Grand Brace) à esquerda */}
          <path
            d="M 68,63 C 56,63 48,73 48,110 C 48,135 54,145 60,160 C 54,175 48,185 48,210 C 48,247 56,257 68,257"
            fill="none"
            className="stroke-white/30"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line x1="68" y1="63" x2="68" y2="257" className="stroke-white/30" strokeWidth="2" />

          {/* CLAVE DE SOL (Treble Clef Staff - 5 Linhas) */}
          <g id="treble-staff-lines">
            {[0, 1, 2, 3, 4].map(i => {
              const y = yTrebleCenter - (i - 2) * lineSpacing;
              return (
                <line
                  key={`treble-line-${i}`}
                  x1="68"
                  y1={y}
                  x2={width - 40}
                  y2={y}
                  className="stroke-white/10"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>

          {/* CLAVE DE FÁ (Bass Clef Staff - 5 Linhas) */}
          <g id="bass-staff-lines">
            {[0, 1, 2, 3, 4].map(i => {
              const y = yBassCenter - (i - 2) * lineSpacing;
              return (
                <line
                  key={`bass-line-${i}`}
                  x1="68"
                  y1={y}
                  x2={width - 40}
                  y2={y}
                  className="stroke-white/10"
                  strokeWidth="1.5"
                />
              );
            })}
          </g>

          {/* Símbolos das Claves (Unicode) */}
          {/* Clave de Sol (Loop central alinhado perfeitamente na segunda linha - G4) */}
          <text
            x="78"
            y={yTrebleCenter + 22}
            className="fill-white/20 font-bold text-6xl"
            style={{ userSelect: 'none', fontFamily: '"Times New Roman", Times, "Noto Music", serif' }}
          >
            𝄞
          </text>

          {/* Clave de Fá (Início da espiral alinhado perfeitamente na quarta linha - F3) */}
          <text
            x="78"
            y={yBassCenter + 4}
            className="fill-white/20 font-bold text-5xl"
            style={{ userSelect: 'none', fontFamily: '"Times New Roman", Times, "Noto Music", serif' }}
          >
            𝄢
          </text>

          {/* Renderização das Notas Ativas */}
          {notesToDraw.map((note, index) => {
            const noteX = xBase + note.xOffset;
            const noteY = note.y;

            const isSharp = note.accidental === 'sharp';
            const isFlat = note.accidental === 'flat';

            // Usamos a variável de cor ativa
            const themeColor = 'fill-[var(--accent)]';
            const glowId = 'url(#noteGlow)';

            // Calcular posicionamento inteligente do texto da nota para evitar sobreposição vertical
            let xTextOffset = 15;
            let textAnchor = "start";
            
            // Verifica se há alguma nota vizinha muito próxima verticalmente no mesmo acorde
            // Se houver, alternamos o lado do texto (direita vs esquerda)
            let isColliding = false;
            for (let j = 0; j < notesToDraw.length; j++) {
              if (j !== index) {
                const other = notesToDraw[j];
                if (other.isTreble === note.isTreble && Math.abs(other.y - note.y) < 20) {
                  isColliding = true;
                  break;
                }
              }
            }
            
            if (isColliding && index % 2 !== 0) {
              const hasAccidental = note.accidental !== 'none';
              xTextOffset = hasAccidental ? -34 : -15;
              textAnchor = "end";
            }

            return (
              <g key={`note-render-${note.midi}-${index}`} className="transition-all duration-150">
                {/* Efeito de brilho de fundo para notas ativas */}
                <circle
                  cx={noteX}
                  cy={noteY}
                  r="24"
                  fill={glowId}
                />

                {/* Linhas suplementares se necessárias */}
                {renderLedgerLines(note.step, note.isTreble, noteX, noteY)}

                {/* Símbolo do Acidente (Sharp/Flat) */}
                {isSharp && (
                  <text
                    x={noteX - 22}
                    y={noteY + 7}
                    className="fill-[var(--accent)] font-sans text-2xl font-bold"
                  >
                    ♯
                  </text>
                )}
                {isFlat && (
                  <text
                    x={noteX - 20}
                    y={noteY + 7}
                    className="fill-[var(--accent)] font-sans text-2xl font-bold"
                  >
                    ♭
                  </text>
                )}

                {/* Cabeça de nota (Oval levemente inclinada para parecer profissional) */}
                <ellipse
                  cx={noteX}
                  cy={noteY}
                  rx="9.5"
                  ry="6.5"
                  transform={`rotate(-18, ${noteX}, ${noteY})`}
                  className={`${themeColor} stroke-[#0A0A0A]`}
                  strokeWidth="1.5"
                />

                {/* Nome da nota desenhado dentro ou próximo à nota */}
                <text
                  x={noteX + xTextOffset}
                  y={noteY + 4}
                  textAnchor={textAnchor}
                  className="fill-white font-mono text-[11px] font-bold uppercase tracking-wider"
                >
                  {note.name}
                </text>
              </g>
            );
          })}

          {/* Texto de Ajuda / Feedback quando vazio */}
          {activeNotes.length === 0 && (
            <text
              x={width / 2 + 10}
              y="138"
              textAnchor="middle"
              className="fill-white/30 font-sans text-xs uppercase tracking-[0.3em] animate-pulse"
            >
              Aguardando sinal midi...
            </text>
          )}
        </svg>
      </div>

      <div className="mt-2 border-t border-white/10 pt-4 px-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span className="text-[12px] font-mono tracking-[0.2em] text-white/40 uppercase font-bold flex items-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full mr-2.5 bg-accent shadow-[0_0_6px_var(--accent)]" />
            Intervalos Empilhados
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-2 sm:justify-start min-h-[36px]">
            {analysis ? (
              <>
                {/* Tônica */}
                {rootName && (
                  <span className="px-2.5 py-1 bg-accent/10 border border-accent/20 font-mono text-[12px] text-accent flex items-center flex-wrap gap-1.5">
                    <span className="text-accent/60 uppercase tracking-wider mr-1.5 text-[10px]">Tônica:</span>
                    <strong className="text-accent font-bold mr-1">{rootName}</strong>
                    <span className="flex gap-1">
                      {tonicIntervals.map((name, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded-sm text-[11px] font-bold ${
                            name === 'T'
                              ? 'bg-accent/20 text-accent border border-accent/30'
                              : 'bg-white/10 text-white/95'
                          }`}
                        >
                          {name}
                        </span>
                      ))}
                    </span>
                  </span>
                )}

                {/* Baixo (se for diferente da tônica / invertido, exibido à direita) */}
                {bassName && rootName && bassName !== rootName && (
                  <span className="px-2.5 py-1 bg-white/5 border border-white/10 font-mono text-[12px] text-white/70 flex items-center">
                    <span className="text-white/40 uppercase tracking-wider mr-1.5 text-[10px]">Baixo:</span>
                    <strong className="text-white font-bold">{bassName}</strong>
                  </span>
                )}

                {/* Alerta de 5a Omitida */}
                {showFifthOmitted && (
                  <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center">
                    <span className="mr-1 text-[13px]">✔️</span> 5ª Omitida
                  </span>
                )}
              </>
            ) : (
              <span className="text-white/20 font-mono text-[11px] uppercase tracking-wider">
                Toque um acorde para visualizar os intervalos
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
