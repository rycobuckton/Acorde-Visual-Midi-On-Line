import React from 'react';
import { ChordAnalysis } from '../types';
import { Music, Layers, Compass } from 'lucide-react';

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

interface ChordDetailsProps {
  analysis: ChordAnalysis | null;
  useFlat: boolean;
  setUseFlat: (flat: boolean) => void;
  useEasyMode: boolean;
  setUseEasyMode: (easy: boolean) => void;
}

export default function ChordDetails({
  analysis,
  useFlat,
  setUseFlat,
  useEasyMode,
  setUseEasyMode,
}: ChordDetailsProps) {

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
    const temQuintaJusta = intervalosTonica.includes(7);

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
    <div className="w-full flex flex-col space-y-4">
      {/* PAINEL 1: NOME DO ACORDE (Destaque Principal - Altura Rigorosamente Fixa) */}
      <div className="bg-[#0D0D0D] border border-white/10 p-5 flex flex-col justify-between relative overflow-hidden h-[245px] max-h-[245px] select-none">
        {/* Massive watermark background chord name */}
        {analysis && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
            <span className="text-[120px] font-black uppercase tracking-tighter text-accent truncate max-w-full">
              {analysis.chordName}
            </span>
          </div>
        )}

        <div className="relative z-10 w-full">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-mono tracking-[0.25em] text-white/40 uppercase flex items-center">
              <Music className="w-3.5 h-3.5 text-accent mr-1.5" />
              Análise Harmônica
            </span>

            {/* Controles de Cifra (Fácil & #/b) */}
            <div className="flex items-center space-x-2">
              {/* Botão de Modo Fácil (EASY) */}
              <button
                onClick={() => setUseEasyMode(!useEasyMode)}
                className={`px-2 py-0.5 text-[8px] font-mono uppercase border transition cursor-pointer select-none ${
                  useEasyMode
                    ? 'bg-accent/15 text-accent border-accent-border font-bold'
                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white/85'
                }`}
                title="Modo Fácil: Oculta inversões de tríades simples para facilitar para iniciantes"
              >
                EASY
              </button>

              {/* Seletor de Notação de Cifra (# / b) */}
              <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-none text-[9px] font-mono">
                <button
                  onClick={() => setUseFlat(false)}
                  className={`px-2.5 py-1 uppercase transition ${
                    !useFlat
                      ? 'bg-accent/15 text-accent font-bold'
                      : 'text-white/40 hover:text-white/85'
                  }`}
                  title="Exibir com Sustenidos (#)"
                >
                  #
                </button>
                <button
                  onClick={() => setUseFlat(true)}
                  className={`px-2.5 py-1 uppercase transition ${
                    useFlat
                      ? 'bg-accent/15 text-accent font-bold'
                      : 'text-white/40 hover:text-white/85'
                  }`}
                  title="Exibir com Bemóis (b)"
                >
                  b
                </button>
              </div>
            </div>
          </div>

          {/* Container de texto com altura fixa para evitar quebras de layout */}
          <div className="mt-2 h-[80px] flex flex-col justify-center">
            {analysis ? (
              <div>
                <h1 className="text-3xl sm:text-4xl font-light tracking-tighter text-accent truncate">
                  {analysis.chordName}
                </h1>
                <p className="text-[10px] text-white/40 tracking-[0.15em] uppercase mt-1 font-mono leading-relaxed truncate">
                  {analysis.name}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl sm:text-3xl font-light tracking-tighter text-white/20 uppercase truncate">
                  Aguardando...
                </h1>
                <p className="text-[10px] text-white/30 tracking-[0.1em] mt-1 font-mono leading-relaxed">
                  Toque notas para identificar acordes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Detalhes Técnicos Rápidos - Grid horizontal fixo de 3 colunas para manter estabilidade pixel-perfect */}
        <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3 relative z-10 w-full mt-auto">
          <div className="bg-white/5 p-1.5 border border-white/5 flex flex-col justify-center items-center text-center">
            <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Tônica</span>
            <span className="text-[11px] font-mono font-bold text-accent mt-0.5 truncate max-w-full">
              {analysis ? analysis.root : '—'}
            </span>
          </div>
          
          <div className="bg-white/5 p-1.5 border border-white/5 flex flex-col justify-center items-center text-center">
            <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Baixo</span>
            <span className="text-[11px] font-mono font-bold text-white/80 mt-0.5 truncate max-w-full">
              {analysis ? analysis.bass : '—'}
            </span>
          </div>

          <div className="bg-white/5 p-1.5 border border-white/5 flex flex-col justify-center items-center text-center">
            <span className="text-[8px] font-mono text-white/40 uppercase tracking-wider">Notas</span>
            <span className="text-[10px] font-mono font-bold text-white mt-0.5 truncate max-w-full">
              {analysis ? analysis.notes.join(', ') : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* PAINEL 2: ESCALAS RECOMENDADAS (Altura rigorosamente fixa para manter consistência estética) */}
      <div className="bg-[#0D0D0D] border border-white/10 p-5 flex flex-col justify-between h-[160px] max-h-[160px]">
        <div>
          <h3 className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase flex items-center mb-2">
            <Compass className="w-4 h-4 text-accent mr-2" />
            Escalas para Improviso
          </h3>

          {/* Altura fixa para a lista de escalas */}
          <div className="space-y-2 h-[85px] flex flex-col justify-between">
            <div className="space-y-1 overflow-y-auto pr-1 scrollbar-thin flex-1 flex flex-col justify-center">
              {analysis ? (
                analysis.scales.slice(0, 3).map((scale, idx) => (
                  <div
                    key={`scale-${idx}`}
                    className="flex items-center justify-between bg-white/5 border border-white/5 p-1.5 hover:border-white/10 transition"
                  >
                    <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider font-mono truncate max-w-[210px]">
                      {scale}
                    </span>
                    <span className="w-1.5 h-1.5 bg-accent" />
                  </div>
                ))
              ) : (
                /* Placeholder estável */
                <div className="text-white/20 font-mono text-[9px] uppercase tracking-wider text-center select-none pointer-events-none py-2">
                  Toque notas para analisar escalas
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
