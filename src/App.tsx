import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SF2Parser, ParsedSoundFont, SF2Preset, SF2Instrument, SF2SampleHeader } from './lib/sf2-parser';
import { synthEngineInstance, ChannelState } from './lib/synth-engine';

import { noteToMidi } from './lib/sf-parsers';
import { MODXConsole } from './components/MODXConsole';
import { Keyboard } from './components/Keyboard';
import { Info, Zap, Activity, Loader2, Database, UploadCloud, Music } from 'lucide-react';
import {
  saveSoundFont,
  loadAllSoundFontsMetadata,
  loadSoundFontData,
  deleteSoundFont,
  clearAllSoundFonts,
  getRawSoundFontKeys,
  getRawSoundFontRecord,
  saveSoundFontMetadata,
  SoundFontMetadata
} from './lib/db';

export interface SynthPreset {
  id: string;
  name: string;
  channels: ChannelState[];
  reverbDecay: number;
  reverbMix: number;
  chorusBypass?: boolean;
  chorusRate?: number;
  chorusDepth?: number;
  chorusMix?: number;
  tremoloBypass?: boolean;
  tremoloRate?: number;
  tremoloDepth?: number;
  tremoloMode?: 'volume' | 'pan';
}

export interface SoundFontAsset {
  id: string;
  name: string;
  sizeMb: number;
  presetsCount: number;
  presets: { name: string; preset: number; bank: number }[];
}

const DEFAULT_ADSR = { attack: 0.0, decay: 0.5, sustain: 50, release: 0.35 };

const DEFAULT_EQ_BANDS = [
  { gain: 3.0, frequency: 80, q: 0.7 },
  { gain: 2.0, frequency: 150, q: 1.0 },
  { gain: -1.0, frequency: 400, q: 1.0 },
  { gain: 0.0, frequency: 1000, q: 1.0 },
  { gain: 1.0, frequency: 2500, q: 1.0 },
  { gain: 2.0, frequency: 4300, q: 1.0 },
  { gain: 3.0, frequency: 12000, q: 0.7 }
];

const createDefaultChannels = (): ChannelState[] => [
  {
    presetIndex: 0,
    volume: 1.0, // 0 dB standard volume
    pan: 0, // C for PAN
    mute: false,
    solo: false,
    filterType: 'lowpass',
    filterCutoff: 20000, // LP Cutoff 20K
    filterResonance: 0, // resonance 0
    eqBands: JSON.parse(JSON.stringify(DEFAULT_EQ_BANDS)),
    adsr: { ...DEFAULT_ADSR },
    reverbSend: 0.2,
    routingEnabled: true,
    sustainEnabled: true,
    keyRangeMin: 21, // A0 (A8/A0 Area Midi Min)
    keyRangeMax: 108, // C8 Area Midi Max
    octaveOffset: 0,
    midiSensitivity: 1.0,
    chorusBypass: true,
    chorusRate: 1.5,
    chorusDepth: 0.3,
    chorusMix: 0.45,
    tremoloBypass: true,
    tremoloRate: 5.0,
    tremoloDepth: 0.5,
    tremoloMode: 'volume',
  },
  {
    presetIndex: 0,
    volume: 0.0, // Switched off by default, ready for layers
    pan: 0, // C for PAN
    mute: false,
    solo: false,
    filterType: 'lowpass',
    filterCutoff: 20000, // LP Cutoff 20K
    filterResonance: 0, // resonance 0
    eqBands: JSON.parse(JSON.stringify(DEFAULT_EQ_BANDS)),
    adsr: { ...DEFAULT_ADSR },
    reverbSend: 0.2,
    routingEnabled: true,
    sustainEnabled: true,
    keyRangeMin: 21, // A0
    keyRangeMax: 108, // C8
    octaveOffset: 0,
    midiSensitivity: 1.0,
    chorusBypass: true,
    chorusRate: 1.5,
    chorusDepth: 0.3,
    chorusMix: 0.45,
    tremoloBypass: true,
    tremoloRate: 5.0,
    tremoloDepth: 0.5,
    tremoloMode: 'volume',
  },
  {
    presetIndex: 0,
    volume: 0.0,
    pan: 0, // C for PAN
    mute: false,
    solo: false,
    filterType: 'lowpass',
    filterCutoff: 20000, // LP Cutoff 20K
    filterResonance: 0, // resonance 0
    eqBands: JSON.parse(JSON.stringify(DEFAULT_EQ_BANDS)),
    adsr: { ...DEFAULT_ADSR },
    reverbSend: 0.2,
    routingEnabled: true,
    sustainEnabled: true,
    keyRangeMin: 21, // A0
    keyRangeMax: 108, // C8
    octaveOffset: 0,
    midiSensitivity: 1.0,
    chorusBypass: true,
    chorusRate: 1.5,
    chorusDepth: 0.3,
    chorusMix: 0.45,
    tremoloBypass: true,
    tremoloRate: 5.0,
    tremoloDepth: 0.5,
    tremoloMode: 'volume',
  },
  {
    presetIndex: 0,
    volume: 0.0,
    pan: 0, // C for PAN
    mute: false,
    solo: false,
    filterType: 'lowpass',
    filterCutoff: 20000, // LP Cutoff 20K
    filterResonance: 0, // resonance 0
    eqBands: JSON.parse(JSON.stringify(DEFAULT_EQ_BANDS)),
    adsr: { ...DEFAULT_ADSR },
    reverbSend: 0.2,
    routingEnabled: true,
    sustainEnabled: true,
    keyRangeMin: 21, // A0
    keyRangeMax: 108, // C8
    octaveOffset: 0,
    midiSensitivity: 1.0,
    chorusBypass: true,
    chorusRate: 1.5,
    chorusDepth: 0.3,
    chorusMix: 0.45,
    tremoloBypass: true,
    tremoloRate: 5.0,
    tremoloDepth: 0.5,
    tremoloMode: 'volume',
  },
];

const LOCAL_STORAGE_KEY = 'sf2_synth_presets_v2';

export default function App() {
  const [audioActive, setAudioActive] = useState(false);
  const [reverbDecay, setReverbDecay] = useState(2.5);
  const [reverbMix, setReverbMix] = useState(0.25);
  const [reverbPreDelay, setReverbPreDelay] = useState(0.02);
  const [reverbHighCut, setReverbHighCut] = useState(5000);
  const [reverbBypass, setReverbBypass] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  
  const [chorusBypass, setChorusBypass] = useState(true);
  const [chorusRate, setChorusRate] = useState(1.5);
  const [chorusDepth, setChorusDepth] = useState(0.3);
  const [chorusMix, setChorusMix] = useState(0.45);

  const [tremoloBypass, setTremoloBypass] = useState(true);
  const [tremoloRate, setTremoloRate] = useState(5.0);
  const [tremoloDepth, setTremoloDepth] = useState(0.5);
  const [tremoloMode, setTremoloMode] = useState<'volume' | 'pan'>('volume');

  const [channels, setChannels] = useState<ChannelState[]>(createDefaultChannels());
  
  // Preferred Sample Rate state (44100, 48000, or undefined for hardware default)
  const [preferredSampleRate, setPreferredSampleRate] = useState<number | undefined>(() => {
    const saved = localStorage.getItem('sf2_synth_sample_rate');
    return saved ? parseInt(saved, 10) : undefined;
  });

  // SoundFont categories map state: mapping soundfont id to category name
  const [sfCategories, setSfCategories] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('sf2_categories_map');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    if (preferredSampleRate) {
      localStorage.setItem('sf2_synth_sample_rate', preferredSampleRate.toString());
    } else {
      localStorage.removeItem('sf2_synth_sample_rate');
    }
  }, [preferredSampleRate]);

  useEffect(() => {
    localStorage.setItem('sf2_categories_map', JSON.stringify(sfCategories));
  }, [sfCategories]);

  // Loaded SoundFonts list
  const [loadedSoundFonts, setLoadedSoundFonts] = useState<SoundFontAsset[]>([]);

  // State to track if there is an active soundfont being auditioned (pre-selected)
  // so MIDI and virtual keys trigger it instead of the current layer's instrument
  const [auditioningSoundFont, setAuditioningSoundFont] = useState<{
    layerIndex: number;
    soundfontIndex: number;
    soundfontId: string;
    soundfontName: string;
    soundfontGain: number;
  } | null>(null);

  // Loading states for SoundFont uploading/IndexedDB restoration
  const [isSf2Loading, setIsSf2Loading] = useState(false);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isAudioRebuilding, setIsAudioRebuilding] = useState(false);

  // Detailed progress tracking for loaders
  const [dbLoadingStatus, setDbLoadingStatus] = useState<{
    total: number;
    current: number;
    currentName: string;
    progress: number;
  }>({ total: 0, current: 0, currentName: '', progress: 0 });

  const [uploadLoadingStatus, setUploadLoadingStatus] = useState<{
    total: number;
    current: number;
    currentName: string;
    progress: number;
  }>({ total: 0, current: 0, currentName: '', progress: 0 });

  // Polyphony Voice Telemetry
  const [voiceCount, setVoiceCount] = useState(0);

  // Custom iframe-safe confirmation and alert dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'confirm' | 'info' | 'warning' | 'error';
    onConfirm?: () => void;
  } | null>(null);

  // Memory-safe, one-by-one database migration from v1 to v2 (metadata extraction)
  const migrateDatabaseIfNecessary = async () => {
    try {
      const rawKeys = await getRawSoundFontKeys();
      if (rawKeys.length === 0) return;

      const metadataList = await loadAllSoundFontsMetadata();
      const existingMetaIds = new Set(metadataList.map(m => m.id));

      const missingIds = rawKeys.filter(id => !existingMetaIds.has(id));
      if (missingIds.length === 0) return;

      console.log(`[Database Migration] ${missingIds.length} SoundFonts need metadata migration.`);

      for (const id of missingIds) {
        try {
          const record = await getRawSoundFontRecord(id);
          if (!record || !record.data) continue;

          const name = record.name || 'Migrated SoundFont';

          const parser = new SF2Parser(record.data);
          const parsed = parser.parse();

          const presetsList = parsed.presets.map(p => ({
            name: p.name,
            preset: p.preset,
            bank: p.bank
          }));

          await saveSoundFontMetadata({
            id,
            name,
            sizeMb: record.data.byteLength / (1024 * 1024),
            presetsCount: presetsList.length,
            presets: presetsList,
            timestamp: record.timestamp ?? Date.now()
          });

          console.log(`[Database Migration] Migrated metadata for "${name}" successfully.`);
        } catch (err) {
          console.warn(`[Database Migration] SoundFont ID ${id} is invalid or has unsupported format (e.g. SFZ/SF3). Automatically cleaning it up from database.`, err);
          try {
            await deleteSoundFont(id);
            console.log(`[Database Migration] Obsolete or corrupted record with ID ${id} deleted successfully.`);
          } catch (delErr) {
            console.error(`[Database Migration] Failed to delete corrupted record ID ${id}:`, delErr);
          }
        }
      }
    } catch (err) {
      console.error('[Database Migration] Error during migration:', err);
    }
  };

  // Restore SoundFonts from IndexedDB on startup (Lazy Metadata Restore)
  useEffect(() => {
    let active = true;
    const restoreSavedSoundFonts = async () => {
      setIsDbLoading(true);
      try {
        // Run migration first (one-by-one, low memory footprint)
        await migrateDatabaseIfNecessary();
        if (!active) return;

        const savedMetadata = await loadAllSoundFontsMetadata();
        if (!active) return;
        
        setDbLoadingStatus({
          total: savedMetadata.length,
          current: 0,
          currentName: '',
          progress: 0
        });

        const restoredAssets: SoundFontAsset[] = [];
        let index = 0;
        for (const sf of savedMetadata) {
          index++;
          if (!active) return;

          setDbLoadingStatus({
            total: savedMetadata.length,
            current: index,
            currentName: sf.name,
            progress: Math.round((index / savedMetadata.length) * 100)
          });

          // Yield execution to the browser main thread to paint the screen & prevent freezing
          await new Promise<void>(resolve => setTimeout(resolve, 15));

          restoredAssets.push({
            id: sf.id,
            name: sf.name,
            sizeMb: sf.sizeMb,
            presetsCount: sf.presetsCount,
            presets: sf.presets
          });
        }
        
        if (active) {
          setLoadedSoundFonts(restoredAssets);
        }
      } catch (err) {
        console.error('Erro ao restaurar metadados dos SoundFonts:', err);
      } finally {
        if (active) {
          setIsDbLoading(false);
        }
      }
    };

    restoreSavedSoundFonts();

    return () => {
      active = false;
    };
  }, []);

  // Saved presets list
  const [savedPresets, setSavedPresets] = useState<SynthPreset[]>([]);

  // Initialize Synth Engine and Load Presets
  useEffect(() => {
    synthEngineInstance.init((count) => {
      setVoiceCount(count);
    }, preferredSampleRate);

    // Load presets from LocalStorage
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        setSavedPresets(JSON.parse(raw));
      } catch (err) {
        console.error('Error loading user presets: ', err);
      }
    } else {
      // Load 3 gorgeous factory demo presets
      const factory: SynthPreset[] = [
        {
          id: 'piano_solo',
          name: '🎹 Piano Clássico Solo',
          channels: createDefaultChannels().map((ch, idx) => ({
            ...ch,
            volume: idx === 0 ? 0.95 : 0.0,
            adsr: { attack: 0.005, decay: 0.2, sustain: 70, release: 0.3 }
          })),
          reverbDecay: 2.0,
          reverbMix: 0.2
        },
        {
          id: 'cosmic_pad_layer',
          name: '🌌 Camada Espacial Pad (CH 1 + 2)',
          channels: createDefaultChannels().map((ch, idx) => ({
            ...ch,
            volume: idx === 0 ? 0.6 : idx === 1 ? 0.8 : 0.0,
            adsr: idx === 1 ? { attack: 1.2, decay: 1.0, sustain: 90, release: 2.5 } : ch.adsr,
            reverbSend: idx === 1 ? 0.6 : ch.reverbSend
          })),
          reverbDecay: 4.5,
          reverbMix: 0.45
        },
        {
          id: 'plucked_orchestra',
          name: '🎻 Orquestra Dedilhada (Todos)',
          channels: createDefaultChannels().map((ch, idx) => ({
            ...ch,
            volume: idx === 0 ? 0.6 : idx === 1 ? 0.3 : idx === 2 ? 0.8 : 0.5,
            adsr: { attack: 0.005, decay: 0.1, sustain: 20, release: 0.15 }
          })),
          reverbDecay: 1.8,
          reverbMix: 0.15
        }
      ];
      setSavedPresets(factory);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(factory));
    }
  }, [preferredSampleRate]);

  // Sync state variables progressively to physical Web Audio nodes
  useEffect(() => {
    if (!audioActive) return;

    // Sync master volume
    if (synthEngineInstance.masterGain) {
      synthEngineInstance.masterGain.gain.setValueAtTime(masterVolume, synthEngineInstance.ctx!.currentTime);
    }

    // Sync individual channel strip params (solo/mute calculations)
    const hasSolo = channels.some(ch => ch.solo);
    
    channels.forEach((ch, idx) => {
      let finalVolume = ch.volume;
      if (ch.mute) {
        finalVolume = 0;
      } else if (hasSolo && !ch.solo) {
        finalVolume = 0; // Mute if other channel is soloed
      }
      
      synthEngineInstance.updateChannel(idx, {
        ...ch,
        volume: finalVolume
      });
    });

    // Sync global reverb
    synthEngineInstance.updateGlobalReverb(reverbDecay, reverbMix, reverbPreDelay, reverbHighCut, reverbBypass);

    // Sync global chorus
    synthEngineInstance.updateGlobalChorus(chorusBypass, chorusRate, chorusDepth, chorusMix);

    // Sync global tremolo
    synthEngineInstance.updateGlobalTremolo(tremoloBypass, tremoloRate, tremoloDepth, tremoloMode);

  }, [
    audioActive, 
    channels, 
    reverbDecay, 
    reverbMix, 
    reverbPreDelay, 
    reverbHighCut, 
    reverbBypass, 
    masterVolume,
    chorusBypass,
    chorusRate,
    chorusDepth,
    chorusMix,
    tremoloBypass,
    tremoloRate,
    tremoloDepth,
    tremoloMode
  ]);

  // Hook typing and physical MIDI keys trigger
  useEffect(() => {
    const handleKeyboardOn = (e: Event) => {
      const { note, velocity } = (e as CustomEvent).detail;
      if (!audioActive) {
        handleToggleAudio(true);
      }

      // Distribute to all layered channels
      for (let i = 0; i < 4; i++) {
        let channelState = channels[i];
        if (auditioningSoundFont) {
          if (auditioningSoundFont.layerIndex === i) {
            channelState = {
              ...channelState,
              soundfontIndex: auditioningSoundFont.soundfontIndex,
              soundfontId: auditioningSoundFont.soundfontId,
              soundfontName: auditioningSoundFont.soundfontName,
              soundfontGain: auditioningSoundFont.soundfontGain,
              presetIndex: 0,
              routingEnabled: true,
            };
          } else {
            // Mute other layers during pre-escuta so user hears only the auditioned sound font
            channelState = {
              ...channelState,
              routingEnabled: false,
            };
          }
        }
        synthEngineInstance.noteOn(i, note, velocity, channelState);
      }
    };

    const handleKeyboardOff = (e: Event) => {
      const { note } = (e as CustomEvent).detail;
      
      for (let i = 0; i < 4; i++) {
        let channelState = channels[i];
        if (auditioningSoundFont) {
          if (auditioningSoundFont.layerIndex === i) {
            channelState = {
              ...channelState,
              soundfontIndex: auditioningSoundFont.soundfontIndex,
              soundfontId: auditioningSoundFont.soundfontId,
              soundfontName: auditioningSoundFont.soundfontName,
              soundfontGain: auditioningSoundFont.soundfontGain,
              presetIndex: 0,
              routingEnabled: true,
            };
          } else {
            channelState = {
              ...channelState,
              routingEnabled: false,
            };
          }
        }
        synthEngineInstance.noteOff(i, note, channelState.adsr, channelState);
      }
    };

    const handleMidiSustain = (e: Event) => {
      const { value } = (e as CustomEvent).detail;
      const active = value >= 64;
      
      for (let i = 0; i < 4; i++) {
        if (channels[i]) {
          let channelState = channels[i];
          if (auditioningSoundFont && auditioningSoundFont.layerIndex === i) {
            channelState = {
              ...channelState,
              soundfontIndex: auditioningSoundFont.soundfontIndex,
              soundfontId: auditioningSoundFont.soundfontId,
              soundfontName: auditioningSoundFont.soundfontName,
              soundfontGain: auditioningSoundFont.soundfontGain,
              presetIndex: 0,
              routingEnabled: true,
            };
          }
          synthEngineInstance.setSustainPedal(i, active, channelState.adsr, channelState);
        }
      }
    };

    window.addEventListener('keyboard-note-on', handleKeyboardOn);
    window.addEventListener('keyboard-note-off', handleKeyboardOff);
    window.addEventListener('synth-midi-sustain', handleMidiSustain);

    return () => {
      window.removeEventListener('keyboard-note-on', handleKeyboardOn);
      window.removeEventListener('keyboard-note-off', handleKeyboardOff);
      window.removeEventListener('synth-midi-sustain', handleMidiSustain);
    };
  }, [audioActive, channels, auditioningSoundFont]);

  const handleToggleAudio = (syncInit: boolean = false) => {
    if (audioActive) {
      if (synthEngineInstance.ctx) {
        synthEngineInstance.ctx.suspend();
      }
      setAudioActive(false);
      synthEngineInstance.panic();
    } else {
      const initEngine = () => {
        try {
          synthEngineInstance.init((count) => {
            setVoiceCount(count);
          }, preferredSampleRate);
          if (synthEngineInstance.ctx) {
            synthEngineInstance.ctx.resume();
            setAudioActive(true);
          }
        } catch (err) {
          console.error("Erro ao ativar áudio:", err);
        }
      };

      if (syncInit) {
        initEngine();
      } else {
        setIsAudioRebuilding(true);
        setTimeout(() => {
          initEngine();
          setIsAudioRebuilding(false);
        }, 300);
      }
    }
  };

  const handleSampleRateChange = (rate: number | undefined) => {
    setPreferredSampleRate(rate);
    // If active, re-init and resume
    if (audioActive) {
      setIsAudioRebuilding(true);
      setTimeout(() => {
        try {
          synthEngineInstance.init((count) => {
            setVoiceCount(count);
          }, rate);
          if (synthEngineInstance.ctx) {
            synthEngineInstance.ctx.resume();
          }
        } catch (err) {
          console.error("Erro ao reinicializar áudio:", err);
        } finally {
          setIsAudioRebuilding(false);
        }
      }, 300);
    }
  };

  const handleSoundFontsUploaded = async (files: File[], category?: string) => {
    if (!files || files.length === 0) return;

    // CRITICAL SECURITY & PERMISSION OPTIMIZATION:
    // Read ArrayBuffers IMMEDIATELY as the very first synchronous microtask before calling ANY React state setters.
    // Triggering React state updates or modal dialogs before arrayBuffer() causes Chromium/Safari transient file permissions to expire, leading to NotReadableError.
    const rawReadResults = await Promise.all(
      files.map(async (file) => {
        try {
          const buffer = await file.arrayBuffer();
          return { file, buffer, ok: true };
        } catch (err) {
          console.warn(`[Studio-SF2] File read handle revoked for ${file.name}:`, err);
          return { file, buffer: null, ok: false };
        }
      })
    );

    const validFileBuffers = rawReadResults.filter(r => r.ok && r.buffer && r.buffer.byteLength > 0);
    if (validFileBuffers.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: '❌ ERRO DE LEITURA DO ARQUIVO',
        message: 'Não foi possível ler os arquivos selecionados do computador. Certifique-se de selecionar os arquivos diretamente da pasta.',
        type: 'error'
      });
      return;
    }

    setIsSf2Loading(true);

    const sf2Buffers = validFileBuffers.filter(r => r.file.name.toLowerCase().endsWith('.sf2'));
    if (sf2Buffers.length === 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'FORMATO DE ARQUIVO INVÁLIDO',
        message: 'Por favor, selecione apenas arquivos de SoundFont no formato .sf2',
        type: 'warning'
      });
      setIsSf2Loading(false);
      return;
    }

    // Check for duplicate names against currently loaded SoundFonts
    const existingNames = new Set(loadedSoundFonts.map(sf => (sf?.name || '').toLowerCase()));
    const duplicates: string[] = [];
    const uniqueBuffers: { file: File; buffer: ArrayBuffer }[] = [];

    for (const item of sf2Buffers) {
      if (existingNames.has(item.file.name.toLowerCase())) {
        duplicates.push(item.file.name);
      } else {
        existingNames.add(item.file.name.toLowerCase());
        uniqueBuffers.push({ file: item.file, buffer: item.buffer! });
      }
    }

    if (duplicates.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: '⚠️ DUPLICIDADE BLOQUEADA',
        message: `Os seguintes arquivos SoundFont já existem na sua biblioteca com o mesmo nome e foram ignorados para evitar duplicidade:\n\n• ${duplicates.join('\n• ')}`,
        type: 'warning'
      });
    }

    if (uniqueBuffers.length === 0) {
      setIsSf2Loading(false);
      return;
    }

    setUploadLoadingStatus({
      total: uniqueBuffers.length,
      current: 0,
      currentName: 'Processando bancos...',
      progress: 0
    });

    const fileBuffers = uniqueBuffers;
    const failedFiles: string[] = [];

    const newAssets: SoundFontAsset[] = [];

    for (let i = 0; i < fileBuffers.length; i++) {
      const { file, buffer } = fileBuffers[i];
      setUploadLoadingStatus({
        total: fileBuffers.length,
        current: i + 1,
        currentName: file.name,
        progress: Math.round(((i + 1) / fileBuffers.length) * 100)
      });

      // Give 45ms pause to let UI paint the progress bar and prevent thread freezing
      await new Promise<void>(resolve => setTimeout(resolve, 45));

      try {
        const parser = new SF2Parser(buffer);
        const parsed = parser.parse();

        const assetId = Math.random().toString(36).substring(2, 11);
        parsed.id = assetId;
        parsed.name = file.name;

        // Feed into synthesis engine with assigned persistent ID and name
        synthEngineInstance.addSoundFont(parsed);

        // Map parsed presets
        const list = parsed.presets.map(p => ({
          name: p.name,
          preset: p.preset,
          bank: p.bank
        }));

        // Save file to IndexedDB for offline persistence
        try {
          await saveSoundFont(assetId, file.name, buffer);
        } catch (dbErr) {
          console.error('Erro ao salvar SoundFont no IndexedDB:', dbErr);
        }

        if (category) {
          setSfCategories(prev => ({
            ...prev,
            [assetId]: category
          }));
        }

        newAssets.push({
          id: assetId,
          name: file.name,
          sizeMb: file.size / (1024 * 1024),
          presetsCount: list.length,
          presets: list
        });

      } catch (err: any) {
        console.error(`Erro ao carregar SoundFont ${file.name}:`, err);
        setConfirmDialog({
          isOpen: true,
          title: '❌ FALHA AO PROCESSAR SOUNDFONT',
          message: `Não foi possível carregar o arquivo SoundFont "${file.name}".\n\nDetalhes: ${err.message || err}`,
          type: 'error'
        });
      }
    }

    if (newAssets.length > 0) {
      setLoadedSoundFonts(prev => [...prev, ...newAssets]);
    }

    setIsSf2Loading(false);
    if (!audioActive) {
      handleToggleAudio();
    }
  };

  const executeRemoveSoundFont = (id: string) => {
    const targetSf = loadedSoundFonts.find(sf => sf.id === id);
    if (!targetSf) return;

    const index = loadedSoundFonts.findIndex(sf => sf.id === id);
    if (index !== -1) {
      synthEngineInstance.removeSoundFont(index);
      const next = loadedSoundFonts.filter(sf => sf.id !== id);
      setLoadedSoundFonts(next);

      // Remove from IndexedDB
      deleteSoundFont(id).catch(err => {
        console.error('Erro ao deletar SoundFont do IndexedDB:', err);
      });

      // Reset channels using this index to fallback to 0
      setChannels(prev => prev.map(ch => {
        const currentIdx = ch.soundfontIndex ?? 0;
        if (currentIdx === index) {
          return { ...ch, soundfontIndex: 0, presetIndex: 0, soundfontId: undefined, soundfontName: undefined };
        } else if (currentIdx > index) {
          return { ...ch, soundfontIndex: currentIdx - 1 };
        }
        return ch;
      }));
    }
  };

  const handleRemoveMultipleSoundFonts = (ids: string[]) => {
    if (ids.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Limpar Categoria de SoundFonts',
      message: `Deseja mesmo excluir permanentemente todas as ${ids.length} SoundFonts desta categoria?`,
      onConfirm: () => {
        // Filter out remaining SoundFonts
        const remainingSoundFonts = loadedSoundFonts.filter(sf => !ids.includes(sf.id));
        const removedSoundFonts = loadedSoundFonts.filter(sf => ids.includes(sf.id));

        // Completely reset synth engine and load remaining SoundFonts
        synthEngineInstance.clearSoundFonts();
        remainingSoundFonts.forEach(sf => {
          synthEngineInstance.addSoundFont(sf);
        });

        setLoadedSoundFonts(remainingSoundFonts);

        // Remove from IndexedDB
        removedSoundFonts.forEach(sf => {
          deleteSoundFont(sf.id).catch(err => {
            console.error('Erro ao deletar SoundFont do IndexedDB:', err);
          });
        });

        // Update channels to map old indices to new ones or fallback to 0
        setChannels(prev => prev.map(ch => {
          const currentIdx = ch.soundfontIndex ?? 0;
          if (currentIdx === 0) return ch;

          const targetSf = loadedSoundFonts[currentIdx];
          if (!targetSf) return { ...ch, soundfontIndex: 0, presetIndex: 0 };

          if (ids.includes(targetSf.id)) {
            return {
              ...ch,
              soundfontIndex: 0,
              presetIndex: 0,
              soundfontId: undefined,
              soundfontName: undefined
            };
          } else {
            const newIdx = remainingSoundFonts.findIndex(sf => sf.id === targetSf.id);
            return {
              ...ch,
              soundfontIndex: newIdx !== -1 ? newIdx : 0
            };
          }
        }));

        setConfirmDialog(null);
      }
    });
  };

  const handleRemoveSoundFont = (id: string) => {
    const targetSf = loadedSoundFonts.find(sf => sf.id === id);
    if (!targetSf) return;

    // Check if used in savedPresets
    const isUsedInPresets = savedPresets.some(preset => 
      preset.channels.some(ch => ch.soundfontId === id || ch.soundfontName === targetSf.name)
    );

    // Also check if used in Live Set Banks
    let isUsedInLiveSets = false;
    try {
      const rawLiveSets = localStorage.getItem('sf2_synth_live_sets_v3');
      if (rawLiveSets) {
        const parsedLiveSets = JSON.parse(rawLiveSets);
        for (const bankKey in parsedLiveSets) {
          const slots = parsedLiveSets[bankKey];
          if (Array.isArray(slots)) {
            for (const slot of slots) {
              if (slot.channelsData && Array.isArray(slot.channelsData)) {
                for (const ch of slot.channelsData) {
                  if (ch.soundfontId === id || ch.soundfontName === targetSf.name) {
                    isUsedInLiveSets = true;
                    break;
                  }
                }
              }
              if (isUsedInLiveSets) break;
            }
          }
          if (isUsedInLiveSets) break;
        }
      }
    } catch (err) {
      console.error('Erro ao ler Live Sets no delete check:', err);
    }

    if (isUsedInPresets || isUsedInLiveSets) {
      setConfirmDialog({
        isOpen: true,
        title: 'Excluir SoundFont em Uso',
        message: `Aviso importante:\nO SoundFont "${targetSf.name}" está memorizado em um ou mais de seus Presets ou Live Sets!\n\nSe você excluí-lo, esses canais voltarão a usar o sintetizador integrado quando carregados.\n\nDeseja mesmo excluir este SoundFont?`,
        onConfirm: () => {
          executeRemoveSoundFont(id);
          setConfirmDialog(null);
        }
      });
    } else {
      setConfirmDialog({
        isOpen: true,
        title: 'Excluir SoundFont',
        message: `Deseja mesmo excluir permanentemente o SoundFont "${targetSf.name}"?`,
        onConfirm: () => {
          executeRemoveSoundFont(id);
          setConfirmDialog(null);
        }
      });
    }
  };

  const handleSoundFontsReset = () => {
    synthEngineInstance.clearSoundFonts();
    setLoadedSoundFonts([]);
    setSfCategories({});
    localStorage.removeItem('sf2_categories_map');
    setChannels(prev => prev.map(ch => ({ ...ch, soundfontIndex: 0, presetIndex: 0 })));

    // Clear all from IndexedDB
    clearAllSoundFonts().catch(err => {
      console.error('Erro ao limpar todas as SoundFonts do IndexedDB:', err);
    });
  };

  const handleSavePreset = (name: string) => {
    // Ensure all channels have SoundFont metadata populated
    const channelsWithMetadata = channels.map(ch => {
      const nextCh = { ...ch };
      if (nextCh.soundfontIndex !== undefined && nextCh.soundfontIndex > 0 && !nextCh.soundfontId) {
        const sf = loadedSoundFonts[nextCh.soundfontIndex];
        if (sf) {
          nextCh.soundfontId = sf.id;
          nextCh.soundfontName = sf.name;
        }
      }
      return nextCh;
    });

    const newPreset: SynthPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      channels: channelsWithMetadata,
      reverbDecay,
      reverbMix,
      chorusBypass,
      chorusRate,
      chorusDepth,
      chorusMix,
      tremoloBypass,
      tremoloRate,
      tremoloDepth,
      tremoloMode,
    };

    const next = [...savedPresets, newPreset];
    setSavedPresets(next);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  };

  const handleLoadPreset = (id: string) => {
    const found = savedPresets.find(p => p.id === id);
    if (found) {
      // Map channels, resolving soundfontIndex using soundfontId or soundfontName
      const mappedChannels = found.channels.map((ch, idx) => {
        const nextCh = { ...ch };
        if (nextCh.soundfontId || nextCh.soundfontName) {
          // Find currently loaded SoundFont that matches ID or Name
          const foundSfIndex = loadedSoundFonts.findIndex(sf => 
            (nextCh.soundfontId && sf.id === nextCh.soundfontId) || 
            (nextCh.soundfontName && sf.name === nextCh.soundfontName)
          );
          
          if (foundSfIndex !== -1) {
            nextCh.soundfontIndex = foundSfIndex;
            // Load custom gain from global storage or preset-level setting
            try {
              const storedGains = JSON.parse(localStorage.getItem('sf2_custom_gains') || '{}');
              const targetSf = loadedSoundFonts[foundSfIndex];
              nextCh.soundfontGain = nextCh.soundfontGain ?? storedGains[targetSf.id] ?? storedGains[targetSf.name] ?? 1.0;
            } catch (err) {
              nextCh.soundfontGain = nextCh.soundfontGain ?? 1.0;
            }
          } else {
            // Warn if the preset expected a SoundFont but it is not found
            const missingName = nextCh.soundfontName || 'Desconhecido';
            alert(`Aviso: O SoundFont "${missingName}" do Layer ${idx + 1} não está carregado. Usando o sintetizador integrado.`);
            nextCh.soundfontIndex = 0;
            nextCh.presetIndex = 0;
            nextCh.soundfontId = undefined;
            nextCh.soundfontName = undefined;
            nextCh.soundfontGain = 1.0;
          }
        }
        return nextCh;
      });

      setChannels(mappedChannels);
      setReverbDecay(found.reverbDecay);
      setReverbMix(found.reverbMix);
      
      if (found.chorusBypass !== undefined) setChorusBypass(found.chorusBypass);
      if (found.chorusRate !== undefined) setChorusRate(found.chorusRate);
      if (found.chorusDepth !== undefined) setChorusDepth(found.chorusDepth);
      if (found.chorusMix !== undefined) setChorusMix(found.chorusMix);
      
      if (found.tremoloBypass !== undefined) setTremoloBypass(found.tremoloBypass);
      if (found.tremoloRate !== undefined) setTremoloRate(found.tremoloRate);
      if (found.tremoloDepth !== undefined) setTremoloDepth(found.tremoloDepth);
      if (found.tremoloMode !== undefined) setTremoloMode(found.tremoloMode);
    }
  };

  const handleDeletePreset = (id: string) => {
    const next = savedPresets.filter(p => p.id !== id);
    setSavedPresets(next);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  };

  const handlePanic = () => {
    synthEngineInstance.panic();
  };

  const handlePlayTestNote = (channelIndex: number) => {
    if (!audioActive) {
      handleToggleAudio(true);
    }
    // Audition C4 (60)
    synthEngineInstance.noteOn(channelIndex, 60, 100, channels[channelIndex]);
    setTimeout(() => {
      synthEngineInstance.noteOff(channelIndex, 60, channels[channelIndex].adsr);
    }, 450);
  };

  const handleChannelStateChange = (idx: number, newState: ChannelState) => {
    setChannels(prev => {
      const next = [...prev];
      next[idx] = newState;
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-zinc-100 flex flex-col font-sans select-none pb-12">
      
      {/* Nice modal loading indicator when rebuilding audio context */}
      {isAudioRebuilding && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex flex-col justify-center items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-[0_0_12px_rgba(16,185,129,0.3)]" />
          <div className="flex flex-col items-center gap-1.5 text-center px-6">
            <span className="text-sm font-mono font-black text-emerald-400 tracking-widest uppercase animate-pulse">
              Aguarde, carregando...
            </span>
            <span className="text-[10px] font-mono text-zinc-300 uppercase tracking-wider">
              RECONFIGURANDO TAXA DE AMOSTRAGEM DO MOTOR DE ÁUDIO E RECONECTANDO CANAIS
            </span>
          </div>
        </div>
      )}

      {/* Nice modal loading indicator when restoring SoundFonts from Database on Startup */}
      {isDbLoading && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col justify-center items-center p-6">
          <div className="max-w-md w-full bg-[#0d0f12] border border-zinc-800 rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Spinning/pulsing graphic */}
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 border-2 border-amber-500/10 rounded-full animate-pulse" />
              <div className="absolute w-12 h-12 border-2 border-t-amber-500 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin" />
              <Database className="w-6 h-6 text-amber-500 animate-pulse" />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-[0.2em]">
                Sincronizando Memória Flash
              </span>
              <h2 className="text-sm font-sans font-black text-zinc-200 uppercase tracking-wide">
                RESTAURANDO BANCO DE TIMBRES
              </h2>
              <p className="text-[10px] font-mono text-zinc-300 mt-1 max-w-[320px] mx-auto uppercase">
                Recuperando arquivos SoundFont salvos no seu navegador para o sintetizador de áudio.
              </p>
            </div>

            {/* Progress status */}
            {dbLoadingStatus.total > 0 && (
              <div className="w-full flex flex-col gap-2 mt-2">
                <div className="flex justify-between text-[12px] font-mono font-bold text-zinc-400 uppercase">
                  <span>Arquivo {dbLoadingStatus.current} de {dbLoadingStatus.total}</span>
                  <span className="text-amber-500">{dbLoadingStatus.progress}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    style={{ width: `${dbLoadingStatus.progress}%` }}
                  />
                </div>

                {/* Current file details */}
                <div className="bg-black/40 border border-zinc-900/60 rounded px-2.5 py-2 mt-1 flex flex-col gap-0.5 text-left font-mono">
                  <span className="text-[12px] text-zinc-400 font-bold truncate block">
                    {dbLoadingStatus.currentName || 'Inicializando motor...'}
                  </span>
                  <span className="text-[11px] text-zinc-300 uppercase">
                    Processando blocos PCM & Mapeando presets...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nice modal loading indicator when uploading new SoundFonts */}
      {isSf2Loading && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col justify-center items-center p-6">
          <div className="max-w-md w-full bg-[#0d0f12] border border-zinc-800 rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Spinning/pulsing graphic */}
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 border-2 border-cyan-500/10 rounded-full animate-pulse" />
              <div className="absolute w-12 h-12 border-2 border-t-cyan-500 border-r-transparent border-l-transparent border-b-transparent rounded-full animate-spin" />
              <UploadCloud className="w-6 h-6 text-cyan-500 animate-bounce" />
            </div>

            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-mono font-black text-cyan-500 uppercase tracking-[0.2em]">
                Carregamento em Progresso
              </span>
              <h2 className="text-sm font-sans font-black text-zinc-200 uppercase tracking-wide">
                PROCESSANDO ARQUIVOS SOUNDFONT
              </h2>
              <p className="text-[10px] font-mono text-zinc-300 mt-1 max-w-[320px] mx-auto uppercase">
                Não feche o navegador. Lendo e analisando blocos binários SF2 para a memória de áudio.
              </p>
            </div>

            {/* Progress status */}
            {uploadLoadingStatus.total > 0 && (
              <div className="w-full flex flex-col gap-2 mt-2">
                <div className="flex justify-between text-[12px] font-mono font-bold text-zinc-400 uppercase">
                  <span>Sincronizando {uploadLoadingStatus.current} de {uploadLoadingStatus.total}</span>
                  <span className="text-cyan-500">{uploadLoadingStatus.progress}%</span>
                </div>
                
                {/* Progress bar */}
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                    style={{ width: `${uploadLoadingStatus.progress}%` }}
                  />
                </div>

                {/* Current file details */}
                <div className="bg-black/40 border border-zinc-900/60 rounded px-2.5 py-2 mt-1 flex flex-col gap-0.5 text-left font-mono">
                  <span className="text-[12px] text-cyan-400 font-bold truncate block">
                    {uploadLoadingStatus.currentName || 'Analisando arquivo...'}
                  </span>
                  <span className="text-[11px] text-zinc-300 uppercase">
                    Extraindo amostras PCM, cabeçalhos de instrumentos e gerando cache IndexedDB...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Top Header / Activation status bar */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-4 py-2 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <h1 className="text-xs font-mono font-black tracking-widest text-zinc-300 uppercase">
              SF2 MULTI-PART SOUNDFONT WORKSTATION ENGINE
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isDbLoading && (
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-widest animate-pulse flex items-center gap-1.5 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                RESTAURANDO SF2...
              </span>
            )}
            
            <button
              onClick={handlePanic}
              className="px-2.5 py-1 rounded font-mono text-[12px] font-black border cursor-pointer uppercase transition-all bg-red-950/40 border-red-800 text-red-400 hover:bg-red-900 hover:text-white flex items-center gap-1 shrink-0"
              title="Para todos os sons imediatamente (Panic)"
            >
              PANIC
            </button>

            {!audioActive ? (
              <button
                onClick={handleToggleAudio}
                className="animate-pulse bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-[10px] font-black py-1 px-3 rounded border border-emerald-400 transition cursor-pointer"
              >
                ATIVAR ÁUDIO CONTEXTO
              </button>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest animate-pulse">
                ÁUDIO ON
              </span>
            )}
            <div className="bg-black/80 px-2 py-0.5 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400">
              VOZES: <span className="text-emerald-400 font-bold">{voiceCount}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-[1500px] mx-auto px-4 py-2 flex flex-col gap-2 w-full">
        {/* Synthesizer Touchscreen Console */}
        <MODXConsole
          channels={channels}
          onChannelsChange={setChannels}
          reverbDecay={reverbDecay}
          reverbMix={reverbMix}
          reverbPreDelay={reverbPreDelay}
          reverbHighCut={reverbHighCut}
          reverbBypass={reverbBypass}
          onReverbBypassChange={setReverbBypass}
          onReverbChange={(decay, mix, preDelay, highCut) => {
            setReverbDecay(decay);
            setReverbMix(mix);
            if (preDelay !== undefined) setReverbPreDelay(preDelay);
            if (highCut !== undefined) setReverbHighCut(highCut);
          }}
          chorusBypass={chorusBypass}
          onChorusBypassChange={setChorusBypass}
          chorusRate={chorusRate}
          chorusDepth={chorusDepth}
          chorusMix={chorusMix}
          onChorusChange={(rate, depth, mix) => {
            setChorusRate(rate);
            setChorusDepth(depth);
            setChorusMix(mix);
          }}
          tremoloBypass={tremoloBypass}
          onTremoloBypassChange={setTremoloBypass}
          tremoloRate={tremoloRate}
          tremoloDepth={tremoloDepth}
          tremoloMode={tremoloMode}
          onTremoloChange={(rate, depth, mode) => {
            setTremoloRate(rate);
            setTremoloDepth(depth);
            if (mode) setTremoloMode(mode);
          }}
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
          loadedSoundFonts={loadedSoundFonts}
          onSoundFontsUploaded={handleSoundFontsUploaded}
          onRemoveSoundFont={handleRemoveSoundFont}
          onRemoveMultipleSoundFonts={handleRemoveMultipleSoundFonts}
          onSoundFontsReset={handleSoundFontsReset}
          savedPresets={savedPresets}
          onSavePreset={handleSavePreset}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
          voiceCount={voiceCount}
          audioActive={audioActive}
          onToggleAudio={handleToggleAudio}
          onPanic={handlePanic}
          isSf2Loading={isSf2Loading}
          isDbLoading={isDbLoading}
          preferredSampleRate={preferredSampleRate}
          onSampleRateChange={handleSampleRateChange}
          sfCategories={sfCategories}
          onSfCategoriesChange={setSfCategories}
          auditioningSoundFont={auditioningSoundFont}
          onAuditioningSoundFontChange={setAuditioningSoundFont}
        />

        {/* Piano Keyboard Controller Panel */}
        <Keyboard
          onNoteOn={(note, velocity) => {}}
          onNoteOff={(note) => {}}
        />
      </main>

      {/* Footer Branding */}
      <footer className="max-w-[1500px] mx-auto px-4 mt-8 w-full border-t border-zinc-900 pt-6 flex justify-between items-center text-[12px] tracking-widest uppercase font-mono text-zinc-300">
        <div>
          Multi-Part Web Synthesizer Interface • SF2 Wavetable Workstation
        </div>
        <div>
          Ryco Buckton • 2026
        </div>
      </footer>

      {/* Custom Confirmation / Alert Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0e1014] border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-scale-up">
            <h2 className="text-xs font-mono font-black uppercase text-zinc-200 tracking-wider flex items-center gap-2 border-b border-zinc-900 pb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${confirmDialog.type === 'warning' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : confirmDialog.type === 'error' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'}`} />
              {confirmDialog.title}
            </h2>
            <p className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre-line bg-black/40 p-3 rounded border border-zinc-900">
              {confirmDialog.message}
            </p>
            <div className="flex gap-3 justify-end mt-2 border-t border-zinc-900 pt-4">
              {confirmDialog.onConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 rounded text-[10px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  >
                    CANCELAR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmDialog.onConfirm?.();
                      setConfirmDialog(null);
                    }}
                    className="px-4 py-2 rounded text-[10px] font-mono font-black bg-red-600 hover:bg-red-500 border border-red-500 text-white transition cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  >
                    EXCLUIR DEFINITIVAMENTE
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-5 py-2.5 rounded text-[11px] font-mono font-black bg-cyan-500 hover:bg-cyan-400 text-black border border-cyan-400 transition cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)] uppercase"
                >
                  ENTENDI / OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
