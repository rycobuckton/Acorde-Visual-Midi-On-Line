export class PolySynth {
  private audioCtx: AudioContext | null = null;
  private activeVoices: Map<number, { oscillators?: OscillatorNode[]; source?: AudioBufferSourceNode; gainNode: GainNode }> = new Map();
  private volume: number = 0.3; // Volume padrão de 30%
  private isMuted: boolean = false;
  private waveform: OscillatorType = 'triangle'; // triangle é suave e agradável
  
  // Suporte a SoundFont
  private useSoundfont: boolean = false; // Desabilitado por padrão
  private soundfontLoading: boolean = false;
  private soundfontLoaded: boolean = false;
  private pianoSamples: Record<string, AudioBuffer> = {};
  
  public onStateChange?: (state: 'idle' | 'loading' | 'loaded' | 'error') => void;

  constructor() {
    // Lazy init no primeiro toque
  }

  private initCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private triggerStateChange(state: 'idle' | 'loading' | 'loaded' | 'error') {
    if (this.onStateChange) {
      this.onStateChange(state);
    }
  }

  public getSoundfontState(): 'idle' | 'loading' | 'loaded' | 'error' {
    if (this.soundfontLoaded) return 'loaded';
    if (this.soundfontLoading) return 'loading';
    return 'idle';
  }

  public setUseSoundfont(use: boolean) {
    this.useSoundfont = use;
    if (use && !this.soundfontLoaded && !this.soundfontLoading) {
      this.loadSoundfont();
    }
  }

  public getUseSoundfont(): boolean {
    return this.useSoundfont;
  }

  public async loadSoundfont(): Promise<void> {
    if (this.soundfontLoaded || this.soundfontLoading) return;
    
    this.soundfontLoading = true;
    this.triggerStateChange('loading');
    
    try {
      this.initCtx();
      if (!this.audioCtx) throw new Error("AudioContext not initialized");
      
      const audioCtx = this.audioCtx;
      
      // Carregar script dinamicamente
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js';
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
      
      const soundfont = (window as any).MIDI?.Soundfont?.acoustic_grand_piano;
      if (!soundfont) {
        throw new Error("MIDI.Soundfont.acoustic_grand_piano not found on window");
      }
      
      const notes = Object.keys(soundfont);
      
      // Decodificar todos os samples base64 em paralelo
      await Promise.all(notes.map(async (note) => {
        try {
          const base64Data = soundfont[note].split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer);
          this.pianoSamples[note] = audioBuffer;
        } catch (e) {
          console.error("Failed to decode note:", note, e);
        }
      }));
      
      this.soundfontLoaded = true;
      this.soundfontLoading = false;
      this.triggerStateChange('loaded');
    } catch (e) {
      console.error("Failed to load soundfont:", e);
      this.soundfontLoading = false;
      this.triggerStateChange('error');
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (mute) {
      this.allNotesOff();
    }
  }

  public getMute(): boolean {
    return this.isMuted;
  }

  public setWaveform(type: OscillatorType) {
    this.waveform = type;
  }

  public getWaveform(): OscillatorType {
    return this.waveform;
  }

  // Converter MIDI note para frequência Hz
  private midiToFreq(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Converter MIDI para nome de nota esperado pela Gleitz SoundFont (ex: "C4", "Db4")
  private midiToGleitzNoteName(midi: number): string {
    const notes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const noteName = notes[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
  }

  public noteOn(midi: number, velocity: number = 100) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.audioCtx) return;

    // Se a nota já está soando, desliga primeiro para evitar acúmulo
    if (this.activeVoices.has(midi)) {
      this.noteOff(midi);
    }

    const velRatio = velocity / 127;
    const voiceVolume = velRatio * this.volume;

    // Se o usuário quer usar SoundFont e o mesmo está carregado, toca o sample real de piano
    if (this.useSoundfont && this.soundfontLoaded) {
      const gleitzName = this.midiToGleitzNoteName(midi);
      const buffer = this.pianoSamples[gleitzName];
      if (buffer) {
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueAtTime(voiceVolume, this.audioCtx.currentTime);

        source.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        source.start(0);

        this.activeVoices.set(midi, {
          source,
          gainNode
        });
        return;
      }
    }

    // Fallback: Síntese de Osciladores clássicos (instantâneo e à prova de falhas de conexão)
    const freq = this.midiToFreq(midi);

    // Criar oscilador principal
    const osc = this.audioCtx.createOscillator();
    osc.type = this.waveform;
    osc.frequency.value = freq;

    // Criar oscilador de sub-oitava
    const subOsc = this.audioCtx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = freq / 2;

    // Criar ganho para controle de envelope (ADSR)
    const gainNode = this.audioCtx.createGain();
    
    // Configurar envelope de Attack suave (evita estalos)
    const now = this.audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(voiceVolume, now + 0.015);

    // Conectar nós
    osc.connect(gainNode);
    subOsc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    // Iniciar osciladores
    osc.start(now);
    subOsc.start(now);

    this.activeVoices.set(midi, {
      oscillators: [osc, subOsc],
      gainNode: gainNode
    });
  }

  public noteOff(midi: number) {
    if (!this.audioCtx) return;
    const voice = this.activeVoices.get(midi);
    if (!voice) return;

    const now = this.audioCtx.currentTime;
    
    // Configurar envelope de Release suave
    const releaseTime = 0.2; // 200ms de release
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    // Parar fontes de áudio correspondentes após o release terminar
    if (voice.oscillators) {
      voice.oscillators.forEach(osc => {
        try {
          osc.stop(now + releaseTime);
        } catch (e) {}
      });
    }

    if (voice.source) {
      try {
        voice.source.stop(now + releaseTime);
      } catch (e) {}
    }

    this.activeVoices.delete(midi);
  }

  public allNotesOff() {
    if (!this.audioCtx) return;
    
    const now = this.audioCtx.currentTime;
    this.activeVoices.forEach(voice => {
      try {
        voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
        voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        if (voice.oscillators) {
          voice.oscillators.forEach(osc => osc.stop(now + 0.1));
        }
        if (voice.source) {
          voice.source.stop(now + 0.1);
        }
      } catch (e) {}
    });
    this.activeVoices.clear();
  }
}

// Instância singleton exportada
export const synth = new PolySynth();
