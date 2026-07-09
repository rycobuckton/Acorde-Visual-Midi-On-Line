import React from 'react';
import { PolySynth } from '../utils/synth';
import { Volume2, VolumeX, Radio, Palette, Music, Cpu } from 'lucide-react';

interface SynthControlsProps {
  synth: PolySynth;
  synthVolume: number;
  setSynthVolume: (v: number) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  synthWaveform: OscillatorType;
  setSynthWaveform: (t: OscillatorType) => void;
  soundSource: 'synth' | 'soundfont';
  setSoundSource: (s: 'synth' | 'soundfont') => void;
  accentId: string;
  setAccentId: (id: string) => void;
  sfLibrary: 'FluidR3' | 'MusyngKite';
  setSfLibrary: (lib: 'FluidR3' | 'MusyngKite') => void;
}

const ACCENT_COLORS = [
  { id: 'cyan', name: 'Ciano', hex: '#00F0FF', bg: 'bg-[#00F0FF]', glow: 'shadow-[0_0_12px_rgba(0,240,255,0.7)]' },
  { id: 'green', name: 'Verde', hex: '#00FF66', bg: 'bg-[#00FF66]', glow: 'shadow-[0_0_12px_rgba(0,255,102,0.7)]' },
  { id: 'yellow', name: 'Ouro', hex: '#FACC15', bg: 'bg-[#FACC15]', glow: 'shadow-[0_0_12px_rgba(250,204,21,0.7)]' },
  { id: 'pink', name: 'Rosa', hex: '#FF007F', bg: 'bg-[#FF007F]', glow: 'shadow-[0_0_12px_rgba(255,0,127,0.7)]' },
  { id: 'orange', name: 'Laranja', hex: '#FF6600', bg: 'bg-[#FF6600]', glow: 'shadow-[0_0_12px_rgba(255,102,0,0.7)]' },
];

export default function SynthControls({
  synth,
  synthVolume,
  setSynthVolume,
  isMuted,
  setIsMuted,
  synthWaveform,
  setSynthWaveform,
  soundSource,
  setSoundSource,
  accentId,
  setAccentId,
  sfLibrary,
  setSfLibrary,
}: SynthControlsProps) {
  const [sfState, setSfState] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>(() => synth.getSoundfontState());

  React.useEffect(() => {
    // Sincronizar o callback de mudança de estado do SoundFont
    synth.onStateChange = (state) => {
      setSfState(state);
    };
    // Forçar atualização do estado caso o synth já tenha mudado
    setSfState(synth.getSoundfontState());
    
    return () => {
      synth.onStateChange = undefined;
    };
  }, [synth, soundSource, sfLibrary]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setSynthVolume(vol);
    synth.setVolume(vol);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    synth.setMute(nextMute);
  };

  const handleWaveformChange = (type: OscillatorType) => {
    setSynthWaveform(type);
    synth.setWaveform(type);
  };

  return (
    <div className="w-full bg-[#0D0D0D] border border-white/10 p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-mono tracking-[0.2em] text-white/40 uppercase flex items-center">
          <Radio className="w-3.5 h-3.5 text-accent mr-2" />
          Gerador de Áudio & Opções do Sistema
        </h3>
        
        <button
          onClick={toggleMute}
          className={`p-1.5 border transition text-xs font-mono tracking-wider uppercase flex items-center space-x-1.5 cursor-pointer ${
            isMuted
              ? 'bg-red-950/20 text-red-400 border-red-900/30 hover:bg-red-950/40'
              : 'bg-white/5 text-accent border-white/10 hover:bg-white/10'
          }`}
          title={isMuted ? 'Ativar Som' : 'Desativar Som'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span className="text-[9px]">{isMuted ? 'MUDO' : 'ATIVO'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Fonte de Áudio (Sintetizador vs SoundFont/SF2) */}
        <div className="space-y-2 bg-white/5 border border-white/5 p-3 flex flex-col justify-center min-h-[90px]">
          <span className="text-[10px] font-mono text-white/40 block uppercase tracking-widest">Fonte de Timbre</span>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setSoundSource('synth')}
              disabled={isMuted}
              className={`py-1.5 text-[9px] font-mono font-bold uppercase border transition cursor-pointer flex items-center justify-center space-x-1 ${
                soundSource === 'synth' && !isMuted
                  ? 'bg-accent-dim text-accent border-accent-border'
                  : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 disabled:opacity-35'
              }`}
            >
              <Cpu className="w-3 h-3 mr-0.5" />
              <span>Synth</span>
            </button>
            <button
              onClick={() => setSoundSource('soundfont')}
              disabled={isMuted}
              className={`py-1.5 text-[9px] font-mono font-bold uppercase border transition cursor-pointer flex items-center justify-center space-x-1 ${
                soundSource === 'soundfont' && !isMuted
                  ? 'bg-accent-dim text-accent border-accent-border'
                  : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 disabled:opacity-35'
              }`}
            >
              <Music className="w-3 h-3 mr-0.5" />
              <span>Piano SF2</span>
            </button>
          </div>
          <div className="text-[9px] font-mono tracking-wide">
            {soundSource === 'synth' ? (
              <span className="text-white/30 uppercase">Ondas matemáticas puras</span>
            ) : (
              <span className="uppercase block mt-0.5">
                {sfState === 'loaded' && (
                  <span className="text-emerald-400">
                    ✓ SF2 Pronto ({sfLibrary === 'MusyngKite' ? 'Kite HD' : 'Fluid R3'})
                  </span>
                )}
                {sfState === 'loading' && <span className="text-amber-400 animate-pulse">⚡ Carregando SF2 (Aguarde...)</span>}
                {sfState === 'error' && <span className="text-red-400">✗ Falha ao carregar SF2</span>}
                {sfState === 'idle' && <span className="text-white/30">Iniciando SoundFont...</span>}
              </span>
            )}
          </div>
        </div>

        {/* 2. Controle de Volume */}
        <div className="space-y-2.5 bg-white/5 border border-white/5 p-3 flex flex-col justify-center min-h-[90px]">
          <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest">
            <span>Volume</span>
            <span className="font-bold text-white/80">
              {isMuted ? 'Mudo' : `${Math.round(synthVolume * 100)}%`}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={synthVolume}
            onChange={handleVolumeChange}
            disabled={isMuted}
            className="w-full h-1 bg-white/10 rounded-none appearance-none cursor-pointer accent-accent disabled:opacity-30"
          />
          <div className="text-[9px] font-mono text-white/20 uppercase tracking-wide">
            Limiter Ativo (Proteção Antiestalo)
          </div>
        </div>

        {/* 3. Ajuste do Timbre Selecionado (Habilitado apenas no Synth) OU Biblioteca do Soundfont */}
        <div className="bg-white/5 border border-white/5 p-3 flex flex-col justify-center min-h-[90px]">
          {soundSource === 'synth' ? (
            <div className="space-y-2">
              <span className={`text-[10px] font-mono block uppercase tracking-widest ${!isMuted ? 'text-white/40' : 'text-white/15'}`}>
                Onda do Oscilador (Synth)
              </span>
              <div className="grid grid-cols-4 gap-1">
                {(['sine', 'triangle', 'sawtooth', 'square'] as OscillatorType[]).map((type) => (
                  <button
                    key={`wave-${type}`}
                    onClick={() => handleWaveformChange(type)}
                    disabled={isMuted}
                    className={`py-1 text-[9px] font-mono font-bold uppercase border transition cursor-pointer ${
                      synthWaveform === type && !isMuted
                        ? 'bg-accent-dim text-accent border-accent-border'
                        : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 disabled:opacity-20'
                    }`}
                  >
                    {type === 'sine' ? 'Sen' : type === 'triangle' ? 'Tri' : type === 'sawtooth' ? 'Den' : 'Qua'}
                  </button>
                ))}
              </div>
              <div className="text-[9px] font-mono text-white/20 uppercase tracking-wide">
                Ajuste a forma de onda analógica
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className={`text-[10px] font-mono block uppercase tracking-widest ${!isMuted ? 'text-white/40' : 'text-white/15'}`}>
                Biblioteca SF2 (Amostras)
              </span>
              <div className="grid grid-cols-2 gap-1">
                {(['FluidR3', 'MusyngKite'] as const).map((lib) => (
                  <button
                    key={`lib-${lib}`}
                    onClick={() => setSfLibrary(lib)}
                    disabled={isMuted}
                    className={`py-1 text-[9px] font-mono font-bold uppercase border transition cursor-pointer ${
                      sfLibrary === lib && !isMuted
                        ? 'bg-accent-dim text-accent border-accent-border'
                        : 'bg-white/5 text-white/50 border-white/5 hover:bg-white/10 disabled:opacity-20'
                    }`}
                  >
                    {lib === 'FluidR3' ? 'Fluid (Padrão)' : 'Kite (Alta Def)'}
                  </button>
                ))}
              </div>
              <div className="text-[9px] font-mono text-white/20 uppercase tracking-wide">
                {sfLibrary === 'MusyngKite' ? 'HD Piano (Estúdio)' : 'Fluida e Leve'}
              </div>
            </div>
          )}
        </div>

        {/* 4. Seletor de Tema de Cores */}
        <div className="space-y-2.5 bg-white/5 border border-white/5 p-3 flex flex-col justify-center min-h-[90px]">
          <span className="text-[10px] font-mono text-white/40 block uppercase tracking-widest flex items-center">
            <Palette className="w-3 h-3 text-accent mr-1.5" />
            Tema (Cor)
          </span>

          <div className="flex items-center space-x-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.id}
                onClick={() => setAccentId(color.id)}
                className={`w-6 h-6 rounded-full cursor-pointer transition-all duration-300 border relative ${color.bg} ${
                  accentId === color.id
                    ? `${color.glow} border-white scale-110`
                    : 'border-transparent opacity-50 hover:opacity-100 hover:scale-105'
                }`}
                title={`Tema ${color.name}`}
              >
                {accentId === color.id && (
                  <span className="absolute inset-0 flex items-center justify-center text-black text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="text-[9px] font-mono text-white/20 uppercase tracking-wide">
            Cores de destaque na interface
          </div>
        </div>
      </div>
    </div>
  );
}
