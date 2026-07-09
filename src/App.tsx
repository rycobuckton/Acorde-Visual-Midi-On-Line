import React, { useState, useEffect, useMemo } from 'react';
import { ActiveNote } from './types';
import { analyzePlayedNotes } from './utils/chordDetector';
import { synth } from './utils/synth';
import GrandStaff from './components/GrandStaff';
import VirtualPiano from './components/VirtualPiano';
import MIDIConnection from './components/MIDIConnection';
import ChordDetails from './components/ChordDetails';
import SynthControls from './components/SynthControls';
import { Trash2, Award, Compass, Music, HelpCircle, X } from 'lucide-react';
import { Note } from '@tonaljs/tonal';

export default function App() {
  const [activeNotes, setActiveNotes] = useState<ActiveNote[]>([]);
  const [physicallyPressedMidis, setPhysicallyPressedMidis] = useState<Set<number>>(new Set());
  const [isSustainPressed, setIsSustainPressed] = useState<boolean>(false);
  const [baseOctave, setBaseOctave] = useState<number>(3); // oitava padrão inicia em C4-C6 (base octave 3)
  
  // Estados do Sintetizador e Áudio (carregados do localStorage para persistir entre recarregamentos)
  const [synthVolume, setSynthVolume] = useState<number>(() => {
    const saved = localStorage.getItem('midi_analyzer_volume');
    return saved !== null ? parseFloat(saved) : 0.25;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('midi_analyzer_muted') === 'true';
  });
  const [synthWaveform, setSynthWaveform] = useState<OscillatorType>(() => {
    return (localStorage.getItem('midi_analyzer_waveform') as OscillatorType) || 'triangle';
  });

  // Preferência de Notação (false = sustenidos #, true = bemóis b)
  const [useFlat, setUseFlat] = useState<boolean>(false);

  // Fonte de som: 'synth' (Sintetizador Analógico) ou 'soundfont' (Piano Acústico Real SF2)
  const [soundSource, setSoundSource] = useState<'synth' | 'soundfont'>(() => {
    return (localStorage.getItem('midi_analyzer_soundsource') as 'synth' | 'soundfont') || 'soundfont'; // 'soundfont' (SF2) como padrão
  });

  // Biblioteca SoundFont (FluidR3 ou MusyngKite) - MusyngKite é HD e padrão
  const [sfLibrary, setSfLibrary] = useState<'FluidR3' | 'MusyngKite'>(() => {
    return (localStorage.getItem('midi_analyzer_sf_library') as 'FluidR3' | 'MusyngKite') || 'MusyngKite';
  });

  // Modo Fácil (EASY): oculta inversões para tríades simples
  const [useEasyMode, setUseEasyMode] = useState<boolean>(() => {
    return localStorage.getItem('midi_analyzer_easy_mode') === 'true';
  });

  // Seletor de Tema de Cores (Ciano, Verde, Amarelo, Rosa, Laranja)
  const [accentId, setAccentId] = useState<string>(() => {
    return localStorage.getItem('midi_analyzer_accent') || 'cyan';
  });

  // Modal informativo sobre o projeto
  const [showIntroModal, setShowIntroModal] = useState<boolean>(false);

  // Sincronizar preferência de Modo Fácil no local storage
  useEffect(() => {
    localStorage.setItem('midi_analyzer_easy_mode', String(useEasyMode));
  }, [useEasyMode]);

  // Aplicar cores dinâmicas no tema por meio de CSS variables
  useEffect(() => {
    const ACCENT_COLORS = [
      { id: 'cyan', hex: '#00F0FF', dim: 'rgba(0, 240, 255, 0.15)', border: 'rgba(0, 240, 255, 0.5)' },
      { id: 'green', hex: '#00FF66', dim: 'rgba(0, 255, 102, 0.15)', border: 'rgba(0, 255, 102, 0.5)' },
      { id: 'yellow', hex: '#FACC15', dim: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.5)' },
      { id: 'pink', hex: '#FF007F', dim: 'rgba(255, 0, 127, 0.15)', border: 'rgba(255, 0, 127, 0.5)' },
      { id: 'orange', hex: '#FF6600', dim: 'rgba(255, 102, 0, 0.15)', border: 'rgba(255, 102, 0, 0.5)' },
    ];
    const accent = ACCENT_COLORS.find(a => a.id === accentId) || ACCENT_COLORS[0];
    document.documentElement.style.setProperty('--accent', accent.hex);
    document.documentElement.style.setProperty('--accent-dim', accent.dim);
    document.documentElement.style.setProperty('--accent-border', accent.border);
    localStorage.setItem('midi_analyzer_accent', accentId);
  }, [accentId]);

  // Sincronizar estados do synth com o singleton e o localStorage
  useEffect(() => {
    synth.setVolume(synthVolume);
    localStorage.setItem('midi_analyzer_volume', String(synthVolume));
  }, [synthVolume]);

  useEffect(() => {
    synth.setMute(isMuted);
    localStorage.setItem('midi_analyzer_muted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    synth.setWaveform(synthWaveform);
    localStorage.setItem('midi_analyzer_waveform', synthWaveform);
  }, [synthWaveform]);

  useEffect(() => {
    synth.setUseSoundfont(soundSource === 'soundfont');
    localStorage.setItem('midi_analyzer_soundsource', soundSource);
  }, [soundSource]);

  useEffect(() => {
    synth.setSoundfontLibrary(sfLibrary);
    localStorage.setItem('midi_analyzer_sf_library', sfLibrary);
  }, [sfLibrary]);

  // Inicializar configurações adicionais do synth
  useEffect(() => {
    // Mostrar modal informativo na primeira visita
    const visited = localStorage.getItem('midi_analyzer_visited');
    if (!visited) {
      setShowIntroModal(true);
      localStorage.setItem('midi_analyzer_visited', 'true');
    }
  }, []);

  // Criar um Set de números MIDI ativos para busca em tempo constante
  const activeMidis = useMemo(() => {
    return new Set(activeNotes.map(n => n.midi));
  }, [activeNotes]);

  // Handler para quando uma nota é pressionada (Midi ou Virtual)
  const handleNoteOn = (midi: number, velocity: number = 100) => {
    const noteName = Note.fromMidi(midi);
    if (!noteName) return;

    // Registrar que a nota está fisicamente pressionada
    setPhysicallyPressedMidis((prev) => {
      const next = new Set(prev);
      next.add(midi);
      return next;
    });

    // Evitar duplicidade caso o hardware envie duas mensagens seguidas
    setActiveNotes((prev) => {
      if (prev.some((n) => n.midi === midi)) return prev;
      
      const newNote: ActiveNote = {
        midi,
        name: noteName,
        pc: Note.pitchClass(noteName),
        octave: Note.octave(noteName) ?? 4,
        velocity,
      };
      return [...prev, newNote];
    });

    // Tocar nota no sintetizador
    synth.noteOn(midi, velocity);
  };

  // Handler para quando uma nota é solta (Midi ou Virtual)
  const handleNoteOff = (midi: number) => {
    // Registrar que a nota foi fisicamente liberada
    setPhysicallyPressedMidis((prev) => {
      const next = new Set(prev);
      next.delete(midi);
      return next;
    });

    // Se o pedal de sustain não estiver pressionado, removemos a nota das ativas
    setIsSustainPressed((isSustainActive) => {
      if (!isSustainActive) {
        setActiveNotes((prev) => prev.filter((n) => n.midi !== midi));
        // Parar nota no sintetizador
        synth.noteOff(midi);
      }
      return isSustainActive;
    });
  };

  // Handler para mudança no estado do pedal de sustain (Midi)
  const handleSustainChange = (pressed: boolean) => {
    setIsSustainPressed(pressed);

    if (!pressed) {
      // Quando o pedal é liberado, removemos todas as notas que não estão fisicamente pressionadas
      setPhysicallyPressedMidis((currentPhysical) => {
        setActiveNotes((prev) => {
          const toRemove = prev.filter((n) => !currentPhysical.has(n.midi));
          
          // Parar no sintetizador as notas que foram liberadas pelo pedal
          toRemove.forEach((n) => {
            synth.noteOff(n.midi);
          });

          // Manter apenas as notas que estão fisicamente pressionadas
          return prev.filter((n) => currentPhysical.has(n.midi));
        });
        return currentPhysical;
      });
    }
  };

  // Botão de Pânico: desliga todas as notas ativas (útil se o MIDI travar)
  const handlePanic = () => {
    setActiveNotes([]);
    setPhysicallyPressedMidis(new Set());
    setIsSustainPressed(false);
    synth.allNotesOff();
  };

  // Análise do acorde com base nas notas ativas, notação preferida e Modo Fácil
  const chordAnalysis = useMemo(() => {
    const midiNumbers = activeNotes.map(n => n.midi);
    return analyzePlayedNotes(midiNumbers, useFlat, useEasyMode);
  }, [activeNotes, useFlat, useEasyMode]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col antialiased">
      {/* Header Principal */}
      <header className="border-b border-white/10 bg-[#0D0D0D] sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-accent shadow-[0_0_12px_var(--accent)] flex items-center justify-center">
              <Music className="w-4 h-4 text-black font-extrabold" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-sm font-bold tracking-[0.25em] text-white uppercase font-mono">Analisador MIDI</h1>
                <span className="text-[9px] font-mono bg-accent-dim text-accent border border-accent-border px-2 py-0.5 font-bold uppercase tracking-widest">
                  Real-time
                </span>
              </div>
              <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider mt-0.5">Teclado Bluetooth & Partitura Dinâmica</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Botão de Pânico */}
            <button
              onClick={handlePanic}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer"
              title="Silenciar todas as notas pendentes (Panic)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pânico (Mute)</span>
            </button>

            {/* Info / Guia */}
            <button
              onClick={() => setShowIntroModal(true)}
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white transition cursor-pointer"
              title="Sobre o aplicativo"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Grid Principal Layout */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-6">
        <div className="flex flex-col space-y-6">
          
          {/* Fila Superior: Partitura (Esquerda) e Cifra (Direita) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PARTITURA GRÁFICA (8 Colunas) */}
            <div className="lg:col-span-7 xl:col-span-8">
              <section id="music-score-section">
                <GrandStaff activeNotes={activeNotes} analysis={chordAnalysis} useFlat={useFlat} />
              </section>
            </div>

            {/* ANALISADOR HARMÔNICO (4 Colunas) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <section id="chord-analysis-section">
                <ChordDetails
                  analysis={chordAnalysis}
                  useFlat={useFlat}
                  setUseFlat={setUseFlat}
                  useEasyMode={useEasyMode}
                  setUseEasyMode={setUseEasyMode}
                />
              </section>
            </div>
          </div>

          {/* Fila Inferior: Teclado Virtual (Largura Total) */}
          <section id="virtual-piano-section">
            <VirtualPiano
              activeMidis={activeMidis}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
              baseOctave={baseOctave}
              setBaseOctave={setBaseOctave}
              useFlat={useFlat}
            />
          </section>

          {/* SEÇÃO DE SINTETIZADOR */}
          <section id="synth-controls-section">
            <SynthControls
              synth={synth}
              synthVolume={synthVolume}
              setSynthVolume={setSynthVolume}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              synthWaveform={synthWaveform}
              setSynthWaveform={setSynthWaveform}
              soundSource={soundSource}
              setSoundSource={setSoundSource}
              accentId={accentId}
              setAccentId={setAccentId}
              sfLibrary={sfLibrary}
              setSfLibrary={setSfLibrary}
            />
          </section>

          {/* CONFIGURAÇÕES DE HARDWARE MIDI & GUIA BLUETOOTH */}
          <section id="midi-hardware-section">
            <MIDIConnection
              onMidiNoteOn={handleNoteOn}
              onMidiNoteOff={handleNoteOff}
              onMidiSustain={handleSustainChange}
            />
          </section>

        </div>
      </main>

      {/* Rodapé / Footer */}
      <footer className="border-t border-white/10 bg-[#0D0D0D] py-5 px-6 text-center mt-auto">
        <p className="text-[10px] text-white/30 font-mono uppercase tracking-[0.2em]">
          Analisador MIDI — Desenvolvido com React, Tailwind CSS & TonalJS
        </p>
      </footer>

      {/* MODAL INTRODUTÓRIO / TUTORIAL (Visita Inicial) */}
      {showIntroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0D0D0D] border border-white/10 max-w-lg w-full overflow-hidden">
            <div className="bg-[#111111] border-b border-white/10 p-6 text-center relative">
              <button
                onClick={() => setShowIntroModal(false)}
                className="absolute top-4 right-4 p-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 bg-accent shadow-[0_0_12px_var(--accent)] flex items-center justify-center mx-auto mb-3">
                <Music className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-[0.25em] font-mono">Bem-vindo ao Analisador MIDI</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1 font-mono">Seu companheiro de estudos harmônicos em tempo real</p>
            </div>

            <div className="p-6 space-y-5 text-xs text-white/70 leading-relaxed font-mono uppercase">
              <p className="font-sans normal-case text-white/80">
                Este aplicativo foi projetado para ajudá-lo a <b>visualizar, identificar e estudar acordes</b> tocados diretamente em seu teclado musical ou piano digital.
              </p>

              <div className="space-y-2.5">
                <h3 className="font-bold text-accent flex items-center tracking-wider text-[11px]">
                  <Award className="w-4 h-4 mr-2" />
                  Funcionalidades:
                </h3>
                <ul className="list-disc list-inside text-white/50 space-y-1.5 pl-1 font-sans normal-case text-xs">
                  <li><b>Partitura Dupla em Tempo Real</b>: Claves de Sol e Fá que desenham exatamente as notas tocadas com acidentes correspondentes.</li>
                  <li><b>Identificador Inteligente</b>: Detecção instantânea de acordes, suas inversões e fórmulas de intervalos.</li>
                  <li><b>Notação Customizada</b>: Alternância instantânea entre as visualizações em Sustenido (#) e Bemol (b).</li>
                  <li><b>Piano de Cauda SF2</b>: Timbre de altíssima qualidade de piano acústico real.</li>
                  <li><b>Suporte Bluetooth</b>: Guia de conexão detalhado para teclados MIDI sem fio.</li>
                </ul>
              </div>

              <div className="bg-[#111111] border border-white/5 p-4 flex items-start text-[11px] text-white/60">
                <Compass className="w-4 h-4 mr-3 shrink-0 text-accent" />
                <div>
                  <p className="font-bold text-accent tracking-wider">Como testar agora:</p>
                  <p className="mt-1 font-sans normal-case text-xs text-white/50 leading-relaxed">
                    Se você não possui um teclado MIDI físico conectado, use o <b>Teclado Virtual Interativo</b> na parte inferior da tela para tocar notas e experimentar os recursos agora mesmo!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIntroModal(false)}
                className="w-full py-3 bg-accent hover:bg-accent/85 text-black text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
              >
                Começar a Tocar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
