import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChordAnalysis } from '../types';
import { Music, Layers, Compass, Maximize2, Minimize2, Upload, Trash2, Image, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';

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
  accentColor: string;
  setAccentColor: (color: string) => void;
}

interface LoadedImageFile {
  id: string;
  name: string;
  data: string;
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
  accentColor,
  setAccentColor,
}: ChordDetailsProps) {

  const [displayedAnalysis, setDisplayedAnalysis] = useState<ChordAnalysis | null>(propAnalysis);
  const [showAwaitingText, setShowAwaitingText] = useState(true);
  const transitionDelay = 40; // Atraso fixo fora da UI para transição de notas em ms

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [fsFontScale, setFsFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_fs_font_scale');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [imageList, setImageList] = useState<LoadedImageFile[]>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_image_list');
      if (saved) {
        return JSON.parse(saved);
      }
      // Migrate old single file if present
      const oldSingle = localStorage.getItem('midi_analyzer_cifra_img');
      if (oldSingle) {
        const list = [{ id: '1', name: 'Cifra Importada 1.png', data: oldSingle }];
        localStorage.setItem('midi_analyzer_image_list', JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.error("Erro ao carregar lista de imagens:", e);
    }
    return [];
  });

  const [currentImageIndex, setCurrentImageIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_image_idx');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [imageRotations, setImageRotations] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_image_rotations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_image_rotations', JSON.stringify(imageRotations));
    } catch (e) {
      console.warn("Could not save image rotations:", e);
    }
  }, [imageRotations]);

  const chordColor = accentColor;
  const bgOpacity = 0;
  const fsLayout = 'overlay';

  const [chordOpacity, setChordOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('midi_analyzer_chord_opacity');
      return saved ? parseFloat(saved) : 0.85;
    } catch {
      return 0.85;
    }
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseMove = (e?: Event) => {
    if (e && e.type === 'mousemove') {
      const mouseEvent = e as MouseEvent;
      const currentX = mouseEvent.clientX;
      const currentY = mouseEvent.clientY;
      
      if (lastMousePosRef.current) {
        const dx = Math.abs(currentX - lastMousePosRef.current.x);
        const dy = Math.abs(currentY - lastMousePosRef.current.y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Exige um movimento real de pelo menos 25 pixels para reexibir os controles
        if (distance < 25) {
          return;
        }
      }
      lastMousePosRef.current = { x: currentX, y: currentY };
    }
    
    setControlsVisible(true);
    if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
    mouseTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 10000); // Ocultar controles após 10s de inatividade
  };

  useEffect(() => {
    if (isFullscreen) {
      lastMousePosRef.current = null; // Reseta a posição ao entrar em tela cheia
      handleMouseMove();
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('keydown', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('keydown', handleMouseMove);
        if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      };
    } else {
      setControlsVisible(true);
    }
  }, [isFullscreen]);

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_image_list', JSON.stringify(imageList));
    } catch (e) {
      console.warn("Could not save imageList to localStorage:", e);
    }
  }, [imageList]);

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_image_idx', currentImageIndex.toString());
    } catch (e) {
      console.error(e);
    }
  }, [currentImageIndex]);

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_chord_opacity', chordOpacity.toString());
    } catch (e) {
      console.error(e);
    }
  }, [chordOpacity]);

  useEffect(() => {
    try {
      localStorage.setItem('midi_analyzer_fs_font_scale', String(fsFontScale));
    } catch (e) {
      console.error(e);
    }
  }, [fsFontScale]);

  const activeImage = imageList[currentImageIndex] || imageList[0] || null;
  const loadedImage = activeImage?.data || null;
  const currentRotation = activeImage ? (imageRotations[activeImage.id] || 0) : 0;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const allowedExtensions = ['.pdf', '.png', '.webp', '.bmp', '.jpg', '.jpeg'];
      const filteredFiles = (Array.from(files) as File[]).filter(file => {
        const name = file.name.toLowerCase();
        return allowedExtensions.some(ext => name.endsWith(ext));
      });

      if (filteredFiles.length === 0) {
        return;
      }

      const newImages: LoadedImageFile[] = [];
      let loadedCount = 0;
      
      for (let i = 0; i < filteredFiles.length; i++) {
        const file = filteredFiles[i];
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          newImages.push({
            id: Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
            name: file.name,
            data: base64
          });
          loadedCount++;
          
          if (loadedCount === filteredFiles.length) {
            setImageList(() => {
              const updated = [...newImages];
              // Sort alphabetically by file name using natural sort order (e.g. 2 comes before 10)
              updated.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
              
              // Começa exibindo o primeiro arquivo da lista ordenada alfabeticamente
              setCurrentImageIndex(0);
              return updated;
            });
            e.target.value = '';
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveImage = () => {
    if (imageList.length === 0) return;
    setImageList(prev => {
      const updated = prev.filter((_, idx) => idx !== currentImageIndex);
      const nextIdx = Math.max(0, Math.min(updated.length - 1, currentImageIndex));
      setCurrentImageIndex(nextIdx);
      return updated;
    });
  };

  const nextImage = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentImageIndex(prev => (prev + 1) % imageList.length);
  }, [imageList.length]);

  const prevImage = useCallback(() => {
    if (imageList.length <= 1) return;
    setCurrentImageIndex(prev => (prev - 1 + imageList.length) % imageList.length);
  }, [imageList.length]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evita disparar atalhos se o usuário estiver digitando em campos de entrada/seleção
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }

      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        }
        return;
      }

      if (imageList.length === 0) return;

      if (e.key === 'ArrowRight') {
        if (e.ctrlKey || e.metaKey) {
          // Gira para a direita (sentido horário: +90 graus)
          e.preventDefault();
          const activeImg = imageList[currentImageIndex];
          if (activeImg) {
            setImageRotations(prev => {
              const currentRot = prev[activeImg.id] || 0;
              return {
                ...prev,
                [activeImg.id]: (currentRot + 90) % 360
              };
            });
          }
        } else {
          // Próxima imagem
          e.preventDefault();
          nextImage();
        }
      } else if (e.key === 'ArrowLeft') {
        if (e.ctrlKey || e.metaKey) {
          // Gira para a esquerda (sentido anti-horário: -90 graus, ou seja, +270 graus mod 360)
          e.preventDefault();
          const activeImg = imageList[currentImageIndex];
          if (activeImg) {
            setImageRotations(prev => {
              const currentRot = prev[activeImg.id] || 0;
              return {
                ...prev,
                [activeImg.id]: (currentRot - 90 + 360) % 360
              };
            });
          }
        } else {
          // Imagem anterior
          e.preventDefault();
          prevImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, imageList, currentImageIndex, nextImage, prevImage]);

  return (
    <div translate="no" className="notranslate w-full flex flex-col space-y-3">
      {/* PAINEL 1: NOME DO ACORDE (Destaque Principal - Altura Confortável) */}
      <div className="bg-[#0D0D0D] border border-white/10 p-5 flex flex-col justify-between relative overflow-hidden h-[290px] max-h-[290px] select-none">
        {/* Massive watermark background chord name */}
        {analysis && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none">
            <span className="text-[130px] font-black uppercase tracking-tighter text-accent truncate max-w-full">
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

            {/* Controles de Cifra */}
            <div className="flex items-center space-x-1.5 h-7">
              {/* 1. Carregador de Cifra (Arquivos) - Primeiro à esquerda */}
              <div className="flex items-center h-7 bg-white/5 border border-white/10 p-0.5 text-[9px] font-mono">
                <label className="h-6 px-2.5 hover:text-accent text-white/40 flex items-center justify-center cursor-pointer gap-1 transition select-none" title="Carregar arquivo(s) de cifra / partitura">
                  <Upload className="w-3 h-3 text-accent" />
                  <span>ARQUIVOS</span>
                  <input 
                    type="file" 
                    accept=".pdf,image/png,image/jpeg,image/webp,image/bmp,image/gif,image/*" 
                    multiple 
                    onChange={handleImageUpload} 
                    className="hidden" 
                  />
                </label>
              </div>

              {/* 2. Botão de Modo Fácil (EASY) */}
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

              {/* 3. Botão de apenas acordes (SÓ ACORDES) */}
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

              {/* 4. Seletor de Notação de Cifra (# / b) */}
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

              {/* 5. Botão Tela Cheia (Fullscreen) */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="h-7 w-7 bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all cursor-pointer rounded-none flex items-center justify-center"
                title="Exibir em tela cheia (Atalho: ESC para sair)"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Container de texto com altura confortável */}
          <div className="mt-1 h-[110px] flex flex-col justify-center">
            {analysis ? (
              <div className="flex flex-col justify-center">
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold font-sans tracking-tight text-accent truncate">
                  {formatChordDisplay(analysis.chordName)}
                </h1>
                
                {/* Intervalos Empilhados abaixo do Acorde */}
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  {/* Tônica & Intervalos */}
                  {rootName && (
                    <div className="px-2.5 py-1 bg-accent/10 border border-accent/20 font-mono text-[11px] md:text-[12px] text-accent flex items-center gap-2 rounded-sm">
                      <span className="text-accent/60 uppercase tracking-wider text-[9px] font-bold">Tônica:</span>
                      <strong className="text-accent font-black text-sm">{rootName}</strong>
                      <div className="flex gap-1 ml-1">
                        {tonicIntervals.map((name, i) => (
                          <span
                            key={i}
                            className={`px-1.5 py-0.5 rounded-sm text-[10px] md:text-[11px] font-bold font-mono ${
                              name === 'T'
                                ? 'bg-accent/25 text-accent border border-accent/30'
                                : 'bg-white/10 text-white/95'
                            }`}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Baixo (se invertido) */}
                  {bassName && rootName && bassName !== rootName && (
                    <div className="px-2.5 py-1 bg-white/5 border border-white/10 font-mono text-[11px] md:text-[12px] text-white/70 flex items-center rounded-sm">
                      <span className="text-white/40 uppercase tracking-wider text-[9px] font-bold mr-1.5">Baixo:</span>
                      <strong className="text-white font-black text-sm">{bassName}</strong>
                    </div>
                  )}

                  {/* Alerta de 5ª Omitida */}
                  {showFifthOmitted && (
                    <div className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 font-mono text-[11px] md:text-[12px] font-bold text-emerald-400 uppercase tracking-wider flex items-center rounded-sm">
                      <span className="mr-1 text-[12px]">✔️</span> 5ª Omitida
                    </div>
                  )}
                </div>
              </div>
            ) : showAwaitingText ? (
              <div>
                <h1 className="text-3xl sm:text-4xl font-medium font-sans tracking-tight text-white/20 uppercase truncate">
                  Aguardando...
                </h1>
                <p className="text-[12px] text-white/30 tracking-[0.1em] mt-1.5 font-sans leading-relaxed">
                  Toque notas para identificar acordes.
                </p>
              </div>
            ) : (
              /* Vazio durante o intervalo de 15s */
              <div className="h-[52px]" />
            )}
          </div>
        </div>

        {/* Detalhes Técnicos Rápidos */}
        <div className="grid grid-cols-3 gap-2.5 border-t border-white/10 pt-3 relative z-10 w-full mt-auto">
          <div className="bg-white/5 p-2 flex flex-col justify-center items-center text-center rounded-sm">
            <span className="text-[10px] font-mono text-white/45 uppercase tracking-wider font-bold">Tônica</span>
            <span className="text-[15px] md:text-[16px] font-mono font-extrabold text-accent mt-0.5 truncate max-w-full">
              {analysis ? analysis.root : '—'}
            </span>
          </div>
          
          <div className="bg-white/5 p-2 flex flex-col justify-center items-center text-center rounded-sm">
            <span className="text-[10px] font-mono text-white/45 uppercase tracking-wider font-bold">Baixo</span>
            <span className="text-[15px] md:text-[16px] font-mono font-extrabold text-white/90 mt-0.5 truncate max-w-full">
              {analysis ? analysis.bass : '—'}
            </span>
          </div>

          <div className="bg-white/5 p-2 flex flex-col justify-center items-center text-center rounded-sm">
            <span className="text-[10px] font-mono text-white/45 uppercase tracking-wider font-bold">Notas</span>
            <span className="text-[13px] md:text-[14px] font-mono font-extrabold text-white mt-0.5 truncate max-w-full">
              {analysis ? analysis.notes.join(', ') : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* PAINEL 2: ESCALAS RECOMENDADAS (Na mesma linha horizontal) */}
      <div className="bg-[#0D0D0D] border border-white/10 p-4 flex flex-col justify-center min-h-[78px] max-h-[85px] overflow-hidden">
        <div>
          <h3 className="text-[9px] font-mono tracking-[0.2em] text-white/40 uppercase flex items-center mb-1.5">
            <Compass className="w-3.5 h-3.5 text-accent mr-2" />
            Escalas para Improviso
          </h3>

          <div className="flex flex-wrap gap-2 items-center">
            {analysis ? (
              analysis.scales.slice(0, 3).map((scale, idx) => (
                <div
                  key={`scale-${idx}`}
                  className="flex items-center space-x-1.5 bg-white/5 border border-white/5 px-2.5 py-1 hover:border-white/10 transition rounded-sm"
                >
                  <span className="text-[10px] font-medium text-white/80 uppercase tracking-wider font-mono">
                    {scale}
                  </span>
                  <span className="w-1.5 h-1.5 bg-accent" />
                </div>
              ))
            ) : showAwaitingText ? (
              /* Placeholder estável */
              <div className="text-white/20 font-mono text-[9px] uppercase tracking-wider select-none pointer-events-none py-1">
                Toque notas para analisar escalas
              </div>
            ) : (
              /* Vazio durante o intervalo de 15s */
              <div className="h-4" />
            )}
          </div>
        </div>
      </div>

      {/* OVERLAY TELA CHEIA (FULLSCREEN) - Otimizado para Tablets & Stands de Partitura */}
      {isFullscreen && (
        <div 
          style={{ cursor: controlsVisible ? 'default' : 'none' }}
          className="fixed inset-0 bg-[#070707] z-[9999] select-none text-white overflow-hidden flex flex-col transition-all duration-300"
        >
          {/* Top Header Controls - Occupies space when visible, collapses completely when hidden */}
          <div 
            className={`transition-all duration-300 ease-in-out bg-[#070707] z-50 flex-none border-b border-white/5 ${
              controlsVisible 
                ? 'opacity-100 max-h-[250px] p-4 sm:p-5' 
                : 'opacity-0 max-h-0 p-0 border-none pointer-events-none overflow-hidden'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2.5 w-full">
              {/* 1. Botão de Carregar (Arquivos) - Primeiro à esquerda */}
              <div className="flex items-center h-9 bg-white/5 border border-white/10 p-0.5 text-[11px] font-mono">
                <label className="h-7 px-3.5 hover:text-accent text-white/40 flex items-center justify-center cursor-pointer gap-1.5 transition select-none" title="Carregar arquivo(s) de cifra / partitura">
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  <span>ARQUIVOS</span>
                  <input 
                    type="file" 
                    accept=".pdf,image/png,image/jpeg,image/webp,image/bmp,image/gif,image/*" 
                    multiple 
                    onChange={handleImageUpload} 
                    className="hidden" 
                  />
                </label>
              </div>

              {/* Caixa Box Seletora (Entre arquivos e cor) */}
              {imageList.length > 0 && (
                <div className="flex items-center h-9 bg-white/5 border border-white/10 p-0.5 text-[11px] font-mono gap-1">
                  <button
                    onClick={prevImage}
                    className="h-7 w-7 hover:text-white text-white/40 transition cursor-pointer flex items-center justify-center border border-transparent hover:border-white/5"
                    title="Cifra Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <select
                    value={currentImageIndex}
                    onChange={(e) => setCurrentImageIndex(parseInt(e.target.value, 10))}
                    className="bg-transparent text-accent text-xs font-mono font-bold border-none focus:outline-none focus:ring-0 max-w-[200px] truncate cursor-pointer py-1"
                  >
                    {imageList.map((img, idx) => (
                      <option key={img.id} value={idx} className="bg-[#0D0D0D] text-white">
                        {img.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={nextImage}
                    className="h-7 w-7 hover:text-white text-white/40 transition cursor-pointer flex items-center justify-center border border-transparent hover:border-white/5"
                    title="Próxima Cifra"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 2. Cor de Destaque Personalizada em Tela Cheia */}
              <div className="flex items-center h-9 bg-white/5 border border-white/10 px-3.5 text-xs font-mono">
                <span className="text-[10px] text-white/40 uppercase tracking-wider mr-2">Cor:</span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-5 h-5 bg-transparent border border-white/10 cursor-pointer p-0 rounded"
                  title="Cor personalizada"
                />
                <span className="text-[10px] text-accent font-bold tracking-wider ml-1.5 select-none uppercase">
                  {accentColor}
                </span>
              </div>

              {/* 3. Slider Opacidade do Acorde */}
              <div className="flex items-center h-9 bg-white/5 border border-white/10 px-3.5 text-xs font-mono">
                <span className="text-[10px] text-white/40 uppercase tracking-wider mr-2">Opac. Acorde:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={chordOpacity}
                  onChange={(e) => setChordOpacity(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <span className="text-[10px] text-accent font-bold min-w-[28px] text-right ml-1">
                  {Math.round(chordOpacity * 100)}%
                </span>
              </div>

              {/* 4. Seletor de Tamanho da Fonte */}
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
                  onClick={() => setFsFontScale(prev => Math.min(6.0, Number((prev + 0.1).toFixed(2))))}
                  className="h-7 px-2.5 text-white/40 hover:text-white transition cursor-pointer font-bold select-none flex items-center justify-center"
                  title="Aumentar Fonte"
                >
                  A+
                </button>
              </div>

              {/* 5. EASY button */}
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

              {/* 6. SÓ ACORDES button */}
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

              {/* 7. Notation selector */}
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

              {/* Spacer para empurrar o Sair e Help para a direita em telas grandes */}
              <div className="flex-1 min-w-[10px] hidden xl:block" />

              {/* 8. Botão de Ajuda (Help) - Entre as opções e o Sair */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="h-9 w-9 bg-white/5 hover:bg-white/10 text-white/60 hover:text-accent border border-white/10 flex items-center justify-center cursor-pointer transition rounded-none"
                title="Como navegar por pastas de músicas"
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>

              {/* 9. Botão de Fechar */}
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

          {/* Floating Next/Previous arrow overlays for multi-image navigation */}
          {imageList.length > 1 && (
            <>
              <button
                onClick={prevImage}
                style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
                className={`fixed left-6 top-1/2 -translate-y-1/2 z-50 p-3.5 rounded-full bg-black/60 hover:bg-black/95 text-white border border-white/10 hover:border-accent hover:text-accent shadow-2xl transition-all duration-300 cursor-pointer ${
                  controlsVisible ? 'opacity-100 scale-100 font-bold' : 'opacity-0 scale-90 pointer-events-none'
                }`}
                title="Cifra Anterior"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                onClick={nextImage}
                style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
                className={`fixed right-6 top-1/2 -translate-y-1/2 z-50 p-3.5 rounded-full bg-black/60 hover:bg-black/95 text-white border border-white/10 hover:border-accent hover:text-accent shadow-2xl transition-all duration-300 cursor-pointer ${
                  controlsVisible ? 'opacity-100 scale-100 font-bold' : 'opacity-0 scale-90 pointer-events-none'
                }`}
                title="Próxima Cifra"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          {/* Central Area: Occupies 100% of the remaining height */}
          <div className="flex-1 min-h-0 w-full relative z-0">
            {loadedImage ? (
              <div className="w-full h-full flex flex-col justify-center items-center bg-[#070707] overflow-hidden">
                <div className="w-full h-full overflow-auto flex items-center justify-center p-0 custom-scrollbar">
                  {loadedImage.startsWith('data:application/pdf') ? (
                    <iframe
                      src={loadedImage}
                      className="w-full h-full border-none pointer-events-auto"
                      title="Cifra PDF"
                      style={{
                        transform: `rotate(${currentRotation}deg)`,
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    />
                  ) : (
                    <img
                      src={loadedImage}
                      alt="Cifra Carregada"
                      className="max-w-full max-h-full object-contain pointer-events-none select-none"
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `rotate(${currentRotation}deg)`,
                        transition: 'transform 0.2s ease-in-out'
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-[#070707]" />
            )}
          </div>

          {/* Giant Floating Chord overlay - centered, pointer-events-none */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none transition-all">
            {analysis ? (
              <h2 
                style={{ 
                  color: accentColor, 
                  opacity: chordOpacity,
                  fontSize: `calc(${getChordBaseFontSize()} * ${fsFontScale} * 1.5)` 
                }}
                className="font-normal font-sans tracking-tight leading-none text-center transition-all duration-150 select-none pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {formatChordDisplay(analysis.chordName)}
              </h2>
            ) : showAwaitingText ? (
              <h2 
                style={{ 
                  color: '#666666', 
                  opacity: chordOpacity,
                }}
                className="text-xl sm:text-2xl font-normal font-sans tracking-[0.2em] text-center uppercase animate-pulse select-none pointer-events-none"
              >
                AGUARDANDO NOTAS MIDI
              </h2>
            ) : null}
          </div>

          {/* CAIXA SUSPENSA DE AJUDA */}
          {showHelpModal && (
            <div className="absolute top-20 right-6 z-50 w-[360px] sm:w-[420px] bg-[#0D0D0D]/95 backdrop-blur-md border border-white/15 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.9)] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Botão X para fechar no canto superior */}
              <button 
                onClick={() => setShowHelpModal(false)}
                className="absolute top-3 right-3 text-white/40 hover:text-white transition cursor-pointer font-mono text-sm"
                title="Fechar"
              >
                ✕
              </button>

              <div className="flex items-center space-x-2 text-accent mb-3.5">
                <HelpCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold tracking-tight font-mono uppercase">Como navegar pelas imagens</h3>
              </div>
              
              <div className="text-xs text-white/95 space-y-3.5 leading-relaxed">
                <div>
                  <p className="font-bold text-accent uppercase tracking-wider text-[9px] mb-1 font-mono">1. Como selecionar os arquivos:</p>
                  <p>
                    Clique no botão <strong className="text-accent font-mono">ARQUIVOS</strong> para abrir a janela do sistema. Você pode selecionar uma ou várias imagens/PDFs de uma vez. Para carregar todas as imagens de um diretório, entre na pasta correspondente e pressione <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl+A</kbd> (ou <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">Cmd+A</kbd> no Mac) para selecionar tudo.
                  </p>
                </div>

                <div>
                  <p className="font-bold text-accent uppercase tracking-wider text-[9px] mb-1 font-mono">2. Listagem e Ordenação:</p>
                  <p>
                    Ao carregar novos arquivos, o aplicativo limpa completamente a lista de imagens anterior e exibe as novas imagens na caixa seletora, ordenadas automaticamente de forma alfabética natural (ex: <em>Imagem 2</em> vem antes de <em>Imagem 10</em>).
                  </p>
                </div>

                <div>
                  <p className="font-bold text-accent uppercase tracking-wider text-[9px] mb-1 font-mono">3. COMO NAVEGAR ENTRE AS IMAGENS SELECIONADAS (NEXT/PREV):</p>
                  <p>
                    Você pode trocar de imagem de três formas rápidas:
                  </p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Usando a <strong>caixa seletora</strong> (dropdown) na barra superior.</li>
                    <li>Clicando nas setas <span className="text-accent">◀</span> e <span className="text-accent">▶</span> logo ao lado da caixa seletora.</li>
                    <li>Utilizando as grandes <strong>setas flutuantes nas laterais</strong> da tela em modo de leitura.</li>
                  </ul>
                </div>

                <div>
                  <p className="font-bold text-accent uppercase tracking-wider text-[9px] mb-1 font-mono">4. Atalhos de Teclado & Rotação Salva:</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    <li>Pressione as setas <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">◀</kbd> ou <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">▶</kbd> do teclado para mudar de imagem instantaneamente.</li>
                    <li>Segure <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">Ctrl</kbd> + as setas <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">◀</kbd> / <kbd className="bg-white/10 px-1 py-0.5 rounded font-mono text-[10px]">▶</kbd> para rotacionar a imagem atual em 90°.</li>
                    <li><strong className="text-accent">Rotação Salva:</strong> O ângulo de cada imagem é salvo automaticamente de forma persistente! Mesmo mudando de imagem ou atualizando a página, a rotação é mantida.</li>
                  </ul>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 pt-3 border-t border-white/5">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="bg-accent hover:bg-accent-hover text-black px-3.5 py-1.5 text-[10px] font-mono font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
