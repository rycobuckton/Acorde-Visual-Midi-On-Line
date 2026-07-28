import React, { useState, useEffect } from 'react';
import { ChannelState } from '../lib/synth-engine';
import { Knob } from './Knob';
import { Zap, Copy, Scissors, Clipboard, Music, Layers, Check, Trash2, Clock } from 'lucide-react';

export interface EchoPreset {
  id: string;
  name: string;
  time: number;       // 0.05 to 1.5s
  feedback: number;   // Count of repetitions: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16
  mix: number;        // 0.0 to 1.0
  highCut: number;    // 500 to 18000 Hz
}

export const factoryEchoTemplates: EchoPreset[] = [
  { id: 'factory_echo_solo_short', name: '⚡ Eco Solo Curto (220ms / 3x Repet)', time: 0.22, feedback: 3, mix: 0.35, highCut: 8000 },
  { id: 'factory_echo_solo_long', name: '🌊 Eco Solo Expansivo (450ms / 5x Repet)', time: 0.45, feedback: 5, mix: 0.40, highCut: 5000 },
  { id: 'factory_echo_slapback', name: '🎸 Slapback Delay (110ms / 1x Repet)', time: 0.11, feedback: 1, mix: 0.30, highCut: 12000 },
  { id: 'factory_echo_dub', name: '📻 Eco Dub Vintage (380ms / 8x Repet / Escuro)', time: 0.38, feedback: 8, mix: 0.45, highCut: 3200 },
  { id: 'factory_echo_ambient', name: '🌌 Delay Ambiental Suave (600ms / 6x Repet)', time: 0.60, feedback: 6, mix: 0.35, highCut: 6000 },
];

const LOCAL_STORAGE_ECHO_PRESETS_KEY = 'modx_echo_presets';

// Musical tempo divisions for 120 BPM reference (or manual delay time)
const MUSICAL_TEMPOS = [
  { label: '1/16', time: 0.075, name: 'Semicocheia' },
  { label: '1/8t', time: 0.10, name: 'Triolet 1/8' },
  { label: '1/8', time: 0.15, name: 'Colcheia' },
  { label: '1/8d', time: 0.225, name: 'Colcheia Ponto' },
  { label: '1/4', time: 0.30, name: 'Semínima (Padrão)' },
  { label: '1/4d', time: 0.45, name: 'Semínima Ponto' },
  { label: '1/2', time: 0.60, name: 'Mínima' },
  { label: '1/1', time: 1.20, name: 'Semibreve' },
];

interface EchoTabProps {
  channels: ChannelState[];
  onChannelsChange: (channels: ChannelState[]) => void;
  activeParamFocus: [number, string] | null;
  setActiveParamFocus: (val: [number, string] | null) => void;
  channelAccents: string[];
  channelSolidBg: string[];
  updateChannelValue: (chIdx: number, param: string, value: any) => void;
  showNotification: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  handleCopyChannel?: (chIdx: number) => void;
  handleCutChannel?: (chIdx: number) => void;
  handlePasteChannel?: (chIdx: number) => void;
  copiedChannelConfig?: ChannelState | null;
  handleOpenMidiContextMenu?: (e: React.MouseEvent, paramKey: string, paramLabel: string) => void;
}

export const EchoTab: React.FC<EchoTabProps> = ({
  channels,
  onChannelsChange,
  activeParamFocus,
  setActiveParamFocus,
  updateChannelValue,
  showNotification,
  handleCopyChannel,
  handleCutChannel,
  handlePasteChannel,
  copiedChannelConfig,
  handleOpenMidiContextMenu
}) => {
  const selectedIdx = activeParamFocus?.[0] ?? 0;
  const state = channels[selectedIdx] || channels[0];

  const [echoPresets, setEchoPresets] = useState<EchoPreset[]>([]);
  const [selectedEchoPresetId, setSelectedEchoPresetId] = useState<string>('');
  const [newEchoPresetName, setNewEchoPresetName] = useState<string>('');

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_ECHO_PRESETS_KEY);
      if (raw) {
        setEchoPresets(JSON.parse(raw));
      }
    } catch (err) {
      console.error('Erro ao carregar presets de Eco:', err);
    }
  }, []);

  const saveEchoPresetsToStorage = (presetsList: EchoPreset[]) => {
    setEchoPresets(presetsList);
    try {
      localStorage.setItem(LOCAL_STORAGE_ECHO_PRESETS_KEY, JSON.stringify(presetsList));
    } catch (err) {
      console.error('Erro ao salvar presets de Eco:', err);
    }
  };

  const handleLoadEchoPreset = (presetId: string, chIdx: number) => {
    setSelectedEchoPresetId(presetId);
    if (!presetId) return;

    const allPresets = [...factoryEchoTemplates, ...echoPresets];
    const target = allPresets.find(p => p.id === presetId);
    if (!target) return;

    const nextCh = [...channels];
    nextCh[chIdx] = {
      ...nextCh[chIdx],
      delayBypass: false,
      delayTime: target.time,
      delayFeedback: target.feedback,
      delayMix: target.mix,
      delayHighCut: target.highCut
    };
    onChannelsChange(nextCh);
    showNotification(`Preset de Eco "${target.name}" aplicado ao Layer 0${chIdx + 1}!`, 'success');
  };

  const handleSaveEchoPreset = (name: string, chIdx: number) => {
    if (!name.trim()) return;
    const currentCh = channels[chIdx];
    const newPreset: EchoPreset = {
      id: `user_echo_${Date.now()}`,
      name: name.trim(),
      time: currentCh.delayTime ?? 0.3,
      feedback: currentCh.delayFeedback ?? 3,
      mix: currentCh.delayMix ?? 0.35,
      highCut: currentCh.delayHighCut ?? 6000
    };

    const updated = [newPreset, ...echoPresets];
    saveEchoPresetsToStorage(updated);
    setSelectedEchoPresetId(newPreset.id);
    setNewEchoPresetName('');
    showNotification(`Preset de Eco "${newPreset.name}" gravado com sucesso!`, 'success');
  };

  const handleDeleteEchoPreset = (presetId: string) => {
    const target = echoPresets.find(p => p.id === presetId);
    if (!target) return;
    const filtered = echoPresets.filter(p => p.id !== presetId);
    saveEchoPresetsToStorage(filtered);
    if (selectedEchoPresetId === presetId) setSelectedEchoPresetId('');
    showNotification(`Preset de Eco "${target.name}" removido!`, 'info');
  };

  // Current Values for selected layer
  const dBypass = state.delayBypass ?? true; // Default bypassed
  const dTime = state.delayTime ?? 0.3;      // Default 300ms
  
  // Feedback stored as integer repeat count (0, 1, 2, 3, 4, 5, 6, 8, 10, 12)
  // Or converted if old float (e.g. 0.40 -> 3 repeats)
  const rawFeedback = state.delayFeedback ?? 3;
  const dRepeats = rawFeedback <= 1.0 && !Number.isInteger(rawFeedback)
    ? (rawFeedback === 0 ? 0 : Math.max(1, Math.round(rawFeedback * 8)))
    : Math.max(0, Math.round(rawFeedback));

  const dMix = state.delayMix ?? 0.35;        // 35% mix
  const dHighCut = state.delayHighCut ?? 6000; // 6kHz high cut

  // Find matching or closest musical tempo division for display
  const currentMusicalTempo = MUSICAL_TEMPOS.reduce((prev, curr) => {
    return Math.abs(curr.time - dTime) < Math.abs(prev.time - dTime) ? curr : prev;
  });

  // Layer themes with high contrast colors
  const layerThemes = [
    { 
      name: 'Layer 01', 
      text: 'text-amber-400', 
      border: 'border-amber-500/50', 
      bg: 'bg-amber-500', 
      active: 'bg-amber-500/20 text-amber-200 border-amber-500/80', 
      knob: '#f59e0b',
      accentText: 'text-amber-300',
      btnActive: 'bg-amber-400 text-black border-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)] scale-105',
      barGradient: 'bg-gradient-to-t from-amber-600 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      btnSubmit: 'bg-amber-500 hover:bg-amber-400 text-black border-amber-300',
      borderFocus: 'focus:border-amber-400'
    },
    { 
      name: 'Layer 02', 
      text: 'text-sky-400', 
      border: 'border-sky-500/50', 
      bg: 'bg-sky-500', 
      active: 'bg-sky-500/20 text-sky-200 border-sky-500/80', 
      knob: '#0ea5e9',
      accentText: 'text-sky-300',
      btnActive: 'bg-sky-400 text-black border-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.5)] scale-105',
      barGradient: 'bg-gradient-to-t from-sky-600 to-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.5)]',
      btnSubmit: 'bg-sky-500 hover:bg-sky-400 text-black border-sky-300',
      borderFocus: 'focus:border-sky-400'
    },
    { 
      name: 'Layer 03', 
      text: 'text-emerald-400', 
      border: 'border-emerald-500/50', 
      bg: 'bg-emerald-500', 
      active: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/80', 
      knob: '#10b981',
      accentText: 'text-emerald-300',
      btnActive: 'bg-emerald-400 text-black border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)] scale-105',
      barGradient: 'bg-gradient-to-t from-emerald-600 to-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      btnSubmit: 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-300',
      borderFocus: 'focus:border-emerald-400'
    },
    { 
      name: 'Layer 04', 
      text: 'text-rose-400', 
      border: 'border-rose-500/50', 
      bg: 'bg-rose-500', 
      active: 'bg-rose-500/20 text-rose-200 border-rose-500/80', 
      knob: '#f43f5e',
      accentText: 'text-rose-300',
      btnActive: 'bg-rose-400 text-black border-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.5)] scale-105',
      barGradient: 'bg-gradient-to-t from-rose-600 to-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
      btnSubmit: 'bg-rose-500 hover:bg-rose-400 text-black border-rose-300',
      borderFocus: 'focus:border-rose-400'
    }
  ];
  const channelSolidBg = ['bg-amber-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500'];
  const activeLayerStyles = [
    'bg-[#231e18] border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-400/30',
    'bg-[#172330] border-sky-400 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)] ring-1 ring-sky-400/30',
    'bg-[#152820] border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/30',
    'bg-[#28171d] border-rose-400 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)] ring-1 ring-rose-400/30'
  ];
  const activeLabelStyles = [
    'text-amber-300 font-extrabold',
    'text-sky-300 font-extrabold',
    'text-emerald-300 font-extrabold',
    'text-rose-300 font-extrabold'
  ];
  const inactiveStyles = 'bg-[#1e232a] border-zinc-700 text-zinc-200 hover:border-zinc-500 hover:bg-[#282f38] hover:text-white transition-all';
  const currentTheme = layerThemes[selectedIdx] || layerThemes[0];

  return (
    <div className="flex flex-col h-full justify-between gap-3 select-none text-zinc-100">
      {/* Main Container: Layer Tabs on Left + Controls Panel on Right */}
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 flex-1 items-start">
        {/* Layer Selector Panel */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((idx) => {
            const isFocused = selectedIdx === idx;
            const chState = channels[idx];

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveParamFocus([idx, 'delay'])}
                className={`p-2.5 rounded-lg text-left font-mono border transition-all duration-200 flex flex-col gap-1 select-none cursor-pointer ${
                  isFocused ? activeLayerStyles[idx] : inactiveStyles
                }`}
              >
                <span className={`text-[10px] font-mono tracking-wider uppercase ${
                  isFocused ? activeLabelStyles[idx] : 'text-zinc-300 font-bold'
                }`}>
                  LAYER 0{idx + 1}
                </span>
                <span className={`text-xs font-mono font-black leading-none ${
                  isFocused ? 'text-white' : 'text-zinc-200'
                }`}>
                  VOL: {chState?.mute ? 'MUTADO' : `${Math.round((chState?.volume ?? 0) * 100)}%`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Layer Echo Main Workspace */}
        <div className="flex flex-col gap-2 bg-[#0a0c0f] border border-zinc-800 p-2.5 rounded-xl flex-1 shadow-2xl">
          {/* Layer Control Bar & Bypass Switch */}
          <div className="flex items-center justify-between border-b border-zinc-850 pb-1.5">
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-mono font-black px-2 py-0.5 rounded text-black shrink-0 ${channelSolidBg[selectedIdx]}`}>
                CONTROLES DE ECO — LAYER 0{selectedIdx + 1}
              </span>
              <div className="flex gap-1 items-center ml-2">
                {handleCopyChannel && (
                  <button
                    type="button"
                    onClick={() => handleCopyChannel(selectedIdx)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all uppercase font-bold flex items-center gap-1"
                    title="Copiar configurações do Layer"
                  >
                    <Copy className="w-3 h-3 text-zinc-400" />
                    Copiar
                  </button>
                )}
                {handleCutChannel && (
                  <button
                    type="button"
                    onClick={() => handleCutChannel(selectedIdx)}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-amber-400 hover:text-amber-300 hover:bg-zinc-800 cursor-pointer transition-all uppercase font-bold flex items-center gap-1"
                    title="Recortar Layer"
                  >
                    <Scissors className="w-3 h-3 text-amber-400" />
                    Recortar
                  </button>
                )}
                {handlePasteChannel && (
                  <button
                    type="button"
                    onClick={() => handlePasteChannel(selectedIdx)}
                    disabled={!copiedChannelConfig}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-700 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all uppercase font-bold flex items-center gap-1"
                    title="Colar configurações salvas"
                  >
                    <Clipboard className="w-3 h-3 text-emerald-400" />
                    Colar
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateChannelValue(selectedIdx, 'delayBypass', !dBypass)}
              onContextMenu={(e) => handleOpenMidiContextMenu?.(e, `layer${selectedIdx}_delayBypass`, `Layer 0${selectedIdx + 1} Eco Bypass`)}
              className={`px-3 py-1 rounded-md text-[10px] font-mono font-black border cursor-pointer transition shadow-md flex items-center gap-1.5 ${
                dBypass
                  ? 'bg-red-950/60 border-red-600 text-red-300 hover:bg-red-900 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                  : 'bg-emerald-950/60 border-emerald-500 text-emerald-200 hover:bg-emerald-900 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dBypass ? 'bg-red-500' : 'bg-emerald-400 animate-pulse'}`} />
              ECO: {dBypass ? 'BYPASS (DESATIVADO)' : 'ATIVO (LIGADO)'}
            </button>
          </div>

          {/* Preset Selection & Saving Row */}
          <div className="flex flex-col md:flex-row gap-2 bg-[#12151c] p-2 rounded-lg border border-zinc-800 items-center justify-between">
            <div className="flex items-center gap-1.5 flex-1 w-full">
              <span className={`text-[12px] font-mono font-black ${currentTheme.accentText} uppercase shrink-0`}>
                PRESET DE ECO:
              </span>
              <select
                value={selectedEchoPresetId}
                onChange={(e) => handleLoadEchoPreset(e.target.value, selectedIdx)}
                className={`bg-black border border-zinc-700 text-[10px] ${currentTheme.accentText} rounded px-2 py-1 font-mono focus:outline-none ${currentTheme.borderFocus} w-full cursor-pointer font-bold`}
              >
                <option value="">-- Escolher Preset de Eco Prontos --</option>
                <optgroup label="Presets de Fábrica">
                  {factoryEchoTemplates.map((p, idx) => (
                    <option key={`echo_fac_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                  ))}
                </optgroup>
                {echoPresets.length > 0 && (
                  <optgroup label="Seus Presets Salvos">
                    {echoPresets.map((p, idx) => (
                      <option key={`echo_usr_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedEchoPresetId && echoPresets.some(p => p.id === selectedEchoPresetId) && (
                <button
                  type="button"
                  onClick={() => handleDeleteEchoPreset(selectedEchoPresetId)}
                  className="px-2 py-1 rounded bg-zinc-900 hover:bg-red-900 border border-zinc-700 text-red-300 hover:text-white transition cursor-pointer text-[12px] font-mono uppercase font-black shrink-0"
                  title="Apagar Preset"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEchoPreset(newEchoPresetName, selectedIdx);
              }}
              className="flex gap-1.5 items-center w-full md:w-auto"
            >
              <input
                type="text"
                value={newEchoPresetName}
                onChange={(e) => setNewEchoPresetName(e.target.value)}
                placeholder="Nomear novo preset..."
                className={`bg-black border border-zinc-700 text-[10px] rounded px-2 py-1 text-zinc-200 focus:outline-none ${currentTheme.borderFocus} font-mono w-full md:w-40 font-medium`}
              />
              <button
                type="submit"
                disabled={!newEchoPresetName.trim()}
                className={`text-[12px] font-mono font-black px-2.5 py-1 rounded ${currentTheme.btnSubmit} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase shrink-0 shadow-md`}
              >
                Gravar
              </button>
            </form>
          </div>

          {/* Quick Musical Tempo Bar */}
          <div className="flex flex-col gap-1 bg-[#0e1014] p-2 rounded-lg border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className={`text-[12px] font-mono font-black ${currentTheme.accentText} uppercase flex items-center gap-1.5`}>
                <Music className={`w-3 h-3 ${currentTheme.text}`} />
                TEMPO MUSICAL RÁPIDO (DIVISÃO DE RITMO):
              </span>
              <span className={`text-[12px] font-mono font-bold ${currentTheme.accentText}`}>
                Aproximado: {currentMusicalTempo.label} ({currentMusicalTempo.name})
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {MUSICAL_TEMPOS.map((t, idx) => {
                const isSelected = Math.abs(dTime - t.time) < 0.02;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => updateChannelValue(selectedIdx, 'delayTime', t.time)}
                    className={`px-2 py-0.5 rounded text-[12px] font-mono font-black transition cursor-pointer border flex-1 text-center ${
                      isSelected
                        ? currentTheme.btnActive
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                    title={`${t.name} (${Math.round(t.time * 1000)}ms)`}
                  >
                    {t.label} ({Math.round(t.time * 1000)}ms)
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Contrast Interactive Visual Echo Pulse Graph */}
          <div className="bg-[#050608] border border-zinc-800 rounded-lg p-2 flex flex-col gap-1 relative overflow-hidden shadow-2xl">
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-1">
              <span className={`text-[12px] font-mono font-black ${currentTheme.accentText} uppercase tracking-wider flex items-center gap-1.5`}>
                <Clock className={`w-3 h-3 ${currentTheme.text}`} />
                DESENHO DOS PULSOS DE ECO (VITALIDADE & REPETIÇÕES)
              </span>
              <span className="text-[12px] font-mono font-bold text-zinc-300">
                DRY: <span className={`${currentTheme.accentText} font-bold`}>100%</span> | MIX WET: <span className={`${currentTheme.text} font-bold`}>{Math.round(dMix * 100)}%</span> | REPETIÇÕES: <span className={`font-bold ${dRepeats === 0 ? 'text-rose-400' : currentTheme.accentText}`}>{dRepeats === 0 ? '0 (MUTO)' : `${dRepeats}x`}</span>
              </span>
            </div>

            {/* Visualizer bars container */}
            <div className="flex items-end justify-between gap-1.5 w-full h-[58px] pt-1 px-1">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((tapIdx) => {
                const isFirst = tapIdx === 0;
                const isWithinRepeats = tapIdx <= dRepeats && dRepeats > 0;

                // Calculate decay percentage
                let heightPct = 0;
                if (isFirst) {
                  heightPct = 100; // DRY signal always 100%
                } else if (isWithinRepeats && !dBypass) {
                  // Decay smoothly based on tap index
                  const decayFactor = Math.pow(0.72, tapIdx - 1);
                  heightPct = Math.max(15, Math.min(95, decayFactor * dMix * 100));
                } else {
                  heightPct = 10; // Muted / cutoff bar
                }

                return (
                  <div key={tapIdx} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                    <div className="w-full h-[40px] bg-zinc-900/60 rounded-t flex items-end p-0.5 border-x border-t border-zinc-800">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          isFirst
                            ? 'bg-gradient-to-t from-zinc-600 to-zinc-300 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                            : isWithinRepeats && !dBypass
                            ? currentTheme.barGradient
                            : 'bg-zinc-800/40 border-t border-zinc-700/40'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className={`text-[11.5px] font-mono font-bold truncate ${
                      isFirst 
                        ? 'text-zinc-300' 
                        : isWithinRepeats && !dBypass 
                        ? currentTheme.accentText 
                        : 'text-zinc-300'
                    }`}>
                      {isFirst ? 'DRY' : isWithinRepeats && !dBypass ? `#${tapIdx}` : 'OFF'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Controls Knobs & Quick Repeat Selectors Row */}
          <div className="bg-[#0e1014] rounded-lg border border-zinc-800 p-2.5 flex flex-col gap-2">
            {/* Quick Repetition Count Selector Buttons */}
            <div className="flex flex-col gap-1">
              <span className={`text-[12px] font-mono font-black ${currentTheme.accentText} uppercase flex items-center justify-between`}>
                <span>NÚMERO DE REPETIÇÕES DO ECO (EXATO):</span>
                <span className="text-zinc-400 font-bold">
                  {dRepeats === 0 ? '0 (Eco Desativado / Muto)' : dRepeats === 1 ? '1 Repetição (Eco Único / Slapback)' : `${dRepeats} Repetições em Sequência`}
                </span>
              </span>
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((repCount) => {
                  const isSelected = dRepeats === repCount;
                  return (
                    <button
                      key={repCount}
                      type="button"
                      onClick={() => updateChannelValue(selectedIdx, 'delayFeedback', repCount)}
                      className={`px-2 py-0.5 rounded text-[11.5px] font-mono font-black transition cursor-pointer border flex-1 text-center ${
                        isSelected
                          ? currentTheme.btnActive
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      {repCount === 0 ? '0 (Muto)' : `${repCount}x`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Knobs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center justify-around pt-1 border-t border-zinc-850">
              <Knob
                label="TEMPO (ATRASO)"
                min={0.05}
                max={1.5}
                value={dTime}
                step={0.01}
                defaultValue={0.3}
                onChange={(val) => updateChannelValue(selectedIdx, 'delayTime', parseFloat(val.toFixed(2)))}
                onContextMenu={(e) => handleOpenMidiContextMenu?.(e, `layer${selectedIdx}_delayTime`, `Layer 0${selectedIdx + 1} Eco Tempo`)}
                unit="s"
                color={currentTheme.knob}
                size="md"
              />

              <Knob
                label="REPETIÇÕES (QTD)"
                min={0}
                max={16}
                value={dRepeats}
                step={1}
                defaultValue={3}
                onChange={(val) => updateChannelValue(selectedIdx, 'delayFeedback', Math.round(val))}
                onContextMenu={(e) => handleOpenMidiContextMenu?.(e, `layer${selectedIdx}_delayFeedback`, `Layer 0${selectedIdx + 1} Eco Repetições`)}
                unit="x"
                color={currentTheme.knob}
                size="md"
              />

              <Knob
                label="NÍVEL MIX (WET)"
                min={0.0}
                max={1.0}
                value={dMix}
                step={0.02}
                defaultValue={0.35}
                onChange={(val) => updateChannelValue(selectedIdx, 'delayMix', parseFloat(val.toFixed(2)))}
                onContextMenu={(e) => handleOpenMidiContextMenu?.(e, `layer${selectedIdx}_delayMix`, `Layer 0${selectedIdx + 1} Eco Nível Mix`)}
                unit="%"
                color={currentTheme.knob}
                size="md"
              />

              <Knob
                label="AMORTECIMENTO"
                min={500}
                max={18000}
                value={dHighCut}
                step={250}
                defaultValue={6000}
                onChange={(val) => updateChannelValue(selectedIdx, 'delayHighCut', Math.round(val))}
                onContextMenu={(e) => handleOpenMidiContextMenu?.(e, `layer${selectedIdx}_delayHighCut`, `Layer 0${selectedIdx + 1} Eco Amortecimento`)}
                unit="Hz"
                color={currentTheme.knob}
                size="md"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
