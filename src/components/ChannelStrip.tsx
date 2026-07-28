import React from 'react';
import { ChannelState } from '../lib/synth-engine';
import { Volume2, Music, Play, Sliders, Sparkles } from 'lucide-react';

interface ChannelStripProps {
  channelIndex: number;
  state: ChannelState;
  presets: { name: string; preset: number; bank: number }[];
  onStateChange: (newState: ChannelState) => void;
  onPlayTestNote: () => void;
  accentColor: string;
  glowColor: string;
  onOpenEffects: () => void;
}

export const ChannelStrip: React.FC<ChannelStripProps> = ({
  channelIndex,
  state,
  presets,
  onStateChange,
  onPlayTestNote,
  accentColor,
  glowColor,
  onOpenEffects,
}) => {
  const updateParam = <K extends keyof ChannelState>(key: K, value: ChannelState[K]) => {
    onStateChange({
      ...state,
      [key]: value,
    });
  };

  const hasPreset = presets.length > 0;

  return (
    <div className="bg-[#13171e] border border-zinc-700 rounded-lg p-4 flex flex-col gap-4 shadow-md transition-all relative overflow-hidden">
      {/* Visual Accent Strip */}
      <div className={`absolute top-0 left-0 right-0 h-1.5 ${accentColor}`} />

      {/* Header */}
      <div className="flex justify-between items-center mt-1 pb-2 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-black px-2 py-0.5 rounded text-black ${accentColor}`}>
            CH {(channelIndex + 1).toString().padStart(2, '0')}
          </span>
          <span className="text-xs font-bold font-mono text-zinc-200 tracking-tight">
            {hasPreset ? 'SOUNDFONT SF2' : 'SEM BANCO'}
          </span>
        </div>
        
        <button
          onClick={onPlayTestNote}
          className="flex items-center gap-1.5 text-xs font-bold font-mono text-zinc-100 hover:text-white px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition border border-zinc-600 cursor-pointer shadow-sm"
        >
          <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
          TESTE
        </button>
      </div>

      {/* Preset / Fallback Selector */}
      <div className="relative">
        {hasPreset ? (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono font-black text-amber-300 uppercase tracking-wider">
              Patch / Preset
            </label>
            <select
              value={state.presetIndex}
              onChange={(e) => updateParam('presetIndex', parseInt(e.target.value))}
              className="w-full bg-[#0b0d10] border border-zinc-600 text-zinc-100 text-xs font-semibold rounded p-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono cursor-pointer"
            >
              {presets.map((p, idx) => (
                <option key={idx} value={idx}>
                  {p.preset.toString().padStart(3, '0')}:{p.bank.toString().padStart(3, '0')} - {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-wider">
              Patch / Preset
            </span>
            <div className="w-full bg-[#0b0d10] border border-zinc-700 text-zinc-400 text-xs rounded p-2.5 font-mono flex items-center gap-1.5 italic">
              <Sparkles className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
              <span className="truncate">Carregue um arquivo .sf2</span>
            </div>
          </div>
        )}
      </div>

      {/* Vol, Pan, Mute, Solo Panel */}
      <div className="flex flex-col gap-3.5">
        {/* Slider Volume */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-mono text-zinc-200">
            <span className="flex items-center gap-1.5 uppercase font-bold text-zinc-300">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Volume
            </span>
            <span className="font-extrabold text-emerald-400 text-sm">
              {Math.round(state.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.volume}
            onChange={(e) => updateParam('volume', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-black rounded appearance-none cursor-pointer accent-emerald-500 border border-zinc-700"
          />
        </div>

        {/* Slider Pan */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs font-mono text-zinc-200">
            <span className="uppercase font-bold text-zinc-300">Balanço (PAN)</span>
            <span className="font-extrabold text-emerald-400 text-sm">
              {state.pan === 0 ? 'C' : state.pan < 0 ? `L${Math.round(Math.abs(state.pan) * 100)}` : `R${Math.round(state.pan * 100)}`}
            </span>
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.02"
            value={state.pan}
            onChange={(e) => updateParam('pan', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-black rounded appearance-none cursor-pointer accent-emerald-500 border border-zinc-700"
          />
        </div>

        {/* Mute and Solo Toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateParam('mute', !state.mute)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-mono font-bold border transition cursor-pointer ${
              state.mute
                ? 'bg-red-950 border-red-700 text-red-300 font-black shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : 'bg-[#0b0d10] border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${state.mute ? 'bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]' : 'bg-zinc-600'}`} />
            MUTE
          </button>

          <button
            onClick={() => updateParam('solo', !state.solo)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded text-xs font-mono font-bold border transition cursor-pointer ${
              state.solo
                ? 'bg-amber-950 border-amber-700 text-amber-300 font-black shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                : 'bg-[#0b0d10] border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${state.solo ? 'bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]' : 'bg-zinc-600'}`} />
            SOLO
          </button>
        </div>
      </div>

      {/* Button to Open Dedicated Effects Window */}
      <button
        onClick={onOpenEffects}
        className="mt-2 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-xs font-mono font-black text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/50 hover:border-emerald-400 transition cursor-pointer uppercase tracking-wider shadow-sm"
      >
        <Sliders className="w-4 h-4 text-emerald-400" />
        Filtros & Efeitos
      </button>
    </div>
  );
};
