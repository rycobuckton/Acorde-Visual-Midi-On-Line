import React from 'react';
import { Layers } from 'lucide-react';
import { ChannelState } from '../lib/synth-engine';
import { Knob } from './Knob';

interface EqTabProps {
  channels: ChannelState[];
  onChannelsChange: (newChannels: ChannelState[]) => void;
  activeParamFocus: [number, string] | null;
  setActiveParamFocus: (focus: [number, string] | null) => void;
  channelAccents: string[];
  channelSolidBg: string[];

  selectedEqPresetId: string;
  handleLoadEqPreset: (id: string, channelIdx: number) => void;
  eqPresets: any[];
  handleDeleteEqPreset: (id: string) => void;
  newEqPresetName: string;
  setNewEqPresetName: (name: string) => void;
  handleSaveEqPreset: (name: string, channelIdx: number) => void;

  factoryEqTemplates: any[];
  updateChannelValue: (idx: number, key: any, value: any) => void;
  showNotification: (msg: string, type?: 'success' | 'warning' | 'info') => void;
  
  eqFrequencyData: Uint8Array;
  selectedEqBandIdx: number;
  setSelectedEqBandIdx: (idx: number) => void;

  handleToggleEqBypass: (idx: number) => void;
  handleResetEqToDefault: (idx: number) => void;
  handleCopyChannel: (idx: number) => void;
  handleCutChannel: (idx: number) => void;
  handlePasteChannel: (idx: number) => void;
  copiedChannelConfig: ChannelState | null;
  handleOpenMidiContextMenu?: (e: React.MouseEvent, paramId: string, paramName: string) => void;
}

export const EqTab: React.FC<EqTabProps> = ({
  channels,
  onChannelsChange,
  activeParamFocus,
  setActiveParamFocus,
  channelAccents,
  channelSolidBg,
  selectedEqPresetId,
  handleLoadEqPreset,
  eqPresets,
  handleDeleteEqPreset,
  newEqPresetName,
  setNewEqPresetName,
  handleSaveEqPreset,
  factoryEqTemplates,
  updateChannelValue,
  showNotification,
  eqFrequencyData,
  selectedEqBandIdx,
  setSelectedEqBandIdx,
  handleToggleEqBypass,
  handleResetEqToDefault,
  handleCopyChannel,
  handleCutChannel,
  handlePasteChannel,
  copiedChannelConfig,
  handleOpenMidiContextMenu,
}) => {
  const selectedIdx = activeParamFocus?.[0] ?? 0;
  const state = channels[selectedIdx];

  const layerThemes = [
    {
      name: 'amber',
      text: 'text-amber-400',
      titleText: 'text-amber-500',
      ring: 'focus:ring-amber-500',
      bgBtn: 'bg-amber-500 hover:bg-amber-400 text-black',
      accent: 'accent-amber-500',
      bandSelectedBg: 'bg-amber-500/10 border-amber-500/20',
      bandNameSelected: 'text-amber-400',
      bandPillSelected: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_4px_rgba(245,158,11,0.2)]',
      knobColor: 'text-amber-400',
      knobQColor: 'text-amber-500',
    },
    {
      name: 'sky',
      text: 'text-sky-400',
      titleText: 'text-sky-500',
      ring: 'focus:ring-sky-500',
      bgBtn: 'bg-sky-500 hover:bg-sky-400 text-black',
      accent: 'accent-sky-500',
      bandSelectedBg: 'bg-sky-500/10 border-sky-500/20',
      bandNameSelected: 'text-sky-400',
      bandPillSelected: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-[0_0_4px_rgba(14,165,233,0.2)]',
      knobColor: 'text-sky-400',
      knobQColor: 'text-sky-500',
    },
    {
      name: 'emerald',
      text: 'text-emerald-400',
      titleText: 'text-emerald-500',
      ring: 'focus:ring-emerald-500',
      bgBtn: 'bg-emerald-500 hover:bg-emerald-400 text-black',
      accent: 'accent-emerald-500',
      bandSelectedBg: 'bg-emerald-500/10 border-emerald-500/20',
      bandNameSelected: 'text-emerald-400',
      bandPillSelected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_4px_rgba(16,185,129,0.2)]',
      knobColor: 'text-emerald-400',
      knobQColor: 'text-emerald-500',
    },
    {
      name: 'rose',
      text: 'text-rose-400',
      titleText: 'text-rose-500',
      ring: 'focus:ring-rose-500',
      bgBtn: 'bg-rose-500 hover:bg-rose-400 text-black',
      accent: 'accent-rose-500',
      bandSelectedBg: 'bg-rose-500/10 border-rose-500/20',
      bandNameSelected: 'text-rose-400',
      bandPillSelected: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_4px_rgba(244,63,94,0.2)]',
      knobColor: 'text-rose-400',
      knobQColor: 'text-rose-500',
    },
  ];
  const theme = layerThemes[selectedIdx] || layerThemes[0];

  const bIdxToMinMax = (bIdx: number) => {
    switch (bIdx) {
      case 0: return { min: 20, max: 200, def: 80 };     // Sub-Grave
      case 1: return { min: 80, max: 400, def: 150 };    // Grave-Médio
      case 2: return { min: 200, max: 1000, def: 400 };  // Médio 1 Peak
      case 3: return { min: 500, max: 2500, def: 1000 }; // Médio 2 Peak
      case 4: return { min: 1500, max: 5000, def: 2500 };// High-Mid Peak
      case 5: return { min: 3000, max: 8000, def: 4300 };// High Peak
      case 6: default: return { min: 8000, max: 20000, def: 12000 }; // High Shelf / Air
    }
  };

  const defaultBandsForIdx = (bIdx: number, chState: ChannelState) => {
    const targetFreqs = [80, 150, 400, 1000, 2500, 4300, 12000];
    const targetGains = [
      chState.eqLow ?? 3.0,
      2.0,
      -1.0,
      chState.eqMid ?? 0.0,
      1.0,
      2.0,
      chState.eqHigh ?? 3.0
    ];
    const targetQs = [0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7];

    const band = chState.eqBands?.[bIdx];
    if (!band || chState.eqBands?.length !== 7) {
      return {
        gain: targetGains[bIdx],
        frequency: targetFreqs[bIdx],
        q: targetQs[bIdx]
      };
    }

    const limits = bIdxToMinMax(bIdx);
    const isFreqValid = typeof band.frequency === 'number' && band.frequency >= limits.min && band.frequency <= limits.max;

    return {
      gain: typeof band.gain === 'number' ? band.gain : targetGains[bIdx],
      frequency: isFreqValid ? band.frequency : targetFreqs[bIdx],
      q: typeof band.q === 'number' ? band.q : targetQs[bIdx]
    };
  };

  const bandNames = [
    'Sub-Grave (80Hz)',
    'Grave-Médio (150Hz)',
    'Médio-1 (400Hz)',
    'Médio-2 (1kHz)',
    'Médio-Agudo (2.5kHz)',
    'Agudo (4.3kHz)',
    'Presença/Ar (12kHz)'
  ];

  return (
    <div className="flex flex-col h-full justify-between gap-3 select-none">
      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 flex-1 items-stretch">
        
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
                  onClick={() => setActiveParamFocus([idx, 'volume'])}
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

        {/* Right Panel: Contains EQ with extended height RTA */}
        <div className="bg-[#13171e] border border-zinc-700 rounded-lg p-3.5 flex-1 flex flex-col justify-between gap-3 shadow-lg">
          
          {/* Combined Header & Preset Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-700 pb-2.5 select-none">
            {/* Left & Middle: Layer Tag & Preset EQ Selector */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <span className={`text-xs font-mono font-black px-2.5 py-1 rounded text-black shrink-0 shadow-sm ${channelSolidBg[selectedIdx]}`}>
                LAYER 0{selectedIdx + 1} EQUALIZADOR 7-BANDAS
              </span>

              {/* Preset Selector inline */}
              <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-[420px]">
                <span className={`text-xs font-mono font-black ${theme.titleText} uppercase tracking-wider shrink-0 flex items-center gap-1 text-amber-300`}>
                  <span>💾</span>
                  <span className="hidden sm:inline">PRESET EQ:</span>
                </span>
                <select
                  value={selectedEqPresetId}
                  onChange={(e) => handleLoadEqPreset(e.target.value, selectedIdx)}
                  className={`bg-[#0b0d10] border border-zinc-600 ${theme.text} text-xs font-semibold rounded px-2.5 py-1 focus:outline-none focus:ring-1 ${theme.ring} font-mono w-full cursor-pointer text-zinc-100`}
                >
                  <option value="">-- Carregar Preset EQ --</option>
                  <optgroup label="Fábrica (Equalizador)">
                    {factoryEqTemplates.map((p, idx) => (
                      <option key={`eq_fac_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  {eqPresets.length > 0 && (
                    <optgroup label="Meus Presets EQ">
                      {eqPresets.map((p, idx) => (
                        <option key={`eq_usr_${p.id}_${idx}`} value={p.id}>{p.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {selectedEqPresetId && eqPresets.some(p => p.id === selectedEqPresetId) && (
                  <button
                    onClick={() => handleDeleteEqPreset(selectedEqPresetId)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-red-950 border border-zinc-600 hover:border-red-700 text-red-300 hover:text-white transition cursor-pointer text-xs font-mono uppercase font-black shrink-0"
                    title="Excluir preset EQ"
                  >
                    X
                  </button>
                )}
              </div>

              {/* Save Preset Form inline */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveEqPreset(newEqPresetName, selectedIdx);
                }} 
                className="flex gap-1.5 items-center shrink-0"
              >
                <input
                  type="text"
                  value={newEqPresetName}
                  onChange={(e) => setNewEqPresetName(e.target.value)}
                  placeholder="Nomear preset EQ..."
                  className={`bg-[#0b0d10] border border-zinc-600 text-xs rounded px-2.5 py-1 text-zinc-100 placeholder:text-zinc-300 focus:outline-none focus:ring-1 ${theme.ring} font-mono w-[130px]`}
                />
                <button
                  type="submit"
                  disabled={!newEqPresetName.trim()}
                  className={`text-xs font-mono font-black px-2.5 py-1 rounded ${theme.bgBtn} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase tracking-wider`}
                >
                  Gravar
                </button>
              </form>
            </div>

            {/* Right: Actions (Copiar, Recortar, Colar, Bypass) */}
            <div className="flex gap-1.5 items-center shrink-0">
              <button
                type="button"
                onClick={() => handleCopyChannel(selectedIdx)}
                className="px-2.5 py-1 rounded text-xs font-mono bg-zinc-800 border border-zinc-600 text-zinc-200 hover:text-white hover:bg-zinc-700 cursor-pointer transition-all uppercase font-bold"
                title="Copiar configurações do Layer"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={() => handleCutChannel(selectedIdx)}
                className="px-2.5 py-1 rounded text-xs font-mono bg-zinc-800 border border-zinc-600 text-zinc-200 hover:text-white hover:bg-zinc-700 cursor-pointer transition-all uppercase font-bold"
                title="Recortar/Limpar Layer"
              >
                Recortar
              </button>
              <button
                type="button"
                disabled={!copiedChannelConfig}
                onClick={() => handlePasteChannel(selectedIdx)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition-all uppercase font-bold ${
                  copiedChannelConfig
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100 hover:text-white hover:bg-zinc-700 cursor-pointer'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 cursor-not-allowed'
                }`}
                title="Colar configurações salvas do Layer"
              >
                Colar
              </button>
              <div className="w-[1px] h-5 bg-zinc-700 mx-1" />
              <button
                type="button"
                onClick={() => handleToggleEqBypass(selectedIdx)}
                className={`px-2.5 py-1 rounded text-xs font-mono border cursor-pointer transition-all uppercase font-black ${
                  state.eqBypass ?? false
                    ? 'bg-red-500/20 border-red-500 text-red-300 hover:bg-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:text-white hover:bg-zinc-700'
                }`}
                title="Ignora o Equalizador"
              >
                Bypass: {state.eqBypass ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Real-time Spectrum Analyzer (RTA) - High Contrast & Clear Display */}
          <div className="bg-[#0b0e14] border border-zinc-700 rounded-lg p-3.5 flex-1 min-h-[250px] flex flex-col justify-between relative overflow-hidden select-none shadow-inner my-0.5">
            <div className="absolute top-1.5 left-2.5 text-xs font-mono font-black text-amber-300 tracking-wider z-0 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>RTA SPECTRUM LAYER 0{selectedIdx + 1}</span>
            </div>
            
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-1 opacity-20">
              <div className="border-b border-zinc-500 w-full" />
              <div className="border-b border-zinc-500 w-full" />
              <div className="border-b border-zinc-500 w-full" />
              <div className="border-b border-zinc-500 w-full" />
            </div>
            
            {/* Spectral Bars */}
            <div className="flex-1 flex items-end justify-between min-h-[180px] pt-6 gap-[2px] px-1 relative z-10">
              {Array.from(eqFrequencyData).map((val: any, idx) => {
                const heightPct = Math.max(3, (Number(val) / 255) * 100);
                
                const barColor = idx < 8 
                ? (selectedIdx === 0 ? 'bg-amber-400' : selectedIdx === 1 ? 'bg-sky-400' : selectedIdx === 2 ? 'bg-emerald-400' : 'bg-rose-400')
                : idx < 16 
                  ? 'bg-sky-400' 
                  : idx < 24 
                    ? 'bg-emerald-400' 
                    : 'bg-rose-400';
                
                const glowColor = idx < 8
                ? (selectedIdx === 0 ? 'shadow-[0_0_6px_rgba(245,158,11,0.5)]' : selectedIdx === 1 ? 'shadow-[0_0_6px_rgba(14,165,233,0.5)]' : selectedIdx === 2 ? 'shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'shadow-[0_0_6px_rgba(244,63,94,0.5)]')
                : idx < 16
                  ? 'shadow-[0_0_6px_rgba(14,165,233,0.5)]'
                  : idx < 24
                    ? 'shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                    : 'shadow-[0_0_6px_rgba(244,63,94,0.5)]';

                return (
                  <div 
                    key={idx} 
                    className={`flex-1 rounded-t-[2px] transition-all duration-75 ${barColor} ${glowColor}`} 
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
            
            {/* Logarithmically-spaced frequency labels */}
            <div className="relative h-5 mt-2 border-t border-zinc-700 text-[10px] font-mono text-zinc-300 font-bold uppercase select-none shrink-0 pt-0.5">
              <span className="absolute left-0">20Hz</span>
              <span className="absolute" style={{ left: '29%' }}>150Hz</span>
              <span className="absolute" style={{ left: '45%' }}>500Hz</span>
              <span className="absolute" style={{ left: '67.7%' }}>2kHz</span>
              <span className="absolute" style={{ left: '87%' }}>8kHz</span>
              <span className="absolute right-0">20kHz</span>
            </div>
          </div>

          {/* EQ Sliders */}
          <div className="flex justify-between gap-3 bg-[#0c0f14] p-3.5 rounded-lg border border-zinc-700 min-h-[235px] relative shadow-inner">
            {state.eqBypass && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center pointer-events-none select-none rounded-lg">
                <span className="text-red-400 font-sans font-black tracking-widest text-xs bg-black/95 px-4 py-1.5 rounded border border-red-700 shadow-[0_0_15px_rgba(239,68,68,0.5)] uppercase">
                  EQUALIZADOR BYPASSADO
                </span>
                <span className="text-zinc-300 font-mono text-xs mt-2">Sinal passa flat sem alteração de ganho</span>
              </div>
            )}

            {/* EQ Slider Bands */}
            <div className="flex-1 flex justify-around items-stretch h-full">
              {[0, 1, 2, 3, 4, 5, 6].map((bIdx) => {
                const bandInfo = defaultBandsForIdx(bIdx, state);
                const isSelectedBand = selectedEqBandIdx === bIdx;
                
                return (
                  <div 
                    key={bIdx} 
                    onPointerDown={() => setSelectedEqBandIdx(bIdx)}
                    className={`flex-1 min-w-[50px] max-w-[80px] flex flex-col items-center justify-between p-1 rounded-lg transition cursor-pointer ${
                      isSelectedBand ? 'bg-zinc-800/80 border border-zinc-600' : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Gain label */}
                    <span className="text-[10px] font-mono text-zinc-100 font-black text-center select-none block truncate leading-none h-4 pt-1">
                      {bandInfo.gain > 0 ? `+${bandInfo.gain.toFixed(1)}` : bandInfo.gain.toFixed(1)}
                      <span className="text-[9px] text-zinc-400 ml-0.5">dB</span>
                    </span>
                    
                    {/* Vertical slider track */}
                    <div className="h-28 w-5 flex justify-center items-center relative my-1">
                      <div className="absolute top-0 bottom-0 w-1.5 bg-zinc-950 border border-zinc-700 rounded" />
                      {/* Zero line */}
                      <div className="absolute w-3.5 h-[1.5px] bg-zinc-500" style={{ top: '50%' }} />
                      
                      <input 
                        type="range"
                        min="-20"
                        max="20"
                        step="0.1"
                        value={bandInfo.gain}
                        orient="vertical"
                        style={{ WebkitAppearance: 'slider-vertical', height: '100%', width: '100%', opacity: 0.95 }}
                        onPointerDown={() => setSelectedEqBandIdx(bIdx)}
                        onContextMenu={(e) => {
                          if (handleOpenMidiContextMenu) {
                            const bandLabel = bIdx === 0 ? 'SUB' : bIdx === 1 ? 'L-MID' : bIdx === 2 ? 'MID1' : bIdx === 3 ? 'MID2' : bIdx === 4 ? 'H-MID' : bIdx === 5 ? 'HIGH' : 'AIR';
                            handleOpenMidiContextMenu(e, `layer${selectedIdx}_eq${bIdx}`, `Layer 0${selectedIdx + 1} EQ (${bandLabel})`);
                          }
                        }}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          const nextCh = [...channels];
                          const nextBands = [0, 1, 2, 3, 4, 5, 6].map(i => defaultBandsForIdx(i, state));
                          nextBands[bIdx] = {
                            ...nextBands[bIdx],
                            gain: val
                          };
                          
                          nextCh[selectedIdx] = {
                            ...state,
                            eqLow: bIdx === 0 ? val : state.eqLow,
                            eqMid: bIdx === 3 ? val : state.eqMid,
                            eqHigh: bIdx === 6 ? val : state.eqHigh,
                            eqBands: nextBands
                          };
                          onChannelsChange(nextCh);
                        }}
                        className={`cursor-ns-resize ${theme.accent}`}
                      />
                    </div>

                    {/* Band name and Frequency Indicator label */}
                    <div className="flex flex-col items-center gap-0.5 mt-0.5">
                      <span className={`text-[10px] font-mono uppercase font-black tracking-tight ${
                        isSelectedBand ? theme.bandNameSelected : 'text-zinc-300'
                      }`}>
                        {bIdx === 0 ? 'SUB' : bIdx === 1 ? 'L-MID' : bIdx === 2 ? 'MID1' : bIdx === 3 ? 'MID2' : bIdx === 4 ? 'H-MID' : bIdx === 5 ? 'HIGH' : 'AIR'}
                      </span>
                      <span className={`text-[9.5px] font-mono font-bold px-1 py-0.5 rounded border transition-all ${
                        isSelectedBand 
                          ? 'bg-amber-400 text-black font-black border-amber-300 shadow-[0_0_6px_rgba(245,158,11,0.4)]' 
                          : 'bg-zinc-800 text-zinc-200 border-zinc-650'
                      }`}>
                        {bandInfo.frequency >= 1000 
                          ? `${(bandInfo.frequency / 1000).toFixed(bandInfo.frequency % 1000 === 0 ? 0 : 1)}kHz` 
                          : `${bandInfo.frequency}Hz`
                        }
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected band details */}
            <div className="w-[250px] border-l border-zinc-700 pl-4 flex flex-col justify-between shrink-0 select-none">
              {(() => {
                const bInfo = defaultBandsForIdx(selectedEqBandIdx, state);
                const limits = bIdxToMinMax(selectedEqBandIdx);
                
                return (
                  <div className="flex flex-col justify-between h-full gap-2 text-left">
                    <div>
                      <div className="text-[12px] font-mono font-black text-zinc-400 uppercase">CONFIG DA BANDA</div>
                      <div className="text-xs font-sans font-black text-white uppercase truncate tracking-tight mt-0.5">
                        {bandNames[selectedEqBandIdx]}
                      </div>
                    </div>

                    <div className="flex gap-4 items-center mt-1">
                      <div className="flex-1">
                        <Knob
                          label="Freq (Hz)"
                          min={limits.min}
                          max={limits.max}
                          step={1}
                          value={bInfo.frequency}
                          defaultValue={limits.def}
                          onChange={(val) => {
                            const nextCh = [...channels];
                            const nextBands = [0, 1, 2, 3, 4, 5, 6].map(i => defaultBandsForIdx(i, state));
                            nextBands[selectedEqBandIdx] = {
                              ...nextBands[selectedEqBandIdx],
                              frequency: Math.round(val)
                            };
                            nextCh[selectedIdx] = {
                              ...state,
                              eqBands: nextBands
                            };
                            onChannelsChange(nextCh);
                          }}
                          onContextMenu={(e) => {
                            if (handleOpenMidiContextMenu) {
                              const bandLabel = selectedEqBandIdx === 0 ? 'SUB' : selectedEqBandIdx === 1 ? 'L-MID' : selectedEqBandIdx === 2 ? 'MID1' : selectedEqBandIdx === 3 ? 'MID2' : selectedEqBandIdx === 4 ? 'H-MID' : selectedEqBandIdx === 5 ? 'HIGH' : 'AIR';
                              handleOpenMidiContextMenu(e, `layer${selectedIdx}_eqfreq${selectedEqBandIdx}`, `Layer 0${selectedIdx + 1} EQ Freq (${bandLabel})`);
                            }
                          }}
                          displayValue={`${bInfo.frequency}Hz`}
                          color={theme.knobColor}
                          size="md"
                        />
                      </div>

                      <div className="flex-1">
                        {/* Q parameter for all bands */}
                        <Knob
                          label="Q (Res)"
                          min={0.05}
                          max={5.0}
                          step={0.05}
                          value={bInfo.q ?? 1.0}
                          defaultValue={selectedEqBandIdx === 0 || selectedEqBandIdx === 4 ? 0.7 : 1.0}
                          onChange={(val) => {
                            const nextCh = [...channels];
                            const nextBands = [0, 1, 2, 3, 4, 5, 6].map(i => defaultBandsForIdx(i, state));
                            nextBands[selectedEqBandIdx] = {
                              ...nextBands[selectedEqBandIdx],
                              q: parseFloat(val.toFixed(2))
                            };
                            nextCh[selectedIdx] = {
                              ...state,
                              eqBands: nextBands
                            };
                            onChannelsChange(nextCh);
                          }}
                          onContextMenu={(e) => {
                            if (handleOpenMidiContextMenu) {
                              const bandLabel = selectedEqBandIdx === 0 ? 'SUB' : selectedEqBandIdx === 1 ? 'L-MID' : selectedEqBandIdx === 2 ? 'MID1' : selectedEqBandIdx === 3 ? 'MID2' : selectedEqBandIdx === 4 ? 'H-MID' : selectedEqBandIdx === 5 ? 'HIGH' : 'AIR';
                              handleOpenMidiContextMenu(e, `layer${selectedIdx}_eqq${selectedEqBandIdx}`, `Layer 0${selectedIdx + 1} EQ Q (${bandLabel})`);
                            }
                          }}
                          color={theme.knobQColor}
                          size="md"
                        />
                      </div>
                    </div>

                    <div className="text-[12px] font-mono text-zinc-300 tracking-wide uppercase leading-normal">
                      Ajuste Freq para focar o ganho e Q para estreitar a largura de banda.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
