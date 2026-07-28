import React, { useRef, useState } from 'react';
import { Upload, Trash2, Save, Download, ShieldAlert, Sliders } from 'lucide-react';
import { SynthPreset } from '../App';

interface ReverbControlsProps {
  onSoundFontUploaded: (file: File) => void;
  onSoundFontReset: () => void;
  loadedSoundFontName: string | null;
  loadedSoundFontStats: { sizeMb: number; presetsCount: number } | null;
  savedPresets: SynthPreset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  onPanic: () => void;
  voiceCount: number;
  audioActive: boolean;
  onToggleAudio: () => void;
  onOpenEffects: () => void;
}

export const ReverbControls: React.FC<ReverbControlsProps> = ({
  onSoundFontUploaded,
  onSoundFontReset,
  loadedSoundFontName,
  loadedSoundFontStats,
  savedPresets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  masterVolume,
  onMasterVolumeChange,
  onPanic,
  voiceCount,
  audioActive,
  onToggleAudio,
  onOpenEffects,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [presetInputName, setPresetInputName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSoundFontUploaded(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.sf2') || ext.endsWith('.sf3') || ext.endsWith('.sfz')) {
        onSoundFontUploaded(file);
      } else {
        alert('Por favor, carregue um arquivo no formato SoundFont (.sf2, .sf3, .sfz).');
      }
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetInputName.trim()) return;
    onSavePreset(presetInputName.trim());
    setPresetInputName('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-md relative">
      
      {/* 1. SoundFont Loading Station */}
      <div className="flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-zinc-750 pb-4 lg:pb-0 lg:pr-4 justify-between">
        <div>
          <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Upload className="w-4 h-4" /> 1. Banco SoundFont (.sf2, .sf3, .sfz)
          </h3>

          {loadedSoundFontName ? (
            <div className="bg-black p-3 rounded border border-zinc-750 flex flex-col justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-mono font-bold text-emerald-400 truncate flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
                  {loadedSoundFontName}
                </span>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-zinc-300 mt-1">
                  <span>Tamanho: <b className="text-zinc-300">{loadedSoundFontStats?.sizeMb.toFixed(1)} MB</b></span>
                  <span>Instrumentos: <b className="text-zinc-300">{loadedSoundFontStats?.presetsCount}</b></span>
                </div>
              </div>
              
              <button
                onClick={onSoundFontReset}
                className="w-full mt-1 text-center text-xs font-mono py-1.5 px-3 rounded bg-red-950/80 border border-red-900 text-red-400 hover:bg-red-900 hover:text-white transition cursor-pointer"
              >
                Remover SoundFont
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`min-h-[96px] border border-dashed rounded p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-950/20 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : 'border-zinc-700 hover:border-zinc-500 hover:bg-black/40 text-zinc-300'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".sf2,.sf3,.sfz"
                className="hidden"
              />
              <Upload className={`w-5 h-5 mb-1 ${isDragging ? 'text-emerald-400 animate-bounce' : 'text-zinc-300'}`} />
              <span className="text-xs font-medium font-mono text-zinc-300">
                Arraste seu arquivo (.sf2, .sf3, .sfz)
              </span>
              <span className="text-[10px] text-zinc-300 font-mono mt-0.5">
                ou clique para explorar
              </span>
            </div>
          )}
        </div>

        {/* Global effects window launcher */}
        <button
          onClick={onOpenEffects}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-400 font-mono text-xs font-bold py-2 px-4 rounded border border-emerald-500/30 hover:border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.06)] hover:shadow-[0_0_20px_rgba(16,185,129,0.12)] transition-all uppercase tracking-wider w-full cursor-pointer mt-3 font-black"
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          Ajustar Filtros & Efeitos Gerais
        </button>
      </div>

      {/* 2. Preset Storage & Utility Station */}
      <div className="flex flex-col gap-3 justify-between">
        <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <Save className="w-4 h-4" /> 2. Presets dos 4 Canais SF2
        </h3>

        {/* Preset Saving Form */}
        <form onSubmit={handleSaveSubmit} className="flex gap-1.5">
          <input
            type="text"
            value={presetInputName}
            onChange={(e) => setPresetInputName(e.target.value)}
            placeholder="Nome do preset de canais..."
            className="flex-1 bg-black border border-zinc-700 text-xs rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
          />
          <button
            type="submit"
            className="text-xs font-mono px-3 py-1.5 rounded bg-zinc-750 hover:bg-zinc-650 text-white font-bold transition flex items-center gap-1 border border-zinc-600 border-b-2 border-b-zinc-950 shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" /> SALVAR
          </button>
        </form>

        {/* Preset Selector */}
        <div className="flex gap-1.5 items-center">
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="flex-1 bg-black border border-zinc-700 text-zinc-300 text-xs rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
          >
            <option value="">-- Carregar Preset Gravado --</option>
            {savedPresets.map((p, idx) => (
              <option key={`rev_${p.id}_${idx}`} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => selectedPresetId && onLoadPreset(selectedPresetId)}
            disabled={!selectedPresetId}
            className="p-1.5 rounded bg-zinc-850 hover:bg-zinc-750 border border-zinc-700 text-emerald-400 disabled:opacity-40 disabled:hover:bg-zinc-850 disabled:text-zinc-300 border-b-2 border-b-zinc-950 transition cursor-pointer"
            title="Carregar Preset"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (selectedPresetId) {
                onDeletePreset(selectedPresetId);
                setSelectedPresetId('');
              }
            }}
            disabled={!selectedPresetId}
            className="p-1.5 rounded bg-zinc-850 hover:bg-red-950 border border-zinc-700 hover:border-red-900 text-red-400 disabled:opacity-40 disabled:hover:bg-zinc-850 disabled:hover:border-zinc-700 disabled:text-zinc-300 border-b-2 border-b-zinc-950 transition cursor-pointer"
            title="Excluir Preset"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Active & Voice Count Indicators */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={onToggleAudio}
            className={`py-1.5 px-2.5 rounded text-xs font-mono font-bold border-b-2 border border-zinc-700 transition flex items-center justify-center gap-1.5 cursor-pointer ${
              audioActive
                ? 'bg-emerald-500 border-emerald-700 text-black shadow-[0_0_8px_rgba(16,185,129,0.3)] font-black'
                : 'bg-red-950/80 border-red-900 text-red-400 animate-pulse'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${audioActive ? 'bg-black shadow-[0_0_5px_rgba(0,0,0,0.5)] animate-ping' : 'bg-red-400'}`} />
            {audioActive ? 'ÁUDIO ATIVO' : 'ATIVAR ÁUDIO'}
          </button>

          <button
            onClick={onPanic}
            className="py-1.5 px-2.5 rounded text-xs font-mono font-bold bg-black border border-zinc-700 text-red-400 hover:bg-red-950 hover:border-red-900 hover:text-red-300 transition flex items-center justify-center gap-1.5 border-b-2 border-b-zinc-950 cursor-pointer"
            title="Para todos os sons imediatamente"
          >
            <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
            PANIC (MUTE)
          </button>
        </div>

        {/* Diagnostic Voice Counter */}
        <div className="flex justify-between items-center text-[10px] font-mono text-zinc-300 px-1 mt-0.5">
          <span>Vozes Ativas: <b className="text-emerald-400">{voiceCount}</b></span>
          <span className="text-zinc-300">MIDI: 4 Canais (1-4)</span>
        </div>
      </div>

    </div>
  );
};
