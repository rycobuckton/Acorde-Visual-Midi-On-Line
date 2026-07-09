export class PolySynth {
  private audioCtx: AudioContext | null = null;
  private activeVoices: Map<number, { oscillators?: OscillatorNode[]; source?: AudioBufferSourceNode; gainNode: GainNode }> = new Map();
  private volume: number = 0.3; // Volume padrão de 30%
  private isMuted: boolean = false;
  private waveform: OscillatorType = 'triangle'; // triangle é suave e agradável
  
  // Limiter master e Master Gain para evitar distorção (clipping) e controlar o volume globalmente
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  // Suporte a SoundFont
  private useSoundfont: boolean = false; // Desabilitado por padrão
  private soundfontLoading: boolean = false;
  private soundfontLoaded: boolean = false;
  private soundfontLibrary: 'FluidR3' | 'MusyngKite' = 'FluidR3';
  private pianoSamples: Record<string, AudioBuffer> = {};
  
  public onStateChange?: (state: 'idle' | 'loading' | 'loaded' | 'error') => void;

  public getSoundfontLibrary(): 'FluidR3' | 'MusyngKite' {
    return this.soundfontLibrary;
  }

  public setSoundfontLibrary(lib: 'FluidR3' | 'MusyngKite') {
    if (this.soundfontLibrary === lib) return;
    this.soundfontLibrary = lib;
    
    // Se estiver usando soundfont, força o recarregamento imediato para a nova biblioteca
    if (this.useSoundfont) {
      this.soundfontLoading = false;
      
      // Limpa os dados de soundfont anteriores no window para carregar novos corretamente
      if ((window as any).MIDI && (window as any).MIDI.Soundfont) {
        delete (window as any).MIDI.Soundfont.acoustic_grand_piano;
      }
      
      this.loadSoundfont(true);
    }
  }

  constructor() {
    // Lazy init no primeiro toque
  }

  private initCtx() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Criar limiter para evitar distorção (clipping) ao somar várias vozes simultâneas (acordes)
      this.limiter = this.audioCtx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-12, this.audioCtx.currentTime); // Limite de -12dB antes da compressão
      this.limiter.knee.setValueAtTime(12, this.audioCtx.currentTime);
      this.limiter.ratio.setValueAtTime(12, this.audioCtx.currentTime);
      this.limiter.attack.setValueAtTime(0.003, this.audioCtx.currentTime); // Reação de 3ms
      this.limiter.release.setValueAtTime(0.1, this.audioCtx.currentTime); // Release de 100ms

      // Criar master gain para controle instantâneo de volume geral
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);

      // Conectar: vozes -> limiter -> masterGain -> destino final
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
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

  public async loadSoundfont(forceReload: boolean = false): Promise<void> {
    if (this.soundfontLoading) return;
    if (this.soundfontLoaded && !forceReload) return;
    
    this.soundfontLoading = true;
    this.triggerStateChange('loading');
    
    try {
      this.initCtx();
      if (!this.audioCtx) throw new Error("AudioContext not initialized");
      
      const audioCtx = this.audioCtx;
      
      // Carregar script dinamicamente
      await new Promise<void>((resolve, reject) => {
        // Remove script anterior para evitar tags duplicadas ou cache
        const existingScript = document.getElementById('soundfont-script-loader');
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = 'soundfont-script-loader';
        script.src = this.soundfontLibrary === 'MusyngKite'
          ? 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3.js'
          : 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/acoustic_grand_piano-mp3.js';
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });
      
      const soundfont = (window as any).MIDI?.Soundfont?.acoustic_grand_piano;
      if (!soundfont) {
        throw new Error("MIDI.Soundfont.acoustic_grand_piano not found on window");
      }
      
      const notes = Object.keys(soundfont);
      
      // Decodificar todos os samples base64 em paralelo em um objeto temporário
      const tempSamples: Record<string, AudioBuffer> = {};
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
          tempSamples[note] = audioBuffer;
        } catch (e) {
          console.error("Failed to decode note:", note, e);
        }
      }));
      
      // Swap atômico de samples para evitar silêncio ou fallback para synth durante o carregamento
      this.pianoSamples = tempSamples;
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
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.setValueAtTime(mute ? 0 : this.volume, now);
    }
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

    // Se a nota for acionada com velocidade extremamente baixa (toque fantasma ou sem velocidade real),
    // ignoramos o disparo de áudio para evitar cliques indesejados no driver de som do PC.
    if (velocity < 6) return;

    // Se a nota já está soando, desliga primeiro para evitar acúmulo
    if (this.activeVoices.has(midi)) {
      this.noteOff(midi);
    }

    const velRatio = velocity / 127;
    // O volume individual da voz agora é proporcional apenas à velocidade MIDI.
    // O controle global de volume ocorre de forma limpa no masterGain do AudioContext!
    const voiceVolume = velRatio;

    // Evitar disparos inaudíveis
    if (voiceVolume <= 0.0001 || this.volume <= 0.0001) return;

    // Se o usuário quer usar SoundFont e o mesmo está carregado, toca o sample real de piano
    if (this.useSoundfont && this.soundfontLoaded) {
      const gleitzName = this.midiToGleitzNoteName(midi);
      const buffer = this.pianoSamples[gleitzName];
      if (buffer) {
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.audioCtx.createGain();
        gainNode.gain.value = 0; // Configura o ganho inicial explicitamente como 0 para evitar qualquer click ou vazamento
        const now = this.audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        
        // Ataque adaptativo ultra-rápido à velocidade: para toques suaves usamos 4ms para suavização.
        // Para toques firmes, usamos 1.2ms para preservar todo o brilho e ataque realista do martelo do piano (médios e agudos).
        const attackTime = velocity < 40 ? 0.004 : 0.0012;
        gainNode.gain.linearRampToValueAtTime(voiceVolume, now + attackTime);

        source.connect(gainNode);

        let lastNode: AudioNode = gainNode;
        if (this.soundfontLibrary === 'MusyngKite') {
          // Compensação acústica de perda de médios e agudos (+2.2dB nos agudos e +1.2dB nos médios)
          // Isso reduz a atenuação do timbre em cerca de 40%, restaurando o brilho e a presença do piano HD
          const highShelf = this.audioCtx.createBiquadFilter();
          highShelf.type = 'highshelf';
          highShelf.frequency.value = 3200;
          highShelf.gain.value = 2.2;

          const midPeak = this.audioCtx.createBiquadFilter();
          midPeak.type = 'peaking';
          midPeak.frequency.value = 1500;
          midPeak.Q.value = 0.8;
          midPeak.gain.value = 1.2;

          // Pico de equalização adicionado para ganho de agudos/brilho (+6dB em 2.7kHz com Q de 0.12)
          const eqPeak = this.audioCtx.createBiquadFilter();
          eqPeak.type = 'peaking';
          eqPeak.frequency.value = 2700;
          eqPeak.Q.value = 0.12;
          eqPeak.gain.value = 6.0;

          gainNode.connect(midPeak);
          midPeak.connect(highShelf);
          highShelf.connect(eqPeak);
          lastNode = eqPeak;
        }

        lastNode.connect(this.limiter || this.audioCtx.destination);
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
    gainNode.gain.value = 0; // Ganho inicial explícito 0 para silêncio absoluto no instante inicial
    
    // Configurar envelope de Attack ultra rápido de 10ms para máxima resposta via teclado MIDI
    const now = this.audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(voiceVolume, now + 0.01); // Attack de 10ms (resposta em tempo real)

    // Conectar nós ao limiter principal (evitando estalos de soma)
    osc.connect(gainNode);
    subOsc.connect(gainNode);
    gainNode.connect(this.limiter || this.audioCtx.destination);

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
    
    // Configurar envelope de Release suave sem estalos usando linearRampToValueAtTime
    const releaseTime = 0.25; // 250ms de release
    try {
      voice.gainNode.gain.cancelScheduledValues(now);
      const currentGain = voice.gainNode.gain.value;
      voice.gainNode.gain.setValueAtTime(currentGain, now);
      voice.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);
    } catch (e) {
      try {
        voice.gainNode.gain.setValueAtTime(0, now + releaseTime);
      } catch (err) {}
    }

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
        voice.gainNode.gain.cancelScheduledValues(now);
        const currentGain = voice.gainNode.gain.value;
        voice.gainNode.gain.setValueAtTime(currentGain, now);
        voice.gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
        if (voice.oscillators) {
          voice.oscillators.forEach(osc => osc.stop(now + 0.15));
        }
        if (voice.source) {
          voice.source.stop(now + 0.15);
        }
      } catch (e) {
        try {
          voice.gainNode.gain.setValueAtTime(0, now + 0.15);
          if (voice.oscillators) {
            voice.oscillators.forEach(osc => osc.stop(now + 0.15));
          }
          if (voice.source) {
            voice.source.stop(now + 0.15);
          }
        } catch (err) {}
      }
    });
    this.activeVoices.clear();
  }
}

// Instância singleton exportada
export const synth = new PolySynth();
