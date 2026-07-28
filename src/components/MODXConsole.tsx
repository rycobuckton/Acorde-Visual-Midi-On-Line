import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ChannelState, ADSR, synthEngineInstance } from '../lib/synth-engine';
import { SynthPreset, SoundFontAsset } from '../App';
import { loadSoundFontData, getRawSoundFontKeys, getRawSoundFontRecord, saveSoundFont } from '../lib/db';
import { SF2Parser } from '../lib/sf2-parser';
import { Knob } from './Knob';
import { Visualizer } from './Visualizer';
import { FiltersTab } from './FiltersTab';
import { EqTab } from './EqTab';
import { EchoTab } from './EchoTab';
import { 
  Home, 
  Settings, 
  Activity, 
  Volume2, 
  Zap, 
  Upload, 
  Trash2, 
  Download, 
  Save, 
  Sliders, 
  Compass, 
  Music, 
  ShieldAlert, 
  SlidersHorizontal,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Layers,
  HelpCircle,
  FolderOpen,
  Folder,
  Filter,
  Copy,
  Scissors,
  Clipboard,
  Star,
  Search,
  Tag,
  Edit3,
  ArrowLeft,
  X,
  XCircle,
  Plus,
  FileText
} from 'lucide-react';

interface MODXConsoleProps {
  channels: ChannelState[];
  onChannelsChange: (newChannels: ChannelState[]) => void;
  reverbDecay: number;
  reverbMix: number;
  reverbPreDelay: number;
  reverbHighCut: number;
  onReverbChange: (decay: number, mix: number, preDelay?: number, highCut?: number) => void;
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  loadedSoundFonts: SoundFontAsset[];
  onSoundFontsUploaded: (files: File[], category?: string) => void;
  onRemoveSoundFont: (id: string) => void;
  onRemoveMultipleSoundFonts?: (ids: string[]) => void;
  onSoundFontsReset: () => void;
  savedPresets: SynthPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onPanic: () => void;
  voiceCount: number;
  audioActive: boolean;
  onToggleAudio: () => void;
  isSf2Loading?: boolean;
  isDbLoading?: boolean;
  preferredSampleRate?: number;
  onSampleRateChange: (rate: number | undefined) => void;
  sfCategories: Record<string, string>;
  onSfCategoriesChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  reverbBypass?: boolean;
  onReverbBypassChange?: (bypass: boolean) => void;
  chorusBypass?: boolean;
  onChorusBypassChange?: (bypass: boolean) => void;
  chorusRate?: number;
  chorusDepth?: number;
  chorusMix?: number;
  onChorusChange?: (rate: number, depth: number, mix: number) => void;
  tremoloBypass?: boolean;
  onTremoloBypassChange?: (bypass: boolean) => void;
  tremoloRate?: number;
  tremoloDepth?: number;
  tremoloMode?: 'volume' | 'pan';
  onTremoloChange?: (rate: number, depth: number, mode?: 'volume' | 'pan') => void;
  auditioningSoundFont?: any;
  onAuditioningSoundFontChange?: (val: any) => void;
}

type TabType = 'live-set' | 'performance' | 'delay' | 'mixing' | 'filters' | 'eq' | 'fx-adsr' | 'utility' | 'waveforms';

const midiNoteToName = (note: number): string => {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = names[note % 12];
  return `${noteName}${octave}`;
};

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

export interface SF2CustomConfig {
  soundfontGain?: number;
  volume?: number;
  pan?: number;
  filterCutoff?: number;
  filterResonance?: number;
  filterType?: 'lowpass' | 'highpass' | 'bandpass';
  adsr?: { attack: number; decay: number; sustain: number; release: number };
  reverbSend?: number;
  chorusMix?: number;
  octaveOffset?: number;
  midiSensitivity?: number;
  eqLow?: number;
  eqMid?: number;
  eqHigh?: number;
  presetIndex?: number;
  updatedAt?: number;
}

export function getSF2SavedConfig(sfId: string): SF2CustomConfig | null {
  if (!sfId) return null;
  try {
    const raw = localStorage.getItem('sf2_saved_configs');
    if (!raw) return null;
    const configs = JSON.parse(raw);
    return configs[sfId] || null;
  } catch (err) {
    return null;
  }
}

export function saveSF2ConfigFromChannel(sfId: string, channel: ChannelState): void {
  if (!sfId) return;
  try {
    const raw = localStorage.getItem('sf2_saved_configs');
    const configs = raw ? JSON.parse(raw) : {};
    configs[sfId] = {
      soundfontGain: channel.soundfontGain,
      volume: channel.volume,
      pan: channel.pan,
      filterCutoff: channel.filterCutoff,
      filterResonance: channel.filterResonance,
      filterType: channel.filterType,
      adsr: { ...channel.adsr },
      reverbSend: channel.reverbSend,
      chorusMix: channel.chorusMix,
      octaveOffset: channel.octaveOffset,
      midiSensitivity: channel.midiSensitivity,
      eqLow: channel.eqLow,
      eqMid: channel.eqMid,
      eqHigh: channel.eqHigh,
      delayBypass: channel.delayBypass,
      delayTime: channel.delayTime,
      delayFeedback: channel.delayFeedback,
      delayMix: channel.delayMix,
      delayHighCut: channel.delayHighCut,
      presetIndex: channel.presetIndex ?? 0,
      updatedAt: Date.now()
    };
    localStorage.setItem('sf2_saved_configs', JSON.stringify(configs));
  } catch (err) {
    console.error('Erro ao salvar configuração do SF2:', err);
  }
}

export function removeSF2Config(sfId: string): void {
  if (!sfId) return;
  try {
    const raw = localStorage.getItem('sf2_saved_configs');
    if (!raw) return;
    const configs = JSON.parse(raw);
    delete configs[sfId];
    localStorage.setItem('sf2_saved_configs', JSON.stringify(configs));
  } catch (err) {}
}

const StereoVuMeter: React.FC<{ levels: [number, number]; heightClass?: string }> = ({ levels, heightClass = 'h-28' }) => {
  const dbThresholds = [-40, -30, -24, -18, -15, -12, -9, -6, -3, -1.5, 0, 3];
  
  return (
    <div className={`w-5.5 ${heightClass} bg-zinc-950 border border-zinc-800 rounded p-[2px] flex justify-between gap-[2px] shrink-0 relative overflow-hidden`} title="VU Estéreo (dB)">
      {/* Left channel */}
      <div className="flex flex-col-reverse justify-between flex-1 gap-[1.5px]">
        {dbThresholds.map((threshold, segmentIdx) => {
          const isActive = levels[0] >= threshold;
          let ledColor = 'bg-zinc-900/40';
          if (isActive) {
            if (segmentIdx >= 10) ledColor = 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.95)]';
            else if (segmentIdx >= 8) ledColor = 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.85)]';
            else ledColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.85)]';
          }
          return (
            <div key={segmentIdx} className={`flex-1 rounded-[1px] transition-colors duration-75 ${ledColor}`} />
          );
        })}
      </div>
      
      {/* Right channel */}
      <div className="flex flex-col-reverse justify-between flex-1 gap-[1.5px]">
        {dbThresholds.map((threshold, segmentIdx) => {
          const isActive = levels[1] >= threshold;
          let ledColor = 'bg-zinc-900/40';
          if (isActive) {
            if (segmentIdx >= 10) ledColor = 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.95)]';
            else if (segmentIdx >= 8) ledColor = 'bg-yellow-400 shadow-[0_0_4px_rgba(234,179,8,0.85)]';
            else ledColor = 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.85)]';
          }
          return (
            <div key={segmentIdx} className={`flex-1 rounded-[1px] transition-colors duration-75 ${ledColor}`} />
          );
        })}
      </div>
    </div>
  );
};

const faderPctToGain = (pct: number): number => {
  if (pct <= 0) return 0;
  if (pct >= 1) return 2.0;
  if (pct < 0.2) {
    return (pct / 0.2) * 0.063;
  } else if (pct < 0.5) {
    return 0.063 + ((pct - 0.2) / 0.3) * (0.25 - 0.063);
  } else if (pct < 0.65) {
    return 0.25 + ((pct - 0.5) / 0.15) * (0.5 - 0.25);
  } else if (pct < 0.8) {
    return 0.5 + ((pct - 0.65) / 0.15) * (1.0 - 0.5);
  } else {
    return 1.0 + ((pct - 0.8) / 0.2) * (2.0 - 1.0);
  }
};

const gainToFaderPct = (gain: number): number => {
  if (gain <= 0) return 0;
  if (gain >= 2.0) return 1.0;
  if (gain < 0.063) {
    return (gain / 0.063) * 0.2;
  } else if (gain < 0.25) {
    return 0.2 + ((gain - 0.063) / (0.25 - 0.063)) * 0.3;
  } else if (gain < 0.5) {
    return 0.5 + ((gain - 0.25) / (0.5 - 0.25)) * 0.15;
  } else if (gain < 1.0) {
    return 0.65 + ((gain - 0.5) / (1.0 - 0.5)) * 0.15;
  } else {
    return 0.8 + ((gain - 1.0) / (2.0 - 1.0)) * 0.2;
  }
};

const SLOT_COLORS: { 
  [key: string]: { 
    label: string; 
    dot: string; 
    pastelBg: string; 
    pastelBorder: string; 
    pastelTitle: string; 
    pastelSub: string; 
    pastelPill: string;
    pastelBadge: string; 
    pastelGlow: string; 
    activeBg: string; 
    activeBadge: string; 
    activeTitle: string; 
    activeSub: string; 
    activePill: string;
    tabActive: string; 
    tabInactive: string; 
    bg: string; 
    btn: string; 
    active: string; 
    indicator: string; 
    text: string; 
  } 
} = {
  zinc: { 
    label: 'Cinza / Prata', 
    dot: 'bg-zinc-400', 
    pastelBg: 'bg-[#202528] hover:bg-[#282f33]',
    pastelBorder: 'border-zinc-500/60 hover:border-zinc-300 hover:shadow-[0_0_12px_rgba(228,228,231,0.25)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-zinc-300',
    pastelPill: 'bg-[#181d20] border-zinc-400 text-white shadow-[0_0_8px_rgba(228,228,231,0.25)]',
    pastelBadge: 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50',
    pastelGlow: 'bg-zinc-300/20',
    activeBg: 'bg-[#293035] border-2 border-zinc-200 shadow-[0_0_18px_rgba(228,228,231,0.5)]',
    activeBadge: 'bg-zinc-200 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-zinc-200',
    activePill: 'bg-zinc-200 text-zinc-950 border-white font-black shadow-[0_0_10px_rgba(255,255,255,0.6)]',
    tabActive: 'bg-zinc-200 text-zinc-950 border-white font-black shadow-[0_0_10px_rgba(255,255,255,0.4)]',
    tabInactive: 'bg-[#202528] border-zinc-500/60 text-zinc-300 hover:bg-[#282f33]',
    bg: 'bg-zinc-950 border-zinc-850 hover:bg-zinc-900 text-zinc-300', 
    btn: 'border-[#5e6b6d]/60 bg-[#202528] text-zinc-200',
    active: 'border-white bg-zinc-200 text-zinc-950 font-black shadow-[0_0_14px_rgba(255,255,255,0.6)]',
    indicator: 'bg-zinc-900',
    text: 'text-zinc-300'
  },
  emerald: { 
    label: 'Verde Menta', 
    dot: 'bg-emerald-500', 
    pastelBg: 'bg-[#18241f] hover:bg-[#202e28]',
    pastelBorder: 'border-emerald-500/60 hover:border-emerald-400 hover:shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-emerald-400',
    pastelPill: 'bg-[#103a29] border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]',
    pastelBadge: 'bg-[#124230] text-[#a7f3d0] border border-[#236e4f]/50',
    pastelGlow: 'bg-emerald-400/25',
    activeBg: 'bg-[#143325] border-2 border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.55)]',
    activeBadge: 'bg-emerald-500 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-emerald-300',
    activePill: 'bg-emerald-500 text-zinc-950 border-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.6)]',
    tabActive: 'bg-emerald-500 text-zinc-950 border-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.4)]',
    tabInactive: 'bg-[#18241f] border-emerald-500/60 text-[#86efac] hover:bg-[#202e28]',
    bg: 'bg-emerald-950/20 border-emerald-900 hover:bg-emerald-950/40 text-emerald-200', 
    btn: 'border-[#2d6e52]/60 bg-[#18241f] text-[#86efac]',
    active: 'border-emerald-300 bg-emerald-500 text-zinc-950 font-black shadow-[0_0_14px_rgba(16,185,129,0.6)]',
    indicator: 'bg-zinc-950',
    text: 'text-emerald-400'
  },
  sky: { 
    label: 'Azul Pastel', 
    dot: 'bg-sky-500', 
    pastelBg: 'bg-[#18222c] hover:bg-[#202c38]',
    pastelBorder: 'border-sky-500/60 hover:border-sky-400 hover:shadow-[0_0_12px_rgba(14,165,233,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-sky-400',
    pastelPill: 'bg-[#0e3550] border-sky-400 text-white shadow-[0_0_8px_rgba(14,165,233,0.4)]',
    pastelBadge: 'bg-[#113854] text-[#bae6fd] border border-[#1e5882]/50',
    pastelGlow: 'bg-sky-400/25',
    activeBg: 'bg-[#132c3f] border-2 border-sky-400 shadow-[0_0_18px_rgba(14,165,233,0.55)]',
    activeBadge: 'bg-sky-500 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-sky-300',
    activePill: 'bg-sky-500 text-zinc-950 border-sky-300 font-black shadow-[0_0_10px_rgba(14,165,233,0.6)]',
    tabActive: 'bg-sky-500 text-zinc-950 border-sky-300 font-black shadow-[0_0_10px_rgba(14,165,233,0.4)]',
    tabInactive: 'bg-[#18222c] border-sky-500/60 text-[#7dd3fc] hover:bg-[#202c38]',
    bg: 'bg-sky-950/20 border-sky-900 hover:bg-sky-950/40 text-sky-200', 
    btn: 'border-[#296287]/60 bg-[#18222c] text-[#7dd3fc]',
    active: 'border-sky-300 bg-sky-500 text-zinc-950 font-black shadow-[0_0_14px_rgba(14,165,233,0.6)]',
    indicator: 'bg-zinc-950',
    text: 'text-sky-400'
  },
  violet: { 
    label: 'Roxo Lavanda', 
    dot: 'bg-violet-500', 
    pastelBg: 'bg-[#211a2e] hover:bg-[#2a223a]',
    pastelBorder: 'border-violet-500/60 hover:border-violet-400 hover:shadow-[0_0_12px_rgba(139,92,246,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-violet-400',
    pastelPill: 'bg-[#2e1a4a] border-violet-400 text-white shadow-[0_0_8px_rgba(139,92,246,0.4)]',
    pastelBadge: 'bg-[#2e1b4a] text-[#ddd6fe] border border-[#492b75]/50',
    pastelGlow: 'bg-violet-400/25',
    activeBg: 'bg-[#2c1d42] border-2 border-violet-400 shadow-[0_0_18px_rgba(139,92,246,0.55)]',
    activeBadge: 'bg-violet-500 text-white font-black',
    activeTitle: 'text-white',
    activeSub: 'text-violet-300',
    activePill: 'bg-violet-500 text-white border-violet-300 font-black shadow-[0_0_10px_rgba(139,92,246,0.6)]',
    tabActive: 'bg-violet-600 text-white border-violet-300 font-black shadow-[0_0_10px_rgba(139,92,246,0.4)]',
    tabInactive: 'bg-[#211a2e] border-violet-500/60 text-[#c4b5fd] hover:bg-[#2a223a]',
    bg: 'bg-violet-950/20 border-violet-900 hover:bg-violet-950/40 text-violet-200', 
    btn: 'border-[#523b73]/60 bg-[#211a2e] text-[#c4b5fd]',
    active: 'border-violet-300 bg-violet-600 text-white font-black shadow-[0_0_14px_rgba(139,92,246,0.6)]',
    indicator: 'bg-white',
    text: 'text-violet-400'
  },
  orange: { 
    label: 'Laranja Pêssego', 
    dot: 'bg-orange-500', 
    pastelBg: 'bg-[#251e18] hover:bg-[#30271f]',
    pastelBorder: 'border-orange-500/60 hover:border-orange-400 hover:shadow-[0_0_12px_rgba(249,115,22,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-orange-400',
    pastelPill: 'bg-[#442310] border-orange-400 text-white shadow-[0_0_8px_rgba(249,115,22,0.4)]',
    pastelBadge: 'bg-[#4a2918] text-[#ffedd5] border border-[#753f22]/50',
    pastelGlow: 'bg-orange-400/25',
    activeBg: 'bg-[#332317] border-2 border-orange-400 shadow-[0_0_18px_rgba(249,115,22,0.55)]',
    activeBadge: 'bg-orange-500 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-orange-300',
    activePill: 'bg-orange-500 text-zinc-950 border-orange-300 font-black shadow-[0_0_10px_rgba(249,115,22,0.6)]',
    tabActive: 'bg-orange-500 text-zinc-950 border-orange-300 font-black shadow-[0_0_10px_rgba(249,115,22,0.4)]',
    tabInactive: 'bg-[#251e18] border-orange-500/60 text-[#fdba74] hover:bg-[#30271f]',
    bg: 'bg-orange-950/20 border-orange-900 hover:bg-orange-950/40 text-orange-200', 
    btn: 'border-[#78472d]/60 bg-[#251e18] text-[#fdba74]',
    active: 'border-orange-300 bg-orange-500 text-zinc-950 font-black shadow-[0_0_14px_rgba(249,115,22,0.6)]',
    indicator: 'bg-zinc-950',
    text: 'text-orange-400'
  },
  amber: { 
    label: 'Amarelo Creme', 
    dot: 'bg-amber-500', 
    pastelBg: 'bg-[#252218] hover:bg-[#302c1f]',
    pastelBorder: 'border-amber-400/70 hover:border-amber-300 hover:shadow-[0_0_12px_rgba(251,191,36,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-amber-300',
    pastelPill: 'bg-[#423610] border-amber-300 text-white shadow-[0_0_8px_rgba(251,191,36,0.4)]',
    pastelBadge: 'bg-[#453718] text-[#fef08a] border border-[#6e5525]/50',
    pastelGlow: 'bg-amber-300/25',
    activeBg: 'bg-[#362f16] border-2 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.55)]',
    activeBadge: 'bg-amber-400 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-amber-200',
    activePill: 'bg-amber-400 text-zinc-950 border-amber-200 font-black shadow-[0_0_10px_rgba(251,191,36,0.6)]',
    tabActive: 'bg-amber-400 text-zinc-950 border-amber-200 font-black shadow-[0_0_10px_rgba(251,191,36,0.4)]',
    tabInactive: 'bg-[#252218] border-amber-400/70 text-[#fde047] hover:bg-[#302c1f]',
    bg: 'bg-amber-950/20 border-amber-900 hover:bg-amber-950/40 text-amber-200', 
    btn: 'border-[#705a2e]/60 bg-[#252218] text-[#fde047]',
    active: 'border-amber-200 bg-amber-400 text-zinc-950 font-black shadow-[0_0_14px_rgba(251,191,36,0.6)]',
    indicator: 'bg-zinc-950',
    text: 'text-amber-400'
  },
  red: { 
    label: 'Vermelho Rosé', 
    dot: 'bg-red-500', 
    pastelBg: 'bg-[#261a1c] hover:bg-[#312225]',
    pastelBorder: 'border-red-500/60 hover:border-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-red-400',
    pastelPill: 'bg-[#42151b] border-red-400 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    pastelBadge: 'bg-[#4a1c24] text-[#ffe4e6] border border-[#752a36]/50',
    pastelGlow: 'bg-red-400/25',
    activeBg: 'bg-[#381a1f] border-2 border-red-400 shadow-[0_0_18px_rgba(239,68,68,0.55)]',
    activeBadge: 'bg-red-500 text-white font-black',
    activeTitle: 'text-white',
    activeSub: 'text-red-300',
    activePill: 'bg-red-500 text-white border-red-300 font-black shadow-[0_0_10px_rgba(239,68,68,0.6)]',
    tabActive: 'bg-red-500 text-white border-red-300 font-black shadow-[0_0_10px_rgba(239,68,68,0.4)]',
    tabInactive: 'bg-[#261a1c] border-red-500/60 text-[#fca5a5] hover:bg-[#312225]',
    bg: 'bg-red-950/20 border-red-900 hover:bg-red-950/40 text-red-200', 
    btn: 'border-[#78333e]/60 bg-[#261a1c] text-[#fca5a5]',
    active: 'border-red-300 bg-red-500 text-white font-black shadow-[0_0_14px_rgba(239,68,68,0.6)]',
    indicator: 'bg-white',
    text: 'text-red-400'
  },
  pink: { 
    label: 'Rosa Bebê', 
    dot: 'bg-pink-500', 
    pastelBg: 'bg-[#261a24] hover:bg-[#31212e]',
    pastelBorder: 'border-pink-500/60 hover:border-pink-400 hover:shadow-[0_0_12px_rgba(236,72,153,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-pink-400',
    pastelPill: 'bg-[#421538] border-pink-400 text-white shadow-[0_0_8px_rgba(236,72,153,0.4)]',
    pastelBadge: 'bg-[#4a1e3e] text-[#fce7f3] border border-[#752e61]/50',
    pastelGlow: 'bg-pink-400/25',
    activeBg: 'bg-[#381a30] border-2 border-pink-400 shadow-[0_0_18px_rgba(236,72,153,0.55)]',
    activeBadge: 'bg-pink-500 text-white font-black',
    activeTitle: 'text-white',
    activeSub: 'text-pink-300',
    activePill: 'bg-pink-500 text-white border-pink-300 font-black shadow-[0_0_10px_rgba(236,72,153,0.6)]',
    tabActive: 'bg-pink-500 text-white border-pink-300 font-black shadow-[0_0_10px_rgba(236,72,153,0.4)]',
    tabInactive: 'bg-[#261a24] border-pink-500/60 text-[#fbcfe8] hover:bg-[#31212e]',
    bg: 'bg-pink-950/20 border-pink-900 hover:bg-pink-950/40 text-pink-200', 
    btn: 'border-[#783864]/60 bg-[#261a24] text-[#fbcfe8]',
    active: 'border-pink-300 bg-pink-500 text-white font-black shadow-[0_0_14px_rgba(236,72,153,0.6)]',
    indicator: 'bg-white',
    text: 'text-pink-400'
  },
  cyan: { 
    label: 'Ciano Neon', 
    dot: 'bg-cyan-400', 
    pastelBg: 'bg-[#182326] hover:bg-[#202d31]',
    pastelBorder: 'border-cyan-500/60 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(6,182,212,0.35)]',
    pastelTitle: 'text-white',
    pastelSub: 'text-cyan-400',
    pastelPill: 'bg-[#0e3b42] border-cyan-400 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]',
    pastelBadge: 'bg-[#113d45] text-[#a5f3fc] border border-[#1e5863]/50',
    pastelGlow: 'bg-cyan-400/25',
    activeBg: 'bg-[#133138] border-2 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.55)]',
    activeBadge: 'bg-cyan-400 text-zinc-950 font-black',
    activeTitle: 'text-white',
    activeSub: 'text-cyan-300',
    activePill: 'bg-cyan-400 text-zinc-950 border-cyan-200 font-black shadow-[0_0_10px_rgba(6,182,212,0.6)]',
    tabActive: 'bg-cyan-400 text-zinc-950 border-cyan-200 font-black shadow-[0_0_10px_rgba(6,182,212,0.4)]',
    tabInactive: 'bg-[#182326] border-cyan-500/60 text-[#a5f3fc] hover:bg-[#202d31]',
    bg: 'bg-cyan-950/20 border-cyan-900 hover:bg-cyan-950/40 text-cyan-200', 
    btn: 'border-[#297887]/60 bg-[#182326] text-[#a5f3fc]',
    active: 'border-cyan-200 bg-cyan-400 text-zinc-950 font-black shadow-[0_0_14px_rgba(6,182,212,0.6)]',
    indicator: 'bg-zinc-950',
    text: 'text-cyan-400'
  }
};

const getSlotColorClasses = (colorName: string, isActive: boolean, isWriteMode: boolean) => {
  if (isWriteMode) {
    return 'border-red-500/40 bg-red-950/5 hover:bg-red-950/10 hover:border-red-500 text-red-200';
  }
  const info = SLOT_COLORS[colorName] || SLOT_COLORS.cyan;
  if (isActive) {
    return info.activeBg;
  }
  return `${info.pastelBg} ${info.pastelBorder}`;
};

export const MODXConsole: React.FC<MODXConsoleProps> = ({
  channels,
  onChannelsChange,
  reverbDecay,
  reverbMix,
  reverbPreDelay,
  reverbHighCut,
  onReverbChange,
  masterVolume,
  onMasterVolumeChange,
  loadedSoundFonts,
  onSoundFontsUploaded,
  onRemoveSoundFont,
  onRemoveMultipleSoundFonts,
  onSoundFontsReset,
  savedPresets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onPanic,
  voiceCount,
  audioActive,
  onToggleAudio,
  isSf2Loading = false,
  isDbLoading = false,
  preferredSampleRate,
  onSampleRateChange,
  sfCategories,
  onSfCategoriesChange,
  reverbBypass = false,
  onReverbBypassChange,
  chorusBypass,
  onChorusBypassChange,
  chorusRate,
  chorusDepth,
  chorusMix,
  onChorusChange,
  tremoloBypass,
  onTremoloBypassChange,
  tremoloRate,
  tremoloDepth,
  tremoloMode,
  onTremoloChange,
  auditioningSoundFont,
  onAuditioningSoundFontChange,
  onReloadSoundFontsFromDb,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('live-set');

  // Ref to preserve previous FX state (reverb mix and per-layer delay bypasses) when FX Master is toggled off
  const prevFxStateRef = useRef<{
    reverbMix: number;
    delayBypasses: boolean[];
  } | null>(null);

  // User toggle for showing hover tips, loaded/saved from localStorage
  const [showTips, setShowTips] = useState<boolean>(() => {
    const saved = localStorage.getItem('sf2_synth_show_tips');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('sf2_synth_show_tips', String(showTips));
  }, [showTips]);

  // Custom inline Toast notification state
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'warning' | 'info';
    isOpen: boolean;
  }>({ message: '', type: 'info', isOpen: false });

  const showNotification = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type, isOpen: true });
    // Auto-hide after 3.5 seconds
    setTimeout(() => {
      setNotification(prev => prev.message === message ? { ...prev, isOpen: false } : prev);
    }, 3500);
  };

  // Safe inline confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectingWaveformForLayer, setSelectingWaveformForLayer] = useState<number | null>(null);
  const [selectedWaveformCategory, setSelectedWaveformCategory] = useState<string | null>(null);
  
  const SF2_CATEGORIES = [
    'Piano', 'El Piano', 'Yamaha DX', 'Keyboard', 'Órgão', 'Acordion/Gaita', 
    'Ac Guitar', 'Guitar', 'Bass', 'Strings', 'Orquestra', 'Brass', 
    'Metais', 'Pad', 'Choir', 'Syn Lead', 'Sound FX', 'Percussão', 
    'Drum', 'Outros'
  ];
  
  const [selectedPerformanceId, setSelectedPerformanceId] = useState<string>('cfx_fm_ep');
  const [selectedPerformanceName, setSelectedPerformanceName] = useState<string>('CFX + FM EP 2');
  const [performanceCategory, setPerformanceCategory] = useState<string>('A.PIANO + FM LAYER');
  
  const [isMidiConnected, setIsMidiConnected] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformsFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Cut & Paste Routing state for channels
  const [copiedChannelConfig, setCopiedChannelConfig] = useState<ChannelState | null>(null);

  // Active channel parameter selection for focus highlighting
  const [activeParamFocus, setActiveParamFocus] = useState<[number, string] | null>([0, 'volume']);

  // Real dynamic VU meter polling loop (measures actual Web Audio node outputs in stereo dB)
  const [vuLevels, setVuLevels] = useState<number[]>([0, 0, 0, 0]);
  const [stereoVu, setStereoVu] = useState<{ channels: [number, number][]; master: [number, number] }>({
    channels: [[-100, -100], [-100, -100], [-100, -100], [-100, -100]],
    master: [-100, -100]
  });
  const [eqFrequencyData, setEqFrequencyData] = useState<Uint8Array>(new Uint8Array(32));

  useEffect(() => {
    let animId: number;
    const poll = () => {
      const isEngineRunning = synthEngineInstance.ctx && synthEngineInstance.ctx.state === 'running';
      if (audioActive || isEngineRunning) {
        setVuLevels(synthEngineInstance.getChannelLevels());
        setStereoVu(synthEngineInstance.getStereoLevels());
        if (activeTab === 'filters' || activeTab === 'eq') {
          const selectedIdx = activeParamFocus?.[0] ?? 0;
          setEqFrequencyData(synthEngineInstance.getChannelFrequencyData(selectedIdx));
        }
      } else {
        setVuLevels([0, 0, 0, 0]);
        setStereoVu({
          channels: [[-100, -100], [-100, -100], [-100, -100], [-100, -100]],
          master: [-100, -100]
        });
        setEqFrequencyData(new Uint8Array(32));
      }
      animId = requestAnimationFrame(poll);
    };
    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [audioActive, activeTab, activeParamFocus]);

  // Effect to seamlessly transfer Solo state when user changes active focused layer
  useEffect(() => {
    const focusedIdx = activeParamFocus?.[0] ?? 0;
    const isAnySolo = channels.some((ch) => ch.solo);
    if (isAnySolo && !channels[focusedIdx]?.solo) {
      const updated = channels.map((ch, idx) => ({
        ...ch,
        solo: idx === focusedIdx,
      }));
      onChannelsChange(updated);
    }
  }, [activeParamFocus?.[0]]);

  // Selected EQ band index for parametric controls
  const [selectedEqBandIdx, setSelectedEqBandIdx] = useState<number>(2);

  // Wheel drag states (preserved for background operations)
  const [dataWheelAngle, setDataWheelAngle] = useState<number>(0);
  const [isDraggingWheel, setIsDraggingWheel] = useState<boolean>(false);
  const startWheelPointerY = useRef<number>(0);
  const startWheelAngle = useRef<number>(0);

  // BPM and Tap states
  const [bpm, setBpm] = useState<number>(120);
  const lastTapTime = useRef<number>(0);

  // Live Set Context Menu and copy/paste states
  const [copiedSlotConfig, setCopiedSlotConfig] = useState<any | null>(null);
  const [contextMenuSlot, setContextMenuSlot] = useState<{ slotIndex: number; x: number; y: number } | null>(null);
  const [renameSlotTarget, setRenameSlotTarget] = useState<number | null>(null);
  const [renameForm, setRenameForm] = useState<{ name: string; category: string; badge: string }>({ name: '', category: '', badge: '' });

  // Layer copying/cutting/pasting and loading states
  const [copiedLayerData, setCopiedLayerData] = useState<ChannelState | null>(null);
  const [contextMenuLayer, setContextMenuLayer] = useState<{ layerIndex: number; x: number; y: number } | null>(null);
  const [decodingStatus, setDecodingStatus] = useState<{ name: string; progress: number; currentIdx: number; totalCount: number } | null>(null);
  const [listeningKeyRange, setListeningKeyRange] = useState<{ layerIndex: number; type: 'keyRangeMin' | 'keyRangeMax' } | null>(null);

  // SF2 Attributes (subcategories/tags) state & clipboard
  const [sfAttributes, setSfAttributes] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('modx_sf_attributes');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [copiedAttributes, setCopiedAttributes] = useState<string[] | null>(() => {
    try {
      const saved = localStorage.getItem('modx_copied_attributes');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const saveCopiedAttributes = (attrs: string[] | null) => {
    setCopiedAttributes(attrs);
    if (attrs) {
      localStorage.setItem('modx_copied_attributes', JSON.stringify(attrs));
    } else {
      localStorage.removeItem('modx_copied_attributes');
    }
  };

  const [cutSf2, setCutSf2] = useState<{ sfId: string; sfName: string } | null>(null);
  const [contextMenuCategory, setContextMenuCategory] = useState<{ categoryName: string; x: number; y: number } | null>(null);
  const [contextMenuSf, setContextMenuSf] = useState<{ sfId: string; sfName: string; x: number; y: number } | null>(null);
  const [attributeModalTarget, setAttributeModalTarget] = useState<{ sfId: string; sfName: string } | null>(null);
  const [attributeInputText, setAttributeInputText] = useState<string>('');

  // Quick Suggestions List (Sugestões Rápidas personalizáveis)
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf2_quick_suggestions_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set(parsed.map((s: string) => s.trim()).filter(Boolean)));
        }
      }
    } catch (e) {}
    return ['Acústico', 'Cama', 'DX', 'EP', 'String', 'Brass', 'Organ', 'Pad', 'Lead', 'Pluck', 'Bell', 'Guitar'];
  });

  const [newQuickSuggestionInput, setNewQuickSuggestionInput] = useState<string>('');
  const [showAddQuickSuggestionModal, setShowAddQuickSuggestionModal] = useState<boolean>(false);
  const [quickSuggestionContextMenu, setQuickSuggestionContextMenu] = useState<{ tag: string; x: number; y: number } | null>(null);

  const handleAddQuickSuggestion = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (quickSuggestions.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      showNotification(`A sugestão "${trimmed}" já existe!`, 'info');
      return;
    }
    const nextList = [...quickSuggestions, trimmed];
    setQuickSuggestions(nextList);
    try {
      localStorage.setItem('sf2_quick_suggestions_list', JSON.stringify(nextList));
    } catch (e) {}
    showNotification(`"${trimmed}" adicionada às Sugestões Rápidas!`, 'success');
  };

  const handleRemoveQuickSuggestion = (tagToRemove: string) => {
    const nextList = quickSuggestions.filter(t => t !== tagToRemove);
    setQuickSuggestions(nextList);
    try {
      localStorage.setItem('sf2_quick_suggestions_list', JSON.stringify(nextList));
    } catch (e) {}
    showNotification(`"${tagToRemove}" removida das Sugestões Rápidas!`, 'info');
  };

  const [attackMax1s, setAttackMax1s] = useState<boolean>(false);

  const handleToggleAttackMax1s = (val?: boolean) => {
    const nextVal = val !== undefined ? val : !attackMax1s;
    setAttackMax1s(nextVal);
    if (nextVal) {
      let updated = false;
      const nextCh = channels.map(ch => {
        if (ch.adsr.attack > 1.0) {
          updated = true;
          return { ...ch, adsr: { ...ch.adsr, attack: 1.0 } };
        }
        return ch;
      });
      if (updated) {
        onChannelsChange(nextCh);
      }
      showNotification('⚡ Range de Attack: 0 a 1.0s Ativado! (Alta precisão para MIDI e Knobs)', 'success');
    } else {
      showNotification('Range de Attack: 0 a 3.0s Restaurado (Padrão)', 'info');
    }
  };

  const handleToggleSearchTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (!sfSearchQuery.trim()) {
      setSfSearchQuery(trimmed);
      return;
    }
    const currentTerms = sfSearchQuery.split(/[,]+/).map(s => s.trim()).filter(Boolean);
    const tagLower = trimmed.toLowerCase();
    const index = currentTerms.findIndex(t => t.toLowerCase() === tagLower);
    if (index >= 0) {
      currentTerms.splice(index, 1);
      setSfSearchQuery(currentTerms.join(', '));
    } else {
      currentTerms.push(trimmed);
      setSfSearchQuery(currentTerms.join(', '));
    }
  };

  const updateSfAttributes = (sfId: string, attrs: string[]) => {
    const next = { ...sfAttributes, [sfId]: attrs };
    setSfAttributes(next);
    localStorage.setItem('modx_sf_attributes', JSON.stringify(next));
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenuSf(null);
      setContextMenuLayer(null);
      setContextMenuCategory(null);
      setQuickSuggestionContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // FX & Filter Presets System (Presets e User nos filtros e efeitos)
  const LOCAL_STORAGE_FX_KEY = 'sf2_synth_fx_presets_v2';
  const [fxPresets, setFxPresets] = useState<any[]>([]);
  const [newFxPresetName, setNewFxPresetName] = useState('');
  const [selectedFxPresetId, setSelectedFxPresetId] = useState('');

  // Individual Preset States & Factory presets for ADSR, EQ, Biquad, Reverb
  const LOCAL_STORAGE_ADSR_PRESETS_KEY = 'sf2_synth_adsr_presets_v2';
  const [adsrPresets, setAdsrPresets] = useState<any[]>([]);
  const [newAdsrPresetName, setNewAdsrPresetName] = useState('');
  const [selectedAdsrPresetId, setSelectedAdsrPresetId] = useState('');

  const factoryAdsrTemplates = [
    { id: 'adsr_factory_std', name: '🎹 ADSR Padrão', adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 } },
    { id: 'adsr_factory_piano', name: '🎹 Piano Clássico', adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 } },
    { id: 'adsr_factory_slow_pad', name: '🌫️ Slow Pad (Suave)', adsr: { attack: 1.5, decay: 1.5, sustain: 90, release: 1.8 } },
    { id: 'adsr_factory_pluck', name: '⚡ Pluck (Rápido/Curto)', adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.18 } },
    { id: 'adsr_factory_organ', name: '🎛️ Órgão (Imediato)', adsr: { attack: 0.01, decay: 0.1, sustain: 100, release: 0.1 } },
    { id: 'adsr_factory_fast_pad', name: '☁️ Fast Pad Medium', adsr: { attack: 0.3, decay: 0.8, sustain: 80, release: 1.0 } },
    { id: 'adsr_factory_long_release', name: '🔔 Long Release', adsr: { attack: 0.1, decay: 0.4, sustain: 85, release: 3.5 } },
  ];

  const LOCAL_STORAGE_EQ_PRESETS_KEY = 'sf2_synth_eq_presets_v2';
  const [eqPresets, setEqPresets] = useState<any[]>([]);
  const [newEqPresetName, setNewEqPresetName] = useState('');
  const [selectedEqPresetId, setSelectedEqPresetId] = useState('');

  const factoryEqTemplates = [
    { id: 'eq_factory_flat', name: '🎛️ Padrão (Flat)', eqBands: [0, 0, 0, 0, 0] },
    { id: 'eq_factory_bass', name: '🔊 Reforço Graves', eqBands: [5, 2, 0, -1, -2] },
    { id: 'eq_factory_treble', name: '🎼 Reforço Agudos', eqBands: [-3, -1, 1, 3, 5] },
    { id: 'eq_factory_mid', name: '🎙️ Voz Humana (Mids)', eqBands: [-2, 1, 4, 2, -1] },
    { id: 'eq_factory_bright', name: '✨ Brilhante', eqBands: [1, 0, 1, 3, 6] },
    { id: 'eq_factory_rock', name: '🎸 Rock', eqBands: [4, 2, -2, 2, 4] },
    { id: 'eq_factory_classical', name: '🎻 Clássico', eqBands: [3, 1, -1, 1, 3] },
  ];

  const LOCAL_STORAGE_FILTER_PRESETS_KEY = 'sf2_synth_filter_presets_v2';
  const [filterPresets, setFilterPresets] = useState<any[]>([]);
  const [newFilterPresetName, setNewFilterPresetName] = useState('');
  const [selectedFilterPresetId, setSelectedFilterPresetId] = useState('');

  const factoryFilterTemplates = [
    { id: 'filter_factory_open', name: '🟢 Padrão (Aberto)', type: 'lowpass' as const, cutoff: 20000, resonance: 0 },
    { id: 'filter_factory_soft_lp', name: '🎛️ Abafado (Lowpass Soft)', type: 'lowpass' as const, cutoff: 1200, resonance: 1.0 },
    { id: 'filter_factory_sharp_hp', name: '⚡ Varrido Agudo (Highpass)', type: 'highpass' as const, cutoff: 350, resonance: 2.0 },
    { id: 'filter_factory_narrow_bp', name: '📞 Telefone (Bandpass)', type: 'bandpass' as const, cutoff: 1000, resonance: 4.0 },
    { id: 'filter_factory_megaphone', name: '📣 Megafone', type: 'bandpass' as const, cutoff: 1800, resonance: 1.5 },
    { id: 'filter_factory_sub', name: '🔈 Sub-Bass Focus', type: 'lowpass' as const, cutoff: 200, resonance: 3.0 },
    { id: 'filter_factory_acid', name: '🧪 Acid Sweeper', type: 'lowpass' as const, cutoff: 2500, resonance: 6.0 },
  ];

  const LOCAL_STORAGE_REVERB_PRESETS_KEY = 'sf2_synth_reverb_presets_v2';
  const [reverbPresets, setReverbPresets] = useState<any[]>([]);
  const [newReverbPresetName, setNewReverbPresetName] = useState('');
  const [selectedReverbPresetId, setSelectedReverbPresetId] = useState('');

  const factoryReverbTemplates = [
    { id: 'reverb_factory_std', name: '🏛️ Hall Studio SF2 (Rico & Amplo)', decay: 2.8, mix: 0.32, preDelay: 0.02, highCut: 7500 },
    { id: 'reverb_factory_cathedral', name: '🌌 Catedral Gótica (Épico & Imersivo)', decay: 5.5, mix: 0.48, preDelay: 0.05, highCut: 5000 },
    { id: 'reverb_factory_arena', name: '🏟️ Arena Concert Hall', decay: 3.8, mix: 0.38, preDelay: 0.035, highCut: 6000 },
    { id: 'reverb_factory_plate', name: '🎙️ Lexicon Studio Plate (Aveludado)', decay: 2.2, mix: 0.35, preDelay: 0.012, highCut: 9000 },
    { id: 'reverb_factory_studio', name: '🏠 Sala Acústica Warm (Intimo)', decay: 1.2, mix: 0.22, preDelay: 0.008, highCut: 8000 },
    { id: 'reverb_factory_space', name: '🌠 Espaço Sideral Ethereal', decay: 8.5, mix: 0.58, preDelay: 0.08, highCut: 4500 },
    { id: 'reverb_factory_spring', name: '🌀 Mola Vintage Amp (Spring)', decay: 1.8, mix: 0.35, preDelay: 0.005, highCut: 3500 },
  ];

  const LOCAL_STORAGE_CHORUS_PRESETS_KEY = 'sf2_synth_chorus_presets';
  const [chorusPresets, setChorusPresets] = useState<any[]>([]);
  const [newChorusPresetName, setNewChorusPresetName] = useState('');
  const [selectedChorusPresetId, setSelectedChorusPresetId] = useState('');

  const factoryChorusTemplates = [
    { id: 'chorus_factory_std', name: '🌀 Padrão', rate: 1.5, depth: 0.3, mix: 0.45 },
    { id: 'chorus_factory_slow', name: '🌌 Lento e Profundo', rate: 0.5, depth: 0.8, mix: 0.6 },
    { id: 'chorus_factory_vibrato', name: '⚡ Vibrato Rápido', rate: 6.0, depth: 0.15, mix: 0.35 },
    { id: 'chorus_factory_wide', name: '🪐 Espaço Amplo', rate: 0.2, depth: 0.9, mix: 0.5 }
  ];

  const LOCAL_STORAGE_TREMOLO_PRESETS_KEY = 'sf2_synth_tremolo_presets';
  const [tremoloPresets, setTremoloPresets] = useState<any[]>([]);
  const [newTremoloPresetName, setNewTremoloPresetName] = useState('');
  const [selectedTremoloPresetId, setSelectedTremoloPresetId] = useState('');

  const factoryTremoloTemplates = [
    { id: 'tremolo_factory_std', name: '⚡ Padrão', rate: 5.0, depth: 0.5 },
    { id: 'tremolo_factory_slow', name: '🌊 Onda Lenta', rate: 1.0, depth: 0.8 },
    { id: 'tremolo_factory_heli', name: '🚁 Helicóptero', rate: 12.0, depth: 0.9 },
    { id: 'tremolo_factory_soft', name: '🍃 Tremor Suave', rate: 7.5, depth: 0.2 }
  ];

  const factoryTemplates = [
    {
      id: 'template_piano_natural',
      name: '🎹 Piano Clássico (Natural)',
      reverbDecay: 2.0,
      reverbMix: 0.18,
      channelsData: Array(4).fill(null).map(() => ({
        filterType: 'lowpass' as const,
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
        filterType: 'lowpass' as const,
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
        filterType: 'lowpass' as const,
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
        filterType: 'lowpass' as const,
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
        filterType: 'highpass' as const,
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

    const rawAdsr = localStorage.getItem(LOCAL_STORAGE_ADSR_PRESETS_KEY);
    if (rawAdsr) {
      try { setAdsrPresets(JSON.parse(rawAdsr)); } catch (e) {}
    }
    const rawEq = localStorage.getItem(LOCAL_STORAGE_EQ_PRESETS_KEY);
    if (rawEq) {
      try { setEqPresets(JSON.parse(rawEq)); } catch (e) {}
    }
    const rawFilter = localStorage.getItem(LOCAL_STORAGE_FILTER_PRESETS_KEY);
    if (rawFilter) {
      try { setFilterPresets(JSON.parse(rawFilter)); } catch (e) {}
    }
    const rawReverb = localStorage.getItem(LOCAL_STORAGE_REVERB_PRESETS_KEY);
    if (rawReverb) {
      try { setReverbPresets(JSON.parse(rawReverb)); } catch (e) {}
    }
    const rawChorus = localStorage.getItem(LOCAL_STORAGE_CHORUS_PRESETS_KEY);
    if (rawChorus) {
      try { setChorusPresets(JSON.parse(rawChorus)); } catch (e) {}
    }
    const rawTremolo = localStorage.getItem(LOCAL_STORAGE_TREMOLO_PRESETS_KEY);
    if (rawTremolo) {
      try { setTremoloPresets(JSON.parse(rawTremolo)); } catch (e) {}
    }
  }, []);

  // ADSR Individual Presets
  const handleLoadAdsrPreset = (id: string, channelIdx: number) => {
    if (!id) {
      setSelectedAdsrPresetId('');
      return;
    }
    const preset = [...factoryAdsrTemplates, ...adsrPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedAdsrPresetId(id);
    const nextCh = [...channels];
    nextCh[channelIdx] = {
      ...nextCh[channelIdx],
      adsr: { ...preset.adsr }
    };
    onChannelsChange(nextCh);
    showNotification(`Preset ADSR "${preset.name}" carregado!`, 'success');
  };

  const handleSaveAdsrPreset = (name: string, channelIdx: number) => {
    if (!name.trim()) return;
    const targetAdsr = channels[channelIdx].adsr;
    const newPreset = {
      id: 'user_adsr_' + Date.now(),
      name: '👤 ' + name.trim(),
      adsr: { ...targetAdsr }
    };
    const next = [...adsrPresets, newPreset];
    setAdsrPresets(next);
    localStorage.setItem(LOCAL_STORAGE_ADSR_PRESETS_KEY, JSON.stringify(next));
    setSelectedAdsrPresetId(newPreset.id);
    setNewAdsrPresetName('');
    showNotification(`Preset ADSR "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteAdsrPreset = (id: string) => {
    const next = adsrPresets.filter(p => p.id !== id);
    setAdsrPresets(next);
    localStorage.setItem(LOCAL_STORAGE_ADSR_PRESETS_KEY, JSON.stringify(next));
    if (selectedAdsrPresetId === id) {
      setSelectedAdsrPresetId('');
    }
    showNotification('Preset ADSR removido!', 'info');
  };

  // EQ Individual Presets
  const handleLoadEqPreset = (id: string, channelIdx: number) => {
    if (!id) {
      setSelectedEqPresetId('');
      return;
    }
    const preset = [...factoryEqTemplates, ...eqPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedEqPresetId(id);
    const nextCh = [...channels];
    const current = nextCh[channelIdx];
    
    const nextBands = current.eqBands ? current.eqBands.map((band, bIdx) => {
      return {
        ...band,
        gain: preset.eqBands[bIdx] ?? 0
      };
    }) : undefined;

    nextCh[channelIdx] = {
      ...current,
      eqLow: preset.eqBands[0],
      eqMid: preset.eqBands[2],
      eqHigh: preset.eqBands[4],
      eqBands: nextBands
    };
    onChannelsChange(nextCh);
    showNotification(`Preset EQ "${preset.name}" carregado!`, 'success');
  };

  const handleSaveEqPreset = (name: string, channelIdx: number) => {
    if (!name.trim()) return;
    const current = channels[channelIdx];
    const gains = current.eqBands ? current.eqBands.map(b => b.gain) : [current.eqLow ?? 0, 0, current.eqMid ?? 0, 0, current.eqHigh ?? 0];
    const newPreset = {
      id: 'user_eq_' + Date.now(),
      name: '👤 ' + name.trim(),
      eqBands: [...gains]
    };
    const next = [...eqPresets, newPreset];
    setEqPresets(next);
    localStorage.setItem(LOCAL_STORAGE_EQ_PRESETS_KEY, JSON.stringify(next));
    setSelectedEqPresetId(newPreset.id);
    setNewEqPresetName('');
    showNotification(`Preset EQ "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteEqPreset = (id: string) => {
    const next = eqPresets.filter(p => p.id !== id);
    setEqPresets(next);
    localStorage.setItem(LOCAL_STORAGE_EQ_PRESETS_KEY, JSON.stringify(next));
    if (selectedEqPresetId === id) {
      setSelectedEqPresetId('');
    }
    showNotification('Preset EQ removido!', 'info');
  };

  // Filter Individual Presets
  const handleLoadFilterPreset = (id: string, channelIdx: number) => {
    if (!id) {
      setSelectedFilterPresetId('');
      return;
    }
    const preset = [...factoryFilterTemplates, ...filterPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedFilterPresetId(id);
    const nextCh = [...channels];
    nextCh[channelIdx] = {
      ...nextCh[channelIdx],
      filterType: preset.type,
      filterCutoff: preset.cutoff,
      filterResonance: preset.resonance
    };
    onChannelsChange(nextCh);
    showNotification(`Preset Filtro "${preset.name}" carregado!`, 'success');
  };

  const handleSaveFilterPreset = (name: string, channelIdx: number) => {
    if (!name.trim()) return;
    const current = channels[channelIdx];
    const newPreset = {
      id: 'user_filter_' + Date.now(),
      name: '👤 ' + name.trim(),
      type: current.filterType,
      cutoff: current.filterCutoff,
      resonance: current.filterResonance
    };
    const next = [...filterPresets, newPreset];
    setFilterPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FILTER_PRESETS_KEY, JSON.stringify(next));
    setSelectedFilterPresetId(newPreset.id);
    setNewFilterPresetName('');
    showNotification(`Preset Filtro "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteFilterPreset = (id: string) => {
    const next = filterPresets.filter(p => p.id !== id);
    setFilterPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FILTER_PRESETS_KEY, JSON.stringify(next));
    if (selectedFilterPresetId === id) {
      setSelectedFilterPresetId('');
    }
    showNotification('Preset Filtro removido!', 'info');
  };

  // Reverb Individual Presets
  const handleLoadReverbPreset = (id: string) => {
    if (!id) {
      setSelectedReverbPresetId('');
      return;
    }
    const preset = [...factoryReverbTemplates, ...reverbPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedReverbPresetId(id);
    onReverbChange(preset.decay, preset.mix, preset.preDelay, preset.highCut);
    showNotification(`Preset Reverb "${preset.name}" carregado!`, 'success');
  };

  const handleSaveReverbPreset = (name: string) => {
    if (!name.trim()) return;
    const newPreset = {
      id: 'user_reverb_' + Date.now(),
      name: '👤 ' + name.trim(),
      decay: reverbDecay,
      mix: reverbMix,
      preDelay: reverbPreDelay,
      highCut: reverbHighCut
    };
    const next = [...reverbPresets, newPreset];
    setReverbPresets(next);
    localStorage.setItem(LOCAL_STORAGE_REVERB_PRESETS_KEY, JSON.stringify(next));
    setSelectedReverbPresetId(newPreset.id);
    setNewReverbPresetName('');
    showNotification(`Preset Reverb "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteReverbPreset = (id: string) => {
    const next = reverbPresets.filter(p => p.id !== id);
    setReverbPresets(next);
    localStorage.setItem(LOCAL_STORAGE_REVERB_PRESETS_KEY, JSON.stringify(next));
    if (selectedReverbPresetId === id) {
      setSelectedReverbPresetId('');
    }
    showNotification('Preset Reverb removido!', 'info');
  };

  // Chorus Individual Presets
  const handleLoadChorusPreset = (id: string, channelIdx: number) => {
    if (!id) {
      setSelectedChorusPresetId('');
      return;
    }
    const preset = [...factoryChorusTemplates, ...chorusPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedChorusPresetId(id);
    const nextCh = [...channels];
    nextCh[channelIdx] = {
      ...channels[channelIdx],
      chorusBypass: false,
      chorusRate: preset.rate,
      chorusDepth: preset.depth,
      chorusMix: preset.mix
    };
    onChannelsChange(nextCh);
    showNotification(`Preset Chorus "${preset.name}" carregado no Layer 0${channelIdx + 1}!`, 'success');
  };

  const handleSaveChorusPreset = (name: string, channelIdx: number) => {
    if (!name.trim()) return;
    const current = channels[channelIdx];
    const rateVal = current.chorusRate ?? 1.5;
    const depthVal = current.chorusDepth ?? 0.3;
    const mixVal = current.chorusMix ?? 0.45;
    const newPreset = {
      id: 'user_chorus_' + Date.now(),
      name: '👤 ' + name.trim(),
      rate: rateVal,
      depth: depthVal,
      mix: mixVal
    };
    const next = [...chorusPresets, newPreset];
    setChorusPresets(next);
    localStorage.setItem(LOCAL_STORAGE_CHORUS_PRESETS_KEY, JSON.stringify(next));
    setSelectedChorusPresetId(newPreset.id);
    setNewChorusPresetName('');
    showNotification(`Preset Chorus "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteChorusPreset = (id: string) => {
    const next = chorusPresets.filter(p => p.id !== id);
    setChorusPresets(next);
    localStorage.setItem(LOCAL_STORAGE_CHORUS_PRESETS_KEY, JSON.stringify(next));
    if (selectedChorusPresetId === id) {
      setSelectedChorusPresetId('');
    }
    showNotification('Preset Chorus removido!', 'info');
  };

  // Tremolo Individual Presets
  const handleLoadTremoloPreset = (id: string, channelIdx: number) => {
    if (!id) {
      setSelectedTremoloPresetId('');
      return;
    }
    const preset = [...factoryTremoloTemplates, ...tremoloPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedTremoloPresetId(id);
    const nextCh = [...channels];
    nextCh[channelIdx] = {
      ...channels[channelIdx],
      tremoloBypass: false,
      tremoloRate: preset.rate,
      tremoloDepth: preset.depth,
      tremoloMode: preset.mode ?? 'volume'
    };
    onChannelsChange(nextCh);
    showNotification(`Preset Tremolo "${preset.name}" carregado no Layer 0${channelIdx + 1}!`, 'success');
  };

  const handleSaveTremoloPreset = (name: string, channelIdx: number) => {
    if (!name.trim()) return;
    const current = channels[channelIdx];
    const rateVal = current.tremoloRate ?? 5.0;
    const depthVal = current.tremoloDepth ?? 0.5;
    const modeVal = current.tremoloMode ?? 'volume';
    const newPreset = {
      id: 'user_tremolo_' + Date.now(),
      name: '👤 ' + name.trim(),
      rate: rateVal,
      depth: depthVal,
      mode: modeVal
    };
    const next = [...tremoloPresets, newPreset];
    setTremoloPresets(next);
    localStorage.setItem(LOCAL_STORAGE_TREMOLO_PRESETS_KEY, JSON.stringify(next));
    setSelectedTremoloPresetId(newPreset.id);
    setNewTremoloPresetName('');
    showNotification(`Preset Tremolo "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteTremoloPreset = (id: string) => {
    const next = tremoloPresets.filter(p => p.id !== id);
    setTremoloPresets(next);
    localStorage.setItem(LOCAL_STORAGE_TREMOLO_PRESETS_KEY, JSON.stringify(next));
    if (selectedTremoloPresetId === id) {
      setSelectedTremoloPresetId('');
    }
    showNotification('Preset Tremolo removido!', 'info');
  };

  const handleLoadFXPreset = (id: string) => {
    if (!id) {
      setSelectedFxPresetId('');
      return;
    }
    const preset = [...factoryTemplates, ...fxPresets].find(p => p.id === id);
    if (!preset) return;

    setSelectedFxPresetId(id);

    const next = channels.map((ch, idx) => {
      const pData = preset.channelsData[idx] || preset.channelsData[0]; // fallback to first
      return {
        ...ch,
        filterType: pData.filterType,
        filterCutoff: pData.filterCutoff,
        filterResonance: pData.filterResonance,
        eqLow: pData.eqLow,
        eqMid: pData.eqMid,
        eqHigh: pData.eqHigh,
        eqBands: ch.eqBands ? ch.eqBands.map((b, bIdx) => {
          if (bIdx === 0) return { ...b, gain: pData.eqLow ?? 0 };
          if (bIdx === 2) return { ...b, gain: pData.eqMid ?? 0 };
          if (bIdx === 4) return { ...b, gain: pData.eqHigh ?? 0 };
          return b;
        }) : undefined,
        adsr: { ...pData.adsr },
        reverbSend: pData.reverbSend,
      };
    });

    onChannelsChange(next);
    onReverbChange(preset.reverbDecay, preset.reverbMix, reverbPreDelay, reverbHighCut);
    showNotification(`Preset de efeitos "${preset.name}" carregado!`, 'success');
  };

  const handleSaveFXPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFxPresetName.trim()) return;

    const newPreset = {
      id: 'user_fx_' + Date.now(),
      name: '👤 ' + newFxPresetName.trim(),
      reverbDecay,
      reverbMix,
      channelsData: channels.map(ch => ({
        filterType: ch.filterType,
        filterCutoff: ch.filterCutoff,
        filterResonance: ch.filterResonance,
        eqLow: ch.eqBands?.[0]?.gain ?? ch.eqLow ?? 0,
        eqMid: ch.eqBands?.[2]?.gain ?? ch.eqMid ?? 0,
        eqHigh: ch.eqBands?.[4]?.gain ?? ch.eqHigh ?? 0,
        adsr: { ...ch.adsr },
        reverbSend: ch.reverbSend,
      })),
    };

    const next = [...fxPresets, newPreset];
    setFxPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FX_KEY, JSON.stringify(next));
    setSelectedFxPresetId(newPreset.id);
    setNewFxPresetName('');
    showNotification(`Preset de efeitos "${newPreset.name}" gravado!`, 'success');
  };

  const handleDeleteFXPreset = (id: string) => {
    const next = fxPresets.filter(p => p.id !== id);
    setFxPresets(next);
    localStorage.setItem(LOCAL_STORAGE_FX_KEY, JSON.stringify(next));
    if (selectedFxPresetId === id) {
      setSelectedFxPresetId('');
    }
    showNotification('Preset de efeitos removido!', 'info');
  };

  const handlePreviewSoundFont = async (sf: any) => {
    if (!sf) return;
    const sfIdx = loadedSoundFonts.findIndex(item => item && (item.id === sf.id || item.name === sf.name));
    if (sfIdx === -1) {
      showNotification('SoundFont não encontrado na memória.', 'warning');
      return;
    }
    
    if (!audioActive) {
      onToggleAudio();
    }

    if (synthEngineInstance.ctx && synthEngineInstance.ctx.state === 'suspended') {
      try {
        await synthEngineInstance.ctx.resume();
      } catch (e) {}
    }

    const targetLayer = selectingWaveformForLayer !== null ? selectingWaveformForLayer : (activeParamFocus?.[0] ?? 0);
    
    // Toggle auditioning if clicking the same soundfont that is already active
    if (auditioningSoundFont && auditioningSoundFont.layerIndex === targetLayer && (auditioningSoundFont.soundfontId === sf.id || auditioningSoundFont.soundfontName === sf.name)) {
      if (onAuditioningSoundFontChange) {
        onAuditioningSoundFontChange(null);
      }
      showNotification(`Pré-escuta de "${sf.name}" desativada.`, 'info');
      return;
    }

    let savedGain = 1.0;
    try {
      const storedGains = JSON.parse(localStorage.getItem('sf2_custom_gains') || '{}');
      savedGain = storedGains[sf.id] || storedGains[sf.name] || 1.0;
    } catch (err) {}

    const savedConfig = getSF2SavedConfig(sf.id);

    const baseVol = savedConfig?.volume ?? channels[targetLayer]?.volume ?? 0.8;
    const auditionVol = baseVol > 0.05 ? baseVol : 0.8;

    const tempChannelState = {
      ...channels[targetLayer],
      soundfontIndex: sfIdx,
      soundfontId: sf.id,
      soundfontName: sf.name,
      soundfontGain: savedConfig?.soundfontGain ?? savedGain ?? 1.0,
      volume: auditionVol,
      mute: false,
      pan: savedConfig?.pan ?? channels[targetLayer]?.pan ?? 0,
      filterCutoff: savedConfig?.filterCutoff ?? channels[targetLayer]?.filterCutoff ?? 18000,
      filterResonance: savedConfig?.filterResonance ?? channels[targetLayer]?.filterResonance ?? 1,
      filterType: savedConfig?.filterType ?? channels[targetLayer]?.filterType ?? 'lowpass',
      adsr: savedConfig?.adsr ? { ...savedConfig.adsr } : { ...channels[targetLayer]?.adsr },
      reverbSend: savedConfig?.reverbSend ?? channels[targetLayer]?.reverbSend ?? 0.2,
      chorusMix: savedConfig?.chorusMix ?? channels[targetLayer]?.chorusMix ?? 0,
      octaveOffset: savedConfig?.octaveOffset ?? channels[targetLayer]?.octaveOffset ?? 0,
      midiSensitivity: savedConfig?.midiSensitivity ?? channels[targetLayer]?.midiSensitivity ?? 1,
      eqLow: savedConfig?.eqLow ?? channels[targetLayer]?.eqLow ?? 0,
      eqMid: savedConfig?.eqMid ?? channels[targetLayer]?.eqMid ?? 0,
      eqHigh: savedConfig?.eqHigh ?? channels[targetLayer]?.eqHigh ?? 0,
      presetIndex: savedConfig?.presetIndex ?? 0,
      routingEnabled: true,
    };

    if (onAuditioningSoundFontChange) {
      onAuditioningSoundFontChange({
        layerIndex: targetLayer,
        soundfontIndex: sfIdx,
        soundfontId: sf.id,
        soundfontName: sf.name,
        soundfontGain: savedConfig?.soundfontGain ?? savedGain ?? 1.0,
      });
    }

    // Ensure this soundfont is loaded into RAM before sounding so default piano (S700) never plays
    if (!synthEngineInstance.soundFonts[sfIdx]) {
      try {
        const data = await loadSoundFontData(sf.id);
        if (data) {
          const parser = new SF2Parser(data);
          const parsed = parser.parse();
          parsed.id = sf.id;
          parsed.name = sf.name;
          synthEngineInstance.soundFonts[sfIdx] = parsed;
          (synthEngineInstance as any).linkSoundFontStructure(parsed);
        }
      } catch (err) {
        console.error('Erro ao carregar SoundFont para preview:', err);
      }
    }

    if (!synthEngineInstance.soundFonts[sfIdx]) {
      return;
    }

    // Play C4 (midi 60) for preview
    synthEngineInstance.noteOn(targetLayer, 60, 100, tempChannelState);
    setTimeout(() => {
      synthEngineInstance.noteOff(targetLayer, 60, tempChannelState.adsr, tempChannelState);
    }, 450);
  };

  // Auto-save active SF2 parameter tweaks to localStorage under 'sf2_saved_configs'
  useEffect(() => {
    if (!channels || channels.length === 0) return;
    try {
      const raw = localStorage.getItem('sf2_saved_configs');
      const sfConfigs = raw ? JSON.parse(raw) : {};
      let changed = false;

      channels.forEach((ch) => {
        if (ch.soundfontId) {
          sfConfigs[ch.soundfontId] = {
            soundfontGain: ch.soundfontGain,
            volume: ch.volume,
            pan: ch.pan,
            filterCutoff: ch.filterCutoff,
            filterResonance: ch.filterResonance,
            filterType: ch.filterType,
            adsr: { ...ch.adsr },
            reverbSend: ch.reverbSend,
            chorusMix: ch.chorusMix,
            octaveOffset: ch.octaveOffset,
            midiSensitivity: ch.midiSensitivity,
            eqLow: ch.eqLow,
            eqMid: ch.eqMid,
            eqHigh: ch.eqHigh,
            presetIndex: ch.presetIndex ?? 0,
            updatedAt: Date.now()
          };
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem('sf2_saved_configs', JSON.stringify(sfConfigs));
      }
    } catch (err) {
      console.error('Erro ao auto-salvar estado do SF2:', err);
    }
  }, [channels]);

  useEffect(() => {
    if (activeTab !== 'waveforms' && onAuditioningSoundFontChange) {
      onAuditioningSoundFontChange(null);
    }
  }, [activeTab, onAuditioningSoundFontChange]);

  useEffect(() => {
    if (selectedWaveformCategory === null && onAuditioningSoundFontChange) {
      onAuditioningSoundFontChange(null);
    }
  }, [selectedWaveformCategory, onAuditioningSoundFontChange]);

  // Bank management custom names and colors
  const [contextMenuBank, setContextMenuBank] = useState<{ bankIndex: number; x: number; y: number } | null>(null);
  const [renameBankTarget, setRenameBankTarget] = useState<number | null>(null);
  const [renameBankName, setRenameBankName] = useState<string>('');

  const [userBankCount, setUserBankCount] = useState<number>(() => {
    const raw = localStorage.getItem('sf2_synth_user_bank_count_v5');
    if (raw) {
      try {
        const parsed = parseInt(raw, 10);
        if (parsed >= 4) return parsed;
      } catch (e) {}
    }
    return 4; // Initial 4 USER banks (USER 1, USER 2, USER 3, USER 4)
  });

  useEffect(() => {
    localStorage.setItem('sf2_synth_user_bank_count_v5', userBankCount.toString());
  }, [userBankCount]);

  const [bankNames, setBankNames] = useState<{ [bankIndex: number]: string }>(() => {
    const raw = localStorage.getItem('sf2_synth_bank_names');
    const defaults: { [key: number]: string } = {};
    for (let i = 1; i <= Math.max(4, userBankCount); i++) {
      defaults[i] = `USER ${i}`;
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if ('0' in parsed && !('1' in parsed)) {
          const migrated: { [key: number]: string } = {};
          for (let i = 1; i <= 26; i++) {
            migrated[i] = parsed[i - 1] || `USER ${i}`;
          }
          return migrated;
        }
        return { ...defaults, ...parsed };
      } catch (e) {}
    }
    return defaults;
  });

  const [bankColors, setBankColors] = useState<{ [bankIndex: number]: string }>(() => {
    const raw = localStorage.getItem('sf2_synth_bank_colors');
    const defaults: { [key: number]: string } = {};
    for (let i = 1; i <= Math.max(4, userBankCount); i++) {
      defaults[i] = 'emerald';
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if ('0' in parsed && !('1' in parsed)) {
          const migrated: { [key: number]: string } = {};
          for (let i = 1; i <= 26; i++) {
            migrated[i] = parsed[i - 1] || 'emerald';
          }
          return migrated;
        }
        return { ...defaults, ...parsed };
      } catch (e) {}
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem('sf2_synth_bank_names', JSON.stringify(bankNames));
  }, [bankNames]);

  useEffect(() => {
    localStorage.setItem('sf2_synth_bank_colors', JSON.stringify(bankColors));
  }, [bankColors]);

  const touchTimerRef = useRef<any>(null);
  const isLongPressRef = useRef<boolean>(false);

  // MIDI Learn State
  const [midiMappings, setMidiMappings] = useState<Record<string, number>>(() => {
    const raw = localStorage.getItem('synth_midi_cc_mappings_v1');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {}
    }
    return {};
  });

  const [learningParam, setLearningParam] = useState<{ id: string; name: string } | null>(null);
  const [midiContextMenu, setMidiContextMenu] = useState<{
    x: number;
    y: number;
    paramId: string;
    paramName: string;
  } | null>(null);

  const handleOpenMidiContextMenu = (e: React.MouseEvent, paramId: string, paramName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMidiContextMenu({
      x: e.clientX,
      y: e.clientY,
      paramId,
      paramName
    });
  };

  const handleStartMidiLearn = (paramId: string, paramName: string) => {
    setLearningParam({ id: paramId, name: paramName });
    setMidiContextMenu(null);
    showNotification(`⚡ [MIDI LEARN] Mova qualquer controle no seu teclado MIDI para associar a "${paramName}"...`, 'info');
  };

  const handleRemoveMidiMapping = (paramId: string) => {
    const nextMap = { ...midiMappings };
    delete nextMap[paramId];
    setMidiMappings(nextMap);
    localStorage.setItem('synth_midi_cc_mappings_v1', JSON.stringify(nextMap));
    setMidiContextMenu(null);
    showNotification('Mapeamento MIDI CC removido com sucesso!', 'info');
  };

  // MIDI CC Listener & Parameter Controller
  useEffect(() => {
    const handleMidiCc = (e: any) => {
      const { cc, value } = e.detail;

      if (learningParam) {
        const nextMap = { ...midiMappings, [learningParam.id]: cc };
        setMidiMappings(nextMap);
        localStorage.setItem('synth_midi_cc_mappings_v1', JSON.stringify(nextMap));
        showNotification(`⚡ [MIDI LEARN] CC ${cc} vinculado a "${learningParam.name}" com sucesso!`, 'success');
        setLearningParam(null);
        return;
      }

      let nextCh = [...channels];
      let chChanged = false;
      const focusedLayerIdx = activeParamFocus?.[0] ?? 0;

      for (const [paramId, mappedCc] of Object.entries(midiMappings)) {
        if (mappedCc === cc) {
          const norm = value / 127;

          // Isolamento de MIDI CC pelas abas laterais (activeTab) e Layer selecionado
          const isParamActiveForTab = (pId: string): boolean => {
            if (pId === 'master_volume') {
              return activeTab === 'live-set' || activeTab === 'performance';
            }
            if (['reverbDecay', 'reverbMix', 'reverbPreDelay', 'reverbHighCut', 'reverbBypass'].includes(pId)) {
              return activeTab === 'fx-adsr';
            }
            if (pId.startsWith('layer')) {
              const parts = pId.split('_');
              const chIdx = parseInt(parts[0].replace('layer', ''), 10);
              const act = parts[1] || '';

              // No modo PERF ("performance" ou "live-set"), os 4 controles de volume/pan/mute/solo das 4 layers respondem juntos
              if (['volume', 'pan', 'mute', 'solo', 'midiSensitivity', 'soundfontGain'].includes(act)) {
                return activeTab === 'live-set' || activeTab === 'performance';
              }

              // Nas demais janelas (EQ, FILTROS, CHOR/TREMULO, EFEITO), APENAS o LAYER ATIVO (focusedLayerIdx) responde!
              if (chIdx !== focusedLayerIdx) {
                return false;
              }

              if (act.startsWith('eq') || act === 'eqBypass') {
                return activeTab === 'eq';
              }
              if (['cutoff', 'resonance', 'attack', 'decay', 'sustain', 'release', 'filterBypass'].includes(act)) {
                return activeTab === 'filters';
              }
              if (['chorusRate', 'chorusDepth', 'chorusMix', 'chorusBypass', 'tremoloRate', 'tremoloDepth', 'tremoloBypass', 'tremoloMode'].includes(act)) {
                return activeTab === 'mixing';
              }
              if (['delayTime', 'delayFeedback', 'delayMix', 'delayHighCut', 'delayBypass'].includes(act)) {
                return activeTab === 'delay';
              }
              if (act === 'reverbSend' || act === 'reverbBypass') {
                return activeTab === 'fx-adsr';
              }
            }
            return false;
          };

          if (!isParamActiveForTab(paramId)) {
            continue;
          }

          if (paramId === 'master_volume') {
            onMasterVolumeChange(norm * 1.2);
            continue;
          }

          if (paramId === 'reverbDecay') {
            const decayVal = parseFloat((0.1 + norm * 7.9).toFixed(2));
            onReverbChange(decayVal, reverbMix, reverbPreDelay, reverbHighCut);
            continue;
          }

          if (paramId === 'reverbMix') {
            const mixVal = parseFloat(norm.toFixed(2));
            onReverbChange(reverbDecay, mixVal, reverbPreDelay, reverbHighCut);
            continue;
          }

          if (paramId === 'reverbPreDelay') {
            const preVal = parseFloat((norm * 0.2).toFixed(3));
            onReverbChange(reverbDecay, reverbMix, preVal, reverbHighCut);
            continue;
          }

          if (paramId === 'reverbHighCut') {
            const hcVal = Math.round(500 + norm * 19500);
            onReverbChange(reverbDecay, reverbMix, reverbPreDelay, hcVal);
            continue;
          }

          if (paramId === 'reverbBypass') {
            if (onReverbBypassChange) onReverbBypassChange(value > 63);
            continue;
          }

          if (paramId.startsWith('layer')) {
            const parts = paramId.split('_');
            const channelIdx = parseInt(parts[0].replace('layer', ''), 10);
            const action = parts[1];

            if (isNaN(channelIdx) || channelIdx < 0 || channelIdx > 3) continue;

            const chState = nextCh[channelIdx];
            if (!chState) continue;

            const getFullBandsForState = (st: ChannelState) => {
              const targetFreqs = [80, 150, 400, 1000, 2500, 4300, 12000];
              const targetGains = [st.eqLow ?? 3.0, 2.0, -1.0, st.eqMid ?? 0.0, 1.0, 2.0, st.eqHigh ?? 3.0];
              const targetQs = [0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7];
              const limitsList = [
                { min: 20, max: 200 },
                { min: 80, max: 400 },
                { min: 200, max: 1000 },
                { min: 500, max: 2500 },
                { min: 1500, max: 5000 },
                { min: 3000, max: 8000 },
                { min: 8000, max: 20000 }
              ];

              return [0, 1, 2, 3, 4, 5, 6].map(i => {
                const b = st.eqBands?.[i];
                const limits = limitsList[i];
                const fValid = typeof b?.frequency === 'number' && b.frequency >= limits.min && b.frequency <= limits.max;
                return {
                  gain: typeof b?.gain === 'number' ? b.gain : targetGains[i],
                  frequency: fValid ? b!.frequency : targetFreqs[i],
                  q: typeof b?.q === 'number' ? b.q : targetQs[i]
                };
              });
            };

            if (action === 'volume') {
              const volVal = parseFloat(norm.toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], volume: volVal };
              chChanged = true;
            } else if (action === 'pan') {
              const panVal = parseFloat((norm * 2 - 1).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], pan: panVal };
              chChanged = true;
            } else if (action === 'cutoff') {
              const cutoffVal = Math.round(40 * Math.pow(20000 / 40, norm));
              nextCh[channelIdx] = { ...nextCh[channelIdx], filterCutoff: cutoffVal };
              chChanged = true;
            } else if (action === 'resonance') {
              const resVal = parseFloat((norm * 15 + 0.1).toFixed(1));
              nextCh[channelIdx] = { ...nextCh[channelIdx], filterResonance: resVal };
              chChanged = true;
            } else if (action === 'reverbSend') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], reverbSend: parseFloat(norm.toFixed(2)) };
              chChanged = true;
            } else if (action === 'mute') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], mute: value > 63 };
              chChanged = true;
            } else if (action === 'solo') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], solo: value > 63 };
              chChanged = true;
            } else if (action === 'soundfontGain') {
              const gainVal = parseFloat((0.5 + norm * 3.5).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], soundfontGain: gainVal };
              chChanged = true;
            } else if (action === 'midiSensitivity') {
              const sensVal = parseFloat((0.1 + norm * 1.9).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], midiSensitivity: sensVal };
              chChanged = true;
            } else if (action === 'eqBypass') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], eqBypass: value > 63 };
              chChanged = true;
            } else if (action === 'filterBypass') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], filterBypass: value > 63 };
              chChanged = true;
            } else if (action === 'reverbBypass') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], reverbBypass: value > 63 };
              chChanged = true;
            } else if (action.startsWith('eqfreq')) {
              const bIdx = parseInt(action.replace('eqfreq', ''), 10);
              if (!isNaN(bIdx) && bIdx >= 0 && bIdx <= 6) {
                const limitsList = [
                  { min: 20, max: 200 },    // Sub-Grave
                  { min: 80, max: 400 },    // Grave-Médio
                  { min: 200, max: 1000 },  // Médio 1
                  { min: 500, max: 2500 },  // Médio 2
                  { min: 1500, max: 5000 }, // Médio-Agudo
                  { min: 3000, max: 8000 }, // Agudo
                  { min: 8000, max: 20000 } // Presença/Ar
                ];
                const { min, max } = limitsList[bIdx];
                const freqVal = Math.round(min + norm * (max - min));
                const curState = nextCh[channelIdx];
                const nextBands = getFullBandsForState(curState);
                nextBands[bIdx] = { ...nextBands[bIdx], frequency: freqVal };
                nextCh[channelIdx] = { ...curState, eqBands: nextBands };
                chChanged = true;
              }
            } else if (action.startsWith('eqq')) {
              const bIdx = parseInt(action.replace('eqq', ''), 10);
              if (!isNaN(bIdx) && bIdx >= 0 && bIdx <= 6) {
                const qVal = parseFloat((0.05 + norm * 4.95).toFixed(2));
                const curState = nextCh[channelIdx];
                const nextBands = getFullBandsForState(curState);
                nextBands[bIdx] = { ...nextBands[bIdx], q: qVal };
                nextCh[channelIdx] = { ...curState, eqBands: nextBands };
                chChanged = true;
              }
            } else if (action.startsWith('eq')) {
              const bIdx = parseInt(action.replace('eq', ''), 10);
              if (!isNaN(bIdx) && bIdx >= 0 && bIdx <= 6) {
                const gainVal = parseFloat((norm * 40 - 20).toFixed(1));
                const curState = nextCh[channelIdx];
                const nextBands = getFullBandsForState(curState);
                nextBands[bIdx] = { ...nextBands[bIdx], gain: gainVal };
                nextCh[channelIdx] = {
                  ...curState,
                  eqLow: bIdx === 0 ? gainVal : curState.eqLow,
                  eqMid: bIdx === 3 ? gainVal : curState.eqMid,
                  eqHigh: bIdx === 6 ? gainVal : curState.eqHigh,
                  eqBands: nextBands
                };
                chChanged = true;
              }
            } else if (action === 'attack') {
              const maxAtt = attackMax1s ? 1.0 : 3.0;
              const attVal = parseFloat((norm * maxAtt).toFixed(3));
              const curState = nextCh[channelIdx];
              nextCh[channelIdx] = { ...curState, adsr: { ...curState.adsr, attack: attVal } };
              chChanged = true;
            } else if (action === 'decay') {
              const decVal = parseFloat((norm * 5.0).toFixed(3));
              const curState = nextCh[channelIdx];
              nextCh[channelIdx] = { ...curState, adsr: { ...curState.adsr, decay: decVal } };
              chChanged = true;
            } else if (action === 'sustain') {
              const susVal = Math.round(norm * 100);
              const curState = nextCh[channelIdx];
              nextCh[channelIdx] = { ...curState, adsr: { ...curState.adsr, sustain: susVal } };
              chChanged = true;
            } else if (action === 'release') {
              const relVal = parseFloat((0.01 + norm * 1.99).toFixed(3));
              const curState = nextCh[channelIdx];
              nextCh[channelIdx] = { ...curState, adsr: { ...curState.adsr, release: relVal } };
              chChanged = true;
            } else if (action === 'chorusRate') {
              const rateVal = parseFloat((0.1 + norm * 9.9).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], chorusRate: rateVal };
              chChanged = true;
            } else if (action === 'chorusDepth') {
              const depthVal = parseFloat(norm.toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], chorusDepth: depthVal };
              chChanged = true;
            } else if (action === 'chorusMix') {
              const mixVal = parseFloat(norm.toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], chorusMix: mixVal };
              chChanged = true;
            } else if (action === 'tremoloRate') {
              const tRateVal = parseFloat((0.5 + norm * 19.5).toFixed(1));
              nextCh[channelIdx] = { ...nextCh[channelIdx], tremoloRate: tRateVal };
              chChanged = true;
            } else if (action === 'tremoloDepth') {
              const tDepthVal = parseFloat(norm.toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], tremoloDepth: tDepthVal };
              chChanged = true;
            } else if (action === 'delayTime') {
              const dTimeVal = parseFloat((0.05 + norm * 1.45).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], delayTime: dTimeVal };
              chChanged = true;
            } else if (action === 'delayFeedback') {
              const dFbVal = Math.round(norm * 12);
              nextCh[channelIdx] = { ...nextCh[channelIdx], delayFeedback: dFbVal };
              chChanged = true;
            } else if (action === 'delayMix') {
              const dMixVal = parseFloat(norm.toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], delayMix: dMixVal };
              chChanged = true;
            } else if (action === 'delayHighCut') {
              const dHcVal = Math.round(500 + norm * 17500);
              nextCh[channelIdx] = { ...nextCh[channelIdx], delayHighCut: dHcVal };
              chChanged = true;
            } else if (action === 'delayBypass') {
              nextCh[channelIdx] = { ...nextCh[channelIdx], delayBypass: value > 63 };
              chChanged = true;
            } else if (action === 'midiSensitivity') {
              const sensVal = parseFloat((0.1 + norm * 1.9).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], midiSensitivity: sensVal };
              chChanged = true;
            } else if (action === 'soundfontGain') {
              const gainVal = parseFloat((0.5 + norm * 3.5).toFixed(2));
              nextCh[channelIdx] = { ...nextCh[channelIdx], soundfontGain: gainVal };
              chChanged = true;
            }
          }
        }
      }

      if (chChanged) {
        onChannelsChange(nextCh);
      }
    };

    window.addEventListener('synth-midi-cc', handleMidiCc);
    return () => window.removeEventListener('synth-midi-cc', handleMidiCc);
  }, [learningParam, midiMappings, channels, masterVolume, onMasterVolumeChange, onChannelsChange, activeParamFocus, activeTab, reverbDecay, reverbMix, reverbPreDelay, reverbHighCut, onReverbChange, onReverbBypassChange, attackMax1s]);

  // Close context menu on any outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenuSlot(null);
      setContextMenuBank(null);
      setContextMenuLayer(null);
      setMidiContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const handleLayerContextMenu = (e: React.MouseEvent, lIdx: number) => {
    e.preventDefault();
    setContextMenuLayer({
      layerIndex: lIdx,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleCopyLayer = (lIdx: number) => {
    const layer = channels[lIdx];
    if (layer) {
      setCopiedLayerData(JSON.parse(JSON.stringify(layer)));
      showNotification(`Configuração do LAYER 0${lIdx + 1} copiada com sucesso!`, 'success');
    }
  };

  const handleCutLayer = (lIdx: number) => {
    const layer = channels[lIdx];
    if (layer) {
      setCopiedLayerData(JSON.parse(JSON.stringify(layer)));
      
      const defaultChannels = [
        {
          presetIndex: 0,
          volume: 1.0,
          pan: 0,
          mute: false,
          solo: false,
          filterType: 'lowpass' as const,
          filterCutoff: 20000,
          filterResonance: 0,
          eqBands: [
            { gain: 0.0, frequency: 80, q: 0.7 },
            { gain: 0.0, frequency: 250, q: 1.0 },
            { gain: 0.0, frequency: 1000, q: 1.0 },
            { gain: 0.0, frequency: 4000, q: 1.0 },
            { gain: 0.0, frequency: 12000, q: 0.7 }
          ],
          adsr: { attack: 0.0, decay: 0.5, sustain: 50, release: 0.35 },
          reverbSend: 0.2,
          routingEnabled: true,
          sustainEnabled: true,
          keyRangeMin: 21,
          keyRangeMax: 108,
          octaveOffset: 0,
          midiSensitivity: 1.0,
        },
        {
          presetIndex: 0,
          volume: 0.0,
          pan: 0,
          mute: false,
          solo: false,
          filterType: 'lowpass' as const,
          filterCutoff: 20000,
          filterResonance: 0,
          eqBands: [
            { gain: 0.0, frequency: 80, q: 0.7 },
            { gain: 0.0, frequency: 250, q: 1.0 },
            { gain: 0.0, frequency: 1000, q: 1.0 },
            { gain: 0.0, frequency: 4000, q: 1.0 },
            { gain: 0.0, frequency: 12000, q: 0.7 }
          ],
          adsr: { attack: 0.0, decay: 0.5, sustain: 50, release: 0.35 },
          reverbSend: 0.2,
          routingEnabled: true,
          sustainEnabled: true,
          keyRangeMin: 21,
          keyRangeMax: 108,
          octaveOffset: 0,
          midiSensitivity: 1.0,
        }
      ];

      const defaultCh = lIdx === 0 ? defaultChannels[0] : defaultChannels[1];
      const nextChannels = [...channels];
      nextChannels[lIdx] = JSON.parse(JSON.stringify(defaultCh));
      onChannelsChange(nextChannels);
      showNotification(`LAYER 0${lIdx + 1} recortado para a área de transferência!`, 'info');
    }
  };

  const handlePasteLayer = (lIdx: number) => {
    if (copiedLayerData) {
      const nextChannels = [...channels];
      nextChannels[lIdx] = JSON.parse(JSON.stringify(copiedLayerData));
      onChannelsChange(nextChannels);
      showNotification(`Configuração colada no LAYER 0${lIdx + 1}!`, 'success');
    }
  };

  const handleSlotContextMenu = (e: React.MouseEvent, sIdx: number) => {
    e.preventDefault();
    setContextMenuSlot({
      slotIndex: sIdx,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleBankContextMenu = (e: React.MouseEvent, bIdx: number) => {
    e.preventDefault();
    setContextMenuBank({
      bankIndex: bIdx,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleSetSlotColor = (sIdx: number, colorName: string) => {
    const currentSlotsList = liveSetBanks[currentBankIndex] || [];
    const updatedSlots = currentSlotsList.map((s, idx) => {
      if (idx === sIdx) {
        return {
          ...s,
          color: colorName
        };
      }
      return s;
    });

    const nextBanks = {
      ...liveSetBanks,
      [currentBankIndex]: updatedSlots
    };
    setLiveSetBanks(nextBanks);
    localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
    showNotification('Cor do slot atualizada com sucesso!', 'success');
  };

  const handleSetBankColor = (bIdx: number, colorName: string) => {
    const nextColors = {
      ...bankColors,
      [bIdx]: colorName
    };
    setBankColors(nextColors);
    showNotification('Cor do banco atualizada com sucesso!', 'success');
  };

  const handleSaveRenameBank = () => {
    if (renameBankTarget === null) return;
    const nextNames = {
      ...bankNames,
      [renameBankTarget]: renameBankName.trim() || `USER ${renameBankTarget}`
    };
    setBankNames(nextNames);
    setRenameBankTarget(null);
    showNotification('Banco renomeado com sucesso!', 'success');
  };

  const handleSlotTouchStart = (e: React.TouchEvent, sIdx: number) => {
    isLongPressRef.current = false;
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setContextMenuSlot({
        slotIndex: sIdx,
        x: clientX,
        y: clientY
      });
    }, 600); // 600ms hold
  };

  const handleSlotTouchEnd = (e: React.TouchEvent, slotId: string) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
    if (isLongPressRef.current) {
      e.preventDefault();
    } else {
      loadModxPerformance(slotId);
    }
  };

  const handleSaveCurrentToSlot = (sIdx: number) => {
    const currentSlotsList = liveSetBanks[currentBankIndex] || [];
    const targetSlot = currentSlotsList[sIdx];
    if (!targetSlot) return;

    const updatedSlots = currentSlotsList.map((s, idx) => {
      if (idx === sIdx) {
        const activeInstruments = channels
          .filter(c => c.volume > 0.05)
          .map(c => {
            const sf = loadedSoundFonts[c.soundfontIndex ?? 0];
            if (!sf) return 'Sintetizador';
            if (sf.presets && sf.presets.length === 1) {
              return sf.name.replace(/\.sf2$/i, '').substring(0, 24);
            }
            return sf.presets[c.presetIndex]?.name.substring(0, 24) || 'Patch';
          })
          .filter(Boolean);
        const computedName = activeInstruments.join(' + ') || 'Config Customizada';

        const isDefaultCategory = !s.category || s.category === 'Sem programação' || s.category === 'User Custom Layer';
        const isDefaultBadge = !s.badge || s.badge === 'USER' || s.badge.startsWith('USER ');

        return {
          ...s,
          name: computedName,
          category: isDefaultCategory ? 'User Custom Layer' : s.category,
          badge: isDefaultBadge ? 'USER' : s.badge,
          channelsData: channels.map(ch => ({
            soundfontIndex: ch.soundfontIndex ?? 0,
            soundfontId: ch.soundfontId,
            soundfontName: ch.soundfontName,
            presetIndex: ch.presetIndex ?? 0,
            volume: ch.volume,
            pan: ch.pan,
            soundfontGain: ch.soundfontGain ?? 1.0,
            midiSensitivity: ch.midiSensitivity ?? 1.0,
            filterType: ch.filterType,
            filterCutoff: ch.filterCutoff,
            filterResonance: ch.filterResonance,
            eqLow: ch.eqLow,
            eqMid: ch.eqMid,
            eqHigh: ch.eqHigh,
            eqBands: ch.eqBands ? ch.eqBands.map(b => ({ ...b })) : [
              { gain: ch.eqLow ?? 0, frequency: 80, q: 0.7 },
              { gain: 0, frequency: 250, q: 1.0 },
              { gain: ch.eqMid ?? 0, frequency: 1000, q: 1.0 },
              { gain: 0, frequency: 4000, q: 1.0 },
              { gain: ch.eqHigh ?? 0, frequency: 12000, q: 0.7 }
            ],
            adsr: { ...ch.adsr },
            reverbSend: ch.reverbSend,
            routingEnabled: ch.routingEnabled ?? true,
            sustainEnabled: ch.sustainEnabled ?? true,
            keyRangeMin: ch.keyRangeMin ?? 0,
            keyRangeMax: ch.keyRangeMax ?? 127,
            octaveOffset: ch.octaveOffset ?? 0,
            chorusBypass: ch.chorusBypass ?? true,
            chorusRate: ch.chorusRate ?? 1.5,
            chorusDepth: ch.chorusDepth ?? 0.3,
            chorusMix: ch.chorusMix ?? 0.45,
            tremoloBypass: ch.tremoloBypass ?? true,
            tremoloRate: ch.tremoloRate ?? 5.0,
            tremoloDepth: ch.tremoloDepth ?? 0.5,
            tremoloMode: ch.tremoloMode ?? 'volume',
            delayBypass: ch.delayBypass ?? true,
            delayTime: ch.delayTime ?? 0.35,
            delayFeedback: ch.delayFeedback ?? 0.4,
            delayMix: ch.delayMix ?? 0.3,
            delayHighCut: ch.delayHighCut ?? 8000,
          })),
          reverbDecay,
          reverbMix
        };
      }
      return s;
    });

    const nextBanks = {
      ...liveSetBanks,
      [currentBankIndex]: updatedSlots
    };
    setLiveSetBanks(nextBanks);
    localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
    showNotification('Os canais e efeitos ativos foram gravados com sucesso neste slot!', 'success');
  };

  const handleStartRenameSlot = (sIdx: number) => {
    const targetSlot = currentSlots[sIdx];
    if (!targetSlot) return;
    setRenameSlotTarget(sIdx);
    setRenameForm({
      name: targetSlot.name,
      category: targetSlot.category || '',
      badge: targetSlot.badge || 'USER'
    });
  };

  const handleSaveRenameSlot = () => {
    if (renameSlotTarget === null) return;
    const currentSlotsList = liveSetBanks[currentBankIndex] || [];
    
    const updatedSlots = currentSlotsList.map((s, idx) => {
      if (idx === renameSlotTarget) {
        return {
          ...s,
          name: renameForm.name.trim() || `User Slot ${currentBankIndex}-${renameSlotTarget + 1}`,
          category: renameForm.category.trim() || 'Custom Sound',
          badge: renameForm.badge.trim().toUpperCase() || 'USER'
        };
      }
      return s;
    });

    const nextBanks = {
      ...liveSetBanks,
      [currentBankIndex]: updatedSlots
    };
    setLiveSetBanks(nextBanks);
    localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
    setRenameSlotTarget(null);
  };

  const handleCopySlotConfig = (sIdx: number) => {
    const targetSlot = currentSlots[sIdx];
    if (!targetSlot) return;
    setCopiedSlotConfig(JSON.parse(JSON.stringify(targetSlot)));
  };

  const handlePasteSlotConfig = (sIdx: number) => {
    if (!copiedSlotConfig) return;
    const currentSlotsList = liveSetBanks[currentBankIndex] || [];
    
    const updatedSlots = currentSlotsList.map((s, idx) => {
      if (idx === sIdx) {
        return {
          ...JSON.parse(JSON.stringify(copiedSlotConfig)),
          id: s.id // preserve target ID
        };
      }
      return s;
    });

    const nextBanks = {
      ...liveSetBanks,
      [currentBankIndex]: updatedSlots
    };
    setLiveSetBanks(nextBanks);
    localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
    showNotification('Configuração colada com sucesso neste slot!', 'success');
  };

  const handleClearSlot = (sIdx: number) => {
    const currentSlotsList = liveSetBanks[currentBankIndex] || [];
    
    const updatedSlots = currentSlotsList.map((s, idx) => {
      if (idx === sIdx) {
        return {
          id: s.id,
          name: `User Slot ${currentBankIndex}-${idx + 1}`,
          category: 'Sem programação',
          badge: `USER ${currentBankIndex}`,
          color: 'zinc',
          channelsData: Array.from({ length: 4 }, () => ({
            soundfontIndex: 0,
            presetIndex: 0,
            volume: 0,
            pan: 0,
            filterType: 'lowpass' as const,
            filterCutoff: 18000,
            filterResonance: 1.0,
            eqBands: [
              { gain: 0, frequency: 80, q: 0.7 },
              { gain: 0, frequency: 250, q: 1.0 },
              { gain: 0, frequency: 1000, q: 1.0 },
              { gain: 0, frequency: 4000, q: 1.0 },
              { gain: 0, frequency: 12000, q: 0.7 }
            ],
            adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
            reverbSend: 0.2,
            routingEnabled: true,
            sustainEnabled: true,
            keyRangeMin: 0,
            keyRangeMax: 127,
            octaveOffset: 0,
            midiSensitivity: 1.0,
            chorusBypass: true,
            chorusRate: 1.5,
            chorusDepth: 0.3,
            chorusMix: 0.45,
            tremoloBypass: true,
            tremoloRate: 5.0,
            tremoloDepth: 0.5,
            tremoloMode: 'volume' as const
          })),
          reverbDecay: 2.5,
          reverbMix: 0.25
        };
      }
      return s;
    });

    const nextBanks = {
      ...liveSetBanks,
      [currentBankIndex]: updatedSlots
    };
    setLiveSetBanks(nextBanks);
    localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
  };

  const handleResetBankIndex = (bankIdx: number) => {
    const bankName = bankNames[bankIdx] || `USER ${bankIdx}`;
    setConfirmDialog({
      isOpen: true,
      title: 'Restaurar Banco de Memória',
      message: `Tem certeza de que deseja restaurar as configurações padrões de fábrica para todos os botões do Banco "${bankName}"?`,
      onConfirm: () => {
        const defaultSlots = Array.from({ length: 16 }, (_, i) => ({
          id: `user_${bankIdx}_slot_${i}`,
          name: `User Slot ${bankIdx}-${i + 1}`,
          category: 'Sem programação',
          badge: `USER ${bankIdx}`,
          color: 'zinc',
          channelsData: Array.from({ length: 4 }, () => ({
            soundfontIndex: 0,
            presetIndex: 0,
            volume: 0,
            pan: 0,
            filterType: 'lowpass' as const,
            filterCutoff: 18000,
            filterResonance: 1.0,
            eqBands: [
              { gain: 0, frequency: 80, q: 0.7 },
              { gain: 0, frequency: 250, q: 1.0 },
              { gain: 0, frequency: 1000, q: 1.0 },
              { gain: 0, frequency: 4000, q: 1.0 },
              { gain: 0, frequency: 12000, q: 0.7 }
            ],
            adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
            reverbSend: 0.2,
            routingEnabled: true,
            sustainEnabled: true,
            keyRangeMin: 0,
            keyRangeMax: 127,
            octaveOffset: 0,
            midiSensitivity: 1.0,
            chorusBypass: true,
            chorusRate: 1.5,
            chorusDepth: 0.3,
            chorusMix: 0.45,
            tremoloBypass: true,
            tremoloRate: 5.0,
            tremoloDepth: 0.5,
            tremoloMode: 'volume' as const
          })),
          reverbDecay: 2.5,
          reverbMix: 0.25
        }));

        const nextBanks = {
          ...liveSetBanks,
          [bankIdx]: defaultSlots
        };
        setLiveSetBanks(nextBanks);
        localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));

        // Force-update the current viewed slots so the UI and sound can reflect the reset state
        if (currentBankIndex === bankIdx) {
          const firstSlotId = `user_${bankIdx}_slot_0`;
          const firstSlot = defaultSlots[0];
          setSelectedPerformanceId(firstSlot.id);
          setSelectedPerformanceName(firstSlot.name);
          setPerformanceCategory(firstSlot.category);

          const nextChannels = channels.map((ch, idx) => {
            const pData = firstSlot.channelsData[idx] || firstSlot.channelsData[0];
            return {
              ...ch,
              soundfontIndex: 0,
              presetIndex: 0,
              soundfontId: undefined,
              soundfontName: undefined,
              soundfontGain: 1.0,
              volume: pData.volume,
              pan: pData.pan,
              filterType: pData.filterType as any,
              filterCutoff: pData.filterCutoff,
              filterResonance: pData.filterResonance,
              eqLow: 0,
              eqMid: 0,
              eqHigh: 0,
              eqBands: [
                { gain: 0, frequency: 80, q: 0.7 },
                { gain: 0, frequency: 250, q: 1.0 },
                { gain: 0, frequency: 1000, q: 1.0 },
                { gain: 0, frequency: 4000, q: 1.0 },
                { gain: 0, frequency: 12000, q: 0.7 }
              ],
              adsr: { ...pData.adsr },
              reverbSend: pData.reverbSend,
              routingEnabled: true,
              sustainEnabled: true,
              keyRangeMin: 0,
              keyRangeMax: 127,
              octaveOffset: 0,
              midiSensitivity: 1.0,
            };
          });

          onChannelsChange(nextChannels);
          onReverbChange(firstSlot.reverbDecay, firstSlot.reverbMix);
          setVuLevels([0, 0, 0, 0]);
        }

        showNotification(`Banco "${bankName}" restaurado com sucesso!`, 'success');
        setConfirmDialog(null);
      }
    });
  };

  // Store/Write mode (removed at user request)
  const isWriteMode = false;

  const bIdxToMinMax = (bIdx: number) => {
    switch (bIdx) {
      case 0: return { min: 20, max: 500, def: 80 };     // Low Shelf
      case 1: return { min: 100, max: 1000, def: 250 };  // Low-Mid Peak
      case 2: return { min: 500, max: 4000, def: 1000 }; // Mid Peak
      case 3: return { min: 2000, max: 10000, def: 4000 };// High-Mid Peak
      case 4: default: return { min: 5000, max: 20000, def: 12000 }; // High Shelf
    }
  };

  const defaultBandsForIdx = (bIdx: number, state: ChannelState) => {
    const defaultBands = [
      { gain: state.eqLow ?? 0, frequency: 80, q: 0.7 },
      { gain: 0, frequency: 250, q: 1.0 },
      { gain: state.eqMid ?? 0, frequency: 1000, q: 1.0 },
      { gain: 0, frequency: 4000, q: 1.0 },
      { gain: state.eqHigh ?? 0, frequency: 12000, q: 0.7 }
    ];
    return state.eqBands?.[bIdx] || defaultBands[bIdx];
  };

  const handleCopyChannel = (idx: number) => {
    setCopiedChannelConfig(JSON.parse(JSON.stringify(channels[idx])));
    showNotification(`Configurações do Layer 0${idx + 1} copiadas para a área de transferência!`, 'success');
  };

  const handleCutChannel = (idx: number) => {
    setCopiedChannelConfig(JSON.parse(JSON.stringify(channels[idx])));
    const nextCh = [...channels];
    nextCh[idx] = {
      presetIndex: 0,
      soundfontIndex: 0,
      volume: 0.0,
      pan: 0,
      mute: false,
      solo: false,
      filterType: 'lowpass',
      filterCutoff: 18000,
      filterResonance: 1.0,
      eqBands: [
        { gain: 0, frequency: 80, q: 0.7 },
        { gain: 0, frequency: 250, q: 1.0 },
        { gain: 0, frequency: 1000, q: 1.0 },
        { gain: 0, frequency: 4000, q: 1.0 },
        { gain: 0, frequency: 12000, q: 0.7 }
      ],
      adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
      reverbSend: 0.2,
      routingEnabled: true,
      sustainEnabled: true,
      keyRangeMin: 0,
      keyRangeMax: 127,
      octaveOffset: 0,
      midiSensitivity: 1.0,
      chorusBypass: true,
      chorusRate: 1.5,
      chorusDepth: 0.3,
      chorusMix: 0.45,
      tremoloBypass: true,
      tremoloRate: 5.0,
      tremoloDepth: 0.5,
      tremoloMode: 'volume'
    };
    onChannelsChange(nextCh);
    showNotification(`Camada 0${idx + 1} recortada e limpa!`, 'info');
  };

  const handlePasteChannel = (idx: number) => {
    if (!copiedChannelConfig) return;
    const nextCh = [...channels];
    nextCh[idx] = JSON.parse(JSON.stringify(copiedChannelConfig));
    onChannelsChange(nextCh);
  };

  const handleResetEqToDefault = (idx: number) => {
    const nextCh = [...channels];
    nextCh[idx] = {
      ...channels[idx],
      eqBypass: false,
      eqBands: [
        { gain: 0, frequency: 80, q: 0.7 },
        { gain: 0, frequency: 250, q: 1.0 },
        { gain: 0, frequency: 1000, q: 1.0 },
        { gain: 0, frequency: 4000, q: 1.0 },
        { gain: 0, frequency: 12000, q: 0.7 }
      ]
    };
    onChannelsChange(nextCh);
    showNotification(`Equalizador do Layer 0${idx + 1} resetado para o padrão flat!`, 'success');
  };

  const handleToggleEqBypass = (idx: number) => {
    const nextCh = [...channels];
    const currentBypass = channels[idx].eqBypass ?? false;
    nextCh[idx] = {
      ...channels[idx],
      eqBypass: !currentBypass
    };
    onChannelsChange(nextCh);
    showNotification(`Equalizador do Layer 0${idx + 1} ${!currentBypass ? 'Bypassado (Desativado)' : 'Ativado'}!`, 'info');
  };

  // Hook typing and physical MIDI keys trigger for animating VU meters
  useEffect(() => {
    const handleNoteOn = (e: Event) => {
      const { targets } = (e as CustomEvent).detail;
      setVuLevels(prev => {
        const next = [...prev];
        for (let i = 0; i < 4; i++) {
          if (targets[i] && !channels[i].mute) {
            next[i] = Math.min(1.0, next[i] + 0.45); // burst
          }
        }
        return next;
      });
    };

    window.addEventListener('keyboard-note-on', handleNoteOn);
    return () => {
      window.removeEventListener('keyboard-note-on', handleNoteOn);
    };
  }, [channels]);

  // Decays VU meters smoothly over time
  useEffect(() => {
    const interval = setInterval(() => {
      setVuLevels(prev => {
        const next = prev.map(l => Math.max(0, l - 0.12)); // decay
        // If there are voices currently active, occasionally add small random vibration
        if (voiceCount > 0) {
          for (let i = 0; i < 4; i++) {
            if (!channels[i].mute && channels[i].volume > 0.05) {
              if (Math.random() > 0.4) {
                next[i] = Math.min(1.0, Math.max(0.15, next[i] + (Math.random() * 0.15)));
              }
            }
          }
        }
        return next;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [voiceCount, channels]);

  // Handle Preset Save State Input
  const [presetInputName, setPresetInputName] = useState('');

  // Built-in 16 Classic MODX Live Set Performances definitions
  const modxLiveSetSlots = [
    {
      id: 'cfx_fm_ep',
      name: 'CFX + FM EP 2',
      category: 'Acoustic Piano + DX7 Layer',
      badge: 'PIANO',
      color: 'border-amber-500/60 bg-gradient-to-br from-amber-950/20 to-zinc-900',
      channelsData: [
        { volume: 0.95, pan: -0.05, filterType: 'lowpass', filterCutoff: 18000, filterResonance: 1.0, eqLow: 1.0, eqMid: -0.5, eqHigh: 1.0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.45 }, reverbSend: 0.2 },
        { volume: 0.70, pan: 0.15, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: -0.5, eqMid: 1.0, eqHigh: 2.0, adsr: { attack: 0.08, decay: 0.6, sustain: 85, release: 0.9 }, reverbSend: 0.4 },
        { volume: 0, pan: -0.25, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0, pan: 0.25, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.6,
      reverbMix: 0.22,
    },
    {
      id: 'ocean_pad',
      name: 'Ocean Pad Soft',
      category: 'Slow Ethereal Cinematic Cushion',
      badge: 'PAD',
      color: 'border-sky-500/60 bg-gradient-to-br from-sky-950/20 to-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0.85, pan: -0.35, filterType: 'lowpass', filterCutoff: 4500, filterResonance: 1.5, eqLow: 2.0, eqMid: 0.5, eqHigh: 1.0, adsr: { attack: 1.4, decay: 1.8, sustain: 90, release: 2.8 }, reverbSend: 0.65 },
        { volume: 0.75, pan: 0.35, filterType: 'lowpass', filterCutoff: 6000, filterResonance: 2.0, eqLow: 1.5, eqMid: 1.0, eqHigh: 2.0, adsr: { attack: 1.8, decay: 2.2, sustain: 85, release: 3.2 }, reverbSend: 0.75 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 5.2,
      reverbMix: 0.45,
    },
    {
      id: 'fm_sweeping_poly',
      name: 'FM Sweeping Poly',
      category: 'Resonant Brass & Poly Synth',
      badge: 'SYNTH',
      color: 'border-emerald-500/60 bg-gradient-to-br from-emerald-950/20 to-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.90, pan: -0.1, filterType: 'lowpass', filterCutoff: 2200, filterResonance: 5.5, eqLow: -1.0, eqMid: 1.5, eqHigh: 3.0, adsr: { attack: 0.25, decay: 0.8, sustain: 65, release: 0.55 }, reverbSend: 0.35 },
        { volume: 0.75, pan: 0.2, filterType: 'lowpass', filterCutoff: 3800, filterResonance: 4.0, eqLow: 0.5, eqMid: -0.5, eqHigh: 1.5, adsr: { attack: 0.35, decay: 1.1, sustain: 55, release: 0.7 }, reverbSend: 0.25 },
      ],
      reverbDecay: 2.2,
      reverbMix: 0.18,
    },
    {
      id: 'plastic_beat',
      name: 'Plastic Beat',
      category: 'Pumping Dance Plucks Layer',
      badge: 'PLUCK',
      color: 'border-rose-500/60 bg-gradient-to-br from-rose-950/20 to-zinc-900',
      channelsData: [
        { volume: 0.85, pan: 0.1, filterType: 'lowpass', filterCutoff: 1200, filterResonance: 6.5, eqLow: -2.0, eqMid: 1.0, eqHigh: 2.0, adsr: { attack: 0.005, decay: 0.16, sustain: 5, release: 0.18 }, reverbSend: 0.15 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.90, pan: -0.15, filterType: 'lowpass', filterCutoff: 4500, filterResonance: 2.5, eqLow: 1.0, eqMid: 0, eqHigh: 1.5, adsr: { attack: 0.01, decay: 0.22, sustain: 0, release: 0.15 }, reverbSend: 0.2 },
        { volume: 0.65, pan: 0.25, filterType: 'lowpass', filterCutoff: 14000, filterResonance: 1.0, eqLow: 0, eqMid: 2.0, eqHigh: 0.5, adsr: { attack: 0.04, decay: 0.35, sustain: 35, release: 0.25 }, reverbSend: 0.1 },
      ],
      reverbDecay: 1.6,
      reverbMix: 0.12,
    },
    {
      id: 'rd1_gallery',
      name: 'Rd 1 Gallery 2',
      category: 'Stage Reed EP Clean & Wet',
      badge: 'E.PIANO',
      color: 'border-amber-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0.95, pan: -0.05, filterType: 'lowpass', filterCutoff: 16000, filterResonance: 1.0, eqLow: 1.5, eqMid: -0.5, eqHigh: 2.0, adsr: { attack: 0.005, decay: 0.35, sustain: 65, release: 0.5 }, reverbSend: 0.35 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.4,
      reverbMix: 0.25,
    },
    {
      id: 'romance_strings',
      name: 'Romance Strings',
      category: 'Warm Legato Orchestral Layer',
      badge: 'STRINGS',
      color: 'border-sky-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.90, pan: -0.3, filterType: 'lowpass', filterCutoff: 9000, filterResonance: 1.0, eqLow: 2.0, eqMid: 1.0, eqHigh: 0.5, adsr: { attack: 0.75, decay: 1.4, sustain: 95, release: 1.8 }, reverbSend: 0.4 },
        { volume: 0.85, pan: 0.3, filterType: 'lowpass', filterCutoff: 11000, filterResonance: 1.0, eqLow: 1.0, eqMid: 1.5, eqHigh: 1.0, adsr: { attack: 0.9, decay: 1.6, sustain: 90, release: 2.2 }, reverbSend: 0.5 },
      ],
      reverbDecay: 3.8,
      reverbMix: 0.38,
    },
    {
      id: 'fm_linear',
      name: 'FM Linear Synth',
      category: 'Crystalline Bell Sweep Pad',
      badge: 'SYNTH',
      color: 'border-emerald-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0.60, pan: -0.25, filterType: 'lowpass', filterCutoff: 14000, filterResonance: 1.0, eqLow: -1.0, eqMid: 0.5, eqHigh: 2.0, adsr: { attack: 0.05, decay: 0.75, sustain: 40, release: 0.65 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.85, pan: 0.3, filterType: 'lowpass', filterCutoff: 6500, filterResonance: 3.0, eqLow: 1.0, eqMid: 0.5, eqHigh: 2.5, adsr: { attack: 0.01, decay: 0.45, sustain: 70, release: 0.5 }, reverbSend: 0.4 },
        { volume: 0.75, pan: 0, filterType: 'lowpass', filterCutoff: 18000, filterResonance: 1.0, eqLow: 0, eqMid: 1.0, eqHigh: 2.0, adsr: { attack: 0.15, decay: 1.6, sustain: 85, release: 1.4 }, reverbSend: 0.3 },
      ],
      reverbDecay: 4.2,
      reverbMix: 0.33,
    },
    {
      id: 'whip_motion',
      name: 'Whip Motion Pluck',
      category: 'Fast Resonant Filter Sweep',
      badge: 'PLUCK',
      color: 'border-rose-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0.90, pan: -0.2, filterType: 'lowpass', filterCutoff: 750, filterResonance: 8.5, eqLow: -1.5, eqMid: 2.0, eqHigh: 1.0, adsr: { attack: 0.005, decay: 0.13, sustain: 0, release: 0.15 }, reverbSend: 0.25 },
        { volume: 0.80, pan: 0.2, filterType: 'lowpass', filterCutoff: 2400, filterResonance: 6.5, eqLow: 1.0, eqMid: -1.0, eqHigh: 3.0, adsr: { attack: 0.01, decay: 0.19, sustain: 15, release: 0.22 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 1.8,
      reverbMix: 0.15,
    },
    {
      id: 'wr_gallery',
      name: 'Wr Gallery 2',
      category: 'Vintage Electric Tine Piano',
      badge: 'E.PIANO',
      color: 'border-amber-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0.95, pan: -0.02, filterType: 'lowpass', filterCutoff: 16000, filterResonance: 1.0, eqLow: 2.0, eqMid: 0, eqHigh: 1.5, adsr: { attack: 0.005, decay: 0.38, sustain: 55, release: 0.45 }, reverbSend: 0.22 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.0,
      reverbMix: 0.18,
    },
    {
      id: 'texas_chicken',
      name: 'Texas Chicken Pick',
      category: 'Rotary Clicky Jazz B3 Organ',
      badge: 'ORGAN',
      color: 'border-amber-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.90, pan: -0.15, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 2.5, eqHigh: 1.0, adsr: { attack: 0.005, decay: 0.08, sustain: 100, release: 0.08 }, reverbSend: 0.3 },
        { volume: 0.85, pan: 0.15, filterType: 'lowpass', filterCutoff: 11000, filterResonance: 2.5, eqLow: -1.0, eqMid: 1.5, eqHigh: 2.0, adsr: { attack: 0.01, decay: 0.12, sustain: 90, release: 0.12 }, reverbSend: 0.3 },
      ],
      reverbDecay: 2.8,
      reverbMix: 0.28,
    },
    {
      id: 'multi_saw_hw',
      name: 'Multi Saw HW DA',
      category: 'Thick Stereo Supersaw Lead',
      badge: 'SYNTH',
      color: 'border-emerald-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0.90, pan: -0.2, filterType: 'lowpass', filterCutoff: 5800, filterResonance: 3.5, eqLow: 1.0, eqMid: 0, eqHigh: 2.0, adsr: { attack: 0.01, decay: 0.45, sustain: 75, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.90, pan: 0.2, filterType: 'lowpass', filterCutoff: 6200, filterResonance: 4.0, eqLow: 1.0, eqMid: 0, eqHigh: 2.0, adsr: { attack: 0.01, decay: 0.45, sustain: 75, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.5,
      reverbMix: 0.25,
    },
    {
      id: 'turn_it_on',
      name: 'Turn It On',
      category: 'Industrial Sequencer Sync Stack',
      badge: 'SEQUENCE',
      color: 'border-rose-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0.85, pan: -0.25, filterType: 'lowpass', filterCutoff: 1100, filterResonance: 8.0, eqLow: -1.0, eqMid: 1.5, eqHigh: 1.0, adsr: { attack: 0.005, decay: 0.13, sustain: 8, release: 0.15 }, reverbSend: 0.15 },
        { volume: 0.80, pan: 0.25, filterType: 'lowpass', filterCutoff: 1650, filterResonance: 5.5, eqLow: 1.0, eqMid: -0.5, eqHigh: 2.0, adsr: { attack: 0.01, decay: 0.18, sustain: 12, release: 0.18 }, reverbSend: 0.2 },
        { volume: 0.70, pan: 0, filterType: 'lowpass', filterCutoff: 7500, filterResonance: 1.5, eqLow: 2.0, eqMid: 1.0, eqHigh: 0.5, adsr: { attack: 0.45, decay: 0.9, sustain: 80, release: 1.3 }, reverbSend: 0.45 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 3.0,
      reverbMix: 0.28,
    },
    {
      id: 'super_warm_pad',
      name: 'Super Warm Pad',
      category: 'Slow Massive Brass Cushions',
      badge: 'PAD',
      color: 'border-sky-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.85, pan: -0.2, filterType: 'lowpass', filterCutoff: 3000, filterResonance: 1.0, eqLow: 3.0, eqMid: -0.5, eqHigh: 1.0, adsr: { attack: 2.0, decay: 1.2, sustain: 95, release: 2.6 }, reverbSend: 0.55 },
        { volume: 0.85, pan: 0.2, filterType: 'lowpass', filterCutoff: 4000, filterResonance: 1.0, eqLow: 2.0, eqMid: 1.0, eqHigh: 0.5, adsr: { attack: 2.4, decay: 1.5, sustain: 90, release: 3.0 }, reverbSend: 0.65 },
      ],
      reverbDecay: 4.8,
      reverbMix: 0.40,
    },
    {
      id: 'glass_bell_tines',
      name: 'Glass Bell Tines',
      category: 'Shimmering Metallic Chimes',
      badge: 'BELLS',
      color: 'border-emerald-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0.90, pan: -0.1, filterType: 'lowpass', filterCutoff: 14000, filterResonance: 1.0, eqLow: -0.5, eqMid: 0.5, eqHigh: 2.0, adsr: { attack: 0.005, decay: 1.1, sustain: 0, release: 0.85 }, reverbSend: 0.35 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0.85, pan: 0.3, filterType: 'lowpass', filterCutoff: 9500, filterResonance: 3.0, eqLow: 0, eqMid: 1.5, eqHigh: 1.0, adsr: { attack: 0.02, decay: 0.75, sustain: 8, release: 0.65 }, reverbSend: 0.3 },
      ],
      reverbDecay: 3.5,
      reverbMix: 0.30,
    },
    {
      id: 'solo_saw_lead',
      name: 'Solo Saw Lead',
      category: 'Sharp Monophonic Synthesizer',
      badge: 'LEAD',
      color: 'border-emerald-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 15000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.3, sustain: 70, release: 0.4 }, reverbSend: 0.2 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0.98, pan: 0, filterType: 'lowpass', filterCutoff: 7200, filterResonance: 5.5, eqLow: 1.5, eqMid: 1.0, eqHigh: 1.5, adsr: { attack: 0.01, decay: 0.4, sustain: 80, release: 0.38 }, reverbSend: 0.25 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.0,
      reverbMix: 0.20,
    },
    {
      id: 'piano_solo',
      name: 'Natural CFX Grand',
      category: 'Full Dynamic Acoustic Grand',
      badge: 'PIANO',
      color: 'border-amber-500/40 bg-zinc-900',
      channelsData: [
        { volume: 0.98, pan: 0, filterType: 'lowpass', filterCutoff: 18000, filterResonance: 1.0, eqLow: 1.5, eqMid: -0.5, eqHigh: 1.0, adsr: { attack: 0.005, decay: 0.2, sustain: 70, release: 0.35 }, reverbSend: 0.25 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 12000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.05, decay: 0.4, sustain: 80, release: 0.4 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 8000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.5, decay: 1.0, sustain: 100, release: 1.0 }, reverbSend: 0.3 },
        { volume: 0, pan: 0, filterType: 'lowpass', filterCutoff: 10000, filterResonance: 1.0, eqLow: 0, eqMid: 0, eqHigh: 0, adsr: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.15 }, reverbSend: 0.15 },
      ],
      reverbDecay: 2.0,
      reverbMix: 0.22,
    },
  ];

  // Multiple Live Set Banks management
  const [currentBankIndex, setCurrentBankIndex] = useState<number>(() => {
    const raw = localStorage.getItem('sf2_synth_current_bank_idx_v4');
    if (raw) {
      try {
        const parsed = parseInt(raw, 10);
        if (parsed >= 1) return parsed;
      } catch (e) {}
    }
    return 1; // Default to USER 1 (index 1)
  });

  useEffect(() => {
    localStorage.setItem('sf2_synth_current_bank_idx_v4', currentBankIndex.toString());
  }, [currentBankIndex]);

  const [liveSetBanks, setLiveSetBanks] = useState<{ [bankIndex: number]: any[] }>(() => {
    const raw = localStorage.getItem('sf2_synth_live_sets_v3');
    let loaded: { [bankIndex: number]: any[] } | null = null;
    if (raw) {
      try {
        loaded = JSON.parse(raw);
      } catch (e) {
        console.error('Erro ao analisar bancos do Live Set:', e);
      }
    }

    const createBlankUserSlotsForBank = (bankIdx: number) => {
      return Array.from({ length: 16 }, (_, i) => ({
        id: `user_${bankIdx}_slot_${i}`,
        name: `User Slot ${bankIdx}-${i + 1}`,
        category: 'Sem programação',
        badge: `USER ${bankIdx}`,
        color: 'zinc',
        channelsData: Array.from({ length: 4 }, () => ({
          soundfontIndex: 0,
          presetIndex: 0,
          volume: 0,
          pan: 0,
          filterType: 'lowpass' as const,
          filterCutoff: 18000,
          filterResonance: 1.0,
          eqBands: [
            { gain: 0, frequency: 80, q: 0.7 },
            { gain: 0, frequency: 250, q: 1.0 },
            { gain: 0, frequency: 1000, q: 1.0 },
            { gain: 0, frequency: 4000, q: 1.0 },
            { gain: 0, frequency: 12000, q: 0.7 }
          ],
          adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
          reverbSend: 0.2,
          routingEnabled: true,
          sustainEnabled: true,
          keyRangeMin: 0,
          keyRangeMax: 127,
          octaveOffset: 0,
          midiSensitivity: 1.0,
          chorusBypass: true,
          chorusRate: 1.5,
          chorusDepth: 0.3,
          chorusMix: 0.45,
          tremoloBypass: true,
          tremoloRate: 5.0,
          tremoloDepth: 0.5,
          tremoloMode: 'volume' as const
        })),
        reverbDecay: 2.5,
        reverbMix: 0.25
      }));
    };

    const finalBanks: { [bankIndex: number]: any[] } = {};
    finalBanks[0] = modxLiveSetSlots; // FACTORY always at 0 (hidden in UI)

    let isBrokenVersion = false;
    if (loaded && loaded[0] && loaded[0].length > 0) {
      const firstId = loaded[0][0]?.id || '';
      if (firstId.includes('user_A_')) {
        isBrokenVersion = true;
      }
    }

    const cRaw = localStorage.getItem('sf2_synth_user_bank_count_v5');
    let targetCount = 4;
    if (cRaw) {
      try {
        const p = parseInt(cRaw, 10);
        if (p >= 4) targetCount = p;
      } catch (e) {}
    }

    const maxBankIndexToLoad = Math.max(targetCount, loaded ? Object.keys(loaded).length : 4);

    for (let b = 1; b <= maxBankIndexToLoad; b++) {
      const defaultSlots = createBlankUserSlotsForBank(b);
      
      let sourceSlots: any[] | null = null;
      if (loaded) {
        if (isBrokenVersion) {
          const brokenIdx = b - 1;
          if (loaded[brokenIdx]) {
            sourceSlots = loaded[brokenIdx];
          }
        } else {
          if (loaded[b]) {
            sourceSlots = loaded[b];
          }
        }
      }

      if (sourceSlots && Array.isArray(sourceSlots)) {
        // Limit each bank to 16 slots for optimum RAM/UI performance
        const merged = sourceSlots.slice(0, 16);
        while (merged.length < 16) {
          const i = merged.length;
          merged.push({
            id: `user_${b}_slot_${i}`,
            name: `User Slot ${b}-${i + 1}`,
            category: 'Sem programação',
            badge: `USER ${b}`,
            color: 'zinc',
            channelsData: Array.from({ length: 4 }, () => ({
              soundfontIndex: 0,
              presetIndex: 0,
              volume: 0,
              pan: 0,
              filterType: 'lowpass' as const,
              filterCutoff: 18000,
              filterResonance: 1.0,
              eqBands: [
                { gain: 0, frequency: 80, q: 0.7 },
                { gain: 0, frequency: 250, q: 1.0 },
                { gain: 0, frequency: 1000, q: 1.0 },
                { gain: 0, frequency: 4000, q: 1.0 },
                { gain: 0, frequency: 12000, q: 0.7 }
              ],
              adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
              reverbSend: 0.2,
              routingEnabled: true,
              sustainEnabled: true,
              keyRangeMin: 0,
              keyRangeMax: 127,
              octaveOffset: 0,
              midiSensitivity: 1.0,
              chorusBypass: true,
              chorusRate: 1.5,
              chorusDepth: 0.3,
              chorusMix: 0.45,
              tremoloBypass: true,
              tremoloRate: 5.0,
              tremoloDepth: 0.5,
              tremoloMode: 'volume' as const
            })),
            reverbDecay: 2.5,
            reverbMix: 0.25
          });
        }
        merged.forEach(slot => {
          if (!slot.color) slot.color = 'zinc';
          if (slot.category === 'Sem som salvo' || slot.category === 'SEM SOM SALVO') {
            slot.category = 'Sem programação';
          }
          const isUnprogrammed = slot.category === 'Sem programação' || !slot.name || slot.name.startsWith('User Slot') || slot.name === 'DISPONÍVEL';
          if (isUnprogrammed) {
            slot.category = 'Sem programação';
            slot.badge = `USER ${b}`;
            slot.color = 'zinc';
          }
        });
        finalBanks[b] = merged;
      } else {
        finalBanks[b] = defaultSlots;
      }
    }
    return finalBanks;
  });

  const handleAddUserBank = () => {
    const nextCount = userBankCount + 1;
    setUserBankCount(nextCount);

    const newBankSlots = Array.from({ length: 16 }, (_, i) => ({
      id: `user_${nextCount}_slot_${i}`,
      name: `User Slot ${nextCount}-${i + 1}`,
      category: 'Sem programação',
      badge: `USER ${nextCount}`,
      color: 'zinc',
      channelsData: Array.from({ length: 4 }, () => ({
        soundfontIndex: 0,
        presetIndex: 0,
        volume: 0,
        pan: 0,
        filterType: 'lowpass' as const,
        filterCutoff: 18000,
        filterResonance: 1.0,
        eqBands: [
          { gain: 0, frequency: 80, q: 0.7 },
          { gain: 0, frequency: 250, q: 1.0 },
          { gain: 0, frequency: 1000, q: 1.0 },
          { gain: 0, frequency: 4000, q: 1.0 },
          { gain: 0, frequency: 12000, q: 0.7 }
        ],
        adsr: { attack: 0.0, decay: 0.25, sustain: 75, release: 0.4 },
        reverbSend: 0.2,
        routingEnabled: true,
        sustainEnabled: true,
        keyRangeMin: 0,
        keyRangeMax: 127,
        octaveOffset: 0,
        midiSensitivity: 1.0,
        chorusBypass: true,
        chorusRate: 1.5,
        chorusDepth: 0.3,
        chorusMix: 0.45,
        tremoloBypass: true,
        tremoloRate: 5.0,
        tremoloDepth: 0.5,
        tremoloMode: 'volume' as const
      })),
      reverbDecay: 2.5,
      reverbMix: 0.25
    }));

    const nextBanks = {
      ...liveSetBanks,
      [nextCount]: newBankSlots
    };
    setLiveSetBanks(nextBanks);
    try {
      localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
    } catch (e) {}

    const nextNames = { ...bankNames, [nextCount]: `USER ${nextCount}` };
    setBankNames(nextNames);

    const nextColors = { ...bankColors, [nextCount]: 'zinc' };
    setBankColors(nextColors);

    setCurrentBankIndex(nextCount);
    showNotification(`Novo banco "USER ${nextCount}" adicionado com sucesso! (16 slots)`, 'success');
  };

  const handleDeleteUserBank = (bIdx: number) => {
    if (userBankCount <= 4) {
      showNotification('Você deve manter no mínimo 4 bancos USER.', 'warning');
      return;
    }
    const bankName = bankNames[bIdx] || `USER ${bIdx}`;
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Banco USER',
      message: `Tem certeza que deseja excluir o banco "${bankName}"? Esta ação não poderá ser desfeita.`,
      onConfirm: () => {
        const nextBanks = { ...liveSetBanks };
        delete nextBanks[bIdx];
        setLiveSetBanks(nextBanks);
        try {
          localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(nextBanks));
        } catch (e) {}

        const nextNames = { ...bankNames };
        delete nextNames[bIdx];
        setBankNames(nextNames);

        const nextColors = { ...bankColors };
        delete nextColors[bIdx];
        setBankColors(nextColors);

        const nextCount = Math.max(4, userBankCount - 1);
        setUserBankCount(nextCount);

        if (currentBankIndex === bIdx) {
          setCurrentBankIndex(Math.min(bIdx, nextCount));
        }

        setConfirmDialog(null);
        showNotification(`Banco "${bankName}" excluído com sucesso!`, 'info');
      }
    });
  };

  const currentSlots = liveSetBanks[currentBankIndex] || [];

  // Sync active SoundFonts to SynthEngine's memory (lazy decoding active channels & full active Live Set bank for 0-latency switching)
  useEffect(() => {
    let isMounted = true;
    let clearStatusTimeoutId: any = null;
    const syncSFs = async () => {
      await synthEngineInstance.updateDecodedSoundFonts(channels, currentSlots, loadedSoundFonts, (name, progress, currentIdx, totalCount) => {
        if (!isMounted) return;
        if (clearStatusTimeoutId) {
          clearTimeout(clearStatusTimeoutId);
          clearStatusTimeoutId = null;
        }
        setDecodingStatus({ name, progress, currentIdx, totalCount });
      }, auditioningSoundFont);
      if (isMounted) {
        clearStatusTimeoutId = setTimeout(() => {
          if (isMounted) {
            setDecodingStatus(null);
          }
        }, 300);
      }
    };
    syncSFs();
    return () => {
      isMounted = false;
      if (clearStatusTimeoutId) {
        clearTimeout(clearStatusTimeoutId);
      }
    };
  }, [channels, currentSlots, loadedSoundFonts, auditioningSoundFont]);

  const loadModxPerformance = (perfId: string) => {
    const perf = currentSlots.find(p => p.id === perfId);
    if (!perf) return;

    setSelectedPerformanceId(perfId);
    setSelectedPerformanceName(perf.name);
    setPerformanceCategory(perf.category);

    const nextChannels = channels.map((ch, idx) => {
      const pData = perf.channelsData[idx] || perf.channelsData[0];
      
      let targetSfIndex = pData.soundfontIndex ?? 0;
      let savedId = pData.soundfontId;
      let savedName = pData.soundfontName;
      let savedGain = pData.soundfontGain ?? 1.0;
      
      if (savedId || savedName) {
        const foundSfIndex = loadedSoundFonts.findIndex(sf => 
          (savedId && sf.id === savedId) || 
          (savedName && sf.name === savedName) ||
          (savedName && sf.name.toLowerCase() === savedName.toLowerCase())
        );
        
        if (foundSfIndex !== -1) {
          targetSfIndex = foundSfIndex;
          const targetSf = loadedSoundFonts[foundSfIndex];
          savedId = targetSf.id;
          savedName = targetSf.name;
          try {
            const storedGains = JSON.parse(localStorage.getItem('sf2_custom_gains') || '{}');
            savedGain = pData.soundfontGain ?? storedGains[targetSf.id] ?? storedGains[targetSf.name] ?? 1.0;
          } catch (err) {
            savedGain = pData.soundfontGain ?? 1.0;
          }
        } else {
          const nameToDisplay = savedName || 'Desconhecido';
          showNotification(`Aviso: O SoundFont "${nameToDisplay}" do Layer ${idx + 1} não está carregado. Usando o sintetizador integrado.`, 'warning');
          targetSfIndex = 0;
          savedGain = 1.0;
        }
      }

      return {
        ...ch,
        soundfontIndex: targetSfIndex,
        presetIndex: pData.presetIndex ?? 0,
        soundfontId: savedId,
        soundfontName: savedName,
        soundfontGain: savedGain,
        volume: pData.volume,
        pan: pData.pan,
        filterType: pData.filterType as any,
        filterCutoff: pData.filterCutoff,
        filterResonance: pData.filterResonance,
        eqLow: pData.eqLow,
        eqMid: pData.eqMid,
        eqHigh: pData.eqHigh,
        eqBands: pData.eqBands ? pData.eqBands.map(b => ({ ...b })) : [
          { gain: pData.eqLow ?? 0, frequency: 80, q: 0.7 },
          { gain: 0, frequency: 250, q: 1.0 },
          { gain: pData.eqMid ?? 0, frequency: 1000, q: 1.0 },
          { gain: 0, frequency: 4000, q: 1.0 },
          { gain: pData.eqHigh ?? 0, frequency: 12000, q: 0.7 }
        ],
        adsr: { ...pData.adsr },
        reverbSend: pData.reverbSend,
        routingEnabled: pData.routingEnabled ?? true,
        sustainEnabled: pData.sustainEnabled ?? true,
        keyRangeMin: pData.keyRangeMin ?? 0,
        keyRangeMax: pData.keyRangeMax ?? 127,
        octaveOffset: pData.octaveOffset ?? 0,
        midiSensitivity: pData.midiSensitivity ?? 1.0,
        chorusBypass: pData.chorusBypass ?? true,
        chorusRate: pData.chorusRate ?? 1.5,
        chorusDepth: pData.chorusDepth ?? 0.3,
        chorusMix: pData.chorusMix ?? 0.45,
        tremoloBypass: pData.tremoloBypass ?? true,
        tremoloRate: pData.tremoloRate ?? 5.0,
        tremoloDepth: pData.tremoloDepth ?? 0.5,
        tremoloMode: pData.tremoloMode ?? 'volume',
        delayBypass: pData.delayBypass ?? true,
        delayTime: pData.delayTime ?? 0.35,
        delayFeedback: pData.delayFeedback ?? 0.4,
        delayMix: pData.delayMix ?? 0.3,
        delayHighCut: pData.delayHighCut ?? 8000,
      };
    });

    onChannelsChange(nextChannels);
    onReverbChange(perf.reverbDecay, perf.reverbMix);

    // Flash VU meter
    setVuLevels([0.5, 0.5, 0.5, 0.5]);
  };

  // Drag handler for physical Data Wheel rotation delta calculations
  const handleWheelPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingWheel(true);
    startWheelPointerY.current = e.clientY;
    startWheelAngle.current = dataWheelAngle;
  };

  const handleWheelPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingWheel) return;
    const deltaY = startWheelPointerY.current - e.clientY;
    
    // Rotate 2 degrees per pixel dragged
    const nextAngle = startWheelAngle.current + deltaY * 2.2;
    setDataWheelAngle(nextAngle);

    // Apply incremental change to active focused param
    if (activeParamFocus) {
      const [chIdx, paramKey] = activeParamFocus;
      const ch = channels[chIdx];
      const rangeScale = deltaY * 0.005; // speed modifier
      
      let nextValue = 0;
      if (paramKey === 'volume' || paramKey === 'reverbSend' || paramKey === 'pan') {
        const minVal = paramKey === 'pan' ? -1.0 : 0.0;
        const maxVal = 1.0;
        const curVal = ch[paramKey as keyof ChannelState] as number;
        nextValue = Math.max(minVal, Math.min(maxVal, curVal + rangeScale * (maxVal - minVal)));
        
        updateChannelValue(chIdx, paramKey as any, parseFloat(nextValue.toFixed(2)));
      } else if (paramKey === 'filterCutoff') {
        const curVal = ch.filterCutoff;
        nextValue = Math.max(40, Math.min(20000, curVal + deltaY * 45));
        updateChannelValue(chIdx, 'filterCutoff', Math.round(nextValue));
      } else if (paramKey.startsWith('adsr_')) {
        const adsrKey = paramKey.replace('adsr_', '') as keyof ADSR;
        const curVal = ch.adsr[adsrKey];
        const minVal = adsrKey === 'sustain' ? 0 : 0.000;
        const maxAtt = attackMax1s ? 1.0 : 3.0;
        const maxVal = adsrKey === 'sustain' ? 100 : (adsrKey === 'attack' ? maxAtt : 5.0);
        const scale = adsrKey === 'sustain' ? 1.5 : (adsrKey === 'attack' && attackMax1s ? 0.012 : 0.035);
        nextValue = Math.max(minVal, Math.min(maxVal, curVal + deltaY * scale));
        
        const nextChannels = [...channels];
        nextChannels[chIdx] = {
          ...nextChannels[chIdx],
          adsr: {
            ...nextChannels[chIdx].adsr,
            [adsrKey]: adsrKey === 'sustain' ? Math.round(nextValue) : parseFloat(nextValue.toFixed(3))
          }
        };
        onChannelsChange(nextChannels);
      }
    }

    // Reset reference periodically to make drags relative and continuous
    startWheelPointerY.current = e.clientY;
    if (activeParamFocus) {
      const [chIdx, paramKey] = activeParamFocus;
      const ch = channels[chIdx];
      if (paramKey.startsWith('adsr_')) {
        startWheelAngle.current = nextAngle;
      } else {
        startWheelAngle.current = nextAngle;
      }
    }
  };

  const handleWheelPointerUp = (e: React.PointerEvent) => {
    if (isDraggingWheel) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDraggingWheel(false);
    }
  };

  const updateChannelValue = <K extends keyof ChannelState>(idx: number, key: K, value: ChannelState[K]) => {
    const next = [...channels];
    next[idx] = {
      ...next[idx],
      [key]: value,
    };
    onChannelsChange(next);
  };

  // Listen for MIDI or virtual keyboard notes to set keyRangeMin or keyRangeMax
  useEffect(() => {
    const handleGenericNoteOn = (e: Event) => {
      if (!listeningKeyRange) return;
      const { note } = (e as CustomEvent).detail;
      if (typeof note === 'number') {
        const { layerIndex, type } = listeningKeyRange;
        updateChannelValue(layerIndex, type, note);
        
        // Enforce that keyRangeMin cannot exceed keyRangeMax, and vice-versa
        const ch = channels[layerIndex];
        if (type === 'keyRangeMin') {
          const currentMax = ch.keyRangeMax ?? 127;
          if (note > currentMax) {
            updateChannelValue(layerIndex, 'keyRangeMax', note);
          }
        } else {
          const currentMin = ch.keyRangeMin ?? 0;
          if (note < currentMin) {
            updateChannelValue(layerIndex, 'keyRangeMin', note);
          }
        }
        
        setListeningKeyRange(null);
        showNotification(`Limite ${type === 'keyRangeMin' ? 'Mínimo' : 'Máximo'} do Layer 0${layerIndex + 1} definido para ${midiNoteToName(note)}!`, 'success');
      }
    };

    window.addEventListener('keyboard-note-on', handleGenericNoteOn);
    window.addEventListener('synth-midi-on', handleGenericNoteOn);
    return () => {
      window.removeEventListener('keyboard-note-on', handleGenericNoteOn);
      window.removeEventListener('synth-midi-on', handleGenericNoteOn);
    };
  }, [listeningKeyRange, channels, updateChannelValue]);

  const handleTapTempo = () => {
    const now = Date.now();
    if (lastTapTime.current > 0) {
      const diff = now - lastTapTime.current;
      // Filter out double clicks / glitches
      if (diff > 200 && diff < 2000) {
        const calcBpm = Math.round(60000 / diff);
        setBpm(Math.max(40, Math.min(240, calcBpm)));
      }
    }
    lastTapTime.current = now;
  };

  const handleSoundFontDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleSoundFontDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter((f: File) => {
        const lower = f.name.toLowerCase();
        return lower.endsWith('.sf2') || lower.endsWith('.sf3') || lower.endsWith('.sfz');
      });
      if (filesArray.length > 0) {
        onSoundFontsUploaded(filesArray, selectedWaveformCategory || undefined);
      } else {
        showNotification('Por favor, envie um ou mais arquivos de banco SoundFont (.sf2).', 'warning');
      }
    }
  };

  // Category / Class custom names list state
  const [categoryList, setCategoryList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sf2_custom_categories_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set(parsed.map((s: string) => s.trim()).filter(Boolean)));
        }
      }
    } catch (e) {}
    return Array.from(new Set(SF2_CATEGORIES));
  });

  const [renameCategoryTarget, setRenameCategoryTarget] = useState<string | null>(null);
  const [renameCategoryName, setRenameCategoryName] = useState<string>('');
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  const handleRenameCategory = (oldCatName: string, newCatName: string) => {
    const trimmed = newCatName.trim();
    if (!trimmed || trimmed === oldCatName) return;

    // Check if new name already exists in categoryList
    const targetExists = categoryList.some(c => c.toLowerCase() === trimmed.toLowerCase() && c !== oldCatName);

    let nextList: string[];
    if (targetExists) {
      const targetExact = categoryList.find(c => c.toLowerCase() === trimmed.toLowerCase()) || trimmed;
      nextList = categoryList.filter(c => c !== oldCatName);

      const updatedSfCategories = { ...sfCategories };
      (loadedSoundFonts || []).forEach(sf => {
        const currentCat = updatedSfCategories[sf.id] || (oldCatName === 'Piano' ? 'Piano' : undefined);
        if (currentCat === oldCatName) {
          updatedSfCategories[sf.id] = targetExact;
        }
      });
      onSfCategoriesChange(updatedSfCategories);

      if (selectedWaveformCategory === oldCatName) {
        setSelectedWaveformCategory(targetExact);
      }

      showNotification(`Bancos de "${oldCatName}" mesclados na classe existente "${targetExact}".`, 'info');
    } else {
      nextList = categoryList.map(c => c === oldCatName ? trimmed : c);

      const updatedSfCategories = { ...sfCategories };
      (loadedSoundFonts || []).forEach(sf => {
        const currentCat = updatedSfCategories[sf.id] || (oldCatName === 'Piano' ? 'Piano' : undefined);
        if (currentCat === oldCatName) {
          updatedSfCategories[sf.id] = trimmed;
        }
      });
      onSfCategoriesChange(updatedSfCategories);

      if (selectedWaveformCategory === oldCatName) {
        setSelectedWaveformCategory(trimmed);
      }

      showNotification(`Classe / Categoria "${oldCatName}" renomeada para "${trimmed}"!`, 'success');
    }

    setCategoryList(nextList);
    try {
      localStorage.setItem('sf2_custom_categories_list', JSON.stringify(nextList));
    } catch (e) {}
  };

  const handleAddCategory = (catName: string) => {
    const trimmed = catName.trim();
    if (!trimmed) return;
    const existing = categoryList.find(c => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      showNotification(`A classe "${existing}" já existe!`, 'warning');
      return;
    }
    const nextList = [...categoryList, trimmed];
    setCategoryList(nextList);
    try {
      localStorage.setItem('sf2_custom_categories_list', JSON.stringify(nextList));
    } catch (e) {}
    showNotification(`Nova Classe "${trimmed}" criada com sucesso!`, 'success');
  };

  const handleRestoreDefaultCategories = () => {
    const combined = Array.from(new Set([...categoryList, ...SF2_CATEGORIES]));
    setCategoryList(combined);
    try {
      localStorage.setItem('sf2_custom_categories_list', JSON.stringify(combined));
    } catch (e) {}
    showNotification('Todas as 20 Classes Padrão do sistema foram repostas/restauradas com sucesso!', 'success');
  };

  const handleDeleteCategory = (catName: string) => {
    const countInCat = (loadedSoundFonts || []).filter(sf => sf && sfCategories && (sfCategories[sf.id] === catName || (catName === 'Piano' && !sfCategories[sf.id]))).length;
    
    if (countInCat > 0) {
      showNotification(`A classe "${catName}" possui ${countInCat} banco(s) SF2. Mova ou remova os bancos antes de excluí-la.`, 'warning');
      return;
    }

    const nextList = categoryList.filter(c => c !== catName);
    setCategoryList(nextList);
    try {
      localStorage.setItem('sf2_custom_categories_list', JSON.stringify(nextList));
    } catch (e) {}
    if (selectedWaveformCategory === catName) {
      setSelectedWaveformCategory(null);
    }
    showNotification(`Classe "${catName}" excluída!`, 'info');
  };

  // Backup & Waveform Favorites / Search States
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [backupProgress, setBackupProgress] = useState<{
    active: boolean;
    type: 'export' | 'import';
    percent: number;
    status: string;
  }>({
    active: false,
    type: 'export',
    percent: 0,
    status: ''
  });

  const [sfFavorites, setSfFavorites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('sf2_favorites');
      if (raw) return new Set(JSON.parse(raw));
    } catch (e) {}
    return new Set();
  });

  const [sfSearchQuery, setSfSearchQuery] = useState('');
  const [sfFavoritesOnly, setSfFavoritesOnly] = useState(false);

  const toggleFavorite = (sfId: string) => {
    setSfFavorites(prev => {
      const next = new Set(prev);
      if (next.has(sfId)) {
        next.delete(sfId);
        showNotification('Removido dos favoritos', 'info');
      } else {
        next.add(sfId);
        showNotification('Adicionado aos favoritos! ★', 'success');
      }
      try {
        localStorage.setItem('sf2_favorites', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  const buildBackupManifest = () => {
    const exportedSfAttributes = { ...sfAttributes };
    const exportedSfCategories = { ...sfCategories };
    const exportedSfFavorites = Array.from(sfFavorites);

    // Maps by Soundfont File Name (crucial for cross-machine or re-upload attribute matching)
    const sfAttributesByFileName: Record<string, string[]> = {};
    const sfCategoriesByFileName: Record<string, string> = {};
    const sfFavoritesByFileName: string[] = [];

    // Grouping SF2 files by category for structured reading
    const soundfontsByCategory: Record<string, Array<{ id: string; name: string; sizeMb: number; presetsCount: number; attributes: string[]; isFavorite: boolean }>> = {};

    (loadedSoundFonts || []).forEach(sf => {
      if (!sf) return;
      const attrs = sfAttributes[sf.id] || sfAttributes[sf.name];
      if (attrs && attrs.length > 0) {
        sfAttributesByFileName[sf.name] = attrs;
      }
      const cat = sfCategories[sf.id] || sfCategories[sf.name] || 'Piano';
      if (cat) {
        sfCategoriesByFileName[sf.name] = cat;
      }
      const isFav = sfFavorites.has(sf.id) || sfFavorites.has(sf.name);
      if (isFav) {
        sfFavoritesByFileName.push(sf.name);
      }

      if (!soundfontsByCategory[cat]) {
        soundfontsByCategory[cat] = [];
      }
      soundfontsByCategory[cat].push({
        id: sf.id,
        name: sf.name,
        sizeMb: sf.sizeMb,
        presetsCount: sf.presetsCount,
        attributes: attrs || [],
        isFavorite: isFav
      });
    });

    return {
      version: '3.5',
      timestamp: new Date().toISOString(),
      userBankCount,
      bankNames,
      bankColors,
      liveSetBanks,
      savedPresets: savedPresets || [],
      channels,
      sf2_saved_configs: localStorage.getItem('sf2_saved_configs') ? JSON.parse(localStorage.getItem('sf2_saved_configs')!) : {},
      sf2_custom_gains: localStorage.getItem('sf2_custom_gains') ? JSON.parse(localStorage.getItem('sf2_custom_gains')!) : {},
      midiMappings,
      sfCategories: exportedSfCategories,
      sfCategoriesByFileName,
      sfAttributes: exportedSfAttributes,
      sfAttributesByFileName,
      sfFavorites: exportedSfFavorites,
      sfFavoritesByFileName,
      categoryList: categoryList || [],
      soundfontsByCategory,
      soundfontsMeta: (loadedSoundFonts || []).map(sf => ({
        id: sf.id,
        name: sf.name,
        sizeMb: sf.sizeMb,
        presetsCount: sf.presetsCount,
        presets: sf.presets,
        category: sfCategories[sf.id] || sfCategories[sf.name] || 'Piano',
        attributes: sfAttributes[sf.id] || sfAttributes[sf.name] || [],
        isFavorite: sfFavorites.has(sf.id) || sfFavorites.has(sf.name)
      })),
      reverbDecay,
      reverbMix,
      reverbPreDelay,
      reverbHighCut,
      reverbBypass,
      tremoloBypass,
      tremoloRate,
      tremoloDepth,
      tremoloMode,
      chorusBypass,
      chorusRate,
      chorusDepth,
      chorusMix,
      masterVolume
    };
  };

  const handleExportCategoryListTxt = () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    let text = `========================================================\n`;
    text += `CATÁLOGO DE SOUNDFONTS (SF2) POR CATEGORIA - STUDIO-SF2\n`;
    text += `Data de Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    text += `Total de Arquivos SF2: ${loadedSoundFonts?.length || 0}\n`;
    text += `========================================================\n\n`;

    const categoryMap: Record<string, typeof loadedSoundFonts> = {};
    
    (categoryList || ['Piano', 'E.Piano', 'Organ', 'Strings', 'Brass', 'Synth', 'Pad', 'Bass', 'Guitar', 'Lead']).forEach(cat => {
      categoryMap[cat] = [];
    });

    (loadedSoundFonts || []).forEach(sf => {
      if (!sf) return;
      const cat = sfCategories[sf.id] || sfCategories[sf.name] || 'Piano';
      if (!categoryMap[cat]) categoryMap[cat] = [];
      categoryMap[cat].push(sf);
    });

    Object.entries(categoryMap).forEach(([cat, list]) => {
      if (!list || list.length === 0) return;
      text += `📁 CATEGORIA: [ ${cat.toUpperCase()} ] (${list.length} SF2s)\n`;
      text += `--------------------------------------------------------\n`;
      list.forEach((sf, idx) => {
        const attrs = sfAttributes[sf.id] || sfAttributes[sf.name] || [];
        const isFav = sfFavorites.has(sf.id) || sfFavorites.has(sf.name) ? '⭐ [FAVORITO] ' : '';
        const attrStr = attrs.length > 0 ? ` | Atributos/Tags: [ ${attrs.join(', ')} ]` : '';
        text += `  ${idx + 1}. ${isFav}${sf.name} (${(sf.sizeMb || 0).toFixed(1)} MB - ${sf.presetsCount || 1} presets)${attrStr}\n`;
      });
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `catalogo_sf2_por_categoria_${dateStr}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showNotification('Lista de SF2 por Categoria (.TXT) baixada com sucesso!', 'success');
  };

  const restoreBackupJsonConfig = (parsedJson: any) => {
    if (!parsedJson) return;

    // Restore User Bank Count
    if (typeof parsedJson.userBankCount === 'number' && parsedJson.userBankCount >= 4) {
      setUserBankCount(parsedJson.userBankCount);
    } else if (parsedJson.liveSetBanks) {
      const keys = Object.keys(parsedJson.liveSetBanks).map(k => parseInt(k, 10)).filter(n => !isNaN(n) && n > 0);
      if (keys.length > 0) {
        setUserBankCount(Math.max(4, Math.max(...keys)));
      }
    }

    // 1. Restore Custom Bank Names (e.g., USER 1 -> "NORD L")
    if (parsedJson.bankNames) {
      setBankNames(parsedJson.bankNames);
      try {
        localStorage.setItem('sf2_synth_bank_names', JSON.stringify(parsedJson.bankNames));
      } catch (e) {}
    }

    // 2. Restore Bank Colors
    if (parsedJson.bankColors) {
      setBankColors(parsedJson.bankColors);
      try {
        localStorage.setItem('sf2_synth_bank_colors', JSON.stringify(parsedJson.bankColors));
      } catch (e) {}
    }

    // 3. Restore Live Set Slots
    if (parsedJson.liveSetBanks) {
      let normalizedBanks: { [bankIndex: number]: any[] } = {};
      if (Array.isArray(parsedJson.liveSetBanks)) {
        parsedJson.liveSetBanks.forEach((bankSlots: any, idx: number) => {
          if (Array.isArray(bankSlots)) {
            normalizedBanks[idx + 1] = bankSlots;
          }
        });
      } else if (typeof parsedJson.liveSetBanks === 'object') {
        Object.entries(parsedJson.liveSetBanks).forEach(([key, bankSlots]) => {
          const numKey = parseInt(key, 10);
          if (!isNaN(numKey) && Array.isArray(bankSlots)) {
            normalizedBanks[numKey] = bankSlots as any[];
          }
        });
      }

      if (Object.keys(normalizedBanks).length > 0) {
        setLiveSetBanks(normalizedBanks);
        try {
          localStorage.setItem('sf2_synth_live_sets_v3', JSON.stringify(normalizedBanks));
          localStorage.setItem('sf2_synth_liveset_banks_v4', JSON.stringify(normalizedBanks));
        } catch (e) {}
      }
    }

    // 4. Restore Channel States
    if (Array.isArray(parsedJson.channels)) {
      onChannelsChange(parsedJson.channels);
    }

    // 5. Restore Presets
    let importedPresets: SynthPreset[] = [];
    if (Array.isArray(parsedJson)) {
      importedPresets = parsedJson;
    } else if (parsedJson && Array.isArray(parsedJson.savedPresets)) {
      importedPresets = parsedJson.savedPresets;
    }

    if (importedPresets.length > 0) {
      if (onSavePreset) {
        importedPresets.forEach(p => onSavePreset(p));
      }
      try {
        localStorage.setItem('modx_saved_presets', JSON.stringify(importedPresets));
      } catch (e) {}
    }

    // 6. Restore LocalStorage Configs & Gains & MIDI mappings
    if (parsedJson.sf2_saved_configs) {
      localStorage.setItem('sf2_saved_configs', JSON.stringify(parsedJson.sf2_saved_configs));
    }
    if (parsedJson.sf2_custom_gains) {
      localStorage.setItem('sf2_custom_gains', JSON.stringify(parsedJson.sf2_custom_gains));
    }
    if (parsedJson.midiMappings) {
      setMidiMappings(parsedJson.midiMappings);
      localStorage.setItem('synth_midi_cc_mappings_v1', JSON.stringify(parsedJson.midiMappings));
    }

    // 7. Restore SF Categories
    let mergedCategories: Record<string, string> = { ...sfCategories };
    if (parsedJson.sfCategories) {
      mergedCategories = { ...mergedCategories, ...parsedJson.sfCategories };
    }
    if (parsedJson.sfCategoriesByFileName) {
      Object.entries(parsedJson.sfCategoriesByFileName).forEach(([fname, cat]) => {
        mergedCategories[fname] = cat as string;
      });
    }
    if (Array.isArray(parsedJson.soundfontsMeta)) {
      parsedJson.soundfontsMeta.forEach((meta: any) => {
        if (meta.category) {
          if (meta.id) mergedCategories[meta.id] = meta.category;
          if (meta.name) mergedCategories[meta.name] = meta.category;
        }
      });
    }
    if (loadedSoundFonts) {
      loadedSoundFonts.forEach(sf => {
        if (!mergedCategories[sf.id]) {
          if (parsedJson.sfCategoriesByFileName?.[sf.name]) {
            mergedCategories[sf.id] = parsedJson.sfCategoriesByFileName[sf.name];
          } else if (parsedJson.sfCategories?.[sf.name]) {
            mergedCategories[sf.id] = parsedJson.sfCategories[sf.name];
          }
        }
      });
    }
    if (onSfCategoriesChange) {
      onSfCategoriesChange(mergedCategories);
    }
    try {
      localStorage.setItem('sf2_categories_map', JSON.stringify(mergedCategories));
    } catch (e) {}

    // 8. Restore SF Attributes (subcategories/tags e.g. Acústico, Elétrico, etc.)
    let mergedAttributes: Record<string, string[]> = { ...sfAttributes };
    if (parsedJson.sfAttributes) {
      mergedAttributes = { ...mergedAttributes, ...parsedJson.sfAttributes };
    }
    if (parsedJson.sfAttributesByFileName) {
      Object.entries(parsedJson.sfAttributesByFileName).forEach(([fname, attrs]) => {
        mergedAttributes[fname] = attrs as string[];
      });
    }
    if (Array.isArray(parsedJson.soundfontsMeta)) {
      parsedJson.soundfontsMeta.forEach((meta: any) => {
        if (meta.attributes && Array.isArray(meta.attributes)) {
          if (meta.id) mergedAttributes[meta.id] = meta.attributes;
          if (meta.name) mergedAttributes[meta.name] = meta.attributes;
        }
      });
    }
    if (loadedSoundFonts) {
      loadedSoundFonts.forEach(sf => {
        if (!mergedAttributes[sf.id]) {
          if (parsedJson.sfAttributesByFileName?.[sf.name]) {
            mergedAttributes[sf.id] = parsedJson.sfAttributesByFileName[sf.name];
          } else if (parsedJson.sfAttributes?.[sf.name]) {
            mergedAttributes[sf.id] = parsedJson.sfAttributes[sf.name];
          }
        }
      });
    }
    setSfAttributes(mergedAttributes);
    try {
      localStorage.setItem('modx_sf_attributes', JSON.stringify(mergedAttributes));
    } catch (e) {}

    // 9. Restore Favorites
    const mergedFavs = new Set<string>(sfFavorites);
    if (Array.isArray(parsedJson.sfFavorites)) {
      parsedJson.sfFavorites.forEach((f: string) => mergedFavs.add(f));
    }
    if (Array.isArray(parsedJson.favorites)) {
      parsedJson.favorites.forEach((f: string) => mergedFavs.add(f));
    }
    if (Array.isArray(parsedJson.sfFavoritesByFileName)) {
      parsedJson.sfFavoritesByFileName.forEach((f: string) => mergedFavs.add(f));
    }
    if (Array.isArray(parsedJson.soundfontsMeta)) {
      parsedJson.soundfontsMeta.forEach((meta: any) => {
        if (meta.isFavorite) {
          if (meta.id) mergedFavs.add(meta.id);
          if (meta.name) mergedFavs.add(meta.name);
        }
      });
    }
    if (loadedSoundFonts) {
      loadedSoundFonts.forEach(sf => {
        if (mergedFavs.has(sf.name)) {
          mergedFavs.add(sf.id);
        }
      });
    }
    setSfFavorites(mergedFavs);
    try {
      localStorage.setItem('sf2_favorites', JSON.stringify(Array.from(mergedFavs)));
    } catch (e) {}

    // 10. Restore Category List
    if (Array.isArray(parsedJson.categoryList)) {
      setCategoryList(parsedJson.categoryList);
      try {
        localStorage.setItem('sf2_custom_categories_list', JSON.stringify(parsedJson.categoryList));
      } catch (e) {}
    }

    // 11. Restore Master Effects Settings
    if (typeof parsedJson.reverbDecay === 'number' && typeof parsedJson.reverbMix === 'number') {
      onReverbChange(parsedJson.reverbDecay, parsedJson.reverbMix, parsedJson.reverbPreDelay, parsedJson.reverbHighCut);
    }
    if (typeof parsedJson.masterVolume === 'number') {
      onMasterVolumeChange(parsedJson.masterVolume);
    }
  };

  const handleExportSettingsJson = () => {
    try {
      setBackupProgress({
        active: true,
        type: 'export',
        percent: 50,
        status: 'Exportando arquivo de configurações JSON...'
      });

      const backupManifest = buildBackupManifest();

      const dateStr = new Date().toISOString().slice(0, 10);
      const jsonStr = JSON.stringify(backupManifest, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = URL.createObjectURL(blob);
      downloadAnchor.setAttribute('download', `studio_sf2_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setBackupProgress({
        active: true,
        type: 'export',
        percent: 100,
        status: 'Configurações exportadas com sucesso!'
      });

      setTimeout(() => {
        setBackupProgress(prev => ({ ...prev, active: false }));
      }, 600);

      showNotification('Backup de Presets, Bancos e Configurações exportado em JSON com sucesso!', 'success');
    } catch (err: any) {
      setBackupProgress(prev => ({ ...prev, active: false }));
      showNotification('Erro ao exportar configurações JSON', 'warning');
    }
  };

  const handleExportBackup = async () => {
    try {
      setBackupProgress({
        active: true,
        type: 'export',
        percent: 5,
        status: 'Coletando presets, bancos e configurações...'
      });

      const zip = new JSZip();

      // 1. Gather all configuration and preset data
      const backupManifest = buildBackupManifest();

      // Add manifest JSON file to root of ZIP
      zip.file('studio_sf2_backup.json', JSON.stringify(backupManifest, null, 2));

      // 2. Fetch and add all raw SoundFont binary files from IndexedDB
      const soundfontFolder = zip.folder('soundfonts');
      const rawKeys = await getRawSoundFontKeys();
      let exportedSfCount = 0;
      const totalKeys = rawKeys.length;

      for (let i = 0; i < totalKeys; i++) {
        const key = rawKeys[i];
        const pct = Math.min(45, Math.round(5 + (((i + 1) / Math.max(1, totalKeys)) * 40)));
        setBackupProgress({
          active: true,
          type: 'export',
          percent: pct,
          status: `Carregando SoundFont (${i + 1}/${totalKeys})...`
        });

        const sfRecord = await getRawSoundFontRecord(key);
        if (sfRecord && sfRecord.data && sfRecord.data.byteLength > 0) {
          // Use original soundfont file name if available, otherwise sanitize ID
          let sfFileName = sfRecord.name || `${sfRecord.id}.sf2`;
          if (!sfFileName.toLowerCase().endsWith('.sf2') && !sfFileName.toLowerCase().endsWith('.wav')) {
            sfFileName += '.sf2';
          }
          
          // Convert raw ArrayBuffer to Blob to avoid duplicate Uint8Array allocation in JSZip RAM!
          const sfBlob = new Blob([sfRecord.data], { type: 'application/octet-stream' });
          soundfontFolder?.file(sfFileName, sfBlob);
          exportedSfCount++;
        }
      }

      setBackupProgress({
        active: true,
        type: 'export',
        percent: 45,
        status: `Gerando arquivo ZIP de backup completo (${exportedSfCount} SF2s)...`
      });

      // 3. Compress into single ZIP Blob with STORE mode (uncompressed) for fast execution & lowest RAM
      let zipBlob: Blob;
      try {
        zipBlob = await zip.generateAsync(
          {
            type: 'blob',
            compression: 'STORE',
            streamFiles: true
          },
          (meta) => {
            const currentPercent = Math.min(99, Math.round(45 + (meta.percent * 0.54)));
            setBackupProgress({
              active: true,
              type: 'export',
              percent: currentPercent,
              status: meta.currentFile
                ? `Empacotando: ${meta.currentFile.split('/').pop()} (${Math.round(meta.percent)}%)`
                : `Finalizando arquivo ZIP (${Math.round(meta.percent)}%)...`
            });
          }
        );
      } catch (zipErr: any) {
        console.warn('Memory limit for ZIP exceeded:', zipErr);
        setBackupProgress(prev => ({ ...prev, active: false }));
        showNotification(
          'Erro de Memória RAM: O tamanho dos SoundFonts é superior ao limite permitido pelo navegador para criar um arquivo ZIP único. Baixe as configurações em JSON e faça o re-upload dos arquivos SF2.',
          'warning'
        );
        return;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `STUDIO_SF2_BACKUP_FULL_${dateStr}.zip`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = URL.createObjectURL(zipBlob);
      downloadAnchor.setAttribute('download', fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setBackupProgress({
        active: true,
        type: 'export',
        percent: 100,
        status: 'Backup ZIP exportado com sucesso!'
      });

      setTimeout(() => {
        setBackupProgress(prev => ({ ...prev, active: false }));
      }, 800);

      showNotification(`Backup Completo Studio-SF2 (.ZIP) exportado com sucesso! (${exportedSfCount} arquivos SF2 inclusos)`, 'success');
    } catch (err: any) {
      console.error('Erro ao exportar backup:', err);
      setBackupProgress(prev => ({ ...prev, active: false }));
      showNotification(`Falha ao gerar Backup Completo em ZIP: ${err?.message || 'Memória insuficiente'}`, 'warning');
    }
  };

  const handleImportBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Immediately acquire ArrayBuffer safely using dual fallback (arrayBuffer() -> FileReader)
      let fileBuffer: ArrayBuffer | null = null;
      try {
        fileBuffer = await file.arrayBuffer();
      } catch (err1) {
        try {
          fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
          });
        } catch (err2) {
          fileBuffer = null;
        }
      }

      if (!fileBuffer || fileBuffer.byteLength === 0) {
        throw new Error('O navegador não conseguiu acessar o arquivo. Por favor, tente selecionar o arquivo de backup novamente.');
      }

      setBackupProgress({
        active: true,
        type: 'import',
        percent: 5,
        status: 'Lendo dados do arquivo de backup...'
      });

      const lowerName = file.name.toLowerCase();
      let parsedJson: any = null;
      let restoredSfCount = 0;

      if (lowerName.endsWith('.zip')) {
        setBackupProgress({
          active: true,
          type: 'import',
          percent: 10,
          status: 'Abrindo arquivo ZIP e localizando SoundFonts...'
        });

        const zip = await JSZip.loadAsync(fileBuffer, { checkCRC32: false });

        // Extract JSON manifest file
        const jsonFile = zip.file('studio_sf2_backup.json') || zip.file('modx_synth_backup.json') || Object.values(zip.files).find(f => f.name.endsWith('.json'));
        if (!jsonFile) {
          throw new Error('Arquivo de configuração (studio_sf2_backup.json) não encontrado dentro do arquivo ZIP.');
        }

        const jsonText = await jsonFile.async('text');
        parsedJson = JSON.parse(jsonText);

        // Find soundfont entries in soundfonts/ folder or root of ZIP
        const soundfontEntries = Object.values(zip.files).filter(f => !f.dir && (f.name.includes('soundfonts/') || f.name.toLowerCase().endsWith('.sf2') || f.name.toLowerCase().endsWith('.wav')));

        const metaMap = new Map<string, any>();
        if (parsedJson.soundfontsMeta && Array.isArray(parsedJson.soundfontsMeta)) {
          parsedJson.soundfontsMeta.forEach((m: any) => {
            if (m.id) metaMap.set(m.id, m);
            if (m.name) metaMap.set(m.name, m);
          });
        }

        // Restore JSON settings first
        restoreBackupJsonConfig(parsedJson);

        // Restore soundfonts sequentially directly to IndexedDB
        const totalSF = soundfontEntries.length;
        for (let i = 0; i < totalSF; i++) {
          const entry = soundfontEntries[i];
          const rawFileName = entry.name.split('/').pop() || '';
          const sfId = rawFileName.replace(/\.(sf2|wav)$/i, '');
          const meta = metaMap.get(sfId) || metaMap.get(rawFileName) || Array.from(metaMap.values()).find((m: any) => m.name === rawFileName || m.name === rawFileName.replace(/\.(sf2|wav)$/i, '') + '.sf2');
          const sfName = meta?.name || rawFileName;

          const pct = Math.min(98, Math.round(20 + (((i + 1) / Math.max(1, totalSF)) * 75)));
          setBackupProgress({
            active: true,
            type: 'import',
            percent: pct,
            status: `Extraindo e gravando SoundFont (${i + 1}/${totalSF}): ${sfName}...`
          });

          const buffer = await entry.async('arraybuffer');
          let presets = meta?.presets;
          if (!presets || presets.length === 0) {
            try {
              const parser = new SF2Parser(buffer);
              const parsedSf = parser.parse();
              presets = parsedSf.presets;
            } catch (e) {
              presets = [{ name: sfName.replace(/\.sf2$/i, ''), preset: 0, bank: 0 }];
            }
          }

          const targetId = sfId || `sf_${Date.now()}_${i}`;
          await saveSoundFont(targetId, sfName, buffer, presets);
          restoredSfCount++;
        }

        // Re-apply backup configs to bind restored attributes & categories to newly inserted soundfonts
        restoreBackupJsonConfig(parsedJson);
      } else {
        // Standard JSON import using decoded fileBuffer
        const content = new TextDecoder('utf-8').decode(fileBuffer);
        parsedJson = JSON.parse(content);
        if (parsedJson) {
          restoreBackupJsonConfig(parsedJson);
        }
      }

      if (onReloadSoundFontsFromDb) {
        await onReloadSoundFontsFromDb();
      }

      setBackupProgress({
        active: true,
        type: 'import',
        percent: 100,
        status: 'Backup restaurado com sucesso!'
      });

      setTimeout(() => {
        setBackupProgress(prev => ({ ...prev, active: false }));
      }, 800);

      showNotification(`Backup Restaurado com Sucesso! (${restoredSfCount} arquivos SF2 gravados com todos os seus atributos)`, 'success');
    } catch (err: any) {
      console.error('Erro ao importar backup:', err);
      setBackupProgress(prev => ({ ...prev, active: false }));
      showNotification(`Falha ao importar backup: ${err?.message || 'Arquivo corrompido ou inacessível'}`, 'warning');
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetInputName.trim()) return;
    onSavePreset(presetInputName.trim());
    setPresetInputName('');
    showNotification('Preset de Performance salvo com sucesso na memória flash local!', 'success');
  };

  // Helper coordinates for drawing ADSR Graph in FX screen tab
  const getAdsrPath = (channelIdx: number) => {
    const { attack, decay, sustain, release } = channels[channelIdx].adsr;
    const w = 240;
    const h = 80;
    const padding = 10;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const maxTime = 12.0;
    const totalTime = attack + decay + 3.0 + release;
    
    const attackX = padding + (attack / maxTime) * graphW;
    const decayX = attackX + (decay / maxTime) * graphW;
    const sustainX = decayX + (3.0 / maxTime) * graphW;
    const releaseX = Math.min(w - padding, sustainX + (release / maxTime) * graphW);

    const sustainY = padding + graphH - (sustain / 100) * graphH;

    return `M ${padding} ${padding + graphH} L ${attackX} ${padding} L ${decayX} ${sustainY} L ${sustainX} ${sustainY} L ${releaseX} ${padding + graphH}`;
  };

  const channelAccents = [
    'border-amber-500/60 text-amber-400 bg-amber-500/10',
    'border-sky-500/60 text-sky-400 bg-sky-500/10',
    'border-emerald-500/60 text-emerald-400 bg-emerald-500/10',
    'border-rose-500/60 text-rose-400 bg-rose-500/10',
  ];

  const channelSolidBg = [
    'bg-amber-500',
    'bg-sky-500',
    'bg-emerald-500',
    'bg-rose-500',
  ];

  return (
    <div className="w-full bg-[#1c1d1f] p-4 rounded-xl border border-zinc-800 shadow-[0_12px_40px_rgba(0,0,0,0.8)] relative flex flex-col gap-4 select-none min-h-0">
      
      {/* Upper Brand / Workstation Label */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-1.5 font-mono text-zinc-400 text-[12px] tracking-wider uppercase font-black">
          <span>STUDIO-SF2 WORKSTATION SYNTH ENGINE</span>
          <span className="w-1 h-1 rounded-full bg-zinc-600" />
          <span>MULTI-LAYER PLAYBACK v3</span>
        </div>
        <div className="font-mono text-white text-[10.5px] font-black tracking-wider uppercase flex items-center gap-1">
          <span>CONSOLE</span>
          <span className="text-emerald-400 text-[12px] font-black bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">ACTIVE</span>
        </div>
      </div>

      {/* Main Console: Full Touchscreen Display */}
      <div className="w-full">
        
        {/* ========================================================= */}
        {/* EMULATED TOUCHSCREEN DISPLAY (Now 100% full-width, expanded height) */}
        {/* ========================================================= */}
        <div className="w-full bg-black rounded-lg border border-zinc-950 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),0_2px_4px_rgba(255,255,255,0.03)] p-0.5 overflow-hidden flex flex-col relative min-h-[460px]">
          
          {/* A. Top Navigation Bar (Barra de Navegação) */}
          <div className="bg-[#111214] border-b border-zinc-800 px-3 py-1.5 flex justify-between items-center text-[10px] font-mono text-zinc-400 shrink-0 select-none">
            
            {/* Home / Exit Controls + Selected Performance Title */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setActiveTab('performance'); setSelectedPerformanceId(''); }}
                className={`p-1 rounded-md transition cursor-pointer flex items-center justify-center border ${
                  activeTab === 'performance' 
                    ? 'text-emerald-400 bg-zinc-900 border-emerald-500/20' 
                    : 'text-zinc-300 bg-black/20 border-zinc-800 hover:text-zinc-300'
                }`}
                title="Home / Performance Play"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => setActiveTab('live-set')}
                className="px-2.5 py-1 text-[11px] font-mono font-black border border-emerald-500/25 text-emerald-400 bg-emerald-500/10 hover:border-emerald-500/40 rounded-full tracking-wide cursor-pointer uppercase transition-all shadow-[0_0_6px_rgba(16,185,129,0.1)]"
                title="Sair para o Live Set"
              >
                CAT: {(performanceCategory || 'USER CUSTOM LAYER').toUpperCase()}
              </button>

              <span className="text-[15px] font-sans font-black text-white uppercase tracking-tight ml-1 px-1">
                {selectedPerformanceName || 'S700'}
              </span>

              {/* DYNAMIC MULTI-LAYER SOLO BUTTON IN HEADER */}
              {(() => {
                const focusedIdx = activeParamFocus?.[0] ?? 0;
                const soloedLayers = channels.map((ch, idx) => ch.solo ? idx : -1).filter(idx => idx !== -1);
                const isAnySoloActive = soloedLayers.length > 0;

                const layerPillStyles = [
                  'bg-amber-400 text-black font-black px-1.5 py-0.5 rounded text-[10px] shadow-[0_0_8px_rgba(245,158,11,0.5)] border border-amber-300',
                  'bg-sky-400 text-black font-black px-1.5 py-0.5 rounded text-[10px] shadow-[0_0_8px_rgba(14,165,233,0.5)] border border-sky-300',
                  'bg-emerald-400 text-black font-black px-1.5 py-0.5 rounded text-[10px] shadow-[0_0_8px_rgba(16,185,129,0.5)] border border-emerald-300',
                  'bg-rose-400 text-black font-black px-1.5 py-0.5 rounded text-[10px] shadow-[0_0_8px_rgba(244,63,94,0.5)] border border-rose-300'
                ];

                const handleToggleTopSolo = () => {
                  if (isAnySoloActive) {
                    // Se houver qualquer SOLO ativo (ON): desativa todos os solos
                    const nextCh = channels.map((ch) => ({ ...ch, solo: false }));
                    onChannelsChange(nextCh);
                  } else {
                    // Se estiver em OFF: ativa SOLO apenas para o Layer em foco
                    const nextCh = channels.map((ch, i) => ({
                      ...ch,
                      solo: i === focusedIdx
                    }));
                    onChannelsChange(nextCh);
                  }
                };

                return (
                  <button
                    type="button"
                    onClick={handleToggleTopSolo}
                    className={`px-3 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-2 ml-1 text-xs font-mono font-bold ${
                      isAnySoloActive
                        ? 'bg-zinc-900/90 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500'
                    }`}
                    title={isAnySoloActive ? "Clique para desativar todos os solos" : `Clique para ativar solo no Layer 0${focusedIdx + 1}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isAnySoloActive ? 'bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b]' : 'bg-zinc-500'}`} />
                    
                    {isAnySoloActive ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-amber-300 font-extrabold uppercase text-xs">SOLO:</span>
                        <div className="flex items-center gap-1">
                          {soloedLayers.map((lIdx) => (
                            <span key={lIdx} className={layerPillStyles[lIdx]}>
                              0{lIdx + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-300 font-bold uppercase text-xs">SOLO: OFF</span>
                    )}
                  </button>
                );
              })()}
            </div>

            {/* Information Area (Central LED display block) */}
            <div className="flex items-center gap-1.5 bg-black/40 border border-zinc-800 px-2.5 py-1 rounded-md select-none text-[11.5px] max-w-[170px] md:max-w-[280px] truncate">
              <span className="text-zinc-300 font-sans font-black tracking-wider text-[10.5px]">VIEW:</span>
              <span className="text-emerald-400 font-sans font-black tracking-wider uppercase text-[11.5px]">
                {activeTab === 'live-set' && 'LIVE SET'}
                {activeTab === 'performance' && 'PERFORMANCE PLAY'}
                {activeTab === 'delay' && 'PROCESSADOR DE ECO & DELAY'}
                {activeTab === 'mixing' && 'CHORUS & TREMOLO'}
                {activeTab === 'filters' && 'PROCESSADOR DE FILTROS'}
                {activeTab === 'eq' && 'EQUALIZADOR & ANALISADOR RTA'}
                {activeTab === 'fx-adsr' && 'PROCESSADOR DE REVERB'}
                {activeTab === 'utility' && 'SISTEMA DE UTILITÁRIOS'}
                {activeTab === 'waveforms' && 'GERENCIADOR DE ONDAS SF2'}
              </span>
            </div>

            {/* Effect switch status & System Backup controls */}
            <div className="flex items-center gap-1.5 ml-2">
              {/* Backup Export/Import Buttons */}
              <button
                type="button"
                onClick={handleExportSettingsJson}
                className="px-2 py-0.5 rounded font-black text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 hover:text-emerald-300 cursor-pointer uppercase flex items-center gap-1 transition-all shadow-sm"
                title="Exportar rápido apenas Presets, Bancos e Configurações (JSON leve sem SF2)"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>Backup Configs (.JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCategoryListTxt}
                className="px-2 py-0.5 rounded font-black text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-purple-400 hover:text-purple-300 cursor-pointer uppercase flex items-center gap-1 transition-all shadow-sm"
                title="Baixar lista e catálogo completo de SoundFonts SF2 agrupados por Categoria (.TXT)"
              >
                <FileText className="w-3 h-3 text-purple-400" />
                <span>Lista SF2 (.TXT)</span>
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                className="px-2 py-0.5 rounded font-black text-[11px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sky-400 hover:text-sky-300 cursor-pointer uppercase flex items-center gap-1 transition-all shadow-sm"
                title="Importar Backup (JSON de Configurações)"
              >
                <Upload className="w-3 h-3 text-sky-400" />
                <span>Importar Backup</span>
              </button>

              <input
                type="file"
                ref={backupFileInputRef}
                onChange={handleImportBackupFile}
                accept=".zip,.json"
                className="hidden"
              />

              <button
                onClick={() => {
                  const isFxActive = reverbMix > 0 || channels.some(ch => !ch.delayBypass);
                  if (isFxActive) {
                    // Save exact current state before turning OFF
                    prevFxStateRef.current = {
                      reverbMix: reverbMix > 0 ? reverbMix : 0.25,
                      delayBypasses: channels.map(ch => ch.delayBypass ?? true)
                    };
                    // Mute reverb and bypass delay/echo on all channels
                    onReverbChange(reverbDecay, 0);
                    const updated = channels.map(ch => ({ ...ch, delayBypass: true }));
                    onChannelsChange(updated);
                    showNotification('FX Master Desligado (Reverb e Eco/Delay desativados)', 'info');
                  } else {
                    // Restore exact previous FX state when turning back ON
                    const saved = prevFxStateRef.current;
                    const restoredMix = (saved && saved.reverbMix > 0) ? saved.reverbMix : (reverbMix > 0 ? reverbMix : 0.25);
                    onReverbChange(reverbDecay, restoredMix);

                    let updated;
                    if (saved && saved.delayBypasses && saved.delayBypasses.length === channels.length) {
                      updated = channels.map((ch, idx) => ({
                        ...ch,
                        delayBypass: saved.delayBypasses[idx]
                      }));
                    } else {
                      // Preserve existing delayBypass as is when no saved state exists
                      updated = channels.map((ch) => ({
                        ...ch,
                        delayBypass: ch.delayBypass ?? true
                      }));
                    }
                    onChannelsChange(updated);
                    showNotification('FX Master Ligado (Reverb e Eco/Delay reativados)', 'success');
                  }
                }}
                className={`px-2 py-1 rounded font-black text-[10px] border cursor-pointer uppercase flex items-center gap-1 transition-all ${
                  (reverbMix > 0 || channels.some(ch => !ch.delayBypass))
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
                title="Liga/Desliga Master FX (Reverb Convolução e Eco/Delay de todos os Layers)"
              >
                <span className={`w-2 h-2 rounded-full ${(reverbMix > 0 || channels.some(ch => !ch.delayBypass)) ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
                FX
              </button>
            </div>
          </div>

          {/* B. Touchscreen Interior: Left Sidebar selection, Right Content Panel */}
          <div className="flex-1 flex overflow-hidden bg-[#0c0d0f] relative">
            
            {/* I. Left Sidebar Tabs (Guias de seleção do visor - Nova Ordem) */}
            <div className="w-16 bg-[#12141a] border-r border-zinc-800 flex flex-col justify-between items-center py-2 shrink-0 select-none overflow-y-auto">
              <div className="flex flex-col items-center gap-1.5 w-full px-1">
                {/* 1. Live Set */}
                <button
                  onClick={() => setActiveTab('live-set')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'live-set'
                      ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Live Set</span>
                </button>

                {/* 2. Perf */}
                <button
                  onClick={() => setActiveTab('performance')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'performance'
                      ? 'bg-amber-500/25 border border-amber-400 text-amber-300 font-black shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Perf</span>
                </button>

                {/* 3. EQ/RTA */}
                <button
                  onClick={() => setActiveTab('eq')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'eq'
                      ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-black shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">EQ/RTA</span>
                </button>

                {/* 4. Filtro */}
                <button
                  onClick={() => setActiveTab('filters')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'filters'
                      ? 'bg-fuchsia-500/25 border border-fuchsia-400 text-fuchsia-300 font-black shadow-[0_0_10px_rgba(217,70,239,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Filtro</span>
                </button>

                {/* 5. Reverb */}
                <button
                  onClick={() => setActiveTab('fx-adsr')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'fx-adsr'
                      ? 'bg-rose-500/25 border border-rose-400 text-rose-300 font-black shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Reverb</span>
                </button>

                {/* 6. Eco */}
                <button
                  onClick={() => setActiveTab('delay')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'delay'
                      ? 'bg-amber-500/25 border border-amber-400 text-amber-300 font-black shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                  title="Processador de Eco / Delay por Layer"
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Eco</span>
                </button>

                {/* 7. Chor/Trem */}
                <button
                  onClick={() => setActiveTab('mixing')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'mixing'
                      ? 'bg-sky-500/25 border border-sky-400 text-sky-300 font-black shadow-[0_0_10px_rgba(14,165,233,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Chor/Trem</span>
                </button>

                {/* 8. Waveform */}
                <button
                  onClick={() => {
                    setActiveTab('waveforms');
                    setSelectedWaveformCategory(null);
                  }}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'waveforms'
                      ? 'bg-cyan-500/25 border border-cyan-400 text-cyan-300 font-black shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Waveform</span>
                </button>

                {/* 9. Utility */}
                <button
                  onClick={() => setActiveTab('utility')}
                  className={`w-full py-1.5 rounded-lg flex flex-col items-center gap-1 transition cursor-pointer ${
                    activeTab === 'utility'
                      ? 'bg-zinc-700 border border-zinc-500 text-white font-black'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/80 border border-transparent'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="text-[12px] font-mono uppercase font-extrabold tracking-tighter">Utility</span>
                </button>
              </div>
            </div>

            {/* II. Main Display Window (Touchscreen Content Frame) */}
            <div className="flex-1 p-3 overflow-y-auto">
              
              {/* SCREEN TAB A: LIVE SET (16 Slots Grid, dynamic USER banks) */}
              {activeTab === 'live-set' && (
                <div className="flex flex-col h-full justify-between gap-3 select-none">
                  {/* Bank Select Strip & Custom Instructions */}
                  <div className="flex flex-col gap-1 border-b border-zinc-800 pb-2 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 w-full overflow-hidden">
                        <span className="text-[12px] font-mono font-black text-amber-400 uppercase tracking-wider shrink-0">
                          BANCOS USER (1-{userBankCount}):
                        </span>
                        
                        {/* Bank Select Tabs Scrollable Container */}
                        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                          {Array.from({ length: userBankCount }, (_, idx) => {
                            const bIdx = idx + 1;
                            const label = bankNames[bIdx] || `USER ${bIdx}`;
                            const colorName = bankColors[bIdx] || 'zinc';
                            const info = SLOT_COLORS[colorName] || SLOT_COLORS.zinc;
                            const isCurrent = currentBankIndex === bIdx;
                            const tabClass = isCurrent ? info.tabActive : info.tabInactive;
                            return (
                              <button
                                key={bIdx}
                                onClick={() => {
                                  setCurrentBankIndex(bIdx);
                                }}
                                onContextMenu={(e) => handleBankContextMenu(e, bIdx)}
                                className={`px-3 py-1.5 rounded-md text-[13px] font-mono font-bold border transition cursor-pointer whitespace-nowrap flex items-center justify-center ${tabClass}`}
                                title={showTips ? `${label} - Clique com o botão direito para renomear, excluir ou mudar a cor` : undefined}
                              >
                                <span>{label}</span>
                              </button>
                            );
                          })}

                          {/* Add USER Bank Button */}
                          <button
                            onClick={handleAddUserBank}
                            className="px-3 py-1.5 rounded-md text-[13px] font-mono font-black bg-zinc-800/80 hover:bg-zinc-700/90 border border-zinc-600/80 text-zinc-200 hover:text-white transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 shrink-0 shadow-sm"
                            title="Criar mais um Banco USER de 16 slots"
                          >
                            <Plus className="w-4 h-4 text-zinc-300" />
                            <span>CRIAR BANCO</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 16 Presets Slots Grid (4x4) with high readability typography */}
                  <div className="border border-zinc-800 bg-zinc-950/40 p-3 rounded-xl flex-1 flex flex-col justify-stretch overflow-hidden shadow-inner">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-2.5 flex-1 items-stretch h-full" style={{ gridTemplateRows: 'repeat(4, 1fr)' }}>
                      {currentSlots.slice(0, 16).map((slot, sIdx) => {
                        const isActive = selectedPerformanceId === slot.id;
                        const isUnprogrammed = slot.category === 'Sem programação' || !slot.name || slot.name.startsWith('User Slot');
                        const slotColor = isUnprogrammed ? 'zinc' : (slot.color || 'emerald');
                        const info = SLOT_COLORS[slotColor] || SLOT_COLORS.zinc;

                        const displayName = isUnprogrammed ? 'DISPONÍVEL' : slot.name;
                        const displayCategory = isUnprogrammed ? 'CLASSE SF2' : slot.category;
                        const displayBadge = isUnprogrammed ? `USER ${currentBankIndex}` : (slot.badge || 'USER');

                        return (
                          <button
                            key={slot.id || `slot_${sIdx}`}
                            onContextMenu={(e) => handleSlotContextMenu(e, sIdx)}
                            onTouchStart={(e) => handleSlotTouchStart(e, sIdx)}
                            onTouchEnd={(e) => handleSlotTouchEnd(e, slot.id)}
                            onClick={() => loadModxPerformance(slot.id)}
                            className={`rounded-xl p-3 text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden select-none h-full min-h-[76px] group border ${
                              isWriteMode 
                                ? 'border-red-500/80 bg-red-950/30 hover:bg-red-950/50 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                                : isActive 
                                  ? `${info.activeBg}` 
                                  : `${info.pastelBg} ${info.pastelBorder}`
                            }`}
                            title={showTips ? `${slot.name} - Clique com o botão direito para gerenciar, duplicar, colar ou mudar a cor` : undefined}
                          >
                            {/* Top-right corner accent glow like Waveform Category */}
                            <div className={`absolute top-0 right-0 w-9 h-9 rounded-bl-full pointer-events-none transition-all ${
                              isActive ? 'bg-white/20' : info.pastelGlow
                            }`} />

                            {/* Top Header Row: Category Badge & Slot # */}
                            <div className="flex justify-between items-center w-full relative z-10">
                              <span className={`text-[11px] md:text-[12px] font-mono font-black px-1.5 py-0.5 rounded uppercase tracking-tight ${
                                isActive ? info.activeBadge : info.pastelBadge
                              }`}>
                                {displayBadge}
                              </span>
                              <span className={`text-[12px] md:text-[13px] font-mono font-black text-white/80`}>
                                #{sIdx + 1}
                              </span>
                            </div>

                            {/* Title & Subtitle styled after Waveform Category */}
                            <div className="mt-1 flex-1 flex flex-col justify-center relative z-10">
                              <span className="text-[15px] md:text-[17px] font-sans font-black leading-tight truncate text-white uppercase tracking-tight" title={slot.name}>
                                {displayName}
                              </span>
                              <span className={`text-[11px] md:text-[12px] font-mono truncate uppercase mt-0.5 font-bold tracking-wider ${
                                isActive ? info.activeSub : info.pastelSub
                              }`}>
                                {displayCategory}
                              </span>
                            </div>

                            {/* Bottom bar with BANCOS status pill */}
                            <div className="flex justify-between items-center mt-2 relative z-10">
                              <span className="text-[11px] md:text-[12px] font-mono font-bold uppercase tracking-wider text-white">
                                BANCOS
                              </span>
                              <span className={`text-[12px] md:text-[13px] font-mono font-black px-2.5 py-0.5 rounded-md border transition-all ${
                                isActive ? info.activePill : info.pastelPill
                              }`}>
                                {isUnprogrammed ? '0' : (slot.bankCount || 1)}
                              </span>
                            </div>

                            {/* Decorative Active Bar Indicator on Left Edge */}
                            {isActive && (
                              <div className="absolute left-0 bottom-0 top-0 w-1.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Floating Slot Context Menu */}
                  {contextMenuSlot && (
                    <div 
                      className="fixed bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col min-w-48 select-none"
                      style={{ 
                        left: `${Math.min(window.innerWidth - 200, contextMenuSlot.x)}px`, 
                        top: `${Math.min(window.innerHeight - 260, contextMenuSlot.y)}px` 
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-1 text-[12px] font-mono font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 mb-1">
                        Opções do Slot #{contextMenuSlot.slotIndex + 1}
                      </div>

                      <button
                        onClick={() => {
                          handleSaveCurrentToSlot(contextMenuSlot.slotIndex);
                          setContextMenuSlot(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-zinc-200 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full"
                      >
                        <Save className="w-4 h-4 text-orange-400" />
                        <span>Gravar Synth Atual</span>
                      </button>

                      <button
                        onClick={() => {
                          handleStartRenameSlot(contextMenuSlot.slotIndex);
                          setContextMenuSlot(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-zinc-200 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Renomear Slot</span>
                      </button>

                      <button
                        onClick={() => {
                          handleCopySlotConfig(contextMenuSlot.slotIndex);
                          setContextMenuSlot(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-zinc-200 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full"
                      >
                        <Layers className="w-4 h-4 text-sky-400" />
                        <span>Copiar Configuração</span>
                      </button>

                      <button
                        onClick={() => {
                          handlePasteSlotConfig(contextMenuSlot.slotIndex);
                          setContextMenuSlot(null);
                        }}
                        disabled={!copiedSlotConfig}
                        className={`flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left rounded transition-all w-full ${
                          copiedSlotConfig 
                            ? 'text-zinc-200 hover:text-white hover:bg-zinc-900 cursor-pointer' 
                            : 'text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-500" />
                        <span>Colar Configuração</span>
                      </button>

                      <div className="border-t border-zinc-800 my-1" />

                      <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 uppercase tracking-wider">
                        Mudar Cor do Slot
                      </div>

                      <div className="flex gap-1.5 px-2.5 py-1 mb-1">
                        {Object.entries(SLOT_COLORS).map(([colorName, info]) => {
                          return (
                            <button
                              key={colorName}
                              onClick={() => {
                                handleSetSlotColor(contextMenuSlot.slotIndex, colorName);
                                setContextMenuSlot(null);
                              }}
                              className={`w-4 h-4 rounded-full ${info.dot} border border-white/20 hover:scale-110 active:scale-95 transition cursor-pointer`}
                              title={info.label}
                            />
                          );
                        })}
                      </div>

                      <div className="border-t border-zinc-800 my-1" />

                      <button
                        onClick={() => {
                          const sIdx = contextMenuSlot.slotIndex;
                          setConfirmDialog({
                            isOpen: true,
                            title: 'Limpar Slot de Memória',
                            message: `Tem certeza que deseja limpar as configurações do Slot ${sIdx + 1}?`,
                            onConfirm: () => {
                              handleClearSlot(sIdx);
                              setConfirmDialog(null);
                            }
                          });
                          setContextMenuSlot(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-red-400 hover:text-white hover:bg-red-950/40 rounded cursor-pointer transition-all w-full"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <span>Limpar Slot</span>
                      </button>
                    </div>
                  )}

                  {/* Floating Bank Context Menu */}
                  {contextMenuBank && (
                    <div 
                      className="fixed bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col min-w-48 select-none"
                      style={{ 
                        left: `${Math.min(window.innerWidth - 200, contextMenuBank.x)}px`, 
                        top: `${Math.min(window.innerHeight - 240, contextMenuBank.y)}px` 
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-2.5 py-1 text-[12px] font-mono font-bold text-zinc-300 uppercase tracking-wider border-b border-zinc-800 mb-1">
                        Opções do Banco
                      </div>

                      <button
                        onClick={() => {
                          setRenameBankTarget(contextMenuBank.bankIndex);
                          setRenameBankName(bankNames[contextMenuBank.bankIndex] || `USER ${contextMenuBank.bankIndex}`);
                          setContextMenuBank(null);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-zinc-200 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <span>Renomear Banco</span>
                      </button>

                      <button
                        onClick={() => {
                          const targetBankIdx = contextMenuBank.bankIndex;
                          setContextMenuBank(null);
                          handleResetBankIndex(targetBankIdx);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-amber-400 hover:text-white hover:bg-amber-950/40 rounded cursor-pointer transition-all w-full"
                      >
                        <Trash2 className="w-4 h-4 text-amber-500" />
                        <span>Resetar Banco</span>
                      </button>

                      {userBankCount > 4 && (
                        <button
                          onClick={() => {
                            const targetBankIdx = contextMenuBank.bankIndex;
                            setContextMenuBank(null);
                            handleDeleteUserBank(targetBankIdx);
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium text-left text-red-400 hover:text-white hover:bg-red-950/40 rounded cursor-pointer transition-all w-full"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          <span>Excluir Banco USER</span>
                        </button>
                      )}

                      <div className="border-t border-zinc-800 my-1" />
                      
                      <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 uppercase tracking-wider">
                        Mudar Cor do Banco
                      </div>
                      
                      <div className="flex gap-1.5 px-2.5 py-1 mb-1">
                        {Object.entries(SLOT_COLORS).map(([colorName, info]) => {
                          return (
                            <button
                              key={colorName}
                              onClick={() => {
                                handleSetBankColor(contextMenuBank.bankIndex, colorName);
                                setContextMenuBank(null);
                              }}
                              className={`w-4 h-4 rounded-full ${info.dot} border border-white/20 hover:scale-110 active:scale-95 transition cursor-pointer`}
                              title={info.label}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rename Bank Modal Overlay */}
                  {renameBankTarget !== null && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                          <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight">
                            Renomear Banco USER {renameBankTarget}
                          </h3>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[12px] font-mono font-bold text-zinc-300 uppercase">Nome do Banco</label>
                            <input 
                              type="text"
                              maxLength={12}
                              value={renameBankName}
                              onChange={(e) => setRenameBankName(e.target.value)}
                              className="bg-black border border-zinc-800 rounded p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder={`ex: USER ${renameBankTarget}`}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                          <button
                            onClick={() => setRenameBankTarget(null)}
                            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold border border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveRenameBank}
                            className="px-3 py-1.5 rounded text-[10px] font-mono font-black bg-emerald-500 hover:bg-emerald-600 text-black cursor-pointer transition shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rename Modal Overlay */}
                  {renameSlotTarget !== null && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                          <h3 className="text-xs font-sans font-black text-white uppercase tracking-tight">
                            Renomear Slot {renameSlotTarget + 1}
                          </h3>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-mono font-bold text-zinc-300 uppercase">Nome do Som</label>
                            <input 
                              type="text"
                              value={renameForm.name}
                              onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
                              className="bg-black border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="ex: Piano Espacial"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-mono font-bold text-zinc-300 uppercase">Categoria</label>
                            <input 
                              type="text"
                              value={renameForm.category}
                              onChange={(e) => setRenameForm({ ...renameForm, category: e.target.value })}
                              className="bg-black border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="ex: E.PIANO + PAD"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-mono font-bold text-zinc-300 uppercase">Badge (Etiqueta)</label>
                            <input 
                              type="text"
                              maxLength={16}
                              value={renameForm.badge}
                              onChange={(e) => setRenameForm({ ...renameForm, badge: e.target.value })}
                              className="bg-black border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono uppercase"
                              placeholder="ex: LEAD, PIANO..."
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
                          <button
                            onClick={() => setRenameSlotTarget(null)}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSaveRenameSlot}
                            className="px-3 py-1.5 rounded text-xs font-mono bg-emerald-500 text-black font-black hover:bg-emerald-400 cursor-pointer"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SCREEN TAB B: PERFORMANCE PLAY (Faders & Meters view) */}
              {activeTab === 'performance' && (
                <div className="flex flex-col h-full justify-between gap-3 select-none">
                  {/* 4 Layers + Master Emulated Touchscreen Strips wrapped in horizontal scrollbar */}
                  <div className="w-full overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    <div className="grid grid-cols-5 gap-3 flex-1 items-stretch min-w-[1120px]">
                    {channels.map((state, idx) => {
                      const accent = channelAccents[idx];
                      const solid = channelSolidBg[idx];
                      const hasVoice = vuLevels[idx] > 0.05;

                      return (
                        <div 
                          key={idx}
                          onContextMenu={(e) => handleLayerContextMenu(e, idx)}
                          onClick={() => setActiveParamFocus([idx, 'volume'])}
                          className={`bg-zinc-950/60 border border-zinc-800 rounded p-2.5 flex flex-col justify-between transition-all cursor-context-menu ${
                            activeParamFocus?.[0] === idx && activeParamFocus?.[1] === 'volume'
                              ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.06)]'
                              : 'hover:border-zinc-800'
                          }`}
                        >
                          {/* Layer Label & Quick Pan/Routing stats */}
                          <div className="flex justify-between items-center mb-1.5 select-none border-b border-zinc-800/40 pb-1.5">
                            <span className="text-[10px] font-mono font-black text-zinc-400 uppercase">
                              LAYER {idx + 1}
                            </span>
                            <span className={`text-[11px] font-mono font-black px-1.5 py-0.5 rounded ${
                              state.routingEnabled ?? true ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_4px_rgba(249,115,22,0.1)]' : 'bg-zinc-900 text-zinc-300'
                            }`}>
                              {(state.routingEnabled ?? true) ? 'ON' : 'OFF'}
                            </span>
                          </div>

                          {/* SoundFont & Patch Selectors */}
                          <div className="flex flex-col gap-1.5 w-full my-1 shrink-0">
                            {/* SoundFont Bank Selection */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectingWaveformForLayer(idx);
                                setActiveTab('waveforms');
                                const currentSf = loadedSoundFonts[state.soundfontIndex ?? 0];
                                if (currentSf) {
                                  setSelectedWaveformCategory(sfCategories[currentSf.id] || null);
                                } else {
                                  setSelectedWaveformCategory(null);
                                }
                              }}
                              className="w-full bg-black/95 border border-zinc-800 hover:border-emerald-500/40 text-emerald-400 rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer truncate flex justify-between items-center h-[34px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
                              title="Trocar banco SoundFont (.sf2) no Gerenciador Waveform"
                            >
                              <span className="truncate flex-1 text-left font-mono font-black text-[11px] text-emerald-400">
                                {loadedSoundFonts[state.soundfontIndex ?? 0]?.name.replace('.sf2', '').substring(0, 28) || 'Integrado'}
                              </span>
                              <span className="text-[11px] text-zinc-300 shrink-0 font-sans font-black ml-1 uppercase">SF2 ☰</span>
                            </button>

                            {/* Preset Selection Dropdown */}
                            <div className="relative w-full">
                              <select
                                value={state.presetIndex}
                                onChange={(e) => {
                                  const presetIdx = parseInt(e.target.value);
                                  const nextCh = [...channels];
                                  nextCh[idx] = {
                                    ...nextCh[idx],
                                    presetIndex: presetIdx
                                  };
                                  onChannelsChange(nextCh);
                                }}
                                className="w-full bg-black/95 border border-zinc-800 text-[12px] font-sans font-bold text-zinc-300 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:border-emerald-500/50 cursor-pointer appearance-none shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] h-[32px]"
                                title="Selecionar Preset do SoundFont"
                              >
                                {loadedSoundFonts[state.soundfontIndex ?? 0]?.presets.length > 0 ? (
                                  loadedSoundFonts[state.soundfontIndex ?? 0].presets.map((p, pIdx) => (
                                    <option key={pIdx} value={pIdx} className="bg-zinc-950 text-zinc-350 font-mono">
                                      {String(p.preset).padStart(3, '0')}:{p.name.substring(0, 28)}
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value={0} className="bg-zinc-950 text-zinc-350 font-mono">000: Sine Wave</option>
                                    <option value={1} className="bg-zinc-950 text-zinc-350 font-mono">001: Square Wave</option>
                                    <option value={2} className="bg-zinc-950 text-zinc-350 font-mono">002: Sawtooth Wave</option>
                                    <option value={3} className="bg-zinc-950 text-zinc-350 font-mono">003: Triangle Wave</option>
                                  </>
                                )}
                              </select>
                              {/* Custom dropdown indicator chevron */}
                              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-zinc-300 text-[11px]">
                                <span className="scale-y-75">▼</span>
                              </div>
                            </div>
                          </div>

                          {/* Consolidado: VU, Fader, Pan e Side Toggles */}
                          <div className="flex gap-2 items-center justify-between my-2 select-none">
                            
                            {/* 1. Stereo VU Meter (high precision) */}
                            <StereoVuMeter levels={stereoVu.channels[idx]} heightClass="h-48" />

                            {/* Centered Shared Volume Scale Ticks */}
                            <div className="flex flex-col justify-between h-48 text-[11.5px] font-mono text-zinc-350 select-none py-1.5 w-7 items-center shrink-0 font-bold">
                              <span>+6</span>
                              <span>0</span>
                              <span>-6</span>
                              <span>-12</span>
                              <span>-24</span>
                              <span>-inf</span>
                            </div>

                            {/* 2. Emulated Vertical Metal Fader */}
                            <div 
                              className="w-11 h-48 bg-zinc-900/80 border border-zinc-800 rounded relative flex justify-center items-center overflow-visible shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] cursor-context-menu"
                              onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_volume`, `Layer 0${idx + 1} Volume PERF`)}
                              title="Arraste para ajustar o volume (Clique com o botão direito para Aprender MIDI CC)"
                            >
                              {/* Track Groove */}
                              <div className="w-2 h-[92%] bg-black border border-zinc-950 rounded-full relative flex justify-center items-center overflow-visible">
                                {/* Glowing Active Track */}
                                <div 
                                  className={`w-1 rounded-full absolute bottom-0 ${solid} opacity-60 shadow-[0_0_6px_rgba(16,185,129,0.3)]`}
                                  style={{ height: `${gainToFaderPct(state.volume) * 100}%` }}
                                />
                              </div>

                              {/* Physical looking fader cap - wider than groove, matching layer's solid color, overflow-visible */}
                              <div 
                                className="w-9.5 h-6.5 rounded bg-zinc-800 hover:bg-zinc-750 border-t border-b-2 border-l border-r border-zinc-650 hover:border-zinc-500 shadow-xl cursor-ns-resize absolute z-10 flex flex-col justify-center items-center select-none"
                                style={{ bottom: `calc(${gainToFaderPct(state.volume) * 92}% + 4% - 13px)` }}
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  const track = e.currentTarget.parentElement;
                                  if (!track) return;
                                  const rect = track.getBoundingClientRect();
                                  const padding = rect.height * 0.04;
                                  const trackHeight = rect.height - padding * 2;
                                  const pointerMove = (pe: PointerEvent) => {
                                    const y = pe.clientY - (rect.top + padding);
                                    const pct = 1 - Math.max(0, Math.min(trackHeight, y)) / trackHeight;
                                    updateChannelValue(idx, 'volume', faderPctToGain(pct));
                                  };
                                  const pointerUp = () => {
                                    window.removeEventListener('pointermove', pointerMove);
                                    window.removeEventListener('pointerup', pointerUp);
                                  };
                                  window.addEventListener('pointermove', pointerMove);
                                  window.addEventListener('pointerup', pointerUp);
                                }}
                              >
                                <div className="w-full flex justify-around px-1 opacity-50 mb-0.5 scale-75">
                                  <div className="w-[1.5px] h-1.5 bg-zinc-500 rounded-full" />
                                  <div className="w-[1.5px] h-1.5 bg-zinc-500 rounded-full" />
                                </div>
                                <div className={`h-1.5 ${solid} w-full opacity-95 shadow-[0_0_4px_rgba(255,255,255,0.5)]`} />
                                <div className="w-full flex justify-around px-1 opacity-50 mt-0.5 scale-75">
                                  <div className="w-[1.5px] h-1.5 bg-zinc-500 rounded-full" />
                                  <div className="w-[1.5px] h-1.5 bg-zinc-500 rounded-full" />
                                </div>
                              </div>
                            </div>

                            {/* 3. Controls Right Side: Stacks buttons and larger PAN & GAIN & SENS vertically */}
                            <div className="flex-1 flex flex-col justify-between h-48 select-none pl-1.5 items-center w-full min-w-0">
                              {/* ON and PEDAL Buttons - aligned in a vertical stack to be 100% same size */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateChannelValue(idx, 'routingEnabled', !(state.routingEnabled ?? true));
                                }}
                                className={`w-full py-0.5 rounded text-[11.5px] font-mono font-black border transition-all cursor-pointer text-center ${
                                  (state.routingEnabled ?? true)
                                    ? 'bg-orange-500 border-orange-400 text-black shadow-[0_0_8px_rgba(249,115,22,0.5)] font-extrabold'
                                    : 'bg-red-600 border-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)] font-extrabold'
                                }`}
                                title="Habilitar/Desabilitar roteamento MIDI desta camada"
                              >
                                {(state.routingEnabled ?? true) ? 'ON' : 'OFF'}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateChannelValue(idx, 'sustainEnabled', !(state.sustainEnabled ?? true));
                                }}
                                className={`w-full py-0.5 rounded text-[11.5px] font-mono font-black border transition-all cursor-pointer text-center ${
                                  (state.sustainEnabled ?? true)
                                    ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_8px_rgba(6,182,212,0.5)] font-extrabold'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-zinc-150 hover:border-zinc-800 font-bold'
                                }`}
                                title="Ativar/Desativar pedal de sustain"
                              >
                                PEDAL
                              </button>

                              {/* PAN Knob */}
                              <div className="flex flex-col items-center justify-center">
                                <div 
                                  className="relative w-6.5 h-6.5 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center cursor-ew-resize hover:border-emerald-500/50 transition-colors shadow-inner"
                                  title="Arraste para ajustar o Balanço (PAN) (Clique com o botão direito para Aprender MIDI CC)"
                                  onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_pan`, `Layer 0${idx + 1} Pan PERF`)}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    const initialX = e.clientX;
                                    const initialPan = state.pan;
                                    const pointerMove = (pe: PointerEvent) => {
                                      const deltaX = pe.clientX - initialX;
                                      const newPan = Math.max(-1.0, Math.min(1.0, initialPan + (deltaX / 80)));
                                      updateChannelValue(idx, 'pan', parseFloat(newPan.toFixed(2)));
                                    };
                                    const pointerUp = () => {
                                      window.removeEventListener('pointermove', pointerMove);
                                      window.removeEventListener('pointerup', pointerUp);
                                    };
                                    window.addEventListener('pointermove', pointerMove);
                                    window.addEventListener('pointerup', pointerUp);
                                  }}
                                >
                                  <div 
                                    className="w-[1.5px] h-2.5 bg-emerald-400 absolute origin-bottom bottom-1/2 rounded shadow-[0_0_4px_#10b981]"
                                    style={{ transform: `rotate(${state.pan * 90}deg)` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-zinc-100 mt-0.5 font-bold whitespace-nowrap text-center leading-none select-none">
                                  PAN: <b className="text-emerald-400 font-extrabold">{state.pan > 0 ? `R${Math.round(state.pan * 10)}` : state.pan < 0 ? `L${Math.round(Math.abs(state.pan) * 10)}` : 'C'}</b>
                                </span>
                              </div>

                              {/* SENS Knob */}
                              <div className="flex flex-col items-center justify-center">
                                <div 
                                  className="relative w-6.5 h-6.5 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center cursor-ns-resize hover:border-sky-500/50 transition-colors shadow-inner"
                                  title="Sensibilidade de Velocidade MIDI (SENS) (Clique com botão direito para Aprender MIDI CC)"
                                  onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_midiSensitivity`, `Layer 0${idx + 1} Sensibilidade MIDI PERF`)}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    const initialY = e.clientY;
                                    const initialSens = state.midiSensitivity ?? 1.0;
                                    const pointerMove = (pe: PointerEvent) => {
                                      const deltaY = initialY - pe.clientY;
                                      const newSens = Math.max(0.1, Math.min(2.0, initialSens + (deltaY / 100)));
                                      updateChannelValue(idx, 'midiSensitivity', parseFloat(newSens.toFixed(2)));
                                    };
                                    const pointerUp = () => {
                                      window.removeEventListener('pointermove', pointerMove);
                                      window.removeEventListener('pointerup', pointerUp);
                                    };
                                    window.addEventListener('pointermove', pointerMove);
                                    window.addEventListener('pointerup', pointerUp);
                                  }}
                                >
                                  <div 
                                    className="w-[1.5px] h-2.5 bg-sky-400 absolute origin-bottom bottom-1/2 rounded shadow-[0_0_4px_#38bdf8]"
                                    style={{ transform: `rotate(${((state.midiSensitivity ?? 1.0) - 0.1) / 1.9 * 240 - 120}deg)` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-zinc-100 mt-0.5 font-bold whitespace-nowrap text-center leading-none select-none">
                                  S: <b className="text-sky-400 font-extrabold">{(state.midiSensitivity ?? 1.0).toFixed(1)}</b>
                                </span>
                              </div>

                              {/* GAIN Knob */}
                              <div className="flex flex-col items-center justify-center">
                                <div 
                                  className="relative w-6.5 h-6.5 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center cursor-ns-resize hover:border-red-500/50 transition-colors shadow-inner"
                                  title="Ganho adicional do SoundFont (GAIN) (Clique com botão direito para Aprender MIDI CC)"
                                  onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_soundfontGain`, `Layer 0${idx + 1} Ganho SoundFont PERF`)}
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    const initialY = e.clientY;
                                    const initialGain = state.soundfontGain ?? 1.0;
                                    let latestGain = initialGain;
                                    const pointerMove = (pe: PointerEvent) => {
                                      const deltaY = initialY - pe.clientY;
                                      const newGain = Math.max(0.5, Math.min(4.0, initialGain + (deltaY / 40)));
                                      latestGain = parseFloat(newGain.toFixed(2));
                                      updateChannelValue(idx, 'soundfontGain', latestGain);
                                    };
                                    const pointerUp = () => {
                                      window.removeEventListener('pointermove', pointerMove);
                                      window.removeEventListener('pointerup', pointerUp);
                                      
                                      const currentSf = loadedSoundFonts[state.soundfontIndex ?? 0];
                                      if (currentSf) {
                                        try {
                                          const storedGains = JSON.parse(localStorage.getItem('sf2_custom_gains') || '{}');
                                          storedGains[currentSf.id] = latestGain;
                                          storedGains[currentSf.name] = latestGain;
                                          localStorage.setItem('sf2_custom_gains', JSON.stringify(storedGains));
                                        } catch(err) {
                                          console.error('Erro ao salvar ganho customizado:', err);
                                        }
                                      }
                                    };
                                    window.addEventListener('pointermove', pointerMove);
                                    window.addEventListener('pointerup', pointerUp);
                                  }}
                                >
                                  <div 
                                    className="w-[1.5px] h-2.5 bg-red-500 absolute origin-bottom bottom-1/2 rounded shadow-[0_0_4px_#ef4444]"
                                    style={{ transform: `rotate(${((state.soundfontGain ?? 1.0) - 0.5) / 3.5 * 240 - 120}deg)` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-zinc-100 mt-0.5 font-bold whitespace-nowrap text-center leading-none select-none">
                                  G: <b className="text-red-500 font-extrabold">{(state.soundfontGain ?? 1.0).toFixed(1)}x</b>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Stats footer: VOL and dB */}
                          <div className="flex justify-between items-center w-full px-1 text-[10px] font-mono font-bold select-none text-zinc-200 gap-1 mt-1 border-t border-zinc-800/40 pt-1">
                            {(() => {
                              const layerTextColors = ['text-amber-400', 'text-sky-400', 'text-emerald-400', 'text-rose-400'];
                              const curColor = layerTextColors[idx] || 'text-emerald-400';
                              return (
                                <>
                                  <span>VOL: <b className={`${curColor} font-black`}>{Math.round(state.volume * 100)}%</b></span>
                                  <span>dB: <b className="text-zinc-100">{state.volume <= 0 ? '-INF' : `${(20 * Math.log10(state.volume)).toFixed(1)}`}</b></span>
                                </>
                              );
                            })()}
                          </div>

                          {/* Consolidated MIDI Delimiter, Octave, Mute and Solo Panel */}
                          <div className="mt-3 w-full border border-zinc-700 rounded-lg p-2 bg-black/40 flex flex-col gap-2">
                            {/* Top row: Mute & Solo Buttons */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                onClick={(e) => { e.stopPropagation(); updateChannelValue(idx, 'mute', !state.mute); }}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_mute`, `Layer 0${idx + 1} Mute PERF`)}
                                className={`py-1 px-1.5 rounded-md text-[11px] font-sans font-black border uppercase tracking-wider transition-all cursor-pointer text-center ${
                                  state.mute
                                    ? 'bg-red-500 border-red-400 text-black shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                                    : 'bg-black border-zinc-600 text-white hover:border-white hover:bg-zinc-900'
                                }`}
                              >
                                MUTE
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); updateChannelValue(idx, 'solo', !state.solo); }}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${idx}_solo`, `Layer 0${idx + 1} Solo PERF`)}
                                className={`py-1 px-1.5 rounded-md text-[11px] font-sans font-black border uppercase tracking-wider transition-all cursor-pointer text-center ${
                                  state.solo
                                    ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                    : 'bg-black border-zinc-600 text-white hover:border-white hover:bg-zinc-900'
                                }`}
                              >
                                SOLO
                              </button>
                            </div>

                            {/* Bottom row: Octave and Midi Delimiter Boxes */}
                            <div className="grid grid-cols-5 gap-1.5">
                              {/* Left Box: OITAVA (span-2) */}
                              <div className="col-span-2 border border-zinc-800 rounded p-1 flex flex-col items-center justify-center bg-black/60">
                                <span className="text-zinc-400 font-sans font-black text-[10.5px] tracking-wider uppercase mb-1">
                                  OITAVA:
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const val = Math.max(-3, (state.octaveOffset ?? 0) - 1);
                                      updateChannelValue(idx, 'octaveOffset', val);
                                    }}
                                    className="w-3.5 h-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold flex items-center justify-center rounded border border-zinc-850 cursor-pointer text-[11px]"
                                  >
                                    -
                                  </button>
                                  <span className="text-sky-400 font-sans font-black w-2.5 text-center text-[11px]">
                                    {state.octaveOffset ?? 0}
                                  </span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const val = Math.min(3, (state.octaveOffset ?? 0) + 1);
                                      updateChannelValue(idx, 'octaveOffset', val);
                                    }}
                                    className="w-3.5 h-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-bold flex items-center justify-center rounded border border-zinc-850 cursor-pointer text-[11px]"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Right Box: DELIMITADOR MIDI (span-3) */}
                              <div className="col-span-3 border border-zinc-800 rounded p-1 flex flex-col bg-black/60">
                                <span className="text-zinc-300 font-sans font-black text-[10px] tracking-wider uppercase text-center block border-b border-zinc-800 pb-0.5 mb-1">
                                  DELIMITADOR MIDI
                                </span>
                                
                                {/* Labels: Min / Max */}
                                <div className="grid grid-cols-2 text-center text-[10px] font-sans font-bold text-zinc-400 tracking-wider mb-0.5">
                                  <span>MÍNIMO</span>
                                  <span>MÁXIMO</span>
                                </div>

                                {/* Inputs: Min & Max Controls */}
                                <div className="grid grid-cols-2 gap-1">
                                  {/* Min Note selector */}
                                  <div className="flex justify-center w-full">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMin') {
                                          setListeningKeyRange(null);
                                        } else {
                                          setListeningKeyRange({ layerIndex: idx, type: 'keyRangeMin' });
                                        }
                                      }}
                                      className={`px-1 py-0.5 rounded text-[11px] font-sans font-black text-center w-full transition-all cursor-pointer ${
                                        listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMin'
                                          ? 'bg-amber-500/25 text-amber-400 border border-amber-500/50 animate-pulse font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                          : 'bg-zinc-950/80 hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-zinc-800'
                                      }`}
                                      title="Clique e toque uma tecla para definir o valor mínimo"
                                    >
                                      {listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMin'
                                        ? '???'
                                        : midiNoteToName(state.keyRangeMin ?? 0)}
                                    </button>
                                  </div>

                                  {/* Max Note selector */}
                                  <div className="flex justify-center w-full">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMax') {
                                          setListeningKeyRange(null);
                                        } else {
                                          setListeningKeyRange({ layerIndex: idx, type: 'keyRangeMax' });
                                        }
                                      }}
                                      className={`px-1 py-0.5 rounded text-[11px] font-sans font-black text-center w-full transition-all cursor-pointer ${
                                        listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMax'
                                          ? 'bg-amber-500/25 text-amber-400 border border-amber-500/50 animate-pulse font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                          : 'bg-zinc-950/80 hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 border border-zinc-800 hover:border-zinc-800'
                                      }`}
                                      title="Clique e toque uma tecla para definir o valor máximo"
                                    >
                                      {listeningKeyRange?.layerIndex === idx && listeningKeyRange?.type === 'keyRangeMax'
                                        ? '???'
                                        : midiNoteToName(state.keyRangeMax ?? 127)}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Master Output Channel Strip (Column 5) */}
                    <div 
                      className="bg-zinc-950 border border-zinc-800 rounded p-2.5 flex flex-col justify-between transition-all hover:border-zinc-800"
                    >
                      {/* Master Label */}
                      <div className="flex justify-between items-center mb-1.5 select-none border-b border-zinc-800/40 pb-1.5">
                        <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-wider">
                          MASTER OUT
                        </span>
                        <span className="text-[11px] font-mono font-black px-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_4px_rgba(245,158,11,0.1)]">
                          MAIN
                        </span>
                      </div>

                      {/* Display / Aesthetic Header */}
                      <div className="flex flex-col gap-1 w-full my-1 shrink-0 bg-black/40 border border-zinc-800 rounded p-1.5 text-center">
                        <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                          STUDIO-SF2 ENGINE
                        </span>
                        <span className="text-[10.5px] font-mono text-zinc-300">
                          DSP STEREO BUS
                        </span>
                      </div>

                      {/* Consolidado: VU, Fader, Controls */}
                      <div className="flex gap-2 items-center justify-between my-2 select-none">
                        {/* 1. Stereo Master VU Meter */}
                        <StereoVuMeter levels={stereoVu.master} heightClass="h-48" />

                        {/* Centered Shared Volume Scale Ticks */}
                        <div className="flex flex-col justify-between h-48 text-[11.5px] font-mono text-zinc-350 select-none py-1.5 w-7 items-center shrink-0 font-bold">
                          <span>+6</span>
                          <span>0</span>
                          <span>-6</span>
                          <span>-12</span>
                          <span>-24</span>
                          <span>-inf</span>
                        </div>

                        {/* 2. Emulated Vertical Metal Fader */}
                        <div 
                          className="w-11 h-48 bg-zinc-900 border border-zinc-800 rounded relative flex justify-center items-center overflow-visible shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] cursor-context-menu"
                          onContextMenu={(e) => handleOpenMidiContextMenu(e, 'master_volume', 'Volume Master Out')}
                          title="Arraste para ajustar o volume Master (Clique com o botão direito para Aprender MIDI CC)"
                        >
                          {/* Track Groove */}
                          <div className="w-2 h-[92%] bg-black border border-zinc-950 rounded-full relative flex justify-center items-center overflow-visible">
                            {/* Glowing Active Track */}
                            <div 
                              className="w-1 rounded-full absolute bottom-0 bg-amber-500 opacity-60 shadow-[0_0_6px_rgba(245,158,11,0.3)]"
                              style={{ height: `${gainToFaderPct(masterVolume) * 100}%` }}
                            />
                          </div>

                          {/* Physical looking fader cap - wider than groove, matching Master Out theme */}
                          <div 
                            className="w-9.5 h-6.5 rounded bg-gradient-to-b from-zinc-700 to-zinc-800 hover:from-zinc-650 hover:to-zinc-750 border-t border-b-2 border-l border-r border-zinc-500 shadow-xl cursor-ns-resize absolute z-10 flex flex-col justify-center items-center select-none"
                            style={{ bottom: `calc(${gainToFaderPct(masterVolume) * 92}% + 4% - 13px)` }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              const track = e.currentTarget.parentElement;
                              if (!track) return;
                              const rect = track.getBoundingClientRect();
                              const padding = rect.height * 0.04;
                              const trackHeight = rect.height - padding * 2;
                              const pointerMove = (pe: PointerEvent) => {
                                const y = pe.clientY - (rect.top + padding);
                                const pct = 1 - Math.max(0, Math.min(trackHeight, y)) / trackHeight;
                                onMasterVolumeChange(faderPctToGain(pct));
                              };
                              const pointerUp = () => {
                                window.removeEventListener('pointermove', pointerMove);
                                window.removeEventListener('pointerup', pointerUp);
                              };
                              window.addEventListener('pointermove', pointerMove);
                              window.addEventListener('pointerup', pointerUp);
                            }}
                          >
                            <div className="w-full flex justify-around px-1 opacity-50 mb-0.5 scale-75">
                              <div className="w-[1.5px] h-1.5 bg-zinc-450 rounded-full" />
                              <div className="w-[1.5px] h-1.5 bg-zinc-450 rounded-full" />
                            </div>
                            <div className="h-1.5 bg-amber-400 w-full opacity-95 shadow-[0_0_4px_rgba(245,158,11,0.9)]" />
                            <div className="w-full flex justify-around px-1 opacity-50 mt-0.5 scale-75">
                              <div className="w-[1.5px] h-1.5 bg-zinc-450 rounded-full" />
                              <div className="w-[1.5px] h-1.5 bg-zinc-450 rounded-full" />
                            </div>
                          </div>
                        </div>

                        {/* 3. Controls Right Side: DSP (ON/OFF) Centered */}
                        <div className="flex flex-col gap-2 items-center justify-center h-48 shrink-0 w-11 select-none">
                          {/* DSP On Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleAudio();
                            }}
                            className={`w-9.5 py-1.5 rounded text-[11px] font-mono font-black border transition-all cursor-pointer shadow-sm text-center ${
                              audioActive
                                ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.5)] font-extrabold'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:text-zinc-300 hover:border-zinc-800 font-bold'
                            }`}
                            title="Ligar/Desligar Motor de Áudio DSP"
                          >
                            DSP
                          </button>

                          <div className="flex flex-col items-center">
                            <span className="text-[10.5px] font-mono text-zinc-300 uppercase tracking-wider font-bold">OUT</span>
                          </div>
                        </div>
                      </div>

                      {/* Master volume label */}
                      <div className="flex justify-between items-center w-full px-1 text-[10px] font-mono font-bold text-zinc-200">
                        <span>VOL: <b className="text-amber-400">{Math.round(masterVolume * 100)}%</b></span>
                        <span>dB: <b className="text-zinc-100">{masterVolume <= 0 ? '-INF' : `${(20 * Math.log10(masterVolume)).toFixed(1)}`}</b></span>
                      </div>

                      {/* Bottom Real-time Monitor */}
                      <div className="mt-2 w-full">
                        <div className="bg-black/50 border border-zinc-800/80 rounded p-1.5 flex flex-col gap-1 text-[11px] font-mono">
                          <span className="text-[10.5px] font-mono text-zinc-300 uppercase tracking-widest text-center block border-b border-zinc-800 pb-0.5 mb-1">
                            MONITOR DO SISTEMA
                          </span>
                          <div className="flex justify-between items-center text-[11px] font-mono px-0.5">
                            <span className="text-zinc-300">VOZES ATIVAS:</span>
                            <span className="text-sky-400 font-black">{voiceCount}</span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-mono px-0.5">
                            <span className="text-zinc-300">STATUS:</span>
                            <span className={audioActive ? "text-emerald-400 font-black" : "text-rose-500 font-black"}>
                              {audioActive ? "ATIVO" : "INATIVO"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] font-mono px-0.5 border-t border-zinc-800/50 pt-1">
                            <span className="text-zinc-300">SAMPLE:</span>
                            <span className="text-zinc-350 font-bold">
                              {`${((synthEngineInstance.ctx?.sampleRate || preferredSampleRate || 44100) / 1000).toFixed(1)} kHz`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Mute / Bypass Buttons */}
                      <div className="grid grid-cols-2 gap-1 mt-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (masterVolume > 0) {
                              onMasterVolumeChange(0);
                            } else {
                              onMasterVolumeChange(1.0);
                            }
                          }}
                          className={`py-0.5 px-1 rounded text-[11px] font-mono font-black border tracking-wider transition-all cursor-pointer ${
                            masterVolume <= 0
                              ? 'bg-red-950/80 border-red-800 text-red-400'
                              : 'bg-black/60 border-zinc-850 text-zinc-300'
                          }`}
                        >
                          MUTE
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Simple reset to 0dB reference
                            onMasterVolumeChange(1.0);
                          }}
                          className="py-0.5 px-1 rounded text-[11px] font-mono font-black border tracking-wider transition-all cursor-pointer bg-black/60 border-zinc-850 text-zinc-300 hover:text-white"
                        >
                          0dB REF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

              {/* SCREEN TAB C: CHORUS & TREMOLO EFFECTS PROCESSOR */}
              {activeTab === 'mixing' && (
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

                    {/* Right Panel: Contains Chorus and Tremolo Side-by-Side */}
                    {(() => {
                      const selectedIdx = activeParamFocus?.[0] ?? 0;
                      const state = channels[selectedIdx];
                      
                      const cBypass = state.chorusBypass ?? true;
                      const cRate = state.chorusRate ?? 1.5;
                      const cDepth = state.chorusDepth ?? 0.3;
                      const cMix = state.chorusMix ?? 0.45;

                      const tBypass = state.tremoloBypass ?? true;
                      const tRate = state.tremoloRate ?? 5.0;
                      const tDepth = state.tremoloDepth ?? 0.5;
                      const tMode = state.tremoloMode ?? 'volume';

                      const layerColorsMap = [
                        { text: 'text-amber-400', ring: 'focus:ring-amber-500', bg: 'bg-amber-500 hover:bg-amber-400 text-black', knob: 'text-amber-400', active: 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]' },
                        { text: 'text-sky-400', ring: 'focus:ring-sky-500', bg: 'bg-sky-500 hover:bg-sky-400 text-black', knob: 'text-sky-400', active: 'bg-sky-500 text-black shadow-[0_0_8px_rgba(14,165,233,0.4)]' },
                        { text: 'text-emerald-400', ring: 'focus:ring-emerald-500', bg: 'bg-emerald-500 hover:bg-emerald-400 text-black', knob: 'text-emerald-400', active: 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]' },
                        { text: 'text-rose-400', ring: 'focus:ring-rose-500', bg: 'bg-rose-500 hover:bg-rose-400 text-black', knob: 'text-rose-400', active: 'bg-rose-500 text-black shadow-[0_0_8px_rgba(244,63,94,0.4)]' }
                      ];
                      const channelSolidBg = ['bg-amber-500', 'bg-sky-500', 'bg-emerald-500', 'bg-rose-500'];
                      const currentTheme = layerColorsMap[selectedIdx] || layerColorsMap[0];

                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center bg-zinc-950/60 border border-zinc-800 px-3 py-1.5 rounded">
                            <span className={`text-[12px] font-mono font-black px-2 py-0.5 rounded text-black shrink-0 ${channelSolidBg[selectedIdx]}`}>
                              MODULAÇÕES LAYER 0{selectedIdx + 1}
                            </span>
                            <div className="flex gap-1.5 items-center">
                              <button
                                type="button"
                                onClick={() => handleCopyChannel(selectedIdx)}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all uppercase font-bold"
                                title="Copiar modulações do Layer"
                              >
                                Copiar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCutChannel(selectedIdx)}
                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all uppercase font-bold"
                                title="Recortar/Limpar modulações do Layer"
                              >
                                Recortar
                              </button>
                              <button
                                type="button"
                                disabled={!copiedChannelConfig}
                                onClick={() => handlePasteChannel(selectedIdx)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all uppercase font-bold ${
                                  copiedChannelConfig
                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 cursor-pointer'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 cursor-not-allowed'
                                }`}
                                title="Colar modulações salvas no Layer"
                              >
                                Colar
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                          {/* CHORUS PANEL */}
                          <div className="bg-zinc-950/60 border border-zinc-800 rounded p-3.5 flex flex-col justify-between gap-2.5">
                            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                              <span className={`text-[12px] font-mono font-black ${currentTheme.text} uppercase tracking-wider flex items-center gap-1`}>
                                🌀 CHORUS LAYER 0{selectedIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateChannelValue(selectedIdx, 'chorusBypass', !cBypass)}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-black border cursor-pointer transition ${
                                  cBypass
                                    ? 'bg-red-500/15 border-red-500/50 text-red-400 hover:bg-red-500/25 shadow-[0_0_4px_rgba(239,68,68,0.1)]'
                                    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_4px_rgba(16,185,129,0.1)]'
                                }`}
                              >
                                BYPASS: {cBypass ? 'ON' : 'OFF'}
                              </button>
                            </div>

                            {/* Presets and Saving Row */}
                            <div className="flex flex-col gap-1.5 bg-[#121316] p-2 rounded border border-zinc-800">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-mono font-black text-zinc-400 uppercase">PRESETS:</span>
                                <div className="flex items-center gap-1 flex-1 max-w-[140px]">
                                  <select
                                    value={selectedChorusPresetId}
                                    onChange={(e) => handleLoadChorusPreset(e.target.value, selectedIdx)}
                                    className={`bg-black border border-zinc-850 text-[11.5px] ${currentTheme.text} rounded px-1 py-0.5 font-mono focus:outline-none w-full cursor-pointer`}
                                  >
                                    <option value="">-- Carregar Chorus --</option>
                                    <optgroup label="Fábrica (Factory)">
                                      {factoryChorusTemplates.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </optgroup>
                                    {chorusPresets.length > 0 && (
                                      <optgroup label="Usuário (User)">
                                        {chorusPresets.map(p => (
                                          <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  {selectedChorusPresetId && chorusPresets.some(p => p.id === selectedChorusPresetId) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChorusPreset(selectedChorusPresetId)}
                                      className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-red-400 hover:text-white transition cursor-pointer text-[11px] font-mono uppercase font-black shrink-0"
                                    >
                                      Del
                                    </button>
                                  )}
                                </div>
                              </div>

                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleSaveChorusPreset(newChorusPresetName, selectedIdx);
                                }}
                                className="flex gap-1 items-center justify-between border-t border-zinc-800/60 pt-1"
                              >
                                <input
                                  type="text"
                                  value={newChorusPresetName}
                                  onChange={(e) => setNewChorusPresetName(e.target.value)}
                                  placeholder="Nomear chorus..."
                                  className={`bg-black border border-zinc-850 text-[11.5px] rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono flex-1 mr-1`}
                                />
                                <button
                                  type="submit"
                                  disabled={!newChorusPresetName.trim()}
                                  className={`text-[11px] font-mono font-black px-2 py-0.5 rounded ${currentTheme.bg} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase font-extrabold shrink-0`}
                                >
                                  Salvar
                                </button>
                              </form>
                            </div>

                            {/* Control Knobs Container */}
                            <div className="flex-1 bg-black/40 rounded border border-zinc-800 p-4 flex items-center justify-around gap-4 h-[180px]">
                              <Knob
                                label="VELOCIDADE"
                                min={0.1}
                                max={10.0}
                                value={cRate}
                                step={0.05}
                                defaultValue={1.5}
                                onChange={(val) => updateChannelValue(selectedIdx, 'chorusRate', parseFloat(val.toFixed(2)))}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${selectedIdx}_chorusRate`, `Layer 0${selectedIdx + 1} Chorus Vel`)}
                                unit="Hz"
                                color={currentTheme.knob}
                                size="lg"
                              />

                              <Knob
                                label="PROFUNDIDADE"
                                min={0.0}
                                max={1.0}
                                value={cDepth}
                                step={0.02}
                                defaultValue={0.3}
                                onChange={(val) => updateChannelValue(selectedIdx, 'chorusDepth', parseFloat(val.toFixed(2)))}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${selectedIdx}_chorusDepth`, `Layer 0${selectedIdx + 1} Chorus Prof`)}
                                unit="%"
                                color={currentTheme.knob}
                                size="lg"
                              />

                              <Knob
                                label="MIX"
                                min={0.0}
                                max={1.0}
                                value={cMix}
                                step={0.02}
                                defaultValue={0.45}
                                onChange={(val) => updateChannelValue(selectedIdx, 'chorusMix', parseFloat(val.toFixed(2)))}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${selectedIdx}_chorusMix`, `Layer 0${selectedIdx + 1} Chorus Mix`)}
                                unit="%"
                                color={currentTheme.knob}
                                size="lg"
                              />
                            </div>
                          </div>

                          {/* TREMOLO PANEL */}
                          <div className="bg-zinc-950/60 border border-zinc-800 rounded p-3.5 flex flex-col justify-between gap-2.5">
                            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
                              <span className={`text-[12px] font-mono font-black ${currentTheme.text} uppercase tracking-wider flex items-center gap-1`}>
                                ⚡️ TREMOLO LAYER 0{selectedIdx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateChannelValue(selectedIdx, 'tremoloBypass', !tBypass)}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-black border cursor-pointer transition ${
                                  tBypass
                                    ? 'bg-red-500/15 border-red-500/50 text-red-400 hover:bg-red-500/25 shadow-[0_0_4px_rgba(239,68,68,0.1)]'
                                    : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_4px_rgba(16,185,129,0.1)]'
                                }`}
                              >
                                BYPASS: {tBypass ? 'ON' : 'OFF'}
                              </button>
                            </div>

                            {/* Presets and Saving Row */}
                            <div className="flex flex-col gap-1.5 bg-[#121316] p-2 rounded border border-zinc-800">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-mono font-black text-zinc-400 uppercase">PRESETS:</span>
                                <div className="flex items-center gap-1 flex-1 max-w-[140px]">
                                  <select
                                    value={selectedTremoloPresetId}
                                    onChange={(e) => handleLoadTremoloPreset(e.target.value, selectedIdx)}
                                    className={`bg-black border border-zinc-850 text-[11.5px] ${currentTheme.text} rounded px-1 py-0.5 font-mono focus:outline-none w-full cursor-pointer`}
                                  >
                                    <option value="">-- Carregar Tremolo --</option>
                                    <optgroup label="Fábrica (Factory)">
                                      {factoryTremoloTemplates.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                    </optgroup>
                                    {tremoloPresets.length > 0 && (
                                      <optgroup label="Usuário (User)">
                                        {tremoloPresets.map(p => (
                                          <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  {selectedTremoloPresetId && tremoloPresets.some(p => p.id === selectedTremoloPresetId) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTremoloPreset(selectedTremoloPresetId)}
                                      className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-red-400 hover:text-white transition cursor-pointer text-[11px] font-mono uppercase font-black shrink-0"
                                    >
                                      Del
                                    </button>
                                  )}
                                </div>
                              </div>

                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleSaveTremoloPreset(newTremoloPresetName, selectedIdx);
                                }}
                                className="flex gap-1 items-center justify-between border-t border-zinc-800/60 pt-1"
                              >
                                <input
                                  type="text"
                                  value={newTremoloPresetName}
                                  onChange={(e) => setNewTremoloPresetName(e.target.value)}
                                  placeholder="Nomear tremolo..."
                                  className={`bg-black border border-zinc-850 text-[11.5px] rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:ring-1 ${currentTheme.ring} font-mono flex-1 mr-1`}
                                />
                                <button
                                  type="submit"
                                  disabled={!newTremoloPresetName.trim()}
                                  className={`text-[11px] font-mono font-black px-2 py-0.5 rounded ${currentTheme.bg} disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase font-extrabold shrink-0`}
                                >
                                  Salvar
                                </button>
                              </form>
                            </div>

                            {/* Control Knobs Container */}
                            <div className="flex-1 bg-black/40 rounded border border-zinc-800 p-4 flex items-center justify-around gap-4 h-[180px]">
                              <Knob
                                label="VELOCIDADE"
                                min={0.5}
                                max={20.0}
                                value={tRate}
                                step={0.1}
                                defaultValue={5.0}
                                onChange={(val) => updateChannelValue(selectedIdx, 'tremoloRate', parseFloat(val.toFixed(1)))}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${selectedIdx}_tremoloRate`, `Layer 0${selectedIdx + 1} Tremolo Vel`)}
                                unit="Hz"
                                color={currentTheme.knob}
                                size="lg"
                              />

                              <Knob
                                label="PROFUNDIDADE"
                                min={0.0}
                                max={1.0}
                                value={tDepth}
                                step={0.02}
                                defaultValue={0.5}
                                onChange={(val) => updateChannelValue(selectedIdx, 'tremoloDepth', parseFloat(val.toFixed(2)))}
                                onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${selectedIdx}_tremoloDepth`, `Layer 0${selectedIdx + 1} Tremolo Prof`)}
                                unit="%"
                                color={currentTheme.knob}
                                size="lg"
                              />
                              
                              {/* MODO Selector (Volume vs Auto-Pan) */}
                              <div className="flex flex-col items-center justify-center gap-2 select-none min-w-[72px]">
                                <span className="text-[11px] font-mono font-black text-zinc-300 uppercase tracking-widest text-center">
                                  MODO
                                </span>
                                
                                <div className="flex flex-col gap-1 bg-black/60 p-1 rounded border border-zinc-800 w-[90px]">
                                  <button
                                    type="button"
                                    onClick={() => updateChannelValue(selectedIdx, 'tremoloMode', 'volume')}
                                    className={`px-2 py-1.5 rounded font-mono text-[11.5px] font-black text-center cursor-pointer transition-all ${
                                      tMode === 'volume'
                                        ? currentTheme.active
                                        : 'text-zinc-300 hover:text-zinc-350 hover:bg-zinc-950/40'
                                    }`}
                                  >
                                    VOLUME
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateChannelValue(selectedIdx, 'tremoloMode', 'pan')}
                                    className={`px-2 py-1.5 rounded font-mono text-[11.5px] font-black text-center cursor-pointer transition-all ${
                                      tMode === 'pan'
                                        ? currentTheme.active
                                        : 'text-zinc-300 hover:text-zinc-350 hover:bg-zinc-950/40'
                                    }`}
                                  >
                                    AUTO-PAN
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                    })()}
                  </div>
                </div>
              )}


              {/* SCREEN TAB C-ECHO: DELAY & ECHO PROCESSOR */}
              {activeTab === 'delay' && (
                <EchoTab
                  channels={channels}
                  onChannelsChange={onChannelsChange}
                  activeParamFocus={activeParamFocus}
                  setActiveParamFocus={setActiveParamFocus}
                  channelAccents={channelAccents}
                  channelSolidBg={channelSolidBg}
                  updateChannelValue={updateChannelValue}
                  showNotification={showNotification}
                  handleCopyChannel={handleCopyChannel}
                  handleCutChannel={handleCutChannel}
                  handlePasteChannel={handlePasteChannel}
                  copiedChannelConfig={copiedChannelConfig}
                  handleOpenMidiContextMenu={handleOpenMidiContextMenu}
                />
              )}

              {/* SCREEN TAB C2: FILTERS (Filter & Envelope ADSR) */}
              {activeTab === 'filters' && (
                <FiltersTab
                  channels={channels}
                  onChannelsChange={onChannelsChange}
                  activeParamFocus={activeParamFocus}
                  setActiveParamFocus={setActiveParamFocus}
                  channelAccents={channelAccents}
                  channelSolidBg={channelSolidBg}
                  attackMax1s={attackMax1s}
                  onToggleAttackMax1s={handleToggleAttackMax1s}
                  selectedFxPresetId={selectedFxPresetId}
                  handleLoadFXPreset={handleLoadFXPreset}
                  fxPresets={fxPresets}
                  handleDeleteFXPreset={handleDeleteFXPreset}
                  newFxPresetName={newFxPresetName}
                  setNewFxPresetName={setNewFxPresetName}
                  handleSaveFXPreset={handleSaveFXPreset}
                  selectedAdsrPresetId={selectedAdsrPresetId}
                  handleLoadAdsrPreset={handleLoadAdsrPreset}
                  adsrPresets={adsrPresets}
                  handleDeleteAdsrPreset={handleDeleteAdsrPreset}
                  newAdsrPresetName={newAdsrPresetName}
                  setNewAdsrPresetName={setNewAdsrPresetName}
                  handleSaveAdsrPreset={handleSaveAdsrPreset}
                  selectedFilterPresetId={selectedFilterPresetId}
                  handleLoadFilterPreset={handleLoadFilterPreset}
                  filterPresets={filterPresets}
                  handleDeleteFilterPreset={handleDeleteFilterPreset}
                  newFilterPresetName={newFilterPresetName}
                  setNewFilterPresetName={setNewFilterPresetName}
                  handleSaveFilterPreset={handleSaveFilterPreset}
                  factoryTemplates={factoryTemplates}
                  factoryAdsrTemplates={factoryAdsrTemplates}
                  factoryFilterTemplates={factoryFilterTemplates}
                  updateChannelValue={updateChannelValue}
                  showNotification={showNotification}
                  handleOpenMidiContextMenu={handleOpenMidiContextMenu}
                />
              )}

              {/* SCREEN TAB C3: EQ (7-Band Equalizer & RTA) */}
              {activeTab === 'eq' && (
                <EqTab
                  channels={channels}
                  onChannelsChange={onChannelsChange}
                  activeParamFocus={activeParamFocus}
                  setActiveParamFocus={setActiveParamFocus}
                  channelAccents={channelAccents}
                  channelSolidBg={channelSolidBg}
                  selectedEqPresetId={selectedEqPresetId}
                  handleLoadEqPreset={handleLoadEqPreset}
                  eqPresets={eqPresets}
                  handleDeleteEqPreset={handleDeleteEqPreset}
                  newEqPresetName={newEqPresetName}
                  setNewEqPresetName={setNewEqPresetName}
                  handleSaveEqPreset={handleSaveEqPreset}
                  factoryEqTemplates={factoryEqTemplates}
                  updateChannelValue={updateChannelValue}
                  showNotification={showNotification}
                  eqFrequencyData={eqFrequencyData}
                  selectedEqBandIdx={selectedEqBandIdx}
                  setSelectedEqBandIdx={setSelectedEqBandIdx}
                  handleToggleEqBypass={handleToggleEqBypass}
                  handleResetEqToDefault={handleResetEqToDefault}
                  handleCopyChannel={handleCopyChannel}
                  handleCutChannel={handleCutChannel}
                  handlePasteChannel={handlePasteChannel}
                  copiedChannelConfig={copiedChannelConfig}
                  handleOpenMidiContextMenu={handleOpenMidiContextMenu}
                />
              )}

              {/* SCREEN TAB D: FX (Advanced Effects & Reverb processor) */}
              {activeTab === 'fx-adsr' && (
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
                              onClick={() => setActiveParamFocus([idx, 'reverbSend'])}
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

                    <div className="grid grid-cols-12 gap-3 flex-1 items-stretch">
                      {(() => {
                        const revFocusedIdx = activeParamFocus?.[0] ?? 0;
                        const revLayerColors = ['text-amber-500', 'text-sky-400', 'text-emerald-400', 'text-rose-400'];
                        const revSaveBtnStyles = [
                          'bg-amber-500 hover:bg-amber-400 text-black',
                          'bg-sky-500 hover:bg-sky-400 text-black',
                          'bg-emerald-500 hover:bg-emerald-400 text-black',
                          'bg-rose-500 hover:bg-rose-400 text-black'
                        ];
                        const revFocusRings = [
                          'focus:ring-amber-500',
                          'focus:ring-sky-500',
                          'focus:ring-emerald-500',
                          'focus:ring-rose-500'
                        ];

                        return (
                          <>
                            {/* Left side: High-Contrast Reverb Acoustic Visualizer */}
                            <div className="col-span-5 bg-[#080a0e] border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-2xl relative overflow-hidden">
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                <div>
                                  <span className={`text-[11px] font-mono font-black uppercase tracking-wider block ${revLayerColors[revFocusedIdx]} flex items-center gap-1.5`}>
                                    MODELO DE DECAY ACÚSTICO DE REVERB
                                  </span>
                                  <p className="text-[12px] font-mono text-zinc-400 mt-0.5 uppercase leading-tight font-medium">
                                    Simulação física do decaimento convolutivo & atenuação de agudos
                                  </p>
                                </div>
                                <span className={`text-[12px] font-mono font-black px-2 py-0.5 rounded border uppercase ${
                                  reverbBypass ? 'bg-red-950/80 border-red-600 text-red-300' : 'bg-amber-950/80 border-amber-500 text-amber-300'
                                }`}>
                                  {reverbBypass ? 'BYPASS' : 'ATIVO'}
                                </span>
                              </div>

                              {/* Interactive Acoustic Visualizer Screen */}
                              <div className="bg-[#030406] border border-zinc-800 rounded-lg p-3 flex flex-col justify-between relative overflow-hidden min-h-[175px] shadow-2xl">
                                {reverbBypass && (
                                  <div className="absolute inset-0 bg-zinc-950/85 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center pointer-events-none select-none">
                                    <span className="text-red-400 font-mono text-[11px] tracking-wider uppercase font-black bg-red-950/90 border border-red-700/80 px-3 py-1.5 rounded shadow-lg">
                                      REVERB GLOBAL BYPASSADO
                                    </span>
                                    <span className="text-zinc-400 font-mono text-[12px] mt-1.5 font-bold">O processador convolutivo não está aplicando efeito</span>
                                  </div>
                                )}

                                {/* Header Metrics Bar */}
                                <div className="flex flex-wrap items-center justify-between text-[10px] font-mono font-bold text-zinc-300 bg-zinc-900/80 border border-zinc-800/80 px-2.5 py-1 rounded select-none z-10 gap-1">
                                  <span className="text-emerald-300 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                                    DRY: 100%
                                  </span>
                                  <span className="text-cyan-300 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                                    PRE-DELAY: {Math.round(reverbPreDelay * 1000)}ms
                                  </span>
                                  <span className="text-amber-300 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                                    RT60 DECAY: {reverbDecay.toFixed(1)}s
                                  </span>
                                  <span className="text-emerald-400 flex items-center gap-1 font-black">
                                    CUT: {reverbHighCut >= 1000 ? `${(reverbHighCut / 1000).toFixed(1)} kHz` : `${Math.round(reverbHighCut)} Hz`}
                                  </span>
                                </div>

                                {/* Visual Energy Impulse Bars (like Echo visualizer) */}
                                <div className="flex items-end justify-between gap-1.5 w-full h-[95px] pt-3 px-1 relative z-10">
                                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((tapIdx) => {
                                    const isDry = tapIdx === 0;
                                    const isEarlyRef = tapIdx >= 1 && tapIdx <= 3;

                                    // High cut dampening factor
                                    const cutFactor = Math.min(1.0, Math.max(0.15, reverbHighCut / 12000));

                                    let barHeightPct = 0;
                                    let barColorClass = '';
                                    let barLabel = '';

                                    if (isDry) {
                                      barHeightPct = 100;
                                      barColorClass = 'bg-gradient-to-t from-emerald-600 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.6)]';
                                      barLabel = 'DRY';
                                    } else if (isEarlyRef) {
                                      const erDecay = Math.pow(0.82, tapIdx);
                                      barHeightPct = Math.max(20, Math.min(90, erDecay * (reverbMix + 0.3) * 100));
                                      barColorClass = 'bg-gradient-to-t from-cyan-600 to-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]';
                                      barLabel = `ER${tapIdx}`;
                                    } else {
                                      // Diffuse late decay bars
                                      const progress = (tapIdx - 3) / 8; // 0 to 1
                                      const decayEnvelope = Math.exp(-progress * (3.5 / Math.max(0.5, reverbDecay)));
                                      barHeightPct = Math.max(10, Math.min(95, decayEnvelope * cutFactor * (reverbMix + 0.25) * 100));

                                      if (cutFactor > 0.6) {
                                        barColorClass = 'bg-gradient-to-t from-amber-600 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
                                      } else if (cutFactor > 0.3) {
                                        barColorClass = 'bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
                                      } else {
                                        barColorClass = 'bg-gradient-to-t from-rose-700 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]';
                                      }
                                      barLabel = `${Math.round(progress * reverbDecay * 10) / 10}s`;
                                    }

                                    return (
                                      <div key={`rev_bar_${tapIdx}`} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                        {/* Glowing Energy Bar */}
                                        <div
                                          className={`w-full rounded-t transition-all duration-150 ${barColorClass} ${reverbBypass ? 'opacity-25' : 'opacity-90 group-hover:opacity-100'}`}
                                          style={{ height: `${barHeightPct}%` }}
                                        >
                                          <div className="w-full h-1 bg-white/60 rounded-t" />
                                        </div>

                                        {/* Bar Footer Label */}
                                        <span className="text-[11px] font-mono font-bold text-zinc-400 mt-1 truncate">
                                          {barLabel}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Dynamic SVG Overlay Curve */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40 z-0">
                                  <defs>
                                    <linearGradient id="reverbCurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
                                      <stop offset="20%" stopColor="#06b6d4" stopOpacity="0.8" />
                                      <stop offset="100%" stopColor={reverbHighCut < 3000 ? '#f43f5e' : '#f59e0b'} stopOpacity="0.1" />
                                    </linearGradient>
                                  </defs>
                                  <path
                                    d={`M 15 20 Q 80 25, 120 40 T ${Math.min(320, 150 + reverbDecay * 30)} 130 L 15 130 Z`}
                                    fill="url(#reverbCurveGrad)"
                                  />
                                </svg>
                              </div>

                              {/* Quick High Cut Frequency Presets Selector Bar */}
                              <div className="bg-[#0d1016] p-2 rounded-lg border border-zinc-800/80 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[12px] font-mono font-bold text-zinc-300">
                                  <span className="text-emerald-400 uppercase tracking-wider font-black">
                                    ATALHOS RÁPIDOS DE HIGH CUT (FILTRO DE AMBIENTE):
                                  </span>
                                  <span className="text-zinc-400">Clique para ajustar instantaneamente</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { label: '800 Hz (Íntimo Warm)', val: 800 },
                                    { label: '2.5 kHz (Sala Encorpada)', val: 2500 },
                                    { label: '5.0 kHz (Estúdio SF2)', val: 5000 },
                                    { label: '8.5 kHz (Placa Brilhante)', val: 8500 },
                                    { label: '16.0 kHz (Cristal Aberto)', val: 16000 },
                                  ].map((hc, hIdx) => {
                                    const isSelected = Math.abs(reverbHighCut - hc.val) < 200;
                                    return (
                                      <button
                                        key={`hc_quick_${hIdx}`}
                                        type="button"
                                        onClick={() => onReverbChange(reverbDecay, reverbMix, reverbPreDelay, hc.val)}
                                        className={`px-2 py-1 rounded text-[12px] font-mono font-black transition cursor-pointer border flex-1 text-center ${
                                          isSelected
                                            ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-102'
                                            : 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                                        }`}
                                      >
                                        {hc.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                    {/* Right side: Reverb Knobs & Channels Sends */}
                    <div className="col-span-7 bg-zinc-950/60 border border-zinc-800 rounded p-4 flex flex-col justify-between gap-4">
                      {/* Section 1: Master Reverb Knobs */}
                      <div>
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-1 mb-2">
                          <span className="text-[12px] font-mono font-black text-zinc-400 uppercase tracking-wider block">
                            PARAMETROS DO PROCESSADOR GLOBAL
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (onReverbBypassChange) {
                                  onReverbBypassChange(!reverbBypass);
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-all uppercase font-bold ${
                                reverbBypass
                                  ? 'bg-red-500/15 border-red-500/50 text-red-400 hover:bg-red-500/25 shadow-[0_0_4px_rgba(239,68,68,0.1)]'
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                              }`}
                              title="Desativa temporariamente o efeito de Reverb global"
                            >
                              Bypass: {reverbBypass ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        </div>

                        {/* Reverb Presets Bar */}
                        <div className="bg-[#121316]/90 border border-zinc-800/80 rounded p-2 mb-2 flex flex-wrap gap-2 items-center justify-between select-none">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                            <span className={`text-[11px] font-mono font-black uppercase tracking-widest shrink-0 ${revLayerColors[revFocusedIdx]}`}>
                              TIPO REVERB:
                            </span>
                            <select
                              value={selectedReverbPresetId}
                              onChange={(e) => handleLoadReverbPreset(e.target.value)}
                              className={`bg-black border border-zinc-850 text-zinc-300 text-[11.5px] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 ${revFocusRings[revFocusedIdx]} font-mono w-full`}
                            >
                              <option value="">-- Carregar Tipo Reverb --</option>
                              <optgroup label="Fábrica (Espaços/Ambientes)">
                                {factoryReverbTemplates.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </optgroup>
                              {reverbPresets.length > 0 && (
                                <optgroup label="Meus Tipos Reverb">
                                  {reverbPresets.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                            {selectedReverbPresetId && reverbPresets.some(p => p.id === selectedReverbPresetId) && (
                              <button
                                onClick={() => handleDeleteReverbPreset(selectedReverbPresetId)}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-red-400 hover:text-white transition cursor-pointer text-[11px] font-mono uppercase font-black shrink-0"
                                title="Excluir preset Reverb"
                              >
                                Remover
                              </button>
                            )}
                          </div>

                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSaveReverbPreset(newReverbPresetName);
                            }} 
                            className="flex gap-1 items-center"
                          >
                            <input
                              type="text"
                              value={newReverbPresetName}
                              onChange={(e) => setNewReverbPresetName(e.target.value)}
                              placeholder="Nomear reverb..."
                              className={`bg-black border border-zinc-850 text-[11.5px] rounded px-1.5 py-0.5 text-zinc-300 focus:outline-none focus:ring-1 ${revFocusRings[revFocusedIdx]} font-mono w-[110px]`}
                            />
                            <button
                              type="submit"
                              disabled={!newReverbPresetName.trim()}
                              className={`text-[11px] font-mono font-black px-2 py-0.5 rounded disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer uppercase font-extrabold ${revSaveBtnStyles[revFocusedIdx]}`}
                            >
                              Gravar
                            </button>
                          </form>
                        </div>

                        <div className="grid grid-cols-4 gap-2 justify-items-center items-center py-2 bg-black/35 rounded border border-zinc-800 relative">
                          {reverbBypass && (
                            <div className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center pointer-events-none select-none rounded">
                              <span className="text-red-500 font-sans font-black tracking-widest text-[10px] bg-black/95 px-3 py-1 rounded border border-red-950/80 shadow-[0_0_12px_rgba(239,68,68,0.45)] uppercase">
                                REVERB BYPASSADO
                              </span>
                              <span className="text-zinc-300 font-mono text-[11px] mt-1.5">O sinal do processador global está desativado</span>
                            </div>
                          )}
                          <Knob
                            label="Decay"
                            min={0.1}
                            max={8.0}
                            value={reverbDecay}
                            step={0.1}
                            defaultValue={2.5}
                            onChange={(val) => onReverbChange(val, reverbMix, reverbPreDelay, reverbHighCut)}
                            onContextMenu={(e) => handleOpenMidiContextMenu(e, 'reverbDecay', 'Reverb Global Decay')}
                            unit="s"
                            color="text-amber-500"
                            size="md"
                          />

                          <Knob
                            label="Mix Reverb"
                            min={0.0}
                            max={1.0}
                            value={reverbMix}
                            step={0.02}
                            defaultValue={0.25}
                            onChange={(val) => onReverbChange(reverbDecay, val, reverbPreDelay, reverbHighCut)}
                            onContextMenu={(e) => handleOpenMidiContextMenu(e, 'reverbMix', 'Reverb Global Mix')}
                            unit="%"
                            color="text-amber-500"
                            size="md"
                          />

                          <Knob
                            label="Pre-Delay"
                            min={0.0}
                            max={0.2}
                            value={reverbPreDelay}
                            step={0.005}
                            defaultValue={0.02}
                            onChange={(val) => onReverbChange(reverbDecay, reverbMix, val, reverbHighCut)}
                            onContextMenu={(e) => handleOpenMidiContextMenu(e, 'reverbPreDelay', 'Reverb Global Pre-Delay')}
                            unit="s"
                            color="text-cyan-400"
                            size="md"
                          />

                          <Knob
                            label="High Cut"
                            min={500}
                            max={20000}
                            value={reverbHighCut}
                            step={100}
                            defaultValue={5000}
                            onChange={(val) => onReverbChange(reverbDecay, reverbMix, reverbPreDelay, val)}
                            onContextMenu={(e) => handleOpenMidiContextMenu(e, 'reverbHighCut', 'Reverb Global High Cut')}
                            unit="Hz"
                            color="text-emerald-400"
                            size="md"
                          />
                        </div>
                      </div>

                      {/* Section 2: Channel Reverb Sends for ALL 4 Layers */}
                      {(() => {
                        const focusedIdx = activeParamFocus?.[0] ?? 0;
                        const layerColors = ['text-amber-400', 'text-sky-400', 'text-emerald-400', 'text-rose-400'];
                        const layerBorders = ['border-amber-500/30', 'border-sky-500/30', 'border-emerald-500/30', 'border-rose-500/30'];

                        return (
                          <div className="flex flex-col gap-2 bg-[#090b10] border border-zinc-800/80 p-3 rounded-xl shadow-xl">
                            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-1.5">
                              <div>
                                <span className="text-[10px] font-mono font-black text-zinc-300 uppercase tracking-wider block">
                                  ENVIO AUXILIAR DE REVERB POR CAMADA (LAYERS 01 - 04)
                                </span>
                                <span className="text-[11.5px] font-mono text-zinc-400 font-medium">
                                  Controle de envio individual para cada uma das 4 camadas do Studio-SF2
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 pt-1">
                              {[0, 1, 2, 3].map((lIdx) => {
                                const isFocused = lIdx === focusedIdx;
                                const lColor = layerColors[lIdx];
                                const lBorder = layerBorders[lIdx];
                                const sendVal = channels[lIdx]?.reverbSend ?? 0.2;

                                return (
                                  <div
                                    key={`rev_send_ly_${lIdx}`}
                                    onClick={() => setActiveParamFocus([lIdx, 'reverbSend'])}
                                    className={`flex flex-col items-center py-2 px-1 rounded-lg border transition-all cursor-pointer ${
                                      isFocused
                                        ? `${lBorder} bg-zinc-900/90 shadow-[0_0_12px_rgba(255,255,255,0.05)] ring-1 ring-white/20`
                                        : 'border-zinc-800/60 bg-zinc-950/50 opacity-80 hover:opacity-100 hover:border-zinc-700'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between w-full px-1.5 mb-1">
                                      <span className={`text-[11.5px] font-mono font-black uppercase ${lColor}`}>
                                        LY 0{lIdx + 1}
                                      </span>
                                      <span className={`text-[11px] font-mono font-bold px-1 rounded ${
                                        sendVal > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-zinc-800 text-zinc-400'
                                      }`}>
                                        {sendVal > 0 ? `${Math.round(sendVal * 100)}%` : 'MUTED'}
                                      </span>
                                    </div>

                                    <Knob
                                      label={`SEND L0${lIdx + 1}`}
                                      min={0}
                                      max={1}
                                      value={sendVal}
                                      step={0.05}
                                      defaultValue={0.2}
                                      onChange={(val) => updateChannelValue(lIdx, 'reverbSend', parseFloat(val.toFixed(2)))}
                                      onContextMenu={(e) => handleOpenMidiContextMenu(e, `layer${lIdx}_reverbSend`, `Layer 0${lIdx + 1} Reverb Send`)}
                                      unit="%"
                                      color={lColor}
                                      size="sm"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* SCREEN TAB E: UTILITY (SoundFont Upload & Presets Backup) */}
              {activeTab === 'utility' && (
                <div className="flex flex-col h-full justify-between gap-3 select-none">
                  {/* Settings grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 items-start py-1">
                    
                    {/* Left Col: Hardware Connection Status, System Controls & Backup */}
                    <div className="flex flex-col gap-2.5">
                      {/* Hardware Status */}
                      <div>
                        <span className="text-[12px] font-mono font-black text-zinc-300 uppercase block mb-1">
                          Status do Hardware MIDI & Sistema
                        </span>
                        <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded flex flex-col gap-2 select-none overflow-hidden">
                          <div className="flex flex-col gap-1.5 font-mono text-[11.5px]">
                            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                              <span className="text-zinc-300">DISPOSITIVO MIDI:</span>
                              <span className={isMidiConnected ? "text-sky-400 font-bold" : "text-zinc-300"}>
                                {isMidiConnected ? "STUDIO-SF2 MIDI CONECTADO" : "NENHUM DISPOSITIVO"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                              <span className="text-zinc-300">LATÊNCIA DO MOTOR:</span>
                              <span className="text-emerald-400 font-bold">~2.9 ms (ULTRA-LOW)</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                              <span className="text-zinc-300">MEMÓRIA FLASH DISPONÍVEL:</span>
                              <span className="text-zinc-350">128 MB / 128 MB (OK)</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/50 pb-1">
                              <span className="text-zinc-300">CHIP SINTETIZADOR:</span>
                              <span className="text-amber-400 font-bold">WebAudio SoundFont v3.4</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-300">RECONSTRUÇÃO DA BUFFER:</span>
                              <span className="text-zinc-350">AUTOMÁTICA (44.1/48kHz)</span>
                            </div>
                          </div>

                          {/* Presets manager shortcuts */}
                          <div className="border-t border-zinc-800 pt-2 flex flex-col gap-1">
                            <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider block">Backup do Sintetizador Studio-SF2:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              <button
                                type="button"
                                onClick={handleExportSettingsJson}
                                className="text-center text-[11.5px] font-mono font-black py-1.5 px-2 rounded bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 hover:text-emerald-300 transition cursor-pointer flex items-center justify-center gap-1"
                                title="Exportar Rápido apenas Configurações, Presets, Bancos e Sons (JSON leve)"
                              >
                                <Download className="w-3 h-3 text-emerald-400" />
                                BACKUP (.JSON)
                              </button>
                              <button
                                type="button"
                                onClick={handleExportCategoryListTxt}
                                className="text-center text-[11.5px] font-mono font-black py-1.5 px-2 rounded bg-purple-950/20 hover:bg-purple-950/40 border border-purple-900/50 text-purple-400 hover:text-purple-300 transition cursor-pointer flex items-center justify-center gap-1"
                                title="Exportar Catálogo com todos os SoundFonts SF2 organizados por Categoria (.TXT)"
                              >
                                <FileText className="w-3 h-3 text-purple-400" />
                                LISTA (.TXT)
                              </button>
                              <button
                                type="button"
                                onClick={() => backupFileInputRef.current?.click()}
                                className="text-center text-[11.5px] font-mono font-black py-1.5 px-2 rounded bg-sky-950/20 hover:bg-sky-950/40 border border-sky-900/50 text-sky-400 hover:text-sky-300 transition cursor-pointer flex items-center justify-center gap-1"
                                title="Importar Backup (.json)"
                              >
                                <Upload className="w-3 h-3 text-sky-400" />
                                IMPORTAR
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onSoundFontsReset();
                                }}
                                className="text-center text-[11.5px] font-mono font-bold py-1.5 px-2 rounded bg-red-950/20 hover:bg-red-950/50 border border-red-950 text-red-400 hover:text-red-350 transition cursor-pointer flex items-center justify-center"
                                title="Limpar todos os bancos SF2 do banco de dados IndexedDB"
                              >
                                LIMPAR CACHE
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interface Audio Settings */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11.5px] font-mono font-black text-zinc-300 uppercase block mb-1">
                            Taxa de Amostragem
                          </span>
                          <div className="bg-zinc-950/70 border border-zinc-800 rounded p-1.5 flex flex-col gap-1">
                            {[
                              { label: 'PADRÃO (AUTO)', value: undefined },
                              { label: '44.1 kHz', value: 44100 },
                              { label: '48.0 kHz', value: 48000 }
                            ].map((opt) => {
                              const isActive = preferredSampleRate === opt.value;
                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => onSampleRateChange(opt.value)}
                                  className={`py-0.5 px-1 rounded text-[11px] font-mono font-black border transition-all cursor-pointer text-center ${
                                    isActive
                                      ? 'bg-emerald-500 border-emerald-400 text-black font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.35)]'
                                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <span className="text-[11.5px] font-mono font-black text-zinc-300 uppercase block mb-1">
                            Dicas de Ajuda
                          </span>
                          <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 flex flex-col justify-between items-center h-[82px]">
                            <span className="text-[11px] font-mono text-zinc-400 font-bold text-center">
                              DICAS AO PASSAR O MOUSE
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowTips(!showTips)}
                              className={`w-full py-1 px-2 rounded text-[11px] font-mono font-black border transition-all cursor-pointer text-center ${
                                showTips
                                  ? 'bg-emerald-500 border-emerald-400 text-black font-extrabold shadow-[0_0_6px_rgba(16,185,129,0.35)]'
                                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                              }`}
                            >
                              {showTips ? 'HABILITADO' : 'DESABILITADO'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Col: Categorized SF2 Folders */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[12px] font-mono font-black text-zinc-300 uppercase block">
                          Pastas de Instrumentos
                        </span>
                        {cutSf2 && (
                          <div className="flex items-center gap-1 bg-amber-950/80 border border-amber-500/60 text-amber-200 px-2 py-0.5 rounded text-[11.5px] font-mono animate-pulse">
                            <span>✂️ Recortado: <b>{cutSf2.sfName}</b></span>
                            <button
                              type="button"
                              onClick={() => setCutSf2(null)}
                              className="text-amber-400 hover:text-white font-bold ml-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="bg-zinc-950/70 border border-zinc-800 rounded p-2 flex flex-col overflow-hidden max-h-[300px]">
                        <div className="overflow-y-auto pr-1 flex flex-col gap-1.5 scrollbar-thin">
                          {categoryList.map((cat, catIdx) => {
                            const sfsInCat = (loadedSoundFonts || []).filter(sf => sf && sfCategories && (sfCategories[sf.id] === cat || (cat === 'Piano' && !sfCategories[sf.id])));
                            const isExpanded = expandedCategory === cat;
                            
                            return (
                              <div key={`cat_folder_${cat}_${catIdx}`} className="border border-zinc-800/60 rounded overflow-hidden shrink-0">
                                <button
                                    onClick={() => setExpandedCategory(isExpanded ? null : cat)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setContextMenuCategory({ categoryName: cat, x: e.clientX, y: e.clientY });
                                    }}
                                    className="w-full bg-black/30 hover:bg-black/50 px-2.5 py-2 flex justify-between items-center text-[10px] font-mono text-zinc-200 font-bold transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      {isExpanded ? (
                                        <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                                      ) : (
                                        <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                                      )}
                                      <span>{cat.toUpperCase()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {cutSf2 && (
                                        <button
                                          type="button"
                                          onClick={(evt) => {
                                            evt.stopPropagation();
                                            if (cutSf2) {
                                              onSfCategoriesChange({ ...sfCategories, [cutSf2.sfId]: cat });
                                              showNotification(`SF2 "${cutSf2.sfName}" movido para "${cat}"!`, 'success');
                                              setCutSf2(null);
                                            }
                                          }}
                                          className="text-[11.5px] bg-amber-500 hover:bg-amber-400 text-black border border-amber-300 px-2 py-0.5 rounded font-mono font-black animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)] cursor-pointer"
                                          title="Colar SF2 recortado nesta categoria"
                                        >
                                          📋 COLAR
                                        </button>
                                      )}
                                      <span className={`text-[11.5px] px-1.5 py-0.5 rounded font-mono font-bold ${sfsInCat.length > 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-900/40 text-zinc-300'}`}>
                                        {sfsInCat.length} SF2
                                      </span>
                                    </div>
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="bg-black/60 border-t border-zinc-800/80 p-1.5 flex flex-col gap-1 text-[11.5px] font-mono">
                                      {sfsInCat.length === 0 ? (
                                        <span className="text-zinc-300 italic px-2 py-0.5">Pasta vazia</span>
                                      ) : (
                                        sfsInCat.map((sf) => {
                                          const originalIndex = loadedSoundFonts.findIndex(item => item.id === sf.id);
                                          return (
                                            <div 
                                              key={sf.id} 
                                              onContextMenu={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setContextMenuSf({ sfId: sf.id, sfName: sf.name, x: e.clientX, y: e.clientY });
                                              }}
                                              className="flex justify-between items-center bg-zinc-950/40 px-2 py-1 rounded border border-zinc-800/50 text-zinc-350 hover:border-cyan-500/40 cursor-context-menu"
                                            >
                                              <div className="flex flex-col truncate max-w-[170px]">
                                                <span className="truncate font-medium text-amber-400/90">
                                                  <b className="text-zinc-300 font-bold mr-1">[{originalIndex + 1}]</b>
                                                  {sf.name}
                                                </span>
                                                {(sfAttributes[sf.id] || []).length > 0 && (
                                                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                                                    {(sfAttributes[sf.id] || []).map((attr, aIdx) => {
                                                      const isFiltered = sfSearchQuery.toLowerCase().includes(attr.toLowerCase());
                                                      return (
                                                        <button
                                                          key={aIdx}
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleSearchTag(attr);
                                                          }}
                                                          className={`px-1 py-0.2 rounded text-[11px] font-mono font-bold cursor-pointer transition ${
                                                            isFiltered
                                                              ? 'bg-cyan-500 text-black font-extrabold border border-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.4)]'
                                                              : 'bg-cyan-950/90 text-cyan-300 hover:bg-cyan-900 hover:text-white border border-cyan-800/40'
                                                          }`}
                                                          title={`Clique para incluir/remover "${attr}" na pesquisa de atributos`}
                                                        >
                                                          🏷️ {attr}
                                                        </button>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                              <span className="text-[11px] text-zinc-300 shrink-0">
                                                {(sf.sizeMb ?? 0).toFixed(1)} MB
                                              </span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              )}

              {/* SCREEN TAB F: WAVEFORMS (New category-based soundfont selector) */}
              {activeTab === 'waveforms' && (
                <div className="flex flex-col h-full justify-between gap-2 select-none">
                  {/* Single Consolidated Header Bar */}
                  <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 shrink-0 select-none flex-wrap gap-2.5 bg-[#1b2224]/80 p-2 rounded-lg">
                    {/* Left side: Voltar, Categoria Badge, Title, Global Search */}
                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                      {(selectedWaveformCategory !== null || sfSearchQuery.trim() || sfFavoritesOnly) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWaveformCategory(null);
                            setSfSearchQuery('');
                            setSfFavoritesOnly(false);
                          }}
                          className="px-3 py-1.5 bg-[#2d383b] hover:bg-[#3d4b4e] text-zinc-100 rounded-md border border-[#526569]/80 font-mono text-[11px] font-bold cursor-pointer flex items-center gap-1.5 transition-all shadow-sm shrink-0 active:scale-95"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>VOLTAR PARA CATEGORIAS</span>
                        </button>
                      )}

                      {selectedWaveformCategory !== null ? (
                        <div className="flex items-center gap-2 bg-cyan-950/80 border-l-4 border-cyan-400 px-3 py-1 rounded-r-md text-[11px] font-mono shrink-0 shadow-inner select-none">
                          <Folder className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-zinc-400 font-bold uppercase text-[12px]">CATEGORIA:</span>
                          <span className="text-cyan-300 font-extrabold uppercase tracking-wide text-[11px]">{selectedWaveformCategory}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0 px-1">
                          <Music className="w-4 h-4 text-cyan-400" />
                          <span className="text-[12px] font-mono font-extrabold text-zinc-100 uppercase tracking-wider hidden sm:inline">
                            GERENCIADOR DE SOUNDFONTS (.SF2)
                          </span>
                        </div>
                      )}

                      {/* Campo de pesquisa global de SF2 e botão de favoritos */}
                      <div className="flex flex-col gap-1 w-[210px] sm:w-[260px] md:w-[320px]">
                        <div className="relative flex-1 flex items-center">
                          <Search className="w-3.5 h-3.5 text-cyan-300 absolute left-2.5 pointer-events-none z-10" />
                          <input
                            type="text"
                            value={sfSearchQuery}
                            onChange={(e) => setSfSearchQuery(e.target.value)}
                            placeholder="Pesquisar (ex: Acústico, Cama)..."
                            title="Digite nome, classe, presets ou múltiplos atributos separados por vírgula (ex: Acústico, Cama)"
                            className="w-full bg-[#263133] border border-[#4d5e61] text-white placeholder-zinc-400 text-[11px] font-mono rounded-md pl-8 pr-14 py-1 h-8 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400 shadow-sm transition-all"
                          />
                          <div className="absolute right-1 flex items-center gap-0.5">
                            {sfSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setSfSearchQuery('')}
                                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-black/40 transition cursor-pointer"
                                title="Limpar pesquisa (X)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSfFavoritesOnly(!sfFavoritesOnly)}
                              className={`p-1 rounded transition cursor-pointer ${
                                sfFavoritesOnly 
                                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]' 
                                  : 'text-zinc-400 hover:text-amber-400 hover:bg-[#3d4b4e]'
                              }`}
                              title={sfFavoritesOnly ? "Exibindo apenas Favoritos (Clique para ver todos)" : "Filtrar apenas favoritos ★"}
                            >
                              <Star className={`w-3.5 h-3.5 ${sfFavoritesOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Active multi-attribute search tags */}
                        {(() => {
                          const terms = sfSearchQuery.split(/[,]+/).map(s => s.trim()).filter(Boolean);
                          if (terms.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 items-center px-0.5">
                              <span className="text-[12px] font-mono text-cyan-300/80 font-bold uppercase shrink-0">Filtros:</span>
                              {terms.map((term, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="inline-flex items-center gap-1 bg-cyan-950 border border-cyan-400/80 text-cyan-200 px-1.5 py-0.2 rounded text-[12px] font-mono font-bold shadow-sm"
                                >
                                  <span>🏷️ {term}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSearchTag(term)}
                                    className="hover:text-red-300 text-cyan-400 font-bold ml-0.5 cursor-pointer"
                                    title={`Remover filtro "${term}"`}
                                  >
                                    ✕
                                  </button>
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Right side: Layer status, Adicionar SF2 & Limpar Categoria Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {selectingWaveformForLayer !== null && (
                        <div className="flex items-center gap-1.5 mr-1">
                          <span className={`text-[12px] font-mono font-black px-2 py-0.5 rounded border animate-pulse ${
                            [
                              'text-amber-300 bg-amber-500/20 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
                              'text-sky-300 bg-sky-500/20 border-sky-500/50 shadow-[0_0_8px_rgba(14,165,233,0.3)]',
                              'text-emerald-300 bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                              'text-rose-300 bg-rose-500/20 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                            ][selectingWaveformForLayer % 4]
                          }`}>
                            ★ DESTINO: LAYER 0{selectingWaveformForLayer + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectingWaveformForLayer(null)}
                            className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-[12px] font-mono font-bold cursor-pointer uppercase"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* ADICIONAR SF2 BUTTON (cyan primary action button) */}
                      <button
                        type="button"
                        onClick={() => waveformsFileInputRef.current?.click()}
                        className="text-center text-[11px] font-mono font-extrabold py-1.5 px-3.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 hover:shadow-cyan-400/30 shrink-0 active:scale-95"
                        title={`Adicionar novos arquivos .SF2 na categoria ${selectedWaveformCategory || 'GERAL'}`}
                      >
                        <Plus className="w-4 h-4 text-zinc-950 stroke-[2.5]" />
                        <span>Adicionar SF2</span>
                      </button>

                      {/* LIMPAR CATEGORIA BUTTON (red secondary action button) */}
                      {selectedWaveformCategory && (loadedSoundFonts || []).some(sf => sf && sfCategories && (sfCategories[sf.id] === selectedWaveformCategory || (selectedWaveformCategory === 'Piano' && !sfCategories[sf.id]))) && (
                        <button
                          type="button"
                          onClick={() => {
                            const listInCat = (loadedSoundFonts || []).filter(sf => sf && sfCategories && (sfCategories[sf.id] === selectedWaveformCategory || (selectedWaveformCategory === 'Piano' && !sfCategories[sf.id])));
                            if (onRemoveMultipleSoundFonts) {
                              onRemoveMultipleSoundFonts(listInCat.map(sf => sf.id));
                            } else {
                              listInCat.forEach(sf => onRemoveSoundFont(sf.id));
                            }
                          }}
                          className="text-center text-[10px] font-mono font-bold py-1.5 px-3 rounded-md bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-300 hover:text-white transition-all cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5 active:scale-95"
                          title="Limpar todos os SoundFonts desta categoria"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>LIMPAR CATEGORIA</span>
                        </button>
                      )}

                      <input
                        type="file"
                        ref={waveformsFileInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const files = Array.from(e.target.files);
                            e.target.value = '';
                            onSoundFontsUploaded(files, selectedWaveformCategory);
                          }
                        }}
                        accept=".sf2,.sf3,.sfz"
                        multiple
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Body Content */}
                  {selectedWaveformCategory === null && !sfSearchQuery.trim() && !sfFavoritesOnly ? (
                    /* Category Grid view */
                    <div className="flex-1 flex flex-col justify-between gap-2 overflow-hidden">
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-300 uppercase tracking-wide shrink-0 font-semibold flex-wrap gap-2">
                        <span>Selecione uma classe / categoria para ver os SoundFonts:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCategoryNameInput('');
                              setIsAddCategoryModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 hover:text-white text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                            title="Criar uma nova Classe / Categoria personalizada"
                          >
                            <Plus className="w-3.5 h-3.5 text-cyan-400" />
                            <span>+ NOVA CLASSE</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRestoreDefaultCategories}
                            className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 hover:text-white text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                            title="Restaurar e repor todas as 20 Classes Padrão do sistema"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                            <span>RESTAURAR CLASSES PADRÃO</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 flex-1 py-1 items-stretch overflow-y-auto pr-1 scrollbar-thin">
                        {categoryList.map((catName, catIdx) => {
                          const sfList = (loadedSoundFonts || []).filter(sf => sf && sfCategories && (sfCategories[sf.id] === catName || (catName === 'Piano' && !sfCategories[sf.id])));
                          const count = sfList.length;
                          return (
                            <button
                              key={`cat_grid_${catName}_${catIdx}`}
                              type="button"
                              onClick={() => setSelectedWaveformCategory(catName)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenuCategory({
                                  x: e.clientX,
                                  y: e.clientY,
                                  categoryName: catName
                                });
                              }}
                              className="border border-[#6a8284]/60 rounded-lg p-3.5 text-left flex flex-col justify-between bg-[#2d3335] hover:bg-[#3d4548] hover:border-cyan-300 hover:shadow-[0_0_14px_rgba(6,182,212,0.3)] transition-all cursor-pointer relative overflow-hidden group min-h-[80px]"
                              title="Clique para ver os sons. Clique com botão direito para RENOMEAR esta classe."
                            >
                              <div className="absolute top-0 right-0 w-8 h-8 bg-gradient-to-br from-cyan-400/20 to-transparent rounded-bl-full pointer-events-none group-hover:from-cyan-400/30 transition-all" />
                              <div className="flex flex-col">
                                <span className="text-[19px] font-sans font-black leading-tight truncate text-white uppercase group-hover:text-cyan-300">
                                  {catName}
                                </span>
                                <span className="text-[12px] font-mono text-cyan-200 truncate uppercase mt-0.5 tracking-wider font-extrabold">
                                  CLASSE SF2
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-3">
                                <span className="text-[12px] font-mono text-zinc-100 font-black uppercase tracking-wider">
                                  BANCOS
                                </span>
                                <span className={`text-[13px] px-2.5 py-0.5 rounded font-mono font-black ${count > 0 ? 'bg-cyan-500/40 text-cyan-100 border border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]' : 'bg-zinc-950 text-zinc-400 border border-zinc-800'}`}>
                                  {count}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Inside selected category view OR Global Search / Favorites Only list view */
                    <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
                        {/* SoundFont List Scrolling Card - Maximized Height */}
                        <div className="flex-1 bg-[#6a8284]/5 border border-[#6a8284]/25 p-2.5 rounded flex flex-col overflow-hidden">
                          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-2 content-start scrollbar-thin">
                            {isSf2Loading || isDbLoading ? (
                              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                <div className="relative flex items-center justify-center mb-1">
                                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500/20 border-t-cyan-500" />
                                  <Music className="w-4 h-4 text-cyan-400 absolute animate-pulse" />
                                </div>
                                <span className="text-[11px] font-mono font-bold text-cyan-300 animate-pulse uppercase tracking-wider">
                                  {isDbLoading ? 'Restaurando SF2...' : 'Carregando Waveform...'}
                                </span>
                                <span className="text-[12px] font-mono text-zinc-400 mt-0.5">Processando arquivo Soundfont</span>
                              </div>
                            ) : (
                              (() => {
                                const list = (loadedSoundFonts || []).filter(sf => {
                                  if (!sf) return false;
                                  // Category check if not doing global search or favorites filter
                                  if (selectedWaveformCategory !== null && !sfSearchQuery.trim() && !sfFavoritesOnly) {
                                    const matchCat = sfCategories && (sfCategories[sf.id] === selectedWaveformCategory || (selectedWaveformCategory === 'Piano' && !sfCategories[sf.id]));
                                    if (!matchCat) return false;
                                  }
                                  // Favorites check
                                  if (sfFavoritesOnly && !sfFavorites.has(sf.id) && !sfFavorites.has(sf.name)) {
                                    return false;
                                  }
                                  // Query check
                                  if (sfSearchQuery.trim()) {
                                    const terms = sfSearchQuery
                                      .toLowerCase()
                                      .split(/[,]+|\s+/)
                                      .map(t => t.trim())
                                      .filter(Boolean);

                                    if (terms.length > 0) {
                                      const allTermsMatch = terms.every(term => {
                                        const nameMatch = sf.name.toLowerCase().includes(term);
                                        const catMatch = (sfCategories[sf.id] || '').toLowerCase().includes(term);
                                        const presetMatch = sf.presets.some(p => p.name.toLowerCase().includes(term));
                                        const attrMatch = (sfAttributes[sf.id] || []).some(attr => attr.toLowerCase().includes(term));
                                        return nameMatch || catMatch || presetMatch || attrMatch;
                                      });
                                      if (!allTermsMatch) return false;
                                    }
                                  }
                                  return true;
                                });

                                if (list.length === 0) {
                                  return (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8 opacity-75">
                                      <Music className="w-8 h-8 text-zinc-300 mb-1" />
                                      <span className="text-[11px] font-mono text-zinc-300 font-bold">NENHUM BANCO SF2 ENCONTRADO</span>
                                      <span className="text-[12px] font-mono text-zinc-400 mt-1 uppercase">Tente alterar o termo da busca ou o filtro de favoritos</span>
                                    </div>
                                  );
                                }
                                return list.map((sf) => {
                                  const originalIndex = loadedSoundFonts.findIndex(item => item.id === sf.id);
                                  const isFav = sfFavorites.has(sf.id) || sfFavorites.has(sf.name);

                                  return (
                                    <div 
                                      key={sf.id} 
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setContextMenuSf({ sfId: sf.id, sfName: sf.name, x: e.clientX, y: e.clientY });
                                      }}
                                      className="flex flex-col bg-[#384042] border border-[#6a8284]/50 rounded-lg p-2.5 hover:border-cyan-400/60 transition-colors shadow-sm cursor-context-menu gap-1.5"
                                    >
                                      {/* Top Row: Title on Left, Action Buttons on Right */}
                                      <div className="flex justify-between items-center gap-2">
                                        <span className="text-white font-black truncate flex items-center gap-1 text-[15px] sm:text-[16px] min-w-0">
                                          <span className="text-cyan-300 font-black">[{originalIndex + 1}]</span> {sf.name}
                                        </span>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {/* Estrela de Favorito */}
                                          <button
                                            type="button"
                                            onClick={() => toggleFavorite(sf.id)}
                                            className={`p-1.5 rounded border transition-all cursor-pointer shrink-0 ${
                                              isFav
                                                ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                                : 'bg-zinc-900/80 border-[#6a8284]/50 hover:bg-zinc-950 text-zinc-300 hover:text-amber-400 hover:border-amber-500/40'
                                            }`}
                                            title={isFav ? "Remover dos Favoritos" : "Marcar SF2 como Favorito"}
                                          >
                                            <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
                                          </button>

                                          {(() => {
                                            const targetLayer = selectingWaveformForLayer !== null ? selectingWaveformForLayer : (activeParamFocus?.[0] ?? 0);
                                            const isAuditioning = auditioningSoundFont && auditioningSoundFont.layerIndex === targetLayer && auditioningSoundFont.soundfontId === sf.id;
                                            return (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handlePreviewSoundFont(sf)}
                                                  className={`px-3 py-1.5 rounded border text-[12px] font-mono font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                                                    isAuditioning
                                                      ? 'bg-cyan-400 border-cyan-300 text-black animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.6)] font-black'
                                                      : 'bg-zinc-900/80 border-[#6a8284]/60 hover:bg-zinc-950 text-cyan-200 hover:text-white hover:border-cyan-300'
                                                  }`}
                                                  title={`Ouvir uma preaudição desta Waveform no Layer 0${targetLayer + 1}`}
                                                >
                                                  <Volume2 className={`w-4 h-4 ${isAuditioning ? 'animate-bounce' : ''}`} />
                                                  {isAuditioning ? 'OUVINDO...' : 'OUVIR'}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const sfIdx = loadedSoundFonts.indexOf(sf);
                                                    if (sfIdx !== -1) {
                                                      let savedGain = 1.0;
                                                      try {
                                                        const storedGains = JSON.parse(localStorage.getItem('sf2_custom_gains') || '{}');
                                                        savedGain = storedGains[sf.id] || storedGains[sf.name] || 1.0;
                                                      } catch (err) {}

                                                      const savedConfig = getSF2SavedConfig(sf.id);

                                                      const nextCh = [...channels];
                                                      nextCh[targetLayer] = {
                                                        ...nextCh[targetLayer],
                                                        soundfontIndex: sfIdx,
                                                        soundfontId: sf.id,
                                                        soundfontName: sf.name,
                                                        soundfontGain: savedConfig?.soundfontGain ?? savedGain ?? 1.0,
                                                        presetIndex: savedConfig?.presetIndex ?? 0,
                                                        ...(savedConfig ? {
                                                          volume: savedConfig.volume ?? nextCh[targetLayer].volume,
                                                          pan: savedConfig.pan ?? nextCh[targetLayer].pan,
                                                          filterCutoff: savedConfig.filterCutoff ?? nextCh[targetLayer].filterCutoff,
                                                          filterResonance: savedConfig.filterResonance ?? nextCh[targetLayer].filterResonance,
                                                          filterType: savedConfig.filterType ?? nextCh[targetLayer].filterType,
                                                          adsr: savedConfig.adsr ? { ...savedConfig.adsr } : nextCh[targetLayer].adsr,
                                                          reverbSend: savedConfig.reverbSend ?? nextCh[targetLayer].reverbSend,
                                                          chorusMix: savedConfig.chorusMix ?? nextCh[targetLayer].chorusMix,
                                                          octaveOffset: savedConfig.octaveOffset ?? nextCh[targetLayer].octaveOffset,
                                                          midiSensitivity: savedConfig.midiSensitivity ?? nextCh[targetLayer].midiSensitivity,
                                                          eqLow: savedConfig.eqLow ?? nextCh[targetLayer].eqLow,
                                                          eqMid: savedConfig.eqMid ?? nextCh[targetLayer].eqMid,
                                                          eqHigh: savedConfig.eqHigh ?? nextCh[targetLayer].eqHigh,
                                                        } : {})
                                                      };
                                                      onChannelsChange(nextCh);
                                                      if (onAuditioningSoundFontChange) {
                                                        onAuditioningSoundFontChange(null);
                                                      }
                                                      setSelectingWaveformForLayer(null);
                                                      showNotification(`Waveform "${sf.name}" selecionada no Layer 0${targetLayer + 1}!`, 'success');
                                                      setActiveTab('performance');
                                                    }
                                                  }}
                                                  className="px-3 py-1.5 rounded bg-emerald-500 border border-emerald-400 text-black text-[12px] font-mono font-black hover:bg-emerald-400 transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)] shrink-0"
                                                  title={`Carregar esta Waveform no Layer 0${targetLayer + 1}`}
                                                >
                                                  SELECIONAR
                                                </button>
                                              </>
                                            );
                                          })()}

                                          <button
                                            type="button"
                                            onClick={() => onRemoveSoundFont(sf.id)}
                                            className="p-1.5 rounded bg-zinc-950 hover:bg-red-950/60 border border-zinc-800 hover:border-red-800 text-zinc-400 hover:text-red-300 cursor-pointer transition-all shrink-0"
                                            title="Deletar SoundFont"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Bottom Row: Attributes Badges wrapping on Left, Size & Presets Count on Right */}
                                      <div className="flex justify-between items-end gap-2 flex-wrap sm:flex-nowrap mt-0.5">
                                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                                          {(sfAttributes[sf.id] || []).map((attr, aIdx) => {
                                            const isSelected = sfSearchQuery.toLowerCase().includes(attr.toLowerCase());
                                            return (
                                              <button
                                                key={aIdx}
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleSearchTag(attr);
                                                }}
                                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold shadow-sm cursor-pointer transition-all flex items-center gap-1 ${
                                                  isSelected
                                                    ? 'bg-cyan-500 text-black border border-cyan-300 font-extrabold shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                                                    : 'bg-cyan-950 text-cyan-200 border border-cyan-400/60 hover:bg-cyan-900 hover:text-white'
                                                }`}
                                                title={`Clique para filtrar por "${attr}" (Suporta múltiplos atributos)`}
                                              >
                                                🏷️ {attr}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        <div className="shrink-0 text-right ml-auto">
                                          <span className="text-[12px] text-zinc-100 font-mono font-bold">
                                            {(sf.sizeMb ?? 0).toFixed(2)} MB • {sf.presets.length} Presets
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                });
                              })()
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

          </div>

          {/* C. Interactive Glass Overlay Touchpad Grid Glow effect */}
          <div className="absolute inset-0 pointer-events-none rounded-lg border border-white/5 bg-gradient-to-tr from-white/0 via-white/5 to-white/0" />
        </div>

      </div>

      {/* Toast Notification */}
      {notification.isOpen && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl animate-fade-in max-w-sm bg-[#0a0c10] border-zinc-800">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            notification.type === 'success' 
              ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
              : notification.type === 'warning'
                ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                : 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]'
          }`} />
          <p className="text-[11px] font-sans font-medium text-zinc-300 leading-snug">
            {notification.message}
          </p>
          <button 
            onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
            className="text-zinc-300 hover:text-zinc-400 text-xs font-mono ml-auto cursor-pointer transition pl-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0e1014] border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-scale-up select-none">
            <h2 className="text-xs font-mono font-black uppercase text-zinc-300 tracking-wider flex items-center gap-2 border-b border-zinc-800 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
              {confirmDialog.title}
            </h2>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end mt-2 border-t border-zinc-800 pt-4">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded text-[10px] font-mono font-black bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white transition cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              >
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Layer Context Menu */}
      {contextMenuLayer && (
        <div 
          className="fixed bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-50 p-1 flex flex-col min-w-44 select-none"
          style={{ 
            left: `${Math.min(window.innerWidth - 180, contextMenuLayer.x)}px`, 
            top: `${Math.min(window.innerHeight - 200, contextMenuLayer.y)}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 uppercase tracking-wider border-b border-zinc-800 mb-1">
            Opções do Layer 0{contextMenuLayer.layerIndex + 1}
          </div>

          <button
            onClick={() => {
              handleCopyLayer(contextMenuLayer.layerIndex);
              setContextMenuLayer(null);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full animate-fade-in"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" />
            <span>Copiar Layer</span>
          </button>

          <button
            onClick={() => {
              handleCutLayer(contextMenuLayer.layerIndex);
              setContextMenuLayer(null);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-zinc-300 hover:text-white hover:bg-zinc-900 rounded cursor-pointer transition-all w-full animate-fade-in"
          >
            <Scissors className="w-3.5 h-3.5 text-rose-400" />
            <span>Recortar Layer</span>
          </button>

          <button
            onClick={() => {
              handlePasteLayer(contextMenuLayer.layerIndex);
              setContextMenuLayer(null);
            }}
            disabled={!copiedLayerData}
            className={`flex items-center gap-2 px-2.5 py-1.5 text-xs text-left rounded transition-all w-full ${
              copiedLayerData 
                ? 'text-zinc-300 hover:text-white hover:bg-zinc-900 cursor-pointer' 
                : 'text-zinc-300 cursor-not-allowed'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5 text-emerald-500" />
            <span>Colar Layer</span>
          </button>
        </div>
      )}

      {/* Floating MIDI Learn Context Menu */}
      {midiContextMenu && (
        <div 
          className="fixed bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-[9999] p-1.5 flex flex-col min-w-48 select-none animate-fade-in"
          style={{ 
            left: `${Math.min(window.innerWidth - 200, midiContextMenu.x)}px`, 
            top: `${Math.min(window.innerHeight - 150, midiContextMenu.y)}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800 mb-1 flex items-center justify-between">
            <span className="font-bold text-amber-400">MIDI LEARN</span>
            {midiMappings[midiContextMenu.paramId] !== undefined && (
              <span className="text-[11px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30">
                CC {midiMappings[midiContextMenu.paramId]}
              </span>
            )}
          </div>

          <p className="px-2.5 py-0.5 text-[11.5px] font-mono text-zinc-300 font-bold truncate">
            {midiContextMenu.paramName}
          </p>

          <button
            onClick={() => handleStartMidiLearn(midiContextMenu.paramId, midiContextMenu.paramName)}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-zinc-200 hover:text-white hover:bg-amber-500/20 hover:border-amber-500/40 border border-transparent rounded cursor-pointer transition-all w-full mt-1 font-mono font-bold"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span>{midiMappings[midiContextMenu.paramId] !== undefined ? 'Re-Aprender MIDI CC' : 'Aprender MIDI CC'}</span>
          </button>

          {midiMappings[midiContextMenu.paramId] !== undefined && (
            <button
              onClick={() => handleRemoveMidiMapping(midiContextMenu.paramId)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-left text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded cursor-pointer transition-all w-full mt-0.5 font-mono"
            >
              <span>Remover Mapeamento</span>
            </button>
          )}
        </div>
      )}

      {/* Floating MIDI Learn Mode Active Banner */}
      {learningParam && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-amber-950/95 border border-amber-500/80 px-4 py-2.5 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.3)] flex items-center gap-3 backdrop-blur-md animate-bounce select-none">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-black text-amber-300 uppercase tracking-widest leading-none">
              MODO APRENDER MIDI CC ATIVO
            </span>
            <span className="text-[12px] font-mono text-amber-200 font-bold mt-0.5">
              Mova o controle no seu teclado MIDI para: "{learningParam.name}"
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLearningParam(null)}
            className="ml-2 px-2 py-0.5 bg-black/60 hover:bg-black text-amber-400 hover:text-amber-200 text-[12px] font-mono font-bold rounded border border-amber-500/40 cursor-pointer transition uppercase"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* SF2 Context Menu */}
      {contextMenuSf && (
        <div
          className="fixed z-[9999] bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl p-2 font-mono text-[11px] w-64 select-none flex flex-col gap-1"
          style={{
            left: Math.min(contextMenuSf.x, window.innerWidth - 270),
            top: Math.min(contextMenuSf.y, window.innerHeight - 340)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 border-b border-zinc-800 text-cyan-400 font-bold truncate flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{contextMenuSf.sfName}</span>
          </div>

          {/* Exibir Atributos */}
          <div className="px-2 py-1.5 bg-black/60 rounded border border-zinc-800 my-1">
            <span className="text-[12px] text-zinc-400 uppercase font-bold block mb-1">Atributos Atuais:</span>
            {(sfAttributes[contextMenuSf.sfId] || []).length > 0 ? (
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {(sfAttributes[contextMenuSf.sfId] || []).map((attr, idx) => (
                  <span key={idx} className="bg-cyan-950/80 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded text-[12px] font-bold">
                    🏷️ {attr}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[12px] text-zinc-300 italic">Nenhum atributo definido</span>
            )}
          </div>

          {/* Inserir / Editar Atributos */}
          <button
            type="button"
            onClick={() => {
              const currentAttrs = sfAttributes[contextMenuSf.sfId] || [];
              setAttributeInputText(currentAttrs.join(', '));
              setAttributeModalTarget({ sfId: contextMenuSf.sfId, sfName: contextMenuSf.sfName });
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-cyan-950/60 hover:text-cyan-300 rounded text-zinc-200 transition flex items-center gap-2 font-bold cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Inserir / Editar Atributos</span>
          </button>

          {/* Copiar Atributos */}
          <button
            type="button"
            onClick={() => {
              const currentAttrs = sfAttributes[contextMenuSf.sfId] || [];
              saveCopiedAttributes([...currentAttrs]);
              showNotification(`Atributos de "${contextMenuSf.sfName}" copiados!`, 'info');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 rounded text-zinc-200 transition flex items-center gap-2 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Copiar Atributos</span>
          </button>

          {/* Colar Atributos */}
          <button
            type="button"
            disabled={!copiedAttributes || copiedAttributes.length === 0}
            onClick={() => {
              if (copiedAttributes && copiedAttributes.length > 0) {
                const existing = sfAttributes[contextMenuSf.sfId] || [];
                const merged = Array.from(new Set([...existing, ...copiedAttributes]));
                updateSfAttributes(contextMenuSf.sfId, merged);
                showNotification(`Atributos colados em "${contextMenuSf.sfName}"!`, 'success');
              }
              setContextMenuSf(null);
            }}
            className={`w-full text-left px-2 py-1.5 rounded transition flex items-center gap-2 ${
              copiedAttributes && copiedAttributes.length > 0 ? 'hover:bg-zinc-800 text-zinc-200 cursor-pointer font-bold' : 'text-zinc-300 cursor-not-allowed'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Colar Atributos {copiedAttributes && copiedAttributes.length > 0 ? `(${copiedAttributes.length})` : ''}</span>
          </button>

          {/* Recortar Atributos */}
          <button
            type="button"
            onClick={() => {
              const currentAttrs = sfAttributes[contextMenuSf.sfId] || [];
              saveCopiedAttributes([...currentAttrs]);
              updateSfAttributes(contextMenuSf.sfId, []);
              showNotification(`Atributos recortados de "${contextMenuSf.sfName}"!`, 'info');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-amber-950/40 hover:text-amber-300 rounded text-amber-400 transition flex items-center gap-2 cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Recortar Atributos</span>
          </button>

          {/* Deletar Atributos */}
          <button
            type="button"
            onClick={() => {
              updateSfAttributes(contextMenuSf.sfId, []);
              showNotification(`Todos os atributos deletados de "${contextMenuSf.sfName}"!`, 'warning');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-red-950/60 hover:text-red-300 rounded text-red-400 transition flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Deletar todos os Atributos</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          {/* Gravar Ajustes do Layer no SF2 */}
          <button
            type="button"
            onClick={() => {
              const targetLayer = activeParamFocus?.[0] ?? 0;
              const currentCh = channels[targetLayer];
              saveSF2ConfigFromChannel(contextMenuSf.sfId, currentCh);
              showNotification(`Ajustes do Layer 0${targetLayer + 1} gravados no SF2 "${contextMenuSf.sfName}"!`, 'success');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-emerald-950/60 hover:text-emerald-300 rounded text-emerald-400 transition flex items-center gap-2 font-bold cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Gravar Ajustes do Layer no SF2</span>
          </button>

          {/* Resetar Ajustes do SF2 */}
          <button
            type="button"
            onClick={() => {
              removeSF2Config(contextMenuSf.sfId);
              showNotification(`Ajustes do SF2 "${contextMenuSf.sfName}" restaurados para o padrão!`, 'info');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 hover:text-zinc-200 rounded text-zinc-400 transition flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Resetar Ajustes do SF2</span>
          </button>

          {/* Recortar SF2 (Mover) */}
          <button
            type="button"
            onClick={() => {
              setCutSf2({ sfId: contextMenuSf.sfId, sfName: contextMenuSf.sfName });
              showNotification(`SF2 "${contextMenuSf.sfName}" recortado! Clique no botão COLAR na Categoria desejada.`, 'info');
              setContextMenuSf(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-amber-500/20 hover:text-amber-300 rounded text-amber-400 transition flex items-center gap-2 font-bold cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Recortar SF2 (Mover)</span>
          </button>
        </div>
      )}

      {/* Category Context Menu */}
      {contextMenuCategory && (
        <div
          className="fixed z-[9999] bg-zinc-950 border border-zinc-700 rounded-lg shadow-2xl p-2 font-mono text-[12px] w-64 select-none flex flex-col gap-1"
          style={{
            left: Math.min(contextMenuCategory.x, window.innerWidth - 270),
            top: Math.min(contextMenuCategory.y, window.innerHeight - 180)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 border-b border-zinc-800 text-amber-400 font-bold truncate flex items-center gap-1.5">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="truncate">Classe: {contextMenuCategory.categoryName}</span>
          </div>

          {/* Renomear Classe / Categoria */}
          <button
            type="button"
            onClick={() => {
              setRenameCategoryTarget(contextMenuCategory.categoryName);
              setRenameCategoryName(contextMenuCategory.categoryName);
              setContextMenuCategory(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-cyan-950/80 hover:text-cyan-200 rounded text-cyan-300 transition flex items-center gap-2 font-bold cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Renomear Classe / Categoria</span>
          </button>

          <button
            type="button"
            disabled={!cutSf2}
            onClick={() => {
              if (cutSf2) {
                onSfCategoriesChange({ ...sfCategories, [cutSf2.sfId]: contextMenuCategory.categoryName });
                showNotification(`SF2 "${cutSf2.sfName}" movido para Categoria "${contextMenuCategory.categoryName}"!`, 'success');
                setCutSf2(null);
              }
              setContextMenuCategory(null);
            }}
            className={`w-full text-left px-2 py-1.5 rounded transition flex items-center gap-2 ${
              cutSf2 ? 'hover:bg-amber-950/60 hover:text-amber-300 text-amber-400 font-bold cursor-pointer' : 'text-zinc-300 cursor-not-allowed'
            }`}
          >
            <Clipboard className="w-4 h-4 shrink-0" />
            <span>Colar SF2 nesta Categoria {cutSf2 ? `("${cutSf2.sfName}")` : ''}</span>
          </button>

          {/* Excluir Classe */}
          <button
            type="button"
            onClick={() => {
              handleDeleteCategory(contextMenuCategory.categoryName);
              setContextMenuCategory(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-red-950/60 hover:text-red-300 text-red-400 rounded transition flex items-center gap-2 font-bold cursor-pointer border-t border-zinc-800 mt-1 pt-1.5"
          >
            <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
            <span>Excluir esta Classe</span>
          </button>
        </div>
      )}

      {/* Modal Overlay para Criar Nova Classe / Categoria */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-cyan-500/60 rounded-xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none animate-scale-up">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Criar Nova Classe / Categoria
              </h3>
              <button
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-bold text-cyan-200 uppercase">
                  Nome da Nova Classe:
                </label>
                <input 
                  type="text"
                  value={newCategoryNameInput}
                  onChange={(e) => setNewCategoryNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCategory(newCategoryNameInput);
                      setIsAddCategoryModalOpen(false);
                    }
                  }}
                  className="bg-black border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                  placeholder="Ex: Sax & Metais, Pianos Vintage..."
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="px-4 py-2 rounded text-xs font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddCategory(newCategoryNameInput);
                  setIsAddCategoryModalOpen(false);
                }}
                className="px-4 py-2 rounded text-xs font-mono font-black bg-cyan-500 hover:bg-cyan-400 text-black cursor-pointer transition shadow-[0_0_12px_rgba(6,182,212,0.4)] uppercase"
              >
                Criar Classe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay para Renomear Classe / Categoria */}
      {renameCategoryTarget !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-cyan-500/60 rounded-xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 select-none animate-scale-up">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-sans font-black text-white uppercase tracking-tight flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                Renomear Classe / Categoria
              </h3>
              <button
                onClick={() => setRenameCategoryTarget(null)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono font-bold text-cyan-200 uppercase">
                  Nome Atual: <span className="text-zinc-400">{renameCategoryTarget}</span>
                </label>
                <input 
                  type="text"
                  value={renameCategoryName}
                  onChange={(e) => setRenameCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameCategory(renameCategoryTarget, renameCategoryName);
                      setRenameCategoryTarget(null);
                    }
                  }}
                  className="bg-black border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 font-mono"
                  placeholder="Novo nome da classe (ex: Pianos Acústicos)"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRenameCategoryTarget(null)}
                className="px-4 py-2 rounded text-xs font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRenameCategory(renameCategoryTarget, renameCategoryName);
                  setRenameCategoryTarget(null);
                }}
                className="px-4 py-2 rounded text-xs font-mono font-black bg-cyan-500 hover:bg-cyan-400 text-black cursor-pointer transition shadow-[0_0_12px_rgba(6,182,212,0.4)] uppercase"
              >
                Salvar Nome
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attribute Management Modal */}
      {attributeModalTarget && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <div className="bg-zinc-950 border border-cyan-500/50 rounded-xl shadow-2xl p-5 max-w-md w-full font-mono text-zinc-200 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-cyan-400" />
                Inserir Atributos / Subcategorias
              </span>
              <button
                type="button"
                onClick={() => setAttributeModalTarget(null)}
                className="text-zinc-300 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-amber-400">Instrumento: {attributeModalTarget.sfName}</span>
              <span className="text-[10px] text-zinc-400">
                Digite os atributos/subcategorias separados por vírgula (ex: Acústico, Cama, DX, EP, String).
                Estes atributos serão usados para localizar o instrumento na pesquisa!
              </span>
            </div>

            {/* Existing Badges with Delete button */}
            {attributeInputText.trim() && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-bold text-zinc-400 uppercase">Atributos Atuais:</span>
                  <button
                    type="button"
                    onClick={() => setAttributeInputText('')}
                    className="text-[12px] font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Deletar Todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto bg-black/40 p-2 rounded border border-zinc-850">
                  {attributeInputText.split(',').map(s => s.trim()).filter(Boolean).map((tag, idx) => (
                    <span
                      key={idx}
                      className="bg-cyan-950/80 text-cyan-200 border border-cyan-500/40 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      🏷️ {tag}
                      {!quickSuggestions.includes(tag) && (
                        <button
                          type="button"
                          onClick={() => handleAddQuickSuggestion(tag)}
                          className="text-amber-400 hover:text-amber-300 text-[11.5px] font-bold underline cursor-pointer ml-0.5"
                          title="Salvar esta tag nas Sugestões Rápidas"
                        >
                          + Sugestão
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const currentArr = attributeInputText.split(',').map(s => s.trim()).filter(Boolean);
                          const nextArr = currentArr.filter(t => t !== tag);
                          setAttributeInputText(nextArr.join(', '));
                        }}
                        className="text-zinc-400 hover:text-red-400 font-black cursor-pointer text-[11px]"
                        title="Deletar este atributo"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Suggestion Tag Buttons */}
            <div className="flex flex-col gap-1 bg-black/30 p-2 rounded border border-zinc-800">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-cyan-400 uppercase tracking-wider">
                  Sugestões Rápidas:
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddQuickSuggestionModal(true)}
                  className="text-[12px] font-bold text-cyan-300 hover:text-white bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 rounded cursor-pointer transition shadow-sm"
                  title="Criar e adicionar uma nova sugestão rápida"
                >
                  ＋ Adicionar Nova Sugestão
                </button>
              </div>
              <span className="text-[11px] text-zinc-300">
                Clique para incluir. Clique com o botão direito sobre uma sugestão para gerenciar/excluir.
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1 max-h-28 overflow-y-auto scrollbar-thin pr-1">
                {quickSuggestions.map((tag, tagIdx) => (
                  <button
                    key={`q_sug_${tag}_${tagIdx}`}
                    type="button"
                    onClick={() => {
                      const currentArr = attributeInputText.split(',').map(s => s.trim()).filter(Boolean);
                      if (!currentArr.includes(tag)) {
                        currentArr.push(tag);
                        setAttributeInputText(currentArr.join(', '));
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuickSuggestionContextMenu({ tag, x: e.clientX, y: e.clientY });
                    }}
                    className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-cyan-950 border border-zinc-800 hover:border-cyan-500/50 text-cyan-400 text-[10px] font-bold cursor-pointer transition flex items-center gap-1 active:scale-95"
                    title="Clique para adicionar. Botão direito para opções."
                  >
                    + {tag}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddQuickSuggestionModal(true)}
                  className="px-2 py-0.5 rounded bg-cyan-950/50 hover:bg-cyan-900/80 border border-dashed border-cyan-700/60 text-cyan-300 text-[10px] font-bold cursor-pointer transition"
                >
                  ＋ Nova...
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={attributeInputText}
              onChange={(e) => setAttributeInputText(e.target.value)}
              placeholder="ex: Acústico, Cama, DX, EP, String..."
              className="w-full bg-black border border-zinc-800 rounded p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
            />

            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setAttributeModalTarget(null)}
                className="px-3 py-1.5 rounded text-xs font-mono bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const parsedAttrs = attributeInputText
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  updateSfAttributes(attributeModalTarget.sfId, parsedAttrs);
                  showNotification(`Atributos salvos para "${attributeModalTarget.sfName}"!`, 'success');
                  setAttributeModalTarget(null);
                }}
                className="px-4 py-1.5 rounded text-xs font-mono bg-cyan-500 text-black font-black hover:bg-cyan-400 cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.4)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decoding Loading Indicator Modal/Overlay */}
      {decodingStatus && (() => {
        const total = decodingStatus.totalCount || 1;
        const current = decodingStatus.currentIdx || 0;
        const percentOfEach = 100 / total;
        const overallProgress = Math.round((current * percentOfEach) + (decodingStatus.progress * percentOfEach / 100));
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex flex-col items-center justify-center select-none animate-fade-in">
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center mb-5">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-500/10 border-t-cyan-500" />
                <Music className="w-6 h-6 text-cyan-400 absolute animate-pulse" />
              </div>
              
              <h3 className="text-xs font-mono font-black text-cyan-400 uppercase tracking-widest mb-1.5 animate-pulse">
                {total > 1 ? `Processando ${current + 1} de ${total}` : 'Carregando Instrumento...'}
              </h3>
              
              <p className="text-xs font-mono text-zinc-300 font-bold mb-4 uppercase truncate max-w-full">
                {decodingStatus.name}
              </p>

              <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden mb-2">
                <div 
                  className="bg-cyan-500 h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                  style={{ width: `${decodingStatus.progress}%` }}
                />
              </div>

              <div className="flex flex-col gap-1 items-center">
                <span className="text-[10px] font-mono font-black text-zinc-400">
                  PROGRESADO: {decodingStatus.progress}%
                </span>
                {total > 1 && (
                  <span className="text-[12px] font-mono font-black text-cyan-500/80 uppercase">
                    PROGRESSO GERAL: {overallProgress}%
                  </span>
                )}
              </div>
              
              <span className="text-[11px] font-mono text-zinc-300 uppercase mt-5">
                Aguarde para garantir latência zero ao tocar
              </span>
            </div>
          </div>
        );
      })()}

      {/* Context Menu for Quick Suggestions */}
      {quickSuggestionContextMenu && (
        <div
          className="fixed z-[99999] bg-zinc-950 border border-cyan-500/50 rounded-lg shadow-2xl p-1.5 text-xs text-zinc-200 w-56 backdrop-blur-md font-sans"
          style={{
            left: Math.min(quickSuggestionContextMenu.x, window.innerWidth - 240),
            top: Math.min(quickSuggestionContextMenu.y, window.innerHeight - 160)
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] font-bold text-cyan-400 border-b border-zinc-800 truncate mb-1">
            Sugestão Rápida: "{quickSuggestionContextMenu.tag}"
          </div>
          {attributeModalTarget && (
            <button
              type="button"
              onClick={() => {
                const currentArr = attributeInputText.split(',').map(s => s.trim()).filter(Boolean);
                if (!currentArr.includes(quickSuggestionContextMenu.tag)) {
                  currentArr.push(quickSuggestionContextMenu.tag);
                  setAttributeInputText(currentArr.join(', '));
                }
                setQuickSuggestionContextMenu(null);
              }}
              className="w-full text-left px-2 py-1.5 hover:bg-cyan-950 hover:text-cyan-300 rounded font-bold flex items-center gap-1.5 text-[11px] cursor-pointer"
            >
              ➕ Inserir no Instrumento Atual
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const oldTag = quickSuggestionContextMenu.tag;
              const newName = prompt(`Editar nome da sugestão "${oldTag}":`, oldTag);
              if (newName && newName.trim() && newName.trim() !== oldTag) {
                const trimmed = newName.trim();
                const nextList = quickSuggestions.map(t => t === oldTag ? trimmed : t);
                setQuickSuggestions(nextList);
                try {
                  localStorage.setItem('sf2_quick_suggestions_list', JSON.stringify(nextList));
                } catch (e) {}
                showNotification(`Sugestão alterada de "${oldTag}" para "${trimmed}"!`, 'success');
              }
              setQuickSuggestionContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded flex items-center gap-1.5 text-[11px] cursor-pointer"
          >
            ✏️ Renomear Sugestão
          </button>
          <button
            type="button"
            onClick={() => {
              handleRemoveQuickSuggestion(quickSuggestionContextMenu.tag);
              setQuickSuggestionContextMenu(null);
            }}
            className="w-full text-left px-2 py-1.5 hover:bg-red-950 text-red-400 hover:text-red-300 rounded font-bold flex items-center gap-1.5 text-[11px] cursor-pointer border-t border-zinc-800 mt-1"
          >
            🗑️ Excluir das Sugestões Rápidas
          </button>
        </div>
      )}

      {/* Modal: Adicionar Nova Sugestão Rápida */}
      {showAddQuickSuggestionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-cyan-500/60 rounded-xl p-4 w-full max-w-md flex flex-col gap-3 shadow-2xl font-sans">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                🏷️ Adicionar Nova Sugestão Rápida
              </h3>
              <button
                onClick={() => setShowAddQuickSuggestionModal(false)}
                className="text-zinc-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-zinc-300">
              Digite o nome da nova tag que deseja incluir no painel de Sugestões Rápidas:
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newQuickSuggestionInput.trim()) {
                  handleAddQuickSuggestion(newQuickSuggestionInput);
                  setNewQuickSuggestionInput('');
                  setShowAddQuickSuggestionModal(false);
                }
              }}
              className="flex flex-col gap-3 mt-1"
            >
              <input
                type="text"
                value={newQuickSuggestionInput}
                onChange={(e) => setNewQuickSuggestionInput(e.target.value)}
                placeholder="ex: Chorinho, Gospel, Sub, Lead..."
                autoFocus
                className="w-full bg-black border border-zinc-800 rounded p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono"
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddQuickSuggestionModal(false)}
                  className="px-3 py-1.5 rounded text-xs font-mono bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newQuickSuggestionInput.trim()}
                  className="px-4 py-1.5 rounded text-xs font-mono font-bold bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-40 cursor-pointer transition shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Backup Progress Modal/Overlay (Export & Import) */}
      {backupProgress.active && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[99999] flex flex-col items-center justify-center select-none animate-fade-in p-4">
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-7 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center mb-4">
              <div className={`animate-spin rounded-full h-16 w-16 border-4 ${
                backupProgress.type === 'export'
                  ? 'border-amber-500/20 border-t-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                  : 'border-sky-500/20 border-t-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)]'
              }`} />
              {backupProgress.type === 'export' ? (
                <Download className="w-6 h-6 text-amber-400 absolute animate-bounce" />
              ) : (
                <Upload className="w-6 h-6 text-sky-400 absolute animate-bounce" />
              )}
            </div>

            <h3 className={`text-sm font-mono font-black uppercase tracking-wider mb-1 ${
              backupProgress.type === 'export' ? 'text-amber-400' : 'text-sky-400'
            }`}>
              {backupProgress.type === 'export' ? 'EXPORTANDO BACKUP COMPLETO (OUT)' : 'RESTAURANDO BACKUP COMPLETO (IN)'}
            </h3>

            <div className="text-3xl font-mono font-black text-white my-2">
              {backupProgress.percent}%
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-900 h-3 rounded-full overflow-hidden border border-zinc-800 mb-3 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  backupProgress.type === 'export'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_#f59e0b]'
                    : 'bg-gradient-to-r from-sky-600 to-sky-400 shadow-[0_0_10px_#0ea5e9]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, backupProgress.percent))}%` }}
              />
            </div>

            <p className="text-xs font-mono text-zinc-300 break-words max-w-full font-bold">
              {backupProgress.status || 'Processando dados...'}
            </p>

            <span className="text-[12px] font-mono text-zinc-300 mt-4 uppercase tracking-widest">
              Por favor aguarde, não feche nem atualize a página
            </span>
          </div>
        </div>
      )}

      {/* Toast Notification Overlay */}
      {notification.isOpen && (
        <div className="fixed bottom-5 right-5 z-[10000] max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className={`p-3.5 rounded-xl border font-mono text-xs shadow-2xl flex items-start justify-between gap-3 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : notification.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : notification.type === 'error'
              ? 'bg-red-950/90 border-red-500 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
              : 'bg-cyan-950/90 border-cyan-500 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
          }`}>
            <div className="flex items-start gap-2.5">
              <span className="text-base mt-0.5">
                {notification.type === 'success' ? '✅' : notification.type === 'warning' ? '⚠️' : notification.type === 'error' ? '❌' : 'ℹ️'}
              </span>
              <span className="font-bold leading-snug whitespace-pre-line">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
              className="text-zinc-400 hover:text-white font-bold cursor-pointer text-sm shrink-0"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
