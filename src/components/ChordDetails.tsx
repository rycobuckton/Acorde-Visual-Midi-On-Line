import React, { useState, useEffect, useRef } from 'react';
import { ChordAnalysis } from '../types';
import { Music, Layers, Compass, Maximize2, Minimize2 } from 'lucide-react';

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
  activeNotesCount?: number;
  useFlat: boolean;
  setUseFlat: (flat: boolean) => void;
  useEasyMode: boolean;
  setUseEasyMode: (easy: boolean) => void;
  onlyChords: boolean;
  setOnlyChords: (only: boolean) => void;
}

// Retorna a unidade base (vw) para o tamanho da fonte do acorde na tela cheia de modo responsivo e fluido
function getChordBaseFontSize(): string {
  // Retorna um valor fixo e estável de 11vw para evitar o efeito indesejado de auto-ajuste/ficar encolhendo ao tocar acordes de diferentes tamanhos.
  // O usuário pode regular perfeitamente o tamanho ideal do texto usando os botões de escala de fonte (A+ e A-) na barra superior.
  return '11vw';
}

// Limpa a descrição do acorde removendo variações de "Acorde de" ou "Acorde" no início ou em qualquer parte
function cleanChordDescription(name: string): string {
  if (!name) return '';
  // Remove "Acorde de ", "Acorde: Acorde ", "Acorde: ", "Acorde ", case-insensitive no início
  let cleaned = name.replace(/^(acorde:\s*acorde\s+|acorde:\s*|acorde\s+de\s+|acorde\s+)/i, '');
  // Remove menções repetidas a "acorde"
  cleaned = cleaned.replace(/\bacorde\s+de\s+/ig, '').replace(/\bacorde\s+/ig, '');
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

// Formata a exibição do nome do acorde colocando "add9" e "sus" em minúsculo e sem parênteses
function formatChordDisplay(chordName: string): string {
  if (!chordName) return '';
  let formatted = chordName;

  // 1. Primeiro normalize todos os "add" e "sus" para minúsculo
  formatted = formatted.replace(/add([\d#b,+-]*)/ig, (_, p1) => 'add' + p1.toLowerCase());
  formatted = formatted.replace(/sus([\d#b,+-]*)/ig, (_, p1) => 'sus' + p1.toLowerCase());

  // 2. Remove parênteses temporariamente de todos os "add" para padronização
  formatted = formatted.replace(/\((add[\d#b,+-]*)\)/g, '$1');

  // 3. Se for um acorde menor (tem 'm' antes do 'add'), colocamos parênteses no 'add' para ficar legível: Am(add9)
  // Caso contrário (acorde maior), fica sem parênteses: Cadd9
  formatted = formatted.replace(/madd([\d#b,+-]*)/g, 'm(add$1)');

  // 4. Para os "sus", sempre removemos os parênteses: (sus4) -> sus4, (sus2) -> sus2
  formatted = formatted.replace(/\((sus[\d#b,+-]*)\)/g, '$1');

  // 5. Se houver múltiplos "add" consecutivos separados por vírgula, ex: add9,add11 -> add9,11
  while (formatted.includes(',add')) {
    formatted = formatted.replace(/,add/g, ',');
  }

  return formatted;
}

export default function ChordDetails({
  analysis: propAnalysis,
  activeNotesCount = 0,
  useFlat,
  setUseFlat,
  useEasyMode,
  setUseEasyMode,
  onlyChords,
  setOnlyChords,
}: ChordDetailsProps) {

  const [displayedAnalysis, setDisplayedAnalysis] = useState<ChordAnalysis | null>(propAnalysis);
  const [showAwaitingText, setShowAwaitingText] = useState(true);
  const transitionDelay = 40; // Atraso fixo fora da UI para transição de notas em ms

  const isPowerChordOr5th = (an: ChordAnalysis | null): boolean => {
    if (!an) return false;
    const name = (an.name || "").trim().toLowerCase();
    const chordName = (an.chordName || "").trim().toLowerCase();
    
    return (
      name.endsWith('5') || 
      chordName.endsWith('5') || 
      name.includes('quinta justa') || 
      chordName.includes('(5p)') ||
      chordName.includes('5ª justa')
    );
  };

  const lastValidChordRef = useRef<ChordAnalysis | null>(null);
  const releaseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isValidChord = (an: ChordAnalysis | null): boolean => {
    if (!an) return false;
    const type = (an.type || '').toLowerCase();
    const name = (an.name || '').toLowerCase();
    
    // Ignora notas isoladas, intervalos harmônicos e análises sem nome de cifra válido
    if (type.includes('nota única') || name.includes('nota isolada')) return false;
    if (type.includes('intervalo') || name.includes('intervalo')) return false;
    if (!an.chordName || an.chordName.trim() === '') return false;
    
    return true;
  };

  useEffect(() => {
    // Limpa quaisquer timers pendentes sempre que houver novas notas ou mudanças de estado
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    if (activeNotesCount === 0) {
      // 1. Aguarda 40ms (transition delay de transição) antes de confirmar que não há teclas ativas
      releaseTimerRef.current = setTimeout(() => {
        // Quando confirma que não há teclas ativas, limpamos o acorde e as notas imediatamente
        setDisplayedAnalysis(null);
        lastValidChordRef.current = null;
        
        // E mostramos o vazio (esconde o texto "Aguardando...")
        setShowAwaitingText(false);

        // Se passar o tempo de inatividade (15 segundos), mostramos o "Aguardando..." novamente.
        idleTimerRef.current = setTimeout(() => {
          setShowAwaitingText(true);
        }, 15000); // 15 segundos de inatividade para mostrar "Aguardando..."
      }, transitionDelay);
    } else {
      // Se houver alguma tecla pressionada:
      // Oculta o "Aguardando..." imediatamente para quando voltar a ficar vazio
      setShowAwaitingText(false);

      const isX5 = isPowerChordOr5th(propAnalysis);
      const isNewValid = isValidChord(propAnalysis) && !isX5;

      if (isNewValid) {
        // Se for um novo acorde válido (e não X5), atualiza imediatamente (sem delay)
        setDisplayedAnalysis(propAnalysis);
        lastValidChordRef.current = propAnalysis;
      } else if (isX5) {
        // Se for um acorde X5 (Power Chord / Quinta), aplicamos um atraso fixo de 60ms
        // para evitar piscadas durante transições rápidas de dedos.
        releaseTimerRef.current = setTimeout(() => {
          setDisplayedAnalysis(propAnalysis);
        }, 60); // 60ms de atraso fixo para X5 conforme solicitado
      } else {
        // Se não for um acorde completo/válido nem X5 (ex: transição em que sobrou apenas a nota do baixo)
        if (lastValidChordRef.current) {
          // Mantém o último acorde completo/válido na tela, evitando piscar "AGUARDANDO" ou a nota isolada
          setDisplayedAnalysis(lastValidChordRef.current);
        } else {
          // Se não havia nenhum acorde válido anterior, exibe o que está sendo tocado (ex: nota isolada)
          setDisplayedAnalysis(propAnalysis);
        }
      }
    }

    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [propAnalysis, activeNotesCount, transitionDelay]);

  const analysis = displayedAnalysis;

  let rootName = '';
  let bassName = '';
  let tonicIntervals: string[] = [];
  let showFifthOmitted = false;

  if (analysis) {
    rootName = analysis.root;
    bassName = analysis.bass;

    const uniquePlayNotes = Array.from(new Set(analysis.notes.map(n => n.replace(/[0-9]/g, '')))) as string[];
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

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fsFontScale, setFsFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_fs_font_scale');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_fs_font_scale', String(fsFontScale));
    } catch (e) {
      console.error(e);
    }
  }, [fsFontScale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <div translate="no" className="notranslate w-full flex flex-col space-y-4">
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
              Acorde
            </span>

            {/* Controles de Cifra (Fácil & Só Acordes & #/b & Fullscreen) */}
            <div className="flex items-center space-x-1.5 h-7">
              {/* Botão de Modo Fácil (EASY) */}
              <button
                onClick={() => setUseEasyMode(!useEasyMode)}
                className={`h-7 px-2 text-[9px] font-mono border transition cursor-pointer select-none flex items-center justify-center ${
                  useEasyMode
                    ? 'bg-accent/15 text-accent border-accent-border font-bold'
                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white/85 hover:bg-white/10'
                }`}
                title="Modo Fácil: Oculta inversões de tríades simples para facilitar para iniciantes"
              >
                EASY
              </button>

              {/* Botão de apenas acordes (SÓ ACORDES) */}
              <button
                onClick={() => setOnlyChords(!onlyChords)}
                className={`h-7 px-2 text-[9px] font-mono border transition cursor-pointer select-none flex items-center justify-center ${
                  onlyChords
                    ? 'bg-accent/15 text-accent border-accent-border font-bold'
                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white/85 hover:bg-white/10'
                }`}
                title="Só Acordes: Exibe apenas acordes de 3 ou mais notas (oculta notas isoladas e intervalos)"
              >
                SÓ ACORDES
              </button>

              {/* Seletor de Notação de Cifra (# / b) */}
              <div className="flex h-7 bg-white/5 border border-white/10 p-0.5 rounded-none text-[9px] font-mono items-center">
                <button
                  onClick={() => setUseFlat(false)}
                  className={`h-6 px-2 transition flex items-center justify-center cursor-pointer select-none ${
                    !useFlat
                      ? 'bg-accent/15 text-accent font-bold text-[14px]'
                      : 'text-white/40 hover:text-white/85 text-[11px]'
                  }`}
                  title="Exibir com Sustenidos (♯)"
                >
                  ♯
                </button>
                <button
                  onClick={() => setUseFlat(true)}
                  className={`h-6 px-2 transition flex items-center justify-center cursor-pointer select-none ${
                    useFlat
                      ? 'bg-accent/15 text-accent font-bold text-[14px]'
                      : 'text-white/40 hover:text-white/85 text-[11px]'
                  }`}
                  title="Exibir com Bemóis (♭)"
                >
                  ♭
                </button>
              </div>

              {/* Botão Tela Cheia (Fullscreen) */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="h-7 w-7 bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all cursor-pointer rounded-none flex items-center justify-center"
                title="Exibir em tela cheia (Atalho: ESC para sair)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Container de texto com altura fixa para evitar quebras de layout */}
          <div className="mt-2 h-[80px] flex flex-col justify-center">
            {analysis ? (
              <div>
                <h1 className="text-3xl sm:text-4xl font-medium font-sans tracking-tight text-accent truncate">
                  {formatChordDisplay(analysis.chordName)}
                </h1>
                <p className="text-[10px] text-white/40 tracking-[0.15em] uppercase mt-1 font-sans leading-relaxed truncate">
                  {cleanChordDescription(analysis.name)}
                </p>
              </div>
            ) : showAwaitingText ? (
              <div>
                <h1 className="text-2xl sm:text-3xl font-medium font-sans tracking-tight text-white/20 uppercase truncate">
                  Aguardando...
                </h1>
                <p className="text-[10px] text-white/30 tracking-[0.1em] mt-1 font-sans leading-relaxed">
                  Toque notas para identificar acordes.
                </p>
              </div>
            ) : (
              /* Vazio durante o intervalo de 15s */
              <div className="h-[52px]" />
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
              ) : showAwaitingText ? (
                /* Placeholder estável */
                <div className="text-white/20 font-mono text-[9px] uppercase tracking-wider text-center select-none pointer-events-none py-2">
                  Toque notas para analisar escalas
                </div>
              ) : (
                /* Vazio durante o intervalo de 15s */
                <div className="h-6" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* OVERLAY TELA CHEIA (FULLSCREEN) - Otimizado para Tablets & Stands de Partitura */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-[#070707] z-[9999] flex flex-col justify-between p-4 sm:p-6 md:p-8 select-none animate-fade-in text-white">
          {/* Top Header Controls */}
          <div className="flex items-center justify-between w-full max-w-[1550px] mx-auto border-b border-white/5 pb-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono tracking-[0.3em] text-white/40 uppercase flex items-center">
                <Music className="w-4 h-4 text-accent mr-2" />
                Modo Leitura Gigante
              </span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Seletor de Tamanho da Fonte */}
              <div className="flex h-9 bg-white/5 border border-white/10 p-0.5 text-[11px] font-mono items-center">
                <button
                  onClick={() => setFsFontScale(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
                  className="h-7 px-2.5 text-white/40 hover:text-white transition cursor-pointer font-bold select-none flex items-center justify-center"
                  title="Diminuir Fonte"
                >
                  A-
                </button>
                <span className="h-7 px-2 text-accent font-medium select-none border-x border-white/5 min-w-[45px] text-center flex items-center justify-center">
                  {Math.round(fsFontScale * 100)}%
                </span>
                <button
                  onClick={() => setFsFontScale(prev => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                  className="h-7 px-2.5 text-white/40 hover:text-white transition cursor-pointer font-bold select-none flex items-center justify-center"
                  title="Aumentar Fonte"
                >
                  A+
                </button>
              </div>

              {/* Controles de Cifra no Fullscreen */}
              <button
                onClick={() => setUseEasyMode(!useEasyMode)}
                className={`h-9 px-3.5 text-[11px] font-mono border transition cursor-pointer select-none flex items-center justify-center ${
                  useEasyMode
                    ? 'bg-accent/15 text-accent border-accent-border font-bold'
                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white/85 hover:bg-white/10'
                }`}
                title="Modo Fácil"
              >
                EASY
              </button>

              <button
                onClick={() => setOnlyChords(!onlyChords)}
                className={`h-9 px-3.5 text-[11px] font-mono border transition cursor-pointer select-none flex items-center justify-center ${
                  onlyChords
                    ? 'bg-accent/15 text-accent border-accent-border font-bold'
                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white/85 hover:bg-white/10'
                }`}
                title="Só Acordes: Exibe apenas acordes de 3 ou mais notas"
              >
                SÓ ACORDES
              </button>

              <div className="flex h-9 bg-white/5 border border-white/10 p-0.5 rounded-none text-[11px] font-mono items-center">
                <button
                  onClick={() => setUseFlat(false)}
                  className={`h-7 px-3.5 transition flex items-center justify-center cursor-pointer select-none ${
                    !useFlat
                      ? 'bg-accent/15 text-accent font-bold text-[18px]'
                      : 'text-white/40 hover:text-white/85 text-[13px]'
                  }`}
                  title="Exibir com Sustenidos (♯)"
                >
                  ♯
                </button>
                <button
                  onClick={() => setUseFlat(true)}
                  className={`h-7 px-3.5 transition flex items-center justify-center cursor-pointer select-none ${
                    useFlat
                      ? 'bg-accent/15 text-accent font-bold text-[18px]'
                      : 'text-white/40 hover:text-white/85 text-[13px]'
                  }`}
                  title="Exibir com Bemóis (♭)"
                >
                  ♭
                </button>
              </div>

              {/* Botão de Fechar */}
              <button
                onClick={() => setIsFullscreen(false)}
                className="h-9 bg-accent hover:bg-accent-hover text-black px-4 text-xs font-mono font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center justify-center space-x-1.5"
                title="Sair da tela cheia (ESC)"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          </div>

          {/* Central Area: Massive Chord Name */}
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2 my-2">
            {analysis ? (
              <div className="space-y-4 sm:space-y-6 w-full max-w-full animate-fade-in">
                {/* O tamanho do texto adapta dinamicamente para comportar cifras longas e curtas */}
                <h1 
                  style={{ fontSize: `calc(${getChordBaseFontSize()} * ${fsFontScale})` }}
                  className="font-normal tracking-tight text-accent leading-none break-words select-all font-sans"
                >
                  {formatChordDisplay(analysis.chordName)}
                </h1>
                <p className="text-base sm:text-xl md:text-2xl text-white/50 tracking-[0.15em] uppercase font-sans leading-relaxed break-words whitespace-normal px-4 max-w-5xl mx-auto">
                  {cleanChordDescription(analysis.name)}
                </p>
              </div>
            ) : showAwaitingText ? (
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium font-sans tracking-tight text-white/15 uppercase animate-pulse">
                  Aguardando notas...
                </h1>
                <p className="text-xs sm:text-sm text-white/30 tracking-[0.15em] font-sans uppercase">
                  Toque um acorde para exibição gigante
                </p>
              </div>
            ) : (
              /* Vazio durante o intervalo de 15s */
              <div className="h-20" />
            )}
          </div>

          {/* Bottom Area: Tech Details & Recommended Scales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[1550px] mx-auto border-t border-white/10 pt-6 mt-auto">
            {/* Tech Details Column */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 p-4 border border-white/5 flex flex-col justify-center items-center text-center">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Tônica</span>
                <span className="text-xl sm:text-2xl font-mono font-bold text-accent mt-1">
                  {analysis ? analysis.root : '—'}
                </span>
              </div>
              <div className="bg-white/5 p-4 border border-white/5 flex flex-col justify-center items-center text-center">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Baixo</span>
                <span className="text-xl sm:text-2xl font-mono font-bold text-white/80 mt-1">
                  {analysis ? analysis.bass : '—'}
                </span>
              </div>
              <div className="bg-white/5 p-4 border border-white/5 flex flex-col justify-center items-center text-center">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Notas</span>
                <span className="text-sm sm:text-base font-mono font-bold text-white mt-1 truncate max-w-full">
                  {analysis ? analysis.notes.join(', ') : '—'}
                </span>
              </div>
            </div>

            {/* Recommended Scales Column */}
            <div className="bg-white/5 border border-white/5 p-4 flex flex-col justify-center">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-2.5 block text-center md:text-left">
                Escalas Recomendadas para Improviso
              </span>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {analysis && analysis.scales.length > 0 ? (
                  analysis.scales.slice(0, 3).map((scale, idx) => (
                    <span
                      key={`fs-scale-${idx}`}
                      className="bg-accent/15 border border-accent/25 px-3 py-1.5 text-xs text-accent font-mono uppercase font-semibold"
                    >
                      {scale}
                    </span>
                  ))
                ) : showAwaitingText ? (
                  <span className="text-xs text-white/20 font-mono py-1">Aguardando análise de acorde para sugerir escalas...</span>
                ) : (
                  /* Vazio durante o intervalo de 15s */
                  <span className="text-xs text-white/5 font-mono py-1">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
