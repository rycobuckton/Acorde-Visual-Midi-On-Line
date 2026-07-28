import React from 'react';
import { Layers } from 'lucide-react';
import { ChannelState } from '../lib/synth-engine';
import { Knob } from './Knob';

interface FiltersTabProps {
  channels: ChannelState[];
  onChannelsChange: (newChannels: ChannelState[]) => void;
  activeParamFocus: [number, string] | null;
  setActiveParamFocus: (focus: [number, string] | null) => void;
  channelAccents: string[];
  channelSolidBg: string[];
  
  attackMax1s?: boolean;
  onToggleAttackMax1s?: (val?: boolean) => void;
  
  selectedFxPresetId: string;
  handleLoadFXPreset: (id: string) => void;
  fxPresets: any[];
  handleDeleteFXPreset: (id: string) => void;
  newFxPresetName: string;
  setNewFxPresetName: (name: string) => void;
  handleSaveFXPreset: (e: React.FormEvent) => void;

  selectedAdsrPresetId: string;
  handleLoadAdsrPreset: (id: string, channelIdx: number) => void;
  adsrPresets: any[];
  handleDeleteAdsrPreset: (id: string) => void;
  newAdsrPresetName: string;
  setNewAdsrPresetName: (name: string) => void;
  handleSaveAdsrPreset: (name: string, channelIdx: number) => void;

  selectedFilterPresetId: string;
  handleLoadFilterPreset: (id: string, channelIdx: number) => void;
  filterPresets: any[];
  handleDeleteFilterPreset: (id: string) => void;
  newFilterPresetName: string;
  setNewFilterPresetName: (name: string) => void;
  handleSaveFilterPreset: (name: string, channelIdx: number) => void;

  factoryTemplates: any[];
  factoryAdsrTemplates: any[];
  factoryFilterTemplates: any[];

  updateChannelValue: (idx: number, key: any, value: any) => void;
  showNotification: (msg: string, type?: 'success' | 'warning' | 'info') => void;
  handleOpenMidiContextMenu?: (e: React.MouseEvent, paramId: string, paramName: string) => void;
}

const knobValToHz = (x: number): number => {
  const minF = 40;
  const maxF = 20000;
  const p = 0.525;
  const hz = minF * Math.pow(maxF / minF, Math.pow(x, p));
  return Math.round(hz);
};

const hzToKnobVal = (hz: number): number => {
  const minF = 40;
  const maxF = 20000;
  const p = 0.525;
  const ratio = Math.max(0, Math.log(hz / minF) / Math.log(maxF / minF));
  return Math.pow(ratio, 1 / p);
};

export const FiltersTab: React.FC<FiltersTabProps> = ({
  channels,
  onChannelsChange,
  activeParamFocus,
  setActiveParamFocus,
  channelAccents,
  channelSolidBg,
  attackMax1s: propAttackMax1s,
  onToggleAttackMax1s,
  selectedFxPresetId,
  handleLoadFXPreset,
  fxPresets,
  handleDeleteFXPreset,
  newFxPresetName,
  setNewFxPresetName,
  handleSaveFXPreset,
  selectedAdsrPresetId,
  handleLoadAdsrPreset,
  adsrPresets,
  handleDeleteAdsrPreset,
  newAdsrPresetName,
  setNewAdsrPresetName,
  handleSaveAdsrPreset,
  selectedFilterPresetId,
  handleLoadFilterPreset,
  filterPresets,
  handleDeleteFilterPreset,
  newFilterPresetName,
  setNewFilterPresetName,
  handleSaveFilterPreset,
  factoryTemplates,
  factoryAdsrTemplates,
  factoryFilterTemplates,
  updateChannelValue,
  showNotification,
  handleOpenMidiContextMenu
}) => {
  const getAdsrPath = (adsr: any) => {
    const { attack, decay, sustain, release } = adsr;
    const w = 240;
    const h = 80;
    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const maxTime = 12.0;
    
    const attackX = padding + (attack / maxTime) * graphW;
    const decayX = attackX + (decay / maxTime) * graphW;
    const sustainX = decayX + (3.0 / maxTime) * graphW;
    const releaseX = Math.min(w - padding, sustainX + (release / maxTime) * graphW);

    const sustainY = padding + graphH - (sustain / 100) * graphH;

    return `M ${padding} ${padding + graphH} L ${attackX} ${padding} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${padding + graphH}`;
  };

  const getFilterPath = (type: 'lowpass' | 'highpass' | 'bandpass', cutoff: number, resonance: number) => {
    const w = 240;
    const h = 80;
    const padding = 15;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    
    const xVal = hzToKnobVal(cutoff); // 0 to 1
    const cx = padding + xVal * graphW;
    
    const peakHeight = (resonance / 15.0) * 26; // max 26px peak
    const baseLineY = padding + graphH * 0.5; // Y = 45 (middle)
    const cy = baseLineY - peakHeight;
    
    let d = '';
    if (type === 'lowpass') {
      const startX = padding;
      const startY = baseLineY;
      const peakX = cx;
      const peakY = cy;
      const endX = w - padding;
      const endY = padding + graphH;
      
      d = `M ${startX} ${startY} ` +
          `L ${Math.max(startX, peakX - 25)} ${startY} ` +
          `C ${Math.max(startX, peakX - 10)} ${startY}, ${peakX - 5} ${peakY}, ${peakX} ${peakY} ` +
          `C ${peakX + 15} ${peakY}, ${peakX + 20} ${endY}, ${endX} ${endY}`;
    } else if (type === 'highpass') {
      const startX = padding;
      const startY = padding + graphH;
      const peakX = cx;
      const peakY = cy;
      const endX = w - padding;
      const endY = baseLineY;
      
      d = `M ${startX} ${startY} ` +
          `C ${peakX - 20} ${startY}, ${peakX - 15} ${peakY}, ${peakX} ${peakY} ` +
          `C ${peakX + 5} ${peakY}, ${Math.min(endX, peakX + 10)} ${endY}, ${Math.min(endX, peakX + 25)} ${endY} ` +
          `L ${endX} ${endY}`;
    } else {
      const startX = padding;
      const startY = padding + graphH;
      const peakX = cx;
      const peakY = cy;
      const endX = w - padding;
      const endY = padding + graphH;
      
      d = `M ${startX} ${startY} ` +
          `C ${startX + (peakX - startX) * 0.5} ${startY}, ${peakX - 15} ${peakY}, ${peakX} ${peakY} ` +
          `C ${peakX + 15} ${peakY}, ${peakX + (endX - peakX) * 0.5} ${endY}, ${endX} ${endY}`;
    }
    return d;
  };

  const selectedIdx = activeParamFocus?.[0] ?? 0;
  const state = channels[selectedIdx];
  const [localAttackMax1s, setLocalAttackMax1s] = React.useState<boolean>(false);
  const attackMax1s = propAttackMax1s ?? localAttackMax1s;

  const toggleAttackMax1s = () => {
    if (onToggleAttackMax1s) {
      onToggleAttackMax1s();
    } else {
      setLocalAttackMax1s(!localAttackMax1s);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between gap-3 select-none">
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 flex-1 items-start">
        
        {/* Layer Selector Left Panel */}
        <div className="flex flex-col gap-2">
          {(() => {
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

            return [0, 1, 2, 3].map((idx) => {
              const isFocused = activeParamFocus?.[0] === idx;
              const channelState = channels[idx];

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveParamFocus([idx, 'filterCutoff'])}
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
                    VOL: {channelState?.mute ? 'MUTADO' : `${Math.round((channelState?.volume ?? 0) * 100)}%`}
                  </span>
                </button>
              );
            });
          })()}
        </div>

        {/* Right Panel: Contains ADSR and Filter Side-by-Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
          
          {/* Envelope ADSR Panel */}
          {(() => {
            const layerThemeColors = [
              { text: 'text-amber-300', ring: 'focus:ring-amber-500', bg: 'bg-amber-400 hover:bg-amber-300 text-black', knob: 'text-amber-300', stroke: '#f59e0b', strokeGlow: 'rgba(245,158,11,0.35)', activeType: 'bg-amber-400 text-black shadow-sm font-black' },
              { text: 'text-sky-300', ring: 'focus:ring-sky-500', bg: 'bg-sky-400 hover:bg-sky-300 text-black', knob: 'text-sky-300', stroke: '#0ea5e9', strokeGlow: 'rgba(14,165,233,0.35)', activeType: 'bg-sky-400 text-black shadow-sm font-black' },
              { text: 'text-emerald-300', ring: 'focus:ring-emerald-500', bg: 'bg-emerald-400 hover:bg-emerald-300 text-black', knob: 'text-emerald-300', stroke: '#10b981', strokeGlow: 'rgba(16,185,129,0.35)', activeType: 'bg-emerald-400 text-black shadow-sm font-black' },
              { text: 'text-rose-300', ring: 'focus:ring-rose-500', bg: 'bg-rose-400 hover:bg-rose-300 text-black', knob: 'text-rose-300', stroke: '#f43f5e', strokeGlow: 'rgba(244,63,94,0.35)', activeType: 'bg-rose-400 text-black shadow-sm font-black' }
            ];
            const channelSolidBg = ['bg-amber-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500'];
            const currentTheme = layerThemeColors[selectedIdx] || layerThemeColors[0];

            return (
              <>
                <div className="bg-[#13171e] border border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className={`text-xs font-mono font-black px-2.5 py-1 rounded text-black shadow-sm ${channelSolidBg[selectedIdx]}`}>
                      ENVELOPE ADSR LAYER 0{selectedIdx + 1}
                    </span>
                    <div className="flex gap-1.5 items-center">
                      <button
                        type="button"
                        onClick={toggleAttackMax1s}
                        className={`px-2 py-1 rounded text-xs font-mono border cursor-pointer transition-all uppercase font-bold flex items-center gap-1 ${
                          attackMax1s
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                            : 'bg-zinc-800 border-zinc-650 text-zinc-200 hover:text-white hover:bg-zinc-700'
                        }`}
                        title="Alterna o alcance do Attack de 0-3s para 0-1s (Alta Precisão MIDI e Knob)"
                      >
                        <span className={`w-2 h-2 rounded-full ${attackMax1s ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                        Att: {attackMax1s ? '0-1.0s' : '0-3.0s'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCh = [...channels];
                          nextCh[selectedIdx] = {
                            ...state,
                            adsrBypass: !state.adsrBypass
                          };
                          onChannelsChange(nextCh);
                        }}
                        className={`px-2 py-1 rounded text-xs font-mono border cursor-pointer transition-all uppercase font-bold ${
                          state.adsrBypass
                            ? 'bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30'
                            : 'bg-zinc-800 border-zinc-650 text-zinc-200 hover:text-white hover:bg-zinc-700'
                        }`}
                        title="Ignora temporariamente o envelope ADSR"
                      >
                        Bypass: {state.adsrBypass ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* ADSR Presets Bar */}
                  <div className="bg-[#0b0e14] border border-zinc-700 rounded-lg p-2.5 flex flex-wrap gap-2 items-center justify-between select-none mb-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                      <span className={`text-xs font-mono font-black ${currentTheme.text} uppercase tracking-wider shrink-0`}>
                        PRESET ADSR:
                      </span>
                      <select
                        value={selectedAdsrPresetId}
                        onChange={(e) => handleLoadAdsrPreset(e.target.value, selectedIdx)}
                        className={`bg-[#0b0d10] border border-zinc-600 ${currentTheme.text} text-xs font-semibold rounded px-2 py-1 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono w-full cursor-pointer`}
                      >
                        <option value="">-- Carregar Preset ADSR --</option>
                        <optgroup label="Fábrica (Envelopes)">
                          {factoryAdsrTemplates.map((p, idx) => (
                            <option key={`adsr_fac_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                        {adsrPresets.length > 0 && (
                          <optgroup label="Meus Presets ADSR">
                            {adsrPresets.map((p, idx) => (
                              <option key={`adsr_usr_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {selectedAdsrPresetId && adsrPresets.some(p => p.id === selectedAdsrPresetId) && (
                        <button
                          onClick={() => handleDeleteAdsrPreset(selectedAdsrPresetId)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-950 border border-zinc-600 hover:border-red-700 text-red-300 hover:text-white transition cursor-pointer text-xs font-mono uppercase font-black shrink-0"
                          title="Excluir preset ADSR"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveAdsrPreset(newAdsrPresetName, selectedIdx);
                      }} 
                      className="flex gap-1.5 items-center w-full mt-1 border-t border-zinc-700 pt-1.5"
                    >
                      <input
                        type="text"
                        value={newAdsrPresetName}
                        onChange={(e) => setNewAdsrPresetName(e.target.value)}
                        placeholder="Nomear..."
                        className={`bg-[#0b0d10] border border-zinc-600 text-xs rounded px-2 py-1 text-zinc-100 placeholder:text-zinc-300 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono flex-1 min-w-0`}
                      />
                      <button
                        type="submit"
                        disabled={!newAdsrPresetName.trim()}
                        className={`text-xs font-mono font-black px-2.5 py-1 rounded ${currentTheme.bg} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase tracking-wider shrink-0`}
                      >
                        Gravar
                      </button>
                    </form>
                  </div>

                  {/* ADSR Graph Screen */}
                  <div className="bg-[#0b0e14] border border-zinc-700 rounded-lg p-2.5 flex flex-col justify-between relative overflow-hidden h-36 shadow-inner">
                    {state.adsrBypass && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center pointer-events-none select-none rounded-lg">
                        <span className="text-red-400 font-sans font-black tracking-widest text-xs bg-black/95 px-3 py-1 rounded border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.5)] uppercase">
                          ADSR BYPASSADO
                        </span>
                        <span className="text-zinc-300 font-mono text-xs mt-1.5">Ataque imediato e sustentação total</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center justify-center h-full">
                      <svg width="100%" height="86" viewBox="0 0 240 80" className="opacity-95" preserveAspectRatio="none">
                        <line x1="0" y1="10" x2="240" y2="10" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="40" x2="240" y2="40" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="70" x2="240" y2="70" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        
                        <path 
                          d={getAdsrPath(state.adsr)} 
                          fill="none" 
                          stroke={currentTheme.strokeGlow} 
                          strokeWidth="6" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        <path 
                          d={getAdsrPath(state.adsr)} 
                          fill="none" 
                          stroke={currentTheme.stroke} 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                      </svg>
                      <span className="text-[12px] font-mono font-bold text-zinc-300 uppercase tracking-widest mt-1">CURVA DE AMPLITUDE</span>
                    </div>
                  </div>

                  {/* ADSR 4 Knobs Row */}
                  <div className="grid grid-cols-4 gap-1.5 border-t border-zinc-700 pt-2.5 shrink-0 select-none justify-items-center w-full">
                    <Knob
                      label="A (Att)"
                      min={0.0}
                      max={attackMax1s ? 1.0 : 3.0}
                      value={state.adsr.attack}
                      step={attackMax1s ? 0.001 : 0.01}
                      defaultValue={0.0}
                      onChange={(val) => {
                        const nextCh = [...channels];
                        nextCh[selectedIdx].adsr.attack = parseFloat(val.toFixed(3));
                        onChannelsChange(nextCh);
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_attack`, `Layer 0${selectedIdx + 1} ADSR Attack`);
                        }
                      }}
                      unit="s"
                      color={currentTheme.knob}
                      size="lg"
                    />
                    <Knob
                      label="D (Dec)"
                      min={0.0}
                      max={5.0}
                      value={state.adsr.decay}
                      step={0.01}
                      defaultValue={0.5}
                      onChange={(val) => {
                        const nextCh = [...channels];
                        nextCh[selectedIdx].adsr.decay = parseFloat(val.toFixed(3));
                        onChannelsChange(nextCh);
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_decay`, `Layer 0${selectedIdx + 1} ADSR Decay`);
                        }
                      }}
                      unit="s"
                      color={currentTheme.knob}
                      size="lg"
                    />
                    <Knob
                      label="S (Sus)"
                      min={0}
                      max={100}
                      value={state.adsr.sustain}
                      step={1}
                      defaultValue={50}
                      onChange={(val) => {
                        const nextCh = [...channels];
                        nextCh[selectedIdx].adsr.sustain = Math.round(val);
                        onChannelsChange(nextCh);
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_sustain`, `Layer 0${selectedIdx + 1} ADSR Sustain`);
                        }
                      }}
                      unit="%"
                      color={currentTheme.knob}
                      size="lg"
                    />
                    <Knob
                      label="R (Rel)"
                      min={0.01}
                      max={2.0}
                      value={state.adsr.release}
                      step={0.01}
                      defaultValue={0.35}
                      onChange={(val) => {
                        const nextCh = [...channels];
                        nextCh[selectedIdx].adsr.release = parseFloat(val.toFixed(3));
                        onChannelsChange(nextCh);
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_release`, `Layer 0${selectedIdx + 1} ADSR Release`);
                        }
                      }}
                      unit="s"
                      color={currentTheme.knob}
                      size="lg"
                    />
                  </div>
                </div>

                {/* Biquad Filter Panel */}
                <div className="bg-[#13171e] border border-zinc-700 rounded-lg p-3.5 flex flex-col justify-between gap-3 relative shadow-lg">
                  <div className="flex justify-between items-center border-b border-zinc-700 pb-2">
                    <span className={`text-xs font-mono font-black px-2.5 py-1 rounded text-black shadow-sm ${channelSolidBg[selectedIdx]}`}>
                      FILTRO BIQUAD LAYER 0{selectedIdx + 1}
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextCh = [...channels];
                          nextCh[selectedIdx] = {
                            ...state,
                            filterBypass: !state.filterBypass
                          };
                          onChannelsChange(nextCh);
                        }}
                        className={`px-2 py-1 rounded text-xs font-mono border cursor-pointer transition-all uppercase font-bold ${
                          state.filterBypass
                            ? 'bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30'
                            : 'bg-zinc-800 border-zinc-650 text-zinc-200 hover:text-white hover:bg-zinc-700'
                        }`}
                        title="Ignora temporariamente a filtragem"
                      >
                        Bypass: {state.filterBypass ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Filter Presets Bar */}
                  <div className="w-full bg-[#0b0e14] border border-zinc-700 rounded-lg p-2.5 flex flex-col gap-1.5 select-none text-left">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className={`text-xs font-mono font-black ${currentTheme.text} uppercase tracking-wider shrink-0`}>
                        PRESET FILTRO:
                      </span>
                      <select
                        value={selectedFilterPresetId}
                        onChange={(e) => handleLoadFilterPreset(e.target.value, selectedIdx)}
                        className={`bg-[#0b0d10] border border-zinc-600 ${currentTheme.text} text-xs font-semibold rounded px-2 py-1 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono w-full cursor-pointer`}
                      >
                        <option value="">-- Carregar Preset Filtro --</option>
                        <optgroup label="Fábrica (Filtros)">
                          {factoryFilterTemplates.map((p, idx) => (
                            <option key={`flt_fac_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                        {filterPresets.length > 0 && (
                          <optgroup label="Meus Presets Filtro">
                            {filterPresets.map((p, idx) => (
                              <option key={`flt_usr_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {selectedFilterPresetId && filterPresets.some(p => p.id === selectedFilterPresetId) && (
                        <button
                          onClick={() => handleDeleteFilterPreset(selectedFilterPresetId)}
                          className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-950 border border-zinc-600 hover:border-red-700 text-red-300 hover:text-white transition cursor-pointer text-xs font-mono uppercase font-black shrink-0"
                          title="Excluir preset Filtro"
                        >
                          X
                        </button>
                      )}
                    </div>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveFilterPreset(newFilterPresetName, selectedIdx);
                      }} 
                      className="flex gap-1.5 items-center w-full mt-1 border-t border-zinc-700 pt-1.5"
                    >
                      <input
                        type="text"
                        value={newFilterPresetName}
                        onChange={(e) => setNewFilterPresetName(e.target.value)}
                        placeholder="Nomear preset filtro..."
                        className={`bg-[#0b0d10] border border-zinc-600 text-xs rounded px-2 py-1 text-zinc-100 placeholder:text-zinc-300 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono flex-1 min-w-0`}
                      />
                      <button
                        type="submit"
                        disabled={!newFilterPresetName.trim()}
                        className={`text-xs font-mono font-black px-2.5 py-1 rounded ${currentTheme.bg} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase tracking-wider shrink-0`}
                      >
                        Gravar
                      </button>
                    </form>
                  </div>

                  {/* Filter Graph Screen */}
                  <div className="bg-[#0b0e14] border border-zinc-700 rounded-lg p-2.5 flex flex-col justify-between relative overflow-hidden h-36 shadow-inner">
                    {state.filterBypass && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center pointer-events-none select-none rounded-lg">
                        <span className="text-red-400 font-sans font-black tracking-widest text-xs bg-black/95 px-3 py-1 rounded border border-red-700 shadow-[0_0_12px_rgba(239,68,68,0.5)] uppercase">
                          FILTRO BYPASSADO
                        </span>
                        <span className="text-zinc-300 font-mono text-xs mt-1">Sinal passa limpo sem atenuação</span>
                      </div>
                    )}

                    <div className="flex flex-col items-center justify-center h-full">
                      <svg width="100%" height="86" viewBox="0 0 240 80" className="opacity-95" preserveAspectRatio="none">
                        <line x1="0" y1="10" x2="240" y2="10" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="40" x2="240" y2="40" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        <line x1="0" y1="70" x2="240" y2="70" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="2" />
                        
                        {/* Cutoff frequency indicator marker line */}
                        <line 
                          x1={15 + hzToKnobVal(state.filterCutoff) * 210} 
                          y1="10" 
                          x2={15 + hzToKnobVal(state.filterCutoff) * 210} 
                          y2="70" 
                          stroke={currentTheme.strokeGlow} 
                          strokeWidth="1.5" 
                          strokeDasharray="3 3" 
                        />

                        <path 
                          d={getFilterPath(state.filterType || 'lowpass', state.filterCutoff, state.filterResonance)} 
                          fill="none" 
                          stroke={currentTheme.strokeGlow} 
                          strokeWidth="6" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        <path 
                          d={getFilterPath(state.filterType || 'lowpass', state.filterCutoff, state.filterResonance)} 
                          fill="none" 
                          stroke={currentTheme.stroke} 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                      </svg>
                      <span className="text-[12px] font-mono font-bold text-zinc-300 uppercase tracking-widest mt-1">CURVA DE RESPOSTA DO FILTRO</span>
                    </div>
                  </div>

                  {/* Filter Controls Row */}
                  <div className="flex items-center justify-around border-t border-zinc-700 pt-2.5 shrink-0 select-none w-full gap-2">
                    {/* Type Selector inside the controls row */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[12px] font-mono font-bold text-zinc-300 uppercase tracking-wider text-center">
                        TIPO
                      </span>
                      <div className="flex gap-1 bg-[#0b0d10] p-1 rounded-lg border border-zinc-700 h-14 items-center px-1.5">
                        {(['lowpass', 'highpass', 'bandpass'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              const nextCh = [...channels];
                              nextCh[selectedIdx].filterType = type;
                              if (type === 'lowpass') {
                                nextCh[selectedIdx].filterCutoff = 20000;
                              } else if (type === 'highpass') {
                                nextCh[selectedIdx].filterCutoff = 40;
                              } else if (type === 'bandpass') {
                                nextCh[selectedIdx].filterCutoff = 3000;
                              }
                              nextCh[selectedIdx].filterResonance = 1.0;
                              onChannelsChange(nextCh);
                            }}
                            className={`text-xs font-mono px-2 py-1 rounded transition uppercase font-black cursor-pointer ${
                              state.filterType === type
                                ? currentTheme.activeType
                                : 'text-zinc-300 hover:text-white'
                            }`}
                          >
                            {type === 'lowpass' ? 'LP' : type === 'highpass' ? 'HP' : 'BP'}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-300 min-h-[14px] flex items-center justify-center">
                        {(state.filterType || 'lowpass').toUpperCase()}
                      </span>
                    </div>

                    {/* Cutoff frequency Knob */}
                    <Knob
                      label="Corte (Hz)"
                      min={0}
                      max={1}
                      step={0.001}
                      value={hzToKnobVal(state.filterCutoff)}
                      defaultValue={hzToKnobVal(20000)}
                      onChange={(val) => {
                        const realHz = knobValToHz(val);
                        updateChannelValue(selectedIdx, 'filterCutoff', realHz);
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_cutoff`, `Layer 0${selectedIdx + 1} Filtro Corte`);
                        }
                      }}
                      displayValue={state.filterCutoff >= 1000 
                        ? `${(state.filterCutoff / 1000).toFixed(1)}kHz` 
                        : `${state.filterCutoff}Hz`
                      }
                      color={currentTheme.knob}
                      size="lg"
                    />

                    {/* Resonance Knob */}
                    <Knob
                      label="Ressonância"
                      min={0}
                      max={15.0}
                      step={0.1}
                      value={state.filterResonance}
                      defaultValue={1.0}
                      onChange={(val) => {
                        updateChannelValue(selectedIdx, 'filterResonance', parseFloat(val.toFixed(1)));
                      }}
                      onContextMenu={(e) => {
                        if (handleOpenMidiContextMenu) {
                          handleOpenMidiContextMenu(e, `layer${selectedIdx}_resonance`, `Layer 0${selectedIdx + 1} Filtro Ressonância`);
                        }
                      }}
                      color={currentTheme.knob}
                      size="lg"
                    />
                  </div>

                </div>
              </>
            );
          })()}

        </div>
      </div>
    </div>
  );
};
