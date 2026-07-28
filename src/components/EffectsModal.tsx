import React, { useState, useEffect } from 'react';
import { ChannelState, ADSR } from '../lib/synth-engine';
import { X, Sliders, Music, Sparkles, Activity, Save, Trash2, Download } from 'lucide-react';

interface EffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelState[];
  onChannelsChange: (newChannels: ChannelState[]) => void;
  reverbDecay: number;
  reverbMix: number;
  onReverbChange: (decay: number, mix: number) => void;
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  defaultChannelIndex?: number;
}

interface FXPreset {
  id: string;
  name: string;
  channelsData: {
    filterType: 'lowpass' | 'highpass' | 'bandpass';
    filterCutoff: number;
    filterResonance: number;
    eqLow: number;
    eqMid: number;
    eqHigh: number;
    adsr: ADSR;
    reverbSend: number;
  }[];
  reverbDecay: number;
  reverbMix: number;
}

const LOCAL_STORAGE_FX_KEY = 'sf2_synth_fx_presets_v2';

export const EffectsModal: React.FC<EffectsModalProps> = ({
  isOpen,
  onClose,
  channels,
  onChannelsChange,
  reverbDecay,
  reverbMix,
  onReverbChange,
  masterVolume,
  onMasterVolumeChange,
  defaultChannelIndex = 0,
}) => {
  const [activeChannel, setActiveChannel] = useState<number>(defaultChannelIndex);
  const [attackMax1s, setAttackMax1s] = useState<boolean>(false);
  const [fxPresets, setFxPresets] = useState<FXPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  // Built-in Factory Templates for FX & Filters
  const factoryTemplates: FXPreset[] = [
    {
      id: 'template_piano_natural',
      name: '🎹 Piano Clássico (Natural)',
      reverbDecay: 2.0,
      reverbMix: 0.18,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'lowpass',
        filterCutoff: 18000,
        filterResonance: 1.0,
        eqLow: 1.0,
        eqMid: -0.5,
        eqHigh: 1.0,
        adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 },
        reverbSend: 0.20,
      })),
    },
    {
      id: 'template_ambient_cathedral',
      name: '🌌 Catedral Espacial (Ethereal)',
      reverbDecay: 5.5,
      reverbMix: 0.50,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'lowpass',
        filterCutoff: 12000,
        filterResonance: 1.5,
        eqLow: 2.0,
        eqMid: 1.0,
        eqHigh: 3.0,
        adsr: { attack: 0.8, decay: 1.2, sustain: 85, release: 2.2 },
        reverbSend: 0.65,
      })),
    },
    {
      id: 'template_pluck_synth',
      name: '⚡ Dedilhado Pluck (Rápido)',
      reverbDecay: 1.4,
      reverbMix: 0.12,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'lowpass',
        filterCutoff: 3000,
        filterResonance: 4.5,
        eqLow: -2.0,
        eqMid: 0.5,
        eqHigh: 2.0,
        adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.18 },
        reverbSend: 0.15,
      })),
    },
    {
      id: 'template_slow_pad',
      name: '🌫️ Slow Pad Soft (Orquestral)',
      reverbDecay: 3.8,
      reverbMix: 0.35,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'lowpass',
        filterCutoff: 8000,
        filterResonance: 1.0,
        eqLow: 3.0,
        eqMid: -1.0,
        eqHigh: 0.0,
        adsr: { attack: 1.5, decay: 1.5, sustain: 90, release: 1.8 },
        reverbSend: 0.40,
      })),
    },
    {
      id: 'template_sharp_organ',
      name: '🎛️ Órgão de Tubos Clássico',
      reverbDecay: 2.6,
      reverbMix: 0.25,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'highpass',
        filterCutoff: 120,
        filterResonance: 1.0,
        eqLow: 0.0,
        eqMid: 2.0,
        eqHigh: 1.5,
        adsr: { attack: 0.01, decay: 0.1, sustain: 100, release: 0.1 },
        reverbSend: 0.30,
      })),
    },
  ];

  // Load custom FX presets
  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_FX_KEY);
    if (raw) {
      try {
        setFxPresets(JSON.parse(raw));
      } catch (e) {
        console.error('Error loading FX presets', e);
      }
    }
  }, []);

  if (!isOpen) return null;

  const currentChannelState = channels[activeChannel];

  const updateParam = <K extends keyof ChannelState>(key: K, value: ChannelState[K]) => {
    const next = [...channels];
    next[activeChannel] = {
      ...next[activeChannel],
      [key]: value,
    };
    onChannelsChange(next);
  };

  const updateAdsr = (key: keyof ADSR, value: number) => {
    const next = [...channels];
    next[activeChannel] = {
      ...next[activeChannel],
      adsr: {
        ...next[activeChannel].adsr,
        [key]: value,
      },
    };
    onChannelsChange(next);
  };

  // ADSR Graph coordinates calculation
  const getAdsrPath = () => {
    if (!currentChannelState) return '';
    const { attack, decay, sustain, release } = currentChannelState.adsr;

    // SVG width: 320, height: 120
    const w = 320;
    const h = 120;
    const padding = 10;

    const graphW = w - padding * 2;
    const graphH = h - padding * 2;

    // Normalizing factors
    const maxTime = 12.0; // max sum of A + D + R
    const adsrTotal = attack + decay + 3.0 + release; // fixed width of 3s for sustain phase
    
    const attackX = padding + (attack / maxTime) * graphW;
    const decayX = attackX + (decay / maxTime) * graphW;
    const sustainX = decayX + (3.0 / maxTime) * graphW;
    const releaseX = Math.min(w - padding, sustainX + (release / maxTime) * graphW);

    const sustainY = padding + graphH - (sustain / 100) * graphH;

    return `M ${padding} ${padding + graphH} L ${attackX} ${padding} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${padding + graphH}`;
  };

  // FX Preset Saving
  const handleSaveFXPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const channelsData = channels.map(ch => ({
      filterType: ch.filterType,
      filterCutoff: ch.filterCutoff,
      filterResonance: ch.filterResonance,
      eqLow: ch.eqLow,
      eqMid: ch.eqMid,
      eqHigh: ch.eqHigh,
      adsr: { ...ch.adsr },
      reverbSend: ch.reverbSend,
    }));

    const newPreset: FXPreset = {
      id: 'fx_' + Math.random().toString(36).substr(2, 9),
      name: newPresetName.trim(),
      channelsData,
      reverbDecay,
      reverbMix,
    };

    const next = [...fxPresets, newPreset];
    setFxPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FX_KEY, JSON.stringify(next));
    setNewPresetName('');
    setSelectedPresetId(newPreset.id);
  };

  const handleLoadFXPreset = (id: string) => {
    const preset = [...factoryTemplates, ...fxPresets].find(p => p.id === id);
    if (!preset) return;

    const nextChannels = channels.map((ch, idx) => {
      const pData = preset.channelsData[idx] || preset.channelsData[0]; // fallback to first if mismatched
      return {
        ...ch,
        filterType: pData.filterType,
        filterCutoff: pData.filterCutoff,
        filterResonance: pData.filterResonance,
        eqLow: pData.eqLow,
        eqMid: pData.eqMid,
        eqHigh: pData.eqHigh,
        adsr: { ...pData.adsr },
        reverbSend: pData.reverbSend,
      };
    });

    onChannelsChange(nextChannels);
    onReverbChange(preset.reverbDecay, preset.reverbMix);
    setSelectedPresetId(id);
  };

  const handleDeleteFXPreset = (id: string) => {
    const next = fxPresets.filter(p => p.id !== id);
    setFxPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FX_KEY, JSON.stringify(next));
    if (selectedPresetId === id) setSelectedPresetId('');
  };

  const activeChannelAccents = [
    'border-amber-500/50 text-amber-400 bg-amber-500/5',
    'border-sky-500/50 text-sky-400 bg-sky-500/5',
    'border-emerald-500/50 text-emerald-400 bg-emerald-500/5',
    'border-rose-500/50 text-rose-400 bg-rose-500/5',
  ];

  const activeGlows = [
    'text-amber-400 border-amber-500 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    'text-sky-400 border-sky-500 bg-sky-500/10 shadow-[0_0_10px_rgba(14,165,233,0.15)]',
    'text-emerald-400 border-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]',
    'text-rose-400 border-rose-500 bg-rose-500/10 shadow-[0_0_10px_rgba(244,63,94,0.15)]',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg max-w-4xl w-full shadow-[0_0_60px_rgba(16,185,129,0.2)] relative z-10 overflow-hidden flex flex-col h-[90vh] max-h-[780px] text-zinc-100">
        
        {/* Glowing top line */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-rose-500" />

        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded border border-emerald-500/20">
              <Sliders className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-mono font-black tracking-tight text-white uppercase">
                Painel Avançado: Filtros & Processamento de Efeitos
              </h2>
              <p className="text-[10px] md:text-xs text-zinc-300 font-mono uppercase tracking-wider">
                Ajustes cirúrgicos de equalização, filtros biquad de ressonância e envelopes ADSR
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded-full transition cursor-pointer"
            title="Fechar Painel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal FX Presets Header Row */}
        <div className="px-5 py-3.5 bg-black/60 border-b border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Quick preset selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider shrink-0">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" /> Presets de Efeitos:
            </span>
            <select
              value={selectedPresetId}
              onChange={(e) => handleLoadFXPreset(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            >
              <option value="">-- Carregar Preset de Efeito --</option>
              <optgroup label="Modelos de Fábrica">
                {factoryTemplates.map((p, idx) => (
                  <option key={`fx_fac_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              {fxPresets.length > 0 && (
                <optgroup label="Meus Presets Gravados">
                  {fxPresets.map((p, idx) => (
                    <option key={`fx_usr_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            
            {selectedPresetId && fxPresets.some(p => p.id === selectedPresetId) && (
              <button
                onClick={() => handleDeleteFXPreset(selectedPresetId)}
                className="p-1.5 rounded bg-zinc-800 hover:bg-red-950 border border-zinc-700 hover:border-red-900 text-red-400 hover:text-white transition cursor-pointer"
                title="Excluir preset customizado"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick save current effects */}
          <form onSubmit={handleSaveFXPreset} className="flex gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Nomear novo preset de efeitos..."
              className="flex-1 bg-zinc-900 border border-zinc-700 text-xs rounded px-2.5 py-1.5 text-zinc-350 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={!newPresetName.trim()}
              className="text-xs font-mono font-black px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black border-b-2 border-b-emerald-900 disabled:opacity-40 disabled:hover:bg-emerald-500 disabled:cursor-not-allowed transition flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> GRAVAR FX
            </button>
          </form>
        </div>

        {/* Modal Main Content (Scrollable Area) */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-4 gap-5">
          
          {/* Left Navigation: Channel Selector */}
          <div className="flex flex-col gap-2 lg:col-span-1">
            <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase tracking-wider mb-1 block">
              Selecione o Canal
            </span>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
              {[0, 1, 2, 3].map((idx) => {
                const colors = [
                  'hover:border-amber-500/40 hover:text-amber-400',
                  'hover:border-sky-500/40 hover:text-sky-400',
                  'hover:border-emerald-500/40 hover:text-emerald-400',
                  'hover:border-rose-500/40 hover:text-rose-400',
                ];
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveChannel(idx)}
                    className={`p-3 rounded-lg border text-left font-mono text-xs font-bold transition flex flex-col gap-0.5 relative overflow-hidden cursor-pointer ${
                      activeChannel === idx
                        ? activeGlows[idx]
                        : `bg-black/40 border-zinc-750 text-zinc-400 ${colors[idx]}`
                    }`}
                  >
                    <span className="text-[10px] text-zinc-300 font-black">CANAL 0{idx + 1}</span>
                    <span className="truncate text-white">
                      {channels[idx].mute ? '[MUTADO]' : `VOL: ${Math.round(channels[idx].volume * 100)}%`}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => setActiveChannel(4)} // idx 4 represents Master FX
                className={`p-3 rounded-lg border text-left font-mono text-xs font-bold transition flex flex-col gap-0.5 relative overflow-hidden cursor-pointer ${
                  activeChannel === 4
                    ? 'text-emerald-400 border-emerald-500 bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                    : 'bg-black/40 border-zinc-750 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400'
                }`}
              >
                <span className="text-[10px] text-zinc-300 font-black">GLOBAL</span>
                <span className="truncate text-white">REVERB & MASTER GERAL</span>
              </button>
            </div>

            <div className="bg-black/50 p-3 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase tracking-wider leading-relaxed mt-2 hidden lg:flex flex-col gap-1.5">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 animate-pulse" /> Informação:
              </span>
              <span>Os efeitos são sincronizados em tempo real com as vozes tocando.</span>
              <span>Edite cada canal de forma independente para criar camadas sonoras magníficas.</span>
            </div>
          </div>

          {/* Right Area: Parameters Editor */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {activeChannel < 4 ? (
              // Individual Channel Effects Form
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                
                {/* 1. ADSR Envelope Column */}
                <div className="flex flex-col gap-3.5 bg-black p-4 rounded-lg border border-zinc-800 shadow-inner">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wider">
                      Envelope de Amplitude (ADSR)
                    </span>
                    <span className="text-[11px] font-mono text-zinc-300 uppercase">Ajuste de Dinâmica</span>
                  </div>

                  {/* ADSR Interactive Curve Graph */}
                  <div className="bg-zinc-950 rounded border border-zinc-850 p-1 flex justify-center items-center relative overflow-hidden">
                    <svg width="100%" height="120" viewBox="0 0 320 120" className="opacity-90">
                      {/* Grid background */}
                      <line x1="0" y1="10" x2="320" y2="10" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2" />
                      <line x1="0" y1="40" x2="320" y2="40" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2" />
                      <line x1="0" y1="80" x2="320" y2="80" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="2" />
                      
                      {/* Glow path */}
                      <path 
                        d={getAdsrPath()} 
                        fill="none" 
                        stroke="rgba(16,185,129,0.2)" 
                        strokeWidth="8" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                      {/* Main path */}
                      <path 
                        d={getAdsrPath()} 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="2.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                    <div className="absolute bottom-2 left-2 text-[11px] font-mono text-zinc-300 uppercase">
                      curva de amplitude
                    </div>
                  </div>

                  {/* ADSR Sliders Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    {/* Attack */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                          Attack (A)
                          <button
                            type="button"
                            onClick={() => setAttackMax1s(!attackMax1s)}
                            className={`px-1 py-0.2 text-[11px] rounded font-mono font-bold border transition cursor-pointer ${
                              attackMax1s
                                ? 'bg-emerald-500/25 border-emerald-500/60 text-emerald-300 shadow-[0_0_6px_rgba(16,185,129,0.3)]'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                            title="Alterna o limite máximo do Attack para 1 segundo (Alta Precisão)"
                          >
                            {attackMax1s ? 'Range 0-1s' : 'Range 0-3s'}
                          </button>
                        </span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.adsr.attack}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max={attackMax1s ? "1" : "3"}
                        step={attackMax1s ? "0.001" : "0.005"}
                        value={currentChannelState.adsr.attack}
                        onChange={(e) => updateAdsr('attack', parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[11px] text-zinc-300 font-mono">Tempo até volume máx ({attackMax1s ? '0 a 1s' : '0 a 3s'})</span>
                    </div>

                    {/* Decay */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-400 font-medium">Decay (D)</span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.adsr.decay}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.005"
                        max="4"
                        step="0.05"
                        value={currentChannelState.adsr.decay}
                        onChange={(e) => updateAdsr('decay', parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[11px] text-zinc-300 font-mono">Tempo até sustentação</span>
                    </div>

                    {/* Sustain */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-400 font-medium">Sustain (S)</span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.adsr.sustain}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={currentChannelState.adsr.sustain}
                        onChange={(e) => updateAdsr('sustain', parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[11px] text-zinc-300 font-mono">Volume de repouso</span>
                    </div>

                    {/* Release */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-zinc-400 font-medium">Release (R)</span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.adsr.release}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="2"
                        step="0.05"
                        value={currentChannelState.adsr.release}
                        onChange={(e) => updateAdsr('release', parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-[11px] text-zinc-300 font-mono">Tempo de desvanecimento</span>
                    </div>
                  </div>
                </div>

                {/* 2. Filters & EQ Column */}
                <div className="flex flex-col gap-4">
                  
                  {/* Resonant Filter Box */}
                  <div className="bg-black p-4 rounded-lg border border-zinc-800 shadow-inner flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wider">
                        Filtro Ressonante (Biquad)
                      </span>
                      
                      {/* Filter Type Toggle */}
                      <div className="flex gap-1 bg-zinc-900 p-0.5 rounded border border-zinc-700">
                        {(['lowpass', 'highpass', 'bandpass'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateParam('filterType', type)}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded transition uppercase font-black cursor-pointer ${
                              currentChannelState.filterType === type
                                ? 'bg-emerald-500 text-black'
                                : 'text-zinc-300 hover:text-zinc-300'
                            }`}
                          >
                            {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cutoff frequency */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-zinc-400">Frequência de Corte (Cutoff)</span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.filterCutoff} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="20000"
                        step="10"
                        value={currentChannelState.filterCutoff}
                        onChange={(e) => updateParam('filterCutoff', parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    {/* Resonance Q */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-zinc-400">Ressonância (Q-Factor)</span>
                        <span className="text-emerald-400 font-bold">{currentChannelState.filterResonance.toFixed(1)} Q</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="15"
                        step="0.1"
                        value={currentChannelState.filterResonance}
                        onChange={(e) => updateParam('filterResonance', parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Equalizer & Reverb Send Box */}
                  <div className="bg-black p-4 rounded-lg border border-zinc-800 shadow-inner flex flex-col gap-3.5">
                    <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-wider block">
                      Equalizador Paramétrico de 3 Bandas
                    </span>
                    
                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Low */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[12px] font-mono">
                          <span className="text-zinc-300 font-bold">GRAVES</span>
                          <span className={`font-bold ${currentChannelState.eqLow > 0 ? 'text-emerald-400' : currentChannelState.eqLow < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                            {currentChannelState.eqLow > 0 ? `+${currentChannelState.eqLow}` : currentChannelState.eqLow}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={currentChannelState.eqLow}
                          onChange={(e) => updateParam('eqLow', parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* Mid */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[12px] font-mono">
                          <span className="text-zinc-300 font-bold">MÉDIOS</span>
                          <span className={`font-bold ${currentChannelState.eqMid > 0 ? 'text-emerald-400' : currentChannelState.eqMid < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                            {currentChannelState.eqMid > 0 ? `+${currentChannelState.eqMid}` : currentChannelState.eqMid}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={currentChannelState.eqMid}
                          onChange={(e) => updateParam('eqMid', parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>

                      {/* High */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[12px] font-mono">
                          <span className="text-zinc-300 font-bold">AGUDOS</span>
                          <span className={`font-bold ${currentChannelState.eqHigh > 0 ? 'text-emerald-400' : currentChannelState.eqHigh < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                            {currentChannelState.eqHigh > 0 ? `+${currentChannelState.eqHigh}` : currentChannelState.eqHigh}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="0.5"
                          value={currentChannelState.eqHigh}
                          onChange={(e) => updateParam('eqHigh', parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Reverb Send Level */}
                    <div className="border-t border-zinc-800/80 pt-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-zinc-400 uppercase tracking-wider text-[12px]">Envio para Reverb de Convolução</span>
                        <span className="text-emerald-400 font-bold bg-emerald-950/45 px-1.5 py-0.5 rounded border border-emerald-900/40">
                          {Math.round(currentChannelState.reverbSend * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={currentChannelState.reverbSend}
                        onChange={(e) => updateParam('reverbSend', parseFloat(e.target.value))}
                        className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              // Global / Master Reverb & Volume Settings Form
              <div className="flex flex-col gap-5 bg-black p-5 rounded-lg border border-zinc-800 shadow-inner h-full justify-center">
                <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-800 pb-2">
                  <Activity className="w-4 h-4" /> Configurações Globais do Sintetizador
                </span>

                {/* Reverb Decay (Decaimento da cauda) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono text-zinc-300">
                    <span className="uppercase tracking-wider text-[10px] text-zinc-400 font-bold">
                      Reverb - Tempo de Sala (Room Decay)
                    </span>
                    <span className="font-bold text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded border border-emerald-900/40">
                      {reverbDecay.toFixed(1)} segundos
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="8.0"
                    step="0.1"
                    value={reverbDecay}
                    onChange={(e) => onReverbChange(parseFloat(e.target.value), reverbMix)}
                    className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500 mt-1"
                  />
                  <p className="text-[12px] text-zinc-300 font-mono uppercase mt-0.5">
                    Controla o tempo de caimento exponencial da sala virtual (impulso acústico)
                  </p>
                </div>

                {/* Reverb Mix (Wet/Dry) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono text-zinc-300">
                    <span className="uppercase tracking-wider text-[10px] text-zinc-400 font-bold">
                      Reverb - Nível Mix Geral (Dry/Wet)
                    </span>
                    <span className="font-bold text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded border border-emerald-900/40">
                      {Math.round(reverbMix * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={reverbMix}
                    onChange={(e) => onReverbChange(reverbDecay, parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500 mt-1"
                  />
                  <p className="text-[12px] text-zinc-300 font-mono uppercase mt-0.5">
                    Proporção de envio do áudio molhado (reverberado) em relação ao original
                  </p>
                </div>

                {/* Master Volume Slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono text-zinc-300">
                    <span className="uppercase tracking-wider text-[10px] text-zinc-400 font-bold">
                      Ganho Master Geral de Saída
                    </span>
                    <span className="font-bold text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded border border-emerald-900/40">
                      {Math.round(masterVolume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.2"
                    step="0.01"
                    value={masterVolume}
                    onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-850 rounded appearance-none cursor-pointer accent-emerald-500 mt-1"
                  />
                  <p className="text-[12px] text-zinc-300 font-mono uppercase mt-0.5">
                    Limitador de volume principal para evitar distorção (clipping digital)
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Modal Footer actions */}
        <div className="p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-950/40 shrink-0">
          <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider hidden sm:block">
            Sintetizador Soundfont de 4 Canais SF2
          </span>
          <button
            onClick={onClose}
            className="text-xs font-mono font-black py-2.5 px-8 rounded bg-emerald-500 hover:bg-emerald-400 border-b-2 border-b-emerald-900 text-black shadow-lg transition uppercase tracking-wider cursor-pointer ml-auto"
          >
            Fechar e Aplicar
          </button>
        </div>

      </div>
    </div>
  );
};
