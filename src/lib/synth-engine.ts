/**
 * Real-time 4-Channel Audio Synthesis & Mixer Engine
 * Integrates Web Audio API, EQ, resonant filters, reverb, ADSR, and MIDI.
 */

import { ParsedSoundFont, SF2SampleHeader, SF2Parser } from './sf2-parser';
import { loadSoundFontData } from './db';

export interface ADSR {
  attack: number;   // 0 to 5s
  decay: number;    // 0 to 5s
  sustain: number;  // 0 to 100%
  release: number;  // 0 to 5s
}

export interface EQBandState {
  gain: number;       // -12 to +12 dB
  frequency: number;  // 20 to 20000 Hz
  q: number;          // 0.1 to 10
}

export interface ChannelState {
  soundfontIndex?: number; // Index in the loaded SoundFonts list
  soundfontId?: string;    // Persistent ID of the loaded SoundFont
  soundfontName?: string;  // Name of the loaded SoundFont
  soundfontGain?: number;  // Dynamic volume Gain multiplier for the SoundFont (e.g. 0.5 to 4.0)
  presetIndex: number; // Index in the SoundFont presets
  volume: number;      // 0 to 1
  pan: number;         // -1 to 1 (left to right)
  mute: boolean;
  solo: boolean;
  filterType: 'lowpass' | 'highpass' | 'bandpass';
  filterCutoff: number; // 20 to 20000 Hz
  filterResonance: number; // 0 to 20
  eqLow?: number;       // Backward compatibility
  eqMid?: number;       // Backward compatibility
  eqHigh?: number;      // Backward compatibility
  eqBands?: EQBandState[];
  eqBypass?: boolean; // Bypass equalizer for this layer
  filterBypass?: boolean; // Bypass filter for this layer
  reverbBypass?: boolean; // Bypass reverb for this layer
  adsrBypass?: boolean; // Bypass ADSR envelope for this layer
  adsr: ADSR;
  reverbSend: number;  // 0 to 1
  reverbDecay?: number; // 0.2 to 8.0s
  reverbMix?: number;   // 0 to 1
  reverbPreDelay?: number; // 0 to 0.2s
  reverbHighCut?: number;  // 1000 to 18000 Hz
  routingEnabled?: boolean; // ON/OFF routing for layer
  sustainEnabled?: boolean; // Ignore or respect sustain
  keyRangeMin?: number;    // MIDI Note Min
  keyRangeMax?: number;    // MIDI Note Max
  octaveOffset?: number;   // Octave offset (-3 to +3)
  midiSensitivity?: number; // MIDI Velocity Sensitivity multiplier (e.g. 0.1 to 2.0)
  chorusBypass?: boolean;
  chorusRate?: number;
  chorusDepth?: number;
  chorusMix?: number;
  tremoloBypass?: boolean;
  tremoloRate?: number;
  tremoloDepth?: number;
  tremoloMode?: 'volume' | 'pan';
  delayBypass?: boolean;
  delayTime?: number;     // 0.05s to 1.5s (default 0.3s)
  delayFeedback?: number; // 0.0 to 0.9 (default 0.4)
  delayMix?: number;      // 0.0 to 1.0 (default 0.3)
  delayHighCut?: number;  // 500 to 18000 Hz (default 6000)
}

interface ActiveVoice {
  note: number;
  sourceNode: AudioBufferSourceNode | OscillatorNode;
  gainNode: GainNode;
  filterNode: BiquadFilterNode;
  pannerNode: StereoPannerNode;
  startTime: number;
  ended: boolean;
  releaseTriggered: boolean;
}

export class SynthEngine {
  public ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;
  
  // Reverb nodes
  public isReverbBypassed: boolean = false;
  public reverbDecay: number = 2.5; // seconds
  public reverbMix: number = 0.3;   // 0 to 1
  public reverbPreDelay: number = 0.02; // seconds (20ms default)
  public reverbHighCut: number = 5000;   // Hz
  public lastChannelStates: ChannelState[] = [];
  private reverbNode: ConvolverNode | null = null;
  private reverbDelayNode: DelayNode | null = null;
  private reverbHighPassFilter: BiquadFilterNode | null = null;
  private reverbToneFilter: BiquadFilterNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // Chorus properties
  public chorusBypass: boolean = true;
  public chorusRate: number = 1.5; // Hz
  public chorusDepth: number = 0.5; // 0 to 1
  public chorusMix: number = 0.5; // 0 to 1

  // Tremolo properties
  public tremoloBypass: boolean = true;
  public tremoloRate: number = 5.0; // Hz
  public tremoloDepth: number = 0.5; // 0 to 1
  public tremoloMode: 'volume' | 'pan' = 'volume';

  // Chorus Nodes
  private chorusDryGain: GainNode | null = null;
  private chorusWetGain: GainNode | null = null;
  private chorusDelayNode: DelayNode | null = null;
  private chorusLFO: OscillatorNode | null = null;
  private chorusLFOGain: GainNode | null = null;
  private chorusInput: GainNode | null = null;
  private chorusOutput: GainNode | null = null;

  // Tremolo Nodes
  private tremoloGainNode: GainNode | null = null;
  private tremoloPannerNode: StereoPannerNode | null = null;
  private tremoloLFO: OscillatorNode | null = null;
  private tremoloLFOGain: GainNode | null = null;

  // Channel strip nodes
  private channelInputs: GainNode[] = [];
  private channelEQs: BiquadFilterNode[][] = [];
  private channelFilters: BiquadFilterNode[] = [];
  private channelPanners: StereoPannerNode[] = [];
  private channelGains: GainNode[] = [];
  
  // Per-channel Chorus Nodes
  private channelChorusInputs: GainNode[] = [];
  private channelChorusOutputs: GainNode[] = [];
  private channelChorusDryGains: GainNode[] = [];
  private channelChorusWetGains: GainNode[] = [];
  private channelChorusDelayNodes: DelayNode[] = [];
  private channelChorusLFOs: (OscillatorNode | null)[] = [null, null, null, null];
  private channelChorusLFOGains: GainNode[] = [];

  // Per-channel Tremolo Nodes
  private channelTremoloGainNodes: GainNode[] = [];
  private channelTremoloPannerNodes: StereoPannerNode[] = [];
  private channelTremoloLFOs: (OscillatorNode | null)[] = [null, null, null, null];
  private channelTremoloLFOGains: GainNode[] = [];

  // Per-channel Delay / Echo Nodes
  private channelDelayInputs: GainNode[] = [];
  private channelDelayOutputs: GainNode[] = [];
  private channelDelayDryGains: GainNode[] = [];
  private channelDelayWetGains: GainNode[] = [];
  private channelDelayNodes: DelayNode[] = [];
  private channelDelayFeedbackGains: GainNode[] = [];
  private channelDelayToneFilters: BiquadFilterNode[] = [];

  private channelReverbSends: GainNode[] = [];
  private channelAnalysers: AnalyserNode[] = [];
  private channelAnalysersLeft: AnalyserNode[] = [];
  private channelAnalysersRight: AnalyserNode[] = [];
  private masterAnalyserLeft: AnalyserNode | null = null;
  private masterAnalyserRight: AnalyserNode | null = null;

  // Active playing voices
  private activeVoices: Map<string, ActiveVoice[]> = new Map(); // Key: `${channelIndex}-${note}`

  // Sustain Pedal state
  private sustainActive: boolean[] = [false, false, false, false];
  private sustainedNotes: Set<number>[] = [new Set(), new Set(), new Set(), new Set()];

  // Loaded SoundFont
  public soundFont: ParsedSoundFont | null = null;
  public soundFonts: ParsedSoundFont[] = [];

  // Callbacks
  private onVoiceCountChange: (count: number) => void = () => {};

  constructor() {}

  public init(onVoiceCountChange: (count: number) => void, preferredSampleRate?: number) {
    if (this.ctx) {
      if (preferredSampleRate && this.ctx.sampleRate !== preferredSampleRate) {
        try {
          this.ctx.close();
        } catch (e) {}
        this.ctx = null;
      } else {
        return;
      }
    }
    this.onVoiceCountChange = onVoiceCountChange;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const options: AudioContextOptions = {};
    if (preferredSampleRate) {
      options.sampleRate = preferredSampleRate;
    }
    this.ctx = new AudioContextClass(options);

    // Clear arrays before initialization to avoid double accumulation if re-initialized
    this.channelInputs = [];
    this.channelEQs = [];
    this.channelFilters = [];
    this.channelPanners = [];
    this.channelGains = [];
    
    // Clear chorus/tremolo arrays
    this.channelChorusInputs = [];
    this.channelChorusOutputs = [];
    this.channelChorusDryGains = [];
    this.channelChorusWetGains = [];
    this.channelChorusDelayNodes = [];
    // Stop any existing LFOs
    this.channelChorusLFOs.forEach(lfo => {
      try { lfo?.stop(); } catch (e) {}
    });
    this.channelChorusLFOs = [null, null, null, null];
    this.channelChorusLFOGains = [];

    this.channelTremoloGainNodes = [];
    this.channelTremoloPannerNodes = [];
    this.channelTremoloLFOs.forEach(lfo => {
      try { lfo?.stop(); } catch (e) {}
    });
    this.channelTremoloLFOs = [null, null, null, null];
    this.channelTremoloLFOGains = [];

    this.channelDelayInputs = [];
    this.channelDelayOutputs = [];
    this.channelDelayDryGains = [];
    this.channelDelayWetGains = [];
    this.channelDelayNodes = [];
    this.channelDelayFeedbackGains = [];
    this.channelDelayToneFilters = [];

    this.channelReverbSends = [];
    this.channelAnalysers = [];
    this.channelAnalysersLeft = [];
    this.channelAnalysersRight = [];
    
    // Create master nodes
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // --- CHORUS NODE INITIALIZATION ---
    this.chorusInput = this.ctx.createGain();
    this.chorusOutput = this.ctx.createGain();
    this.chorusDryGain = this.ctx.createGain();
    this.chorusWetGain = this.ctx.createGain();
    this.chorusDelayNode = this.ctx.createDelay(0.1);
    this.chorusLFOGain = this.ctx.createGain();

    // Default values
    this.chorusDelayNode.delayTime.value = 0.025; // 25ms base delay
    this.chorusDryGain.gain.value = 1.0;
    this.chorusWetGain.gain.value = 0.0; // Bypassed by default (chorusBypass = true)
    this.chorusLFOGain.gain.value = 0.0;

    // Connections for Chorus
    this.chorusInput.connect(this.chorusDryGain);
    this.chorusInput.connect(this.chorusDelayNode);
    this.chorusDelayNode.connect(this.chorusWetGain);
    
    this.chorusDryGain.connect(this.chorusOutput);
    this.chorusWetGain.connect(this.chorusOutput);

    // --- TREMOLO NODE INITIALIZATION ---
    this.tremoloGainNode = this.ctx.createGain();
    this.tremoloGainNode.gain.value = 1.0; // Bypassed by default (tremoloBypass = true)
    this.tremoloPannerNode = this.ctx.createStereoPanner();
    this.tremoloPannerNode.pan.value = 0.0;
    this.tremoloLFOGain = this.ctx.createGain();
    this.tremoloLFOGain.gain.value = 0.0;

    // Connect Master chain directly to Analyser and output
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Create stereo master analysers
    const masterSplitter = this.ctx.createChannelSplitter(2);
    this.masterAnalyserLeft = this.ctx.createAnalyser();
    this.masterAnalyserLeft.fftSize = 128;
    this.masterAnalyserRight = this.ctx.createAnalyser();
    this.masterAnalyserRight.fftSize = 128;

    this.masterGain.connect(masterSplitter);
    masterSplitter.connect(this.masterAnalyserLeft, 0, 0);
    masterSplitter.connect(this.masterAnalyserRight, 1, 0);

    // Initialize Reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbWetGain = this.ctx.createGain();
    this.reverbDryGain = this.ctx.createGain();

    // Create delay and tone nodes for reverb
    this.reverbDelayNode = this.ctx.createDelay(1.0); // max delay 1s
    this.reverbDelayNode.delayTime.value = this.reverbPreDelay;

    // High pass filter (low-cut) at 130Hz to remove muddy sub-bass rumble
    this.reverbHighPassFilter = this.ctx.createBiquadFilter();
    this.reverbHighPassFilter.type = 'highpass';
    this.reverbHighPassFilter.frequency.value = 130;

    // Low pass filter (high-cut)
    this.reverbToneFilter = this.ctx.createBiquadFilter();
    this.reverbToneFilter.type = 'lowpass';
    this.reverbToneFilter.frequency.value = this.reverbHighCut;

    this.reverbWetGain.gain.value = this.reverbMix;
    this.reverbDryGain.gain.value = 1.0;

    // Reverb loop connections: preDelay -> convolver -> highpass (130Hz) -> lowpass -> wetGain -> masterGain
    this.reverbDelayNode.connect(this.reverbNode);
    this.reverbNode.connect(this.reverbHighPassFilter);
    this.reverbHighPassFilter.connect(this.reverbToneFilter);
    this.reverbToneFilter.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterGain);
    this.reverbDryGain.connect(this.masterGain);

    this.updateReverbImpulse();

    // Initialize 4 Channel Strips
    for (let i = 0; i < 4; i++) {
      this.initChannelStrip(i);
    }

    // Set up MIDI
    this.initMIDI();

    // Do NOT decode pre-loaded soundfonts on startup.
    // They will be decoded lazily on-demand when selected or played!
  }

  private initChannelStrip(i: number) {
    if (!this.ctx) return;

    // 1. Channel Input Gain
    const input = this.ctx.createGain();

    // 2. 7-Band Equalizer
    const eqBands: BiquadFilterNode[] = [];
    const defaultFreqs = [80, 150, 400, 1000, 2500, 4300, 12000];
    const defaultTypes: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf'];
    const defaultQs = [0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 0.7];

    for (let b = 0; b < 7; b++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = defaultTypes[b];
      filter.frequency.value = defaultFreqs[b];
      filter.Q.value = defaultQs[b];
      filter.gain.value = 0;
      eqBands.push(filter);
    }

    // 3. Resonant Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000; // Max frequency by default
    filter.Q.value = 1.0;

    // 4. Stereo Panner
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    // 5. Channel Volume Gain
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;

    // 5b. Analyser for Real Peak VU Level per channel (mono backward compatibility)
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024; // Better resolution for logarithmic RTA

    // True stereo peak measurement setup
    const splitter = this.ctx.createChannelSplitter(2);
    const analyserLeft = this.ctx.createAnalyser();
    analyserLeft.fftSize = 128;
    const analyserRight = this.ctx.createAnalyser();
    analyserRight.fftSize = 128;

    // 6. Reverb Send
    const reverbSend = this.ctx.createGain();
    reverbSend.gain.value = 0.2;

    // --- CHORUS NODE INITIALIZATION FOR CHANNEL ---
    const chorusInput = this.ctx.createGain();
    const chorusOutput = this.ctx.createGain();
    const chorusDryGain = this.ctx.createGain();
    const chorusWetGain = this.ctx.createGain();
    const chorusDelayNode = this.ctx.createDelay(0.1);
    const chorusLFOGain = this.ctx.createGain();

    chorusDelayNode.delayTime.value = 0.025; // 25ms base delay
    chorusDryGain.gain.value = 1.0;
    chorusWetGain.gain.value = 0.0; // Bypassed by default
    chorusLFOGain.gain.value = 0.0;

    chorusInput.connect(chorusDryGain);
    chorusInput.connect(chorusDelayNode);
    chorusDelayNode.connect(chorusWetGain);
    chorusDryGain.connect(chorusOutput);
    chorusWetGain.connect(chorusOutput);

    // --- TREMOLO NODE INITIALIZATION FOR CHANNEL ---
    const tremoloGainNode = this.ctx.createGain();
    tremoloGainNode.gain.value = 1.0;
    const tremoloPannerNode = this.ctx.createStereoPanner();
    tremoloPannerNode.pan.value = 0.0;
    const tremoloLFOGain = this.ctx.createGain();
    tremoloLFOGain.gain.value = 0.0;

    // --- DELAY / ECHO NODE INITIALIZATION FOR CHANNEL ---
    const delayInput = this.ctx.createGain();
    const delayOutput = this.ctx.createGain();
    const delayDryGain = this.ctx.createGain();
    const delayWetGain = this.ctx.createGain();
    const delayNode = this.ctx.createDelay(2.0); // Max delay 2s
    const delayFeedbackGain = this.ctx.createGain();
    const delayToneFilter = this.ctx.createBiquadFilter();

    delayNode.delayTime.value = 0.3; // 300ms default
    delayFeedbackGain.gain.value = 0.4; // 40% feedback
    delayToneFilter.type = 'lowpass';
    delayToneFilter.frequency.value = 6000; // 6kHz high cut damping

    delayDryGain.gain.value = 1.0;
    delayWetGain.gain.value = 0.0; // Bypassed by default

    // Connections for Delay/Echo:
    delayInput.connect(delayDryGain);
    delayDryGain.connect(delayOutput);

    delayInput.connect(delayNode);
    delayNode.connect(delayToneFilter);
    delayToneFilter.connect(delayFeedbackGain);
    delayFeedbackGain.connect(delayNode); // feedback loop

    delayToneFilter.connect(delayWetGain);
    delayWetGain.connect(delayOutput);

    // --- CONNECT CHAIN ---
    // Input -> EQ Band 0..6 -> Resonant Filter -> Panner -> Gain -> Chorus -> Tremolo -> Delay/Echo -> Dry Mix / Reverb Send / Analysers
    input.connect(eqBands[0]);
    eqBands[0].connect(eqBands[1]);
    eqBands[1].connect(eqBands[2]);
    eqBands[2].connect(eqBands[3]);
    eqBands[3].connect(eqBands[4]);
    eqBands[4].connect(eqBands[5]);
    eqBands[5].connect(eqBands[6]);
    eqBands[6].connect(filter);
    filter.connect(panner);
    panner.connect(gain);

    // Insert Chorus, Tremolo and Delay nodes after volume gain
    gain.connect(chorusInput);
    chorusOutput.connect(tremoloGainNode);
    tremoloGainNode.connect(tremoloPannerNode);
    tremoloPannerNode.connect(delayInput);

    // From Delay Output to Analysers and outputs
    delayOutput.connect(analyser);

    // Split stereo output of Delay into Left & Right analysers
    delayOutput.connect(splitter);
    splitter.connect(analyserLeft, 0, 0);
    splitter.connect(analyserRight, 1, 0);

    // Outputs
    delayOutput.connect(this.reverbDryGain!);
    delayOutput.connect(reverbSend);
    reverbSend.connect(this.reverbDelayNode!);

    // Store references
    this.channelInputs.push(input);
    this.channelEQs.push(eqBands);
    this.channelFilters.push(filter);
    this.channelPanners.push(panner);
    this.channelGains.push(gain);

    // Store Chorus/Tremolo nodes for channel
    this.channelChorusInputs.push(chorusInput);
    this.channelChorusOutputs.push(chorusOutput);
    this.channelChorusDryGains.push(chorusDryGain);
    this.channelChorusWetGains.push(chorusWetGain);
    this.channelChorusDelayNodes.push(chorusDelayNode);
    this.channelChorusLFOGains.push(chorusLFOGain);

    this.channelTremoloGainNodes.push(tremoloGainNode);
    this.channelTremoloPannerNodes.push(tremoloPannerNode);
    this.channelTremoloLFOGains.push(tremoloLFOGain);

    this.channelDelayInputs.push(delayInput);
    this.channelDelayOutputs.push(delayOutput);
    this.channelDelayDryGains.push(delayDryGain);
    this.channelDelayWetGains.push(delayWetGain);
    this.channelDelayNodes.push(delayNode);
    this.channelDelayFeedbackGains.push(delayFeedbackGain);
    this.channelDelayToneFilters.push(delayToneFilter);

    this.channelReverbSends.push(reverbSend);
    this.channelAnalysers.push(analyser);
    this.channelAnalysersLeft.push(analyserLeft);
    this.channelAnalysersRight.push(analyserRight);
  }

  public getChannelLevels(): number[] {
    const levels = [0, 0, 0, 0];
    if (!this.ctx) return levels;

    for (let i = 0; i < this.channelAnalysers.length; i++) {
      const analyser = this.channelAnalysers[i];
      if (!analyser) continue;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate Root Mean Square (RMS) amplitude
      let sum = 0;
      for (let j = 0; j < bufferLength; j++) {
        sum += dataArray[j] * dataArray[j];
      }
      const rms = Math.sqrt(sum / bufferLength);
      
      // Map to a 0.0 - 1.0 range with scaling factor (rms is typically < 0.5, so 4.5 is a good boost)
      levels[i] = Math.min(1.0, rms * 4.5);
    }

    return levels;
  }

  public getStereoLevels(): { channels: [number, number][]; master: [number, number] } {
    const res = {
      channels: [] as [number, number][],
      master: [-100, -100] as [number, number]
    };
    
    if (!this.ctx) {
      res.channels = [[-100, -100], [-100, -100], [-100, -100], [-100, -100]];
      return res;
    }

    // Measure channels
    for (let i = 0; i < 4; i++) {
      const leftAna = this.channelAnalysersLeft[i];
      const rightAna = this.channelAnalysersRight[i];
      if (!leftAna || !rightAna) {
        res.channels.push([-100, -100]);
        continue;
      }

      const leftData = new Float32Array(leftAna.frequencyBinCount);
      leftAna.getFloatTimeDomainData(leftData);
      let leftMax = 0;
      for (let j = 0; j < leftData.length; j++) {
        const abs = Math.abs(leftData[j]);
        if (abs > leftMax) leftMax = abs;
      }

      const rightData = new Float32Array(rightAna.frequencyBinCount);
      rightAna.getFloatTimeDomainData(rightData);
      let rightMax = 0;
      for (let j = 0; j < rightData.length; j++) {
        const abs = Math.abs(rightData[j]);
        if (abs > rightMax) rightMax = abs;
      }

      // Convert peak amplitude to dB
      const leftDb = leftMax > 0.0001 ? 20 * Math.log10(leftMax) : -100;
      const rightDb = rightMax > 0.0001 ? 20 * Math.log10(rightMax) : -100;

      res.channels.push([leftDb, rightDb]);
    }

    // Measure master
    if (this.masterAnalyserLeft && this.masterAnalyserRight) {
      const leftData = new Float32Array(this.masterAnalyserLeft.frequencyBinCount);
      this.masterAnalyserLeft.getFloatTimeDomainData(leftData);
      let leftMax = 0;
      for (let j = 0; j < leftData.length; j++) {
        const abs = Math.abs(leftData[j]);
        if (abs > leftMax) leftMax = abs;
      }

      const rightData = new Float32Array(this.masterAnalyserRight.frequencyBinCount);
      this.masterAnalyserRight.getFloatTimeDomainData(rightData);
      let rightMax = 0;
      for (let j = 0; j < rightData.length; j++) {
        const abs = Math.abs(rightData[j]);
        if (abs > rightMax) rightMax = abs;
      }

      const leftDb = leftMax > 0.0001 ? 20 * Math.log10(leftMax) : -100;
      const rightDb = rightMax > 0.0001 ? 20 * Math.log10(rightMax) : -100;

      res.master = [leftDb, rightDb];
    }

    return res;
  }

  public getChannelFrequencyData(channelIndex: number): Uint8Array {
    const data = new Uint8Array(32);
    if (!this.ctx || !this.channelAnalysers[channelIndex]) return data;
    
    const analyser = this.channelAnalysers[channelIndex];
    const linearData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(linearData);
    
    const sampleRate = this.ctx.sampleRate || 48000;
    const numBands = 32;
    const fMin = 20;
    const fMax = 20000;
    
    for (let i = 0; i < numBands; i++) {
      // Logarithmic center frequency boundaries for this band
      const fLow = fMin * Math.pow(fMax / fMin, (i - 0.5) / (numBands - 1));
      const fHigh = fMin * Math.pow(fMax / fMin, (i + 0.5) / (numBands - 1));
      
      // Exclude bin 0 (DC offset) to avoid continuous low-end hum/offset readings
      const binStart = Math.max(1, Math.floor(fLow * analyser.fftSize / sampleRate));
      const binEnd = Math.max(1, Math.ceil(fHigh * analyser.fftSize / sampleRate));
      
      let maxVal = 0;
      for (let k = binStart; k <= binEnd; k++) {
        if (linearData[k] > maxVal) {
          maxVal = linearData[k];
        }
      }
      
      if (binStart > binEnd || maxVal === 0) {
        const fCenter = fMin * Math.pow(fMax / fMin, i / (numBands - 1));
        const binCenter = Math.max(1, Math.min(linearData.length - 1, Math.round(fCenter * analyser.fftSize / sampleRate)));
        maxVal = linearData[binCenter];
      }
      
      // Subtract a small noise floor to prevent residual rumble/system noise from lighting up bands
      let noiseFloor = 22;
      if (i < 6) {
        noiseFloor = 48; // Higher noise floor for bass to filter out ghost resonance & side-lobe leak
      }
      let val = Math.max(0, maxVal - noiseFloor);
      
      // Gentle music-friendly roll-off for extreme low-end rumble (high-pass filter emulation)
      let rollOff = 1.0;
      if (i === 0) rollOff = 0.05;
      else if (i === 1) rollOff = 0.12;
      else if (i === 2) rollOff = 0.25;
      else if (i === 3) rollOff = 0.45;
      else if (i === 4) rollOff = 0.70;
      else if (i === 5) rollOff = 0.90;
      
      val = Math.round(val * rollOff);
      
      // Visual weight booster for high frequencies
      if (i > 16) {
        const boost = 1 + (i - 16) * 0.05;
        val = Math.round(val * boost);
      }
      
      data[i] = Math.min(255, val);
    }
    
    return data;
  }

  public updateChannel(i: number, state: ChannelState) {
    if (!this.ctx) return;

    // Volume (incorporate Solo and Mute logic dynamically from UI)
    const isMuted = state.mute;
    this.channelGains[i].gain.setValueAtTime(isMuted ? 0 : state.volume, this.ctx.currentTime);

    // Panner
    this.channelPanners[i].pan.setValueAtTime(state.pan, this.ctx.currentTime);

    // Filter
    const filter = this.channelFilters[i];
    const isFilterBypassed = state.filterBypass ?? false;
    if (isFilterBypassed) {
      if (filter.type !== 'allpass') {
        filter.type = 'allpass';
      }
    } else {
      if (filter.type !== state.filterType) {
        filter.type = state.filterType;
      }
      filter.frequency.setValueAtTime(state.filterCutoff, this.ctx.currentTime);
      filter.Q.setValueAtTime(state.filterResonance, this.ctx.currentTime);
    }

    // 7-Band EQs
    const eqFilters = this.channelEQs[i];
    const defaultBands = [
      { gain: state.eqLow ?? 0, frequency: 80, q: 0.7 },
      { gain: 0, frequency: 150, q: 1.0 },
      { gain: 0, frequency: 400, q: 1.0 },
      { gain: state.eqMid ?? 0, frequency: 1000, q: 1.0 },
      { gain: 0, frequency: 2500, q: 1.0 },
      { gain: 0, frequency: 4300, q: 1.0 },
      { gain: state.eqHigh ?? 0, frequency: 12000, q: 0.7 }
    ];
    const bandsState = state.eqBands && state.eqBands.length === 7 ? state.eqBands : defaultBands;
    const isBypassed = state.eqBypass ?? false;

    for (let b = 0; b < 7; b++) {
      if (eqFilters[b] && bandsState[b]) {
        const bs = bandsState[b];
        const activeGain = isBypassed ? 0 : bs.gain;
        eqFilters[b].gain.setValueAtTime(activeGain, this.ctx.currentTime);
        eqFilters[b].frequency.setValueAtTime(bs.frequency, this.ctx.currentTime);
        eqFilters[b].Q.setValueAtTime(bs.q, this.ctx.currentTime);
      }
    }

    // Reverb Send
    this.lastChannelStates[i] = state;
    const isReverbBypassed = this.isReverbBypassed || (state.reverbBypass ?? false);
    if (this.channelReverbSends[i]) {
      this.channelReverbSends[i].gain.setValueAtTime(isReverbBypassed ? 0 : state.reverbSend, this.ctx.currentTime);
    }

    // --- CHORUS LAYER-SPECIFIC SYNC ---
    const isChorusBypassed = state.chorusBypass ?? true;
    const chorusRateVal = state.chorusRate ?? 1.5;
    const chorusDepthVal = state.chorusDepth ?? 0.3;
    const chorusMixVal = state.chorusMix ?? 0.45;

    const channelChorusDryGain = this.channelChorusDryGains[i];
    const channelChorusWetGain = this.channelChorusWetGains[i];
    const channelChorusLFOGain = this.channelChorusLFOGains[i];

    if (channelChorusDryGain && channelChorusWetGain && channelChorusLFOGain) {
      if (isChorusBypassed) {
        channelChorusDryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        channelChorusWetGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
        channelChorusLFOGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      } else {
        // Equal loudness dry/wet mix
        channelChorusDryGain.gain.setValueAtTime(1.0 - chorusMixVal * 0.5, this.ctx.currentTime);
        channelChorusWetGain.gain.setValueAtTime(chorusMixVal * 0.8, this.ctx.currentTime);
        // Map LFO depth to delay modulation (up to ~4ms shift)
        channelChorusLFOGain.gain.setValueAtTime(0.003 * chorusDepthVal, this.ctx.currentTime);
      }
    }

    // Update chorus LFO
    if (!isChorusBypassed) {
      this.startChannelChorusLFO(i, chorusRateVal);
    } else {
      try {
        if (this.channelChorusLFOs[i]) {
          this.channelChorusLFOs[i]?.stop();
          this.channelChorusLFOs[i] = null;
        }
      } catch (e) {}
    }

    // --- TREMOLO LAYER-SPECIFIC SYNC ---
    const isTremoloBypassed = state.tremoloBypass ?? true;
    const tremoloRateVal = state.tremoloRate ?? 5.0;
    const tremoloDepthVal = state.tremoloDepth ?? 0.5;
    const tremoloModeVal = state.tremoloMode ?? 'volume';

    const channelTremoloGainNode = this.channelTremoloGainNodes[i];
    const channelTremoloPannerNode = this.channelTremoloPannerNodes[i];
    const channelTremoloLFOGain = this.channelTremoloLFOGains[i];

    if (channelTremoloGainNode && channelTremoloPannerNode && channelTremoloLFOGain) {
      if (isTremoloBypassed) {
        channelTremoloGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
        channelTremoloPannerNode.pan.setValueAtTime(0.0, this.ctx.currentTime);
        channelTremoloLFOGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      } else {
        if (tremoloModeVal === 'pan') {
          // Auto-Pan: reset gain, oscillate pan between -depth and +depth
          channelTremoloGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
          channelTremoloLFOGain.gain.setValueAtTime(tremoloDepthVal, this.ctx.currentTime);
        } else {
          // Volume Tremolo: reset pan, oscillate gain with depth/2
          channelTremoloPannerNode.pan.setValueAtTime(0.0, this.ctx.currentTime);
          channelTremoloGainNode.gain.setValueAtTime(1.0 - tremoloDepthVal / 2, this.ctx.currentTime);
          channelTremoloLFOGain.gain.setValueAtTime(tremoloDepthVal / 2, this.ctx.currentTime);
        }
      }
    }

    // Update tremolo LFO
    if (!isTremoloBypassed) {
      this.startChannelTremoloLFO(i, tremoloRateVal, tremoloModeVal);
    } else {
      try {
        if (this.channelTremoloLFOs[i]) {
          this.channelTremoloLFOs[i]?.stop();
          this.channelTremoloLFOs[i] = null;
        }
      } catch (e) {}
    }

    // --- DELAY / ECHO LAYER-SPECIFIC SYNC ---
    const isDelayBypassed = state.delayBypass ?? true;
    const delayTimeVal = state.delayTime ?? 0.3;
    const delayFeedbackVal = state.delayFeedback ?? 3;
    const delayMixVal = state.delayMix ?? 0.35;
    const delayHighCutVal = state.delayHighCut ?? 6000;

    const dDry = this.channelDelayDryGains[i];
    const dWet = this.channelDelayWetGains[i];
    const dNode = this.channelDelayNodes[i];
    const dFeedback = this.channelDelayFeedbackGains[i];
    const dFilter = this.channelDelayToneFilters[i];

    if (dDry && dWet && dNode && dFeedback && dFilter) {
      if (isDelayBypassed) {
        dDry.gain.setValueAtTime(1.0, this.ctx.currentTime);
        dWet.gain.setValueAtTime(0.0, this.ctx.currentTime);
        dFeedback.gain.setValueAtTime(0.0, this.ctx.currentTime);
      } else {
        dDry.gain.setValueAtTime(1.0, this.ctx.currentTime);

        let actualWetGain = delayMixVal;
        let actualFeedbackGain = 0.0;

        if (delayFeedbackVal <= 0) {
          // 0 repetições -> eco mudo / desativado
          actualWetGain = 0.0;
          actualFeedbackGain = 0.0;
        } else if (delayFeedbackVal === 1) {
          // 1 repetição -> toca o sinal com eco 1x sem feedback
          actualWetGain = delayMixVal;
          actualFeedbackGain = 0.0;
        } else if (delayFeedbackVal > 1) {
          actualWetGain = delayMixVal;
          if (delayFeedbackVal <= 0.95 && !Number.isInteger(delayFeedbackVal)) {
            // Compatibilidade com presets antigos em valor fracionado (0.0 a 0.85)
            actualFeedbackGain = delayFeedbackVal;
          } else {
            // Contagem exata de repetições (2, 3, 4, 5, 6, 8, 10, 12, 16)
            const count = Math.min(20, Math.max(2, delayFeedbackVal));
            actualFeedbackGain = Math.min(0.88, Math.pow(0.04, 1 / count));
          }
        }

        dWet.gain.setValueAtTime(Math.min(1.0, Math.max(0, actualWetGain)), this.ctx.currentTime);
        dNode.delayTime.setValueAtTime(Math.min(2.0, Math.max(0.02, delayTimeVal)), this.ctx.currentTime);
        dFeedback.gain.setValueAtTime(Math.min(0.9, Math.max(0, actualFeedbackGain)), this.ctx.currentTime);
        dFilter.frequency.setValueAtTime(Math.min(20000, Math.max(500, delayHighCutVal)), this.ctx.currentTime);
      }
    }
  }

  public updateGlobalReverb(decay: number, mix: number, preDelay?: number, highCut?: number, isBypassed: boolean = false) {
    this.isReverbBypassed = isBypassed;
    this.reverbDecay = decay;
    this.reverbMix = mix;
    if (preDelay !== undefined) this.reverbPreDelay = preDelay;
    if (highCut !== undefined) this.reverbHighCut = highCut;

    if (!this.ctx) return;

    // Perceptual boost scaling for wet gain to give rich, audible reverb presence
    const boostedWet = isBypassed ? 0.0 : Math.min(2.5, mix * 2.2);
    if (this.reverbWetGain) {
      this.reverbWetGain.gain.setValueAtTime(boostedWet, this.ctx.currentTime);
    }
    if (this.reverbDryGain) {
      this.reverbDryGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    if (preDelay !== undefined && this.reverbDelayNode) {
      this.reverbDelayNode.delayTime.setValueAtTime(preDelay, this.ctx.currentTime);
    }
    if (highCut !== undefined && this.reverbToneFilter) {
      this.reverbToneFilter.frequency.setValueAtTime(highCut, this.ctx.currentTime);
    }

    // Update sends for all 4 channels dynamically
    for (let i = 0; i < 4; i++) {
      if (this.channelReverbSends[i]) {
        const stateSend = this.lastChannelStates[i]?.reverbSend ?? 0.2;
        const effectiveSend = isBypassed ? 0 : stateSend;
        this.channelReverbSends[i].gain.setValueAtTime(effectiveSend, this.ctx.currentTime);
      }
    }

    this.updateReverbImpulse();
  }

  private startChannelChorusLFO(i: number, rate: number) {
    if (!this.ctx) return;
    try {
      if (this.channelChorusLFOs[i]) {
        this.channelChorusLFOs[i]?.stop();
        this.channelChorusLFOs[i]?.disconnect();
      }
    } catch (e) {}

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rate, this.ctx.currentTime);

    const delayNode = this.channelChorusDelayNodes[i];
    const lfoGain = this.channelChorusLFOGains[i];

    if (delayNode && lfoGain) {
      lfo.connect(lfoGain);
      lfoGain.disconnect();
      lfoGain.connect(delayNode.delayTime);
      lfo.start();
    }
    this.channelChorusLFOs[i] = lfo;
  }

  private startChannelTremoloLFO(i: number, rate: number, mode: 'volume' | 'pan') {
    if (!this.ctx) return;
    try {
      if (this.channelTremoloLFOs[i]) {
        this.channelTremoloLFOs[i]?.stop();
        this.channelTremoloLFOs[i]?.disconnect();
      }
    } catch (e) {}

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rate, this.ctx.currentTime);

    const lfoGain = this.channelTremoloLFOGains[i];
    const gainNode = this.channelTremoloGainNodes[i];
    const pannerNode = this.channelTremoloPannerNodes[i];

    if (lfoGain) {
      lfo.connect(lfoGain);
      lfoGain.disconnect();
      
      if (mode === 'pan') {
        if (pannerNode) {
          lfoGain.connect(pannerNode.pan);
        }
      } else {
        if (gainNode) {
          lfoGain.connect(gainNode.gain);
        }
      }
      
      lfo.start();
    }
    this.channelTremoloLFOs[i] = lfo;
  }

  private startChorusLFO() {
    if (!this.ctx) return;
    try {
      if (this.chorusLFO) {
        this.chorusLFO.stop();
        this.chorusLFO.disconnect();
      }
    } catch (e) {}

    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFO.type = 'sine';
    this.chorusLFO.frequency.value = this.chorusRate;
    
    this.chorusLFO.connect(this.chorusLFOGain!);
    this.chorusLFOGain!.disconnect();
    this.chorusLFOGain!.connect(this.chorusDelayNode!.delayTime);
    
    this.chorusLFO.start();
  }

  private startTremoloLFO() {
    if (!this.ctx) return;
    try {
      if (this.tremoloLFO) {
        this.tremoloLFO.stop();
        this.tremoloLFO.disconnect();
      }
    } catch (e) {}

    this.tremoloLFO = this.ctx.createOscillator();
    this.tremoloLFO.type = 'sine';
    this.tremoloLFO.frequency.value = this.tremoloRate;

    this.tremoloLFO.connect(this.tremoloLFOGain!);
    this.tremoloLFOGain!.disconnect();
    
    if (this.tremoloMode === 'pan') {
      if (this.tremoloPannerNode) {
        this.tremoloLFOGain!.connect(this.tremoloPannerNode.pan);
      }
    } else {
      if (this.tremoloGainNode) {
        this.tremoloLFOGain!.connect(this.tremoloGainNode.gain);
      }
    }

    this.tremoloLFO.start();
  }

  public updateGlobalChorus(bypass: boolean, rate: number, depth: number, mix: number) {
    this.chorusBypass = bypass;
    this.chorusRate = rate;
    this.chorusDepth = depth;
    this.chorusMix = mix;

    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (bypass) {
      if (this.chorusWetGain) this.chorusWetGain.gain.setValueAtTime(0, now);
      if (this.chorusDryGain) this.chorusDryGain.gain.setValueAtTime(1.0, now);
      if (this.chorusLFOGain) this.chorusLFOGain.gain.setValueAtTime(0, now);
    } else {
      if (this.chorusWetGain) this.chorusWetGain.gain.setValueAtTime(mix, now);
      if (this.chorusDryGain) this.chorusDryGain.gain.setValueAtTime(1.0, now);
      if (this.chorusLFOGain) this.chorusLFOGain.gain.setValueAtTime(depth * 0.005, now);
      
      // Ensure LFO is running
      if (!this.chorusLFO) {
        this.startChorusLFO();
      } else {
        this.chorusLFO.frequency.setValueAtTime(rate, now);
      }
    }
  }

  public updateGlobalTremolo(bypass: boolean, rate: number, depth: number, mode?: 'volume' | 'pan') {
    this.tremoloBypass = bypass;
    this.tremoloRate = rate;
    this.tremoloDepth = depth;
    if (mode) {
      this.tremoloMode = mode;
    }

    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (this.tremoloLFOGain) {
      this.tremoloLFOGain.disconnect();
    }

    if (bypass) {
      if (this.tremoloGainNode) this.tremoloGainNode.gain.setValueAtTime(1.0, now);
      if (this.tremoloPannerNode) this.tremoloPannerNode.pan.setValueAtTime(0.0, now);
      if (this.tremoloLFOGain) this.tremoloLFOGain.gain.setValueAtTime(0, now);
    } else {
      if (this.tremoloMode === 'pan') {
        if (this.tremoloGainNode) this.tremoloGainNode.gain.setValueAtTime(1.0, now);
        if (this.tremoloLFOGain) {
          if (this.tremoloPannerNode) this.tremoloLFOGain.connect(this.tremoloPannerNode.pan);
          this.tremoloLFOGain.gain.setValueAtTime(depth, now);
        }
      } else {
        if (this.tremoloPannerNode) this.tremoloPannerNode.pan.setValueAtTime(0.0, now);
        if (this.tremoloGainNode) this.tremoloGainNode.gain.setValueAtTime(1.0 - depth / 2, now);
        if (this.tremoloLFOGain) {
          if (this.tremoloGainNode) this.tremoloLFOGain.connect(this.tremoloGainNode.gain);
          this.tremoloLFOGain.gain.setValueAtTime(depth / 2, now);
        }
      }

      // Ensure LFO is running
      if (!this.tremoloLFO) {
        this.startTremoloLFO();
      } else {
        this.tremoloLFO.frequency.setValueAtTime(rate, now);
      }
    }
  }

  private updateReverbImpulse() {
    if (!this.ctx || !this.reverbNode) return;

    const sampleRate = this.ctx.sampleRate;
    const decayTime = Math.max(0.15, Math.min(10.0, this.reverbDecay));
    const length = Math.max(2048, Math.round(sampleRate * decayTime));
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    // 1. Multi-Tap Early Reflections (16 Taps with Stereo Spreading and Phase Inversion)
    const erTimesMs = [
      4.2, 8.7, 13.5, 19.1, 25.4, 32.8, 41.2, 50.6,
      61.1, 72.5, 85.0, 98.6, 113.3, 129.1, 146.0, 164.2
    ];
    const erCount = erTimesMs.length;

    for (let k = 0; k < erCount; k++) {
      const timeMs = erTimesMs[k];
      const sampleIdx = Math.round((timeMs / 1000) * sampleRate);
      if (sampleIdx < length) {
        // Exponential energy decay of early reflections
        const erGain = Math.exp(-timeMs / 45.0) * 0.60;
        const pan = (k % 2 === 0 ? 0.75 : -0.75) * (1 - k / erCount);
        const polarity = (k % 3 === 0) ? -1 : 1;

        const leftGain = erGain * (0.5 * (1 - pan)) * polarity;
        const rightGain = erGain * (0.5 * (1 + pan)) * polarity;

        for (let offset = -1; offset <= 1; offset++) {
          const idx = sampleIdx + offset;
          if (idx >= 0 && idx < length) {
            const w = offset === 0 ? 1.0 : 0.5;
            left[idx] += leftGain * w;
            right[idx] += rightGain * w;
          }
        }
      }
    }

    // 2. Schroeder Allpass Diffuser Stages with Smooth Dual-Pole Air Absorption & Velvet Noise
    // Prime delay lengths in samples at current sample rate for maximum acoustic diffusion
    const apDelaysL = [
      Math.round(sampleRate * 0.0047), // ~4.7ms
      Math.round(sampleRate * 0.0113), // ~11.3ms
      Math.round(sampleRate * 0.0239), // ~23.9ms
      Math.round(sampleRate * 0.0383), // ~38.3ms
    ];
    const apDelaysR = [
      Math.round(sampleRate * 0.0053), // ~5.3ms
      Math.round(sampleRate * 0.0127), // ~12.7ms
      Math.round(sampleRate * 0.0251), // ~25.1ms
      Math.round(sampleRate * 0.0409), // ~40.9ms
    ];

    const apG = 0.62; // Optimal Lexicon diffusion coefficient
    const apBufsL = apDelaysL.map(d => new Float32Array(Math.max(1, d)));
    const apBufsR = apDelaysR.map(d => new Float32Array(Math.max(1, d)));
    const apPointersL = [0, 0, 0, 0];
    const apPointersR = [0, 0, 0, 0];

    // Target RT60 decay (-60dB at decay length)
    const decayFactor = -6.9078 / length;
    let lpL1 = 0, lpL2 = 0;
    let lpR1 = 0, lpR2 = 0;

    // Window fade-out parameters for smooth buffer end
    const fadeLen = Math.round(sampleRate * 0.05); // 50ms smooth cosine tail fade
    const fadeStart = length - fadeLen;

    for (let i = 0; i < length; i++) {
      const progress = i / length; // 0.0 to 1.0

      // Smooth 12ms attack onset to prevent transient harshness
      const onset = 1 - Math.exp(-i / (sampleRate * 0.012));
      let env = onset * Math.exp(decayFactor * i);

      // Cosine windowing at end of buffer to guarantee zero tail pops/clicks
      if (i >= fadeStart) {
        const fadeProgress = (i - fadeStart) / fadeLen;
        env *= 0.5 * (1 + Math.cos(Math.PI * fadeProgress));
      }

      // High-density velvet/Gaussian noise scattering
      const noiseL = (Math.random() - Math.random()) * env * 0.45;
      const noiseR = (Math.random() - Math.random()) * env * 0.45;

      let inputL = noiseL;
      let inputR = noiseR;

      // Cascade through 4 Allpass Diffusers for Left Channel
      for (let stage = 0; stage < 4; stage++) {
        const d = apDelaysL[stage];
        if (d <= 0) continue;
        const buf = apBufsL[stage];
        const ptr = apPointersL[stage];
        const bufOut = buf[ptr];
        const v = inputL - apG * bufOut;
        buf[ptr] = v;
        inputL = bufOut + apG * v;
        apPointersL[stage] = (ptr + 1) % d;
      }

      // Cascade through 4 Allpass Diffusers for Right Channel
      for (let stage = 0; stage < 4; stage++) {
        const d = apDelaysR[stage];
        if (d <= 0) continue;
        const buf = apBufsR[stage];
        const ptr = apPointersR[stage];
        const bufOut = buf[ptr];
        const v = inputR - apG * bufOut;
        buf[ptr] = v;
        inputR = bufOut + apG * v;
        apPointersR[stage] = (ptr + 1) % d;
      }

      // Smooth 2-pole progressive air damping filter (natural high-frequency energy decay)
      const dampAlpha = Math.max(0.03, 0.55 * Math.pow(1 - progress, 1.8));
      lpL1 += dampAlpha * (inputL - lpL1);
      lpL2 += dampAlpha * (lpL1 - lpL2);

      lpR1 += dampAlpha * (inputR - lpR1);
      lpR2 += dampAlpha * (lpR1 - lpR2);

      // Add diffuse tail to impulse channel buffers
      left[i] += lpL2;
      right[i] += lpR2;
    }

    // 3. Peak Normalization to 0.90 for maximum clean signal-to-noise ratio
    let maxPeak = 0;
    for (let i = 0; i < length; i++) {
      const absL = Math.abs(left[i]);
      const absR = Math.abs(right[i]);
      if (absL > maxPeak) maxPeak = absL;
      if (absR > maxPeak) maxPeak = absR;
    }

    if (maxPeak > 0.0001) {
      const normFactor = 0.90 / maxPeak;
      for (let i = 0; i < length; i++) {
        left[i] *= normFactor;
        right[i] *= normFactor;
      }
    }

    try {
      this.reverbNode.buffer = impulse;
    } catch (e) {
      const newReverbNode = this.ctx.createConvolver();
      newReverbNode.buffer = impulse;

      // Disconnect old
      try { this.reverbNode.disconnect(); } catch (err) {}

      // Reconnect new node: newReverbNode -> reverbHighPassFilter (or tone filter)
      const nextNode = this.reverbHighPassFilter || this.reverbToneFilter!;
      newReverbNode.connect(nextNode);

      for (const send of this.channelReverbSends) {
        try { send.disconnect(this.reverbNode); } catch(err) {}
        send.connect(newReverbNode);
      }

      this.reverbNode = newReverbNode;
    }
  }

  private linkSoundFontStructure(sf: ParsedSoundFont) {
    // Automatically link preset and instrument zones to their actual object references
    if (sf.instruments && sf.sampleHeaders) {
      for (const inst of sf.instruments) {
        if (inst && inst.zones) {
          for (const zone of inst.zones) {
            if (zone.sampleHeaderIndex !== null && zone.sampleHeaderIndex !== undefined) {
              if (zone.sampleHeaderIndex >= 0 && zone.sampleHeaderIndex < sf.sampleHeaders.length) {
                zone.sampleHeader = sf.sampleHeaders[zone.sampleHeaderIndex];
              }
            }
          }
        }
      }
    }
    if (sf.presets && sf.instruments) {
      for (const preset of sf.presets) {
        if (preset && preset.zones) {
          for (const zone of preset.zones) {
            if (zone.instrumentIndex !== null && zone.instrumentIndex !== undefined) {
              if (zone.instrumentIndex >= 0 && zone.instrumentIndex < sf.instruments.length) {
                zone.instrument = sf.instruments[zone.instrumentIndex];
              }
            }
          }
        }
      }
    }
  }

  public setSoundFont(sf: ParsedSoundFont) {
    this.soundFont = sf;
    this.soundFonts = [sf];
    this.linkSoundFontStructure(sf);
  }

  public addSoundFont(sf: ParsedSoundFont) {
    this.linkSoundFontStructure(sf);
    this.soundFonts.push(sf);
    if (!this.soundFont) {
      this.soundFont = sf;
    }
  }

  public removeSoundFont(index: number) {
    if (index >= 0 && index < this.soundFonts.length) {
      this.soundFonts.splice(index, 1);
      this.soundFont = this.soundFonts[0] || null;
    }
  }

  public clearSoundFonts() {
    this.soundFonts = [];
    this.soundFont = null;
  }

  /**
   * Keep only the active channels' and active bank's SoundFonts decoded in RAM.
   * This is a massive memory optimization that prevents "Array buffer allocation failed" crashes
   * when the user has dozens of SoundFonts in their library, while ensuring near-instantaneous
   * preset switching within the active Live Set bank.
   */

  public isDecoding = false;

  private decodeSampleHeader(sh: SF2SampleHeader, sf: ParsedSoundFont) {
    if (!this.ctx || sh.audioBuffer) return;

    if (sh._origStart === undefined) {
      sh._origStart = sh.start;
      sh._origEnd = sh.end;
      sh._origStartLoop = sh.startLoop;
      sh._origEndLoop = sh.endLoop;
      sh._origSampleRate = sh.sampleRate;
    }

    const origStart = sh._origStart;
    const origEnd = sh._origEnd;
    const origStartLoop = sh._origStartLoop;
    const origEndLoop = sh._origEndLoop;
    const origSampleRate = sh._origSampleRate;

    const length = Math.max(1, origEnd - origStart);

    // CRITICAL MEMORY OPTIMIZATION:
    // Web Audio API supports playing back buffers of any standard sample rate (8000Hz to 96000Hz).
    // Instead of always upsampling low-rate samples to 44100Hz or 48000Hz in JavaScript,
    // which inflates memory usage by up to 6x and can trigger "createBuffer failed" errors,
    // we should preserve the original sample rate and let the Web Audio hardware-accelerated
    // engine resample on-the-fly during playback.
    // We only clamp/resample if the original sample rate is outside the Web Audio supported bounds (8000 - 96000).
    let targetSampleRate = origSampleRate || 44100;
    if (targetSampleRate < 8000) {
      targetSampleRate = 8000;
    } else if (targetSampleRate > 96000) {
      targetSampleRate = 96000;
    }

    let finalData: Float32Array;
    let finalLength: number;

    if (origSampleRate !== targetSampleRate) {
      const ratio = origSampleRate / targetSampleRate;
      finalLength = Math.max(1, Math.round(length / ratio));
      try {
        finalData = new Float32Array(finalLength);
      } catch (e) {
        console.error(`[SynthEngine] Out of memory allocating Float32Array of length ${finalLength} for sample ${sh.name}.`);
        return;
      }

      for (let i = 0; i < finalLength; i++) {
        const srcIdx = i * ratio;
        const idx1 = Math.floor(srcIdx);
        const idx2 = Math.min(length - 1, idx1 + 1);
        const frac = srcIdx - idx1;

        const v1 = (sf.sampleData[origStart + idx1] ?? 0) / 32768.0;
        const v2 = (sf.sampleData[origStart + idx2] ?? 0) / 32768.0;

        finalData[i] = v1 + frac * (v2 - v1);
      }

      sh.startLoop = Math.round((origStartLoop - origStart) / ratio);
      sh.endLoop = Math.round((origEndLoop - origStart) / ratio);
      sh.start = 0;
      sh.end = finalLength;
      sh.sampleRate = targetSampleRate;
    } else {
      finalLength = length;
      try {
        finalData = new Float32Array(length);
      } catch (e) {
        console.error(`[SynthEngine] Out of memory allocating Float32Array of length ${length} for sample ${sh.name}.`);
        return;
      }
      for (let i = 0; i < length; i++) {
        const sampleVal = sf.sampleData[origStart + i];
        finalData[i] = sampleVal !== undefined ? sampleVal / 32768.0 : 0;
      }
      sh.startLoop = origStartLoop;
      sh.endLoop = origEndLoop;
      sh.start = origStart;
      sh.end = origEnd;
      sh.sampleRate = targetSampleRate;
    }

    if (finalLength > 0 && this.ctx && this.ctx.state !== 'closed') {
      try {
        const buffer = this.ctx.createBuffer(1, finalLength, targetSampleRate);
        buffer.copyToChannel(finalData, 0);
        sh.audioBuffer = buffer;
      } catch (err) {
        // Handle AudioBuffer allocation limit or context closed gracefully without crashing
      }
    }
  }

  private decodeSoundFont(sf: ParsedSoundFont) {
    if (this.ctx) {
      for (const sh of sf.sampleHeaders) {
        this.decodeSampleHeader(sh, sf);
      }
    }
  }

  public async decodeSoundFontAsync(sf: ParsedSoundFont, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.ctx) return;
    const headers = sf.sampleHeaders || [];
    const total = headers.length;
    if (total === 0) return;

    const chunkSize = 15;
    for (let i = 0; i < total; i += chunkSize) {
      const end = Math.min(total, i + chunkSize);
      for (let j = i; j < end; j++) {
        const sh = headers[j];
        if (!sh) continue;
        this.decodeSampleHeader(sh, sf);
      }

      if (onProgress) {
        onProgress(Math.min(100, Math.round((end / total) * 100)));
      }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  private getPresetSampleHeaders(sf: ParsedSoundFont, presetIndex: number): SF2SampleHeader[] {
    const headers: SF2SampleHeader[] = [];
    if (!sf.presets || !Array.isArray(sf.presets)) return headers;
    const preset = sf.presets[presetIndex];
    if (!preset || !preset.zones || !Array.isArray(preset.zones)) return headers;

    const seen = new Set<any>();

    for (const pZone of preset.zones) {
      if (!pZone) continue;
      const inst = pZone.instrument;
      if (!inst || !inst.zones || !Array.isArray(inst.zones)) continue;

      for (const iZone of inst.zones) {
        if (!iZone) continue;
        const sh = iZone.sampleHeader;
        if (sh && !seen.has(sh)) {
          seen.add(sh);
          headers.push(sh);
        }
      }
    }
    return headers;
  }

  public async updateDecodedSoundFonts(
    channels: ChannelState[], 
    bankSlots: any[] | null,
    loadedSoundFonts: any[],
    onProgress?: (sfName: string, progress: number, currentIdx: number, totalCount: number) => void,
    auditioningSoundFont?: any
  ): Promise<boolean> {
    if (!this.ctx) return false;

    // 1. Maintain alignment of this.soundFonts with loadedSoundFonts list
    if (this.soundFonts.length !== loadedSoundFonts.length) {
      const nextSoundFonts: (ParsedSoundFont | null)[] = [];
      for (let i = 0; i < loadedSoundFonts.length; i++) {
        const asset = loadedSoundFonts[i];
        const existing = this.soundFonts.find(sf => sf && sf.id === asset.id);
        nextSoundFonts.push(existing || null);
      }
      this.soundFonts = nextSoundFonts as ParsedSoundFont[];
    }

    // 2. Identify which SoundFonts (IDs) are needed by active channels or slots
    const activePresetsBySoundFontId = new Map<string, Set<number>>();
    const neededIds = new Set<string>();

    const registerNeededPreset = (sfId: string | undefined, sfIndex: number, presetIndex: number, sfName?: string) => {
      const pIdx = presetIndex ?? 0;
      let targetId = sfId;
      if (!targetId && loadedSoundFonts[sfIndex]) {
        targetId = loadedSoundFonts[sfIndex].id;
      }
      if (!targetId && sfName) {
        const found = loadedSoundFonts.find(sf => sf && (sf.name === sfName || sf.name.toLowerCase() === sfName.toLowerCase()));
        if (found) targetId = found.id;
      }
      if (targetId) {
        neededIds.add(targetId);
        if (!activePresetsBySoundFontId.has(targetId)) {
          activePresetsBySoundFontId.set(targetId, new Set());
        }
        activePresetsBySoundFontId.get(targetId)!.add(pIdx);
      }
    };

    for (const channel of channels) {
      if (!channel) continue;
      registerNeededPreset(channel.soundfontId, channel.soundfontIndex ?? 0, channel.presetIndex ?? 0, channel.soundfontName);
    }

    if (auditioningSoundFont) {
      registerNeededPreset(
        auditioningSoundFont.soundfontId,
        auditioningSoundFont.soundfontIndex ?? 0,
        0,
        auditioningSoundFont.soundfontName
      );
    }

    if (bankSlots) {
      for (const slot of bankSlots) {
        if (slot && Array.isArray(slot.channelsData)) {
          for (const channel of slot.channelsData) {
            if (!channel) continue;
            registerNeededPreset(channel.soundfontId, channel.soundfontIndex ?? 0, channel.presetIndex ?? 0, channel.soundfontName);
          }
        }
      }
    }

    if (loadedSoundFonts.length > 0) {
      // Always register default soundfont (index 0)
      registerNeededPreset(undefined, 0, 0);
    }

    // 3. Keep parsed SoundFonts cached in RAM to avoid loading/parsing twice.
    // Unused decoded Web Audio AudioBuffers are still freed in step 5 to keep RAM usage low.

    // 4. Load required but unloaded SoundFonts on-demand from IndexedDB!
    for (const id of neededIds) {
      let idx = loadedSoundFonts.findIndex(sf => sf && sf.id === id);
      if (idx === -1) {
        idx = loadedSoundFonts.findIndex(sf => sf && (sf.name === id || sf.name.toLowerCase() === id.toLowerCase()));
      }
      if (idx !== -1 && !this.soundFonts[idx]) {
        const asset = loadedSoundFonts[idx];
        const realId = asset.id;
        if (onProgress) {
          onProgress(asset.name, 0, 0, 1);
        }
        console.log(`[SynthEngine] Loading SoundFont on-demand: ${asset.name}`);
        try {
          const data = await loadSoundFontData(realId);
          if (data) {
            const parser = new SF2Parser(data);
            const parsed = parser.parse();
            parsed.id = realId;
            parsed.name = asset.name;
            
            this.soundFonts[idx] = parsed;
            this.linkSoundFontStructure(parsed);
          }
        } catch (err) {
          console.error(`[SynthEngine] Failed to load/parse SoundFont ${asset.name}:`, err);
        }
      }
    }

    // 5. MEMORY REVOLUTION OPTIMIZATION (Like a real hardware keyboard):
    // Do NOT upfront decode any sample headers into Web Audio AudioBuffers.
    // Pre-decoding hundreds/thousands of velocity-layered samples (e.g. CFX Premium Grand Piano)
    // freezes the main thread, blocks memory, and triggers "Failed to execute 'createBuffer'" crashes.
    // Instead, we clear/free any Web Audio AudioBuffers that belong to INACTIVE SoundFonts or INACTIVE presets.
    // The active preset's samples will be decoded on-demand in real-time within noteOn() on the first keypress.
    // This makes preset switching instantaneous (0ms) and uses extremely low RAM.
    for (let i = 0; i < this.soundFonts.length; i++) {
      const sf = this.soundFonts[i];
      if (!sf) continue;

      const isNeededSoundFont = (sf.id && activePresetsBySoundFontId.has(sf.id)) ||
        (sf.name && activePresetsBySoundFontId.has(sf.name));

      if (isNeededSoundFont) {
        const activePresets = (sf.id && activePresetsBySoundFontId.get(sf.id)) ||
          (sf.name && activePresetsBySoundFontId.get(sf.name)) || new Set<number>();
        const sfNeededHeaders = new Set<SF2SampleHeader>();
        for (const pIdx of activePresets) {
          const headers = this.getPresetSampleHeaders(sf, pIdx);
          for (const sh of headers) {
            sfNeededHeaders.add(sh);
            if (!sh.audioBuffer) {
              this.decodeSampleHeader(sh, sf);
            }
          }
        }

        if (sf.sampleHeaders && Array.isArray(sf.sampleHeaders)) {
          for (const sh of sf.sampleHeaders) {
            if (!sh) continue;
            // Free the decoded buffer if this sample is not needed by the active preset
            if (!sfNeededHeaders.has(sh)) {
              if (sh.audioBuffer) {
                sh.audioBuffer = undefined;
              }
            }
          }
        }
      } else {
        // Free all decoded buffers for completely inactive SoundFonts
        if (sf.sampleHeaders && Array.isArray(sf.sampleHeaders)) {
          for (const sh of sf.sampleHeaders) {
            if (sh && sh.audioBuffer) {
              sh.audioBuffer = undefined;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Note On (Trigger key)
   */
  public noteOn(channelIndex: number, note: number, velocity: number, state: ChannelState) {
    if (!this.ctx) return;
    if (this.isDecoding) return;

    // Check layer routing
    if (state.routingEnabled === false) return;

    // Check MIDI key range limit
    const minKey = state.keyRangeMin ?? 0;
    const maxKey = state.keyRangeMax ?? 127;
    if (note < minKey || note > maxKey) return;

    // Apply octave shift
    const octaveOffset = state.octaveOffset ?? 0;
    const shiftedNote = Math.max(0, Math.min(127, note + octaveOffset * 12));

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (!this.chorusBypass && !this.chorusLFO) this.startChorusLFO();
        if (!this.tremoloBypass && !this.tremoloLFO) this.startTremoloLFO();
      });
    }

    const now = this.ctx.currentTime;
    const voicesKey = `${channelIndex}-${note}`; // Stored under original physical note

    // If note was sustained but key is re-triggered, remove from sustained list
    if (this.sustainedNotes[channelIndex]) {
      this.sustainedNotes[channelIndex].delete(note);
    }

    const envelope = state.adsrBypass ? { attack: 0.002, decay: 0.1, sustain: 100, release: 0.35 } : state.adsr;

    // Stop existing voices for this note to prevent overlaps/stacking
    this.stopNoteInternal(channelIndex, note, envelope);
    const sfGain = state.soundfontGain ?? 1.0;
    const sensitivity = state.midiSensitivity ?? 1.0;
    const adjustedVelocity = Math.max(1, Math.min(127, Math.round(velocity * sensitivity)));
    const maxGain = (adjustedVelocity / 127.0) * 0.35 * sfGain; // Calibrate overall polyphony level with custom SoundFont gain multiplier

    const voices: ActiveVoice[] = [];

    // Check if we can play from SoundFont (No synthesizer fallback)
    const sfIndex = state.soundfontIndex ?? 0;
    let sf = this.soundFonts[sfIndex];
    if (!sf || (state.soundfontId && sf.id !== state.soundfontId && sf.name !== state.soundfontName)) {
      const foundSf = this.soundFonts.find(s => s && (
        (state.soundfontId && s.id === state.soundfontId) ||
        (state.soundfontName && s.name === state.soundfontName) ||
        (state.soundfontName && s.name.toLowerCase() === state.soundfontName.toLowerCase())
      ));
      if (foundSf) sf = foundSf;
    }
    if (!sf && (state.soundfontIndex === undefined || state.soundfontIndex === 0)) {
      sf = this.soundFont;
    }
    if (sf) {
      if (sf.presets && Array.isArray(sf.presets) && state.presetIndex >= 0 && state.presetIndex < sf.presets.length) {
        const preset = sf.presets[state.presetIndex];
        
        if (preset && preset.zones && Array.isArray(preset.zones)) {
          // Find preset zones matching shiftedNote
          const matchingPresetZones = preset.zones.filter(z => 
            z && z.keyRange && typeof z.keyRange.min === 'number' && typeof z.keyRange.max === 'number' &&
            z.keyRange.min <= shiftedNote && shiftedNote <= z.keyRange.max
          );

          for (const pZone of matchingPresetZones) {
            const inst = pZone.instrument;
            if (!inst) continue;

            if (inst.zones && Array.isArray(inst.zones)) {
              // Find instrument zones matching shiftedNote and velocity
              const matchingInstZones = inst.zones.filter(z => 
                z && z.keyRange && typeof z.keyRange.min === 'number' && typeof z.keyRange.max === 'number' &&
                z.velRange && typeof z.velRange.min === 'number' && typeof z.velRange.max === 'number' &&
                z.keyRange.min <= shiftedNote && shiftedNote <= z.keyRange.max &&
                z.velRange.min <= adjustedVelocity && adjustedVelocity <= z.velRange.max
              );

              for (const iZone of matchingInstZones) {
                const sh = iZone.sampleHeader;
                if (!sh) continue;

                if (!sh.audioBuffer) {
                  this.decodeSampleHeader(sh, sf);
                }
                if (!sh.audioBuffer) continue;

                // Compute tuning / pitch calculation
          const coarseTune = pZone.coarseTune + iZone.coarseTune;
          const fineTune = pZone.fineTune + iZone.fineTune + sh.pitchCorrection;
          const pitchOffsetSemitones = coarseTune + (fineTune / 100);

          // SF2 playback pitch formula with overridingRootKey and scaleTuning support
          let originalPitch = sh.originalPitch;
          if (iZone.overridingRootKey !== null && iZone.overridingRootKey !== undefined && iZone.overridingRootKey >= 0 && iZone.overridingRootKey <= 127) {
            originalPitch = iZone.overridingRootKey;
          } else if (pZone.overridingRootKey !== null && pZone.overridingRootKey !== undefined && pZone.overridingRootKey >= 0 && pZone.overridingRootKey <= 127) {
            originalPitch = pZone.overridingRootKey;
          }

          const scale = iZone.scaleTuning !== undefined ? iZone.scaleTuning : (pZone.scaleTuning !== undefined ? pZone.scaleTuning : 100);
          const keyDeviation = shiftedNote - originalPitch;
          const noteDiff = (keyDeviation * scale / 100) + pitchOffsetSemitones;
          const playbackRate = Math.pow(2, noteDiff / 12);

          // Create Voice nodes
          const source = this.ctx.createBufferSource();
          source.buffer = sh.audioBuffer;
          source.playbackRate.value = playbackRate;

          // Set looping
          const mode = iZone.sampleModes ?? 0;
          // In SoundFont specs: mode 1 or 3 is looping. If sampleModes is undefined, fall back to checking if startLoop < endLoop.
          const shouldLoop = (mode === 1 || mode === 3) || (iZone.sampleModes === undefined && sh.startLoop < sh.endLoop);

          if (shouldLoop && sh.startLoop < sh.endLoop) {
            source.loop = true;
            // Bound loop points safely to avoid Web Audio range errors
            const loopStart = Math.max(0, sh.startLoop - sh.start);
            const loopEnd = Math.min(sh.end - sh.start, sh.endLoop - sh.start);
            source.loopStart = loopStart / sh.sampleRate;
            source.loopEnd = loopEnd / sh.sampleRate;
          }

          const gainNode = this.ctx.createGain();
          const filterNode = this.ctx.createBiquadFilter();
          filterNode.type = 'peaking'; // Pass-through voice filter
          filterNode.frequency.value = 10000;

          const pannerNode = this.ctx.createStereoPanner();
          // SF2 pan is -500 to 500, map to -1 to 1
          const sf2Pan = (pZone.pan + iZone.pan) / 500;
          pannerNode.pan.value = Math.max(-1, Math.min(1, sf2Pan));

          // Connect voice chain
          source.connect(filterNode);
          filterNode.connect(pannerNode);
          pannerNode.connect(gainNode);
          
          // Connect voice output directly to channel input strip
          gainNode.connect(this.channelInputs[channelIndex]);

          // Trigger Envelope
          this.triggerAttackDecay(gainNode, envelope, maxGain, now);

          // Start playing
          source.start(now);

          const voice: ActiveVoice = {
            note, // Track under original note for clean noteOff stop
            sourceNode: source,
            gainNode,
            filterNode,
            pannerNode,
            startTime: now,
            ended: false,
            releaseTriggered: false,
          };

          // Handle clean end
          source.onended = () => {
            voice.ended = true;
            this.cleanEndedVoices();
          };

          voices.push(voice);
            }
          }
        }
      }
    }
  }

    // Save voices
    if (voices.length > 0) {
      const current = this.activeVoices.get(voicesKey) || [];
      this.activeVoices.set(voicesKey, [...current, ...voices]);
      this.updateActiveVoiceCount();
    }
  }

  private triggerAttackDecay(gainNode: GainNode, envelope: ADSR, maxGain: number, now: number) {
    if (!this.ctx) return;
    gainNode.gain.setValueAtTime(0, now);

    // 1. Attack Phase
    const attackEnd = now + Math.max(0.002, envelope.attack);
    gainNode.gain.linearRampToValueAtTime(maxGain, attackEnd);

    // 2. Decay Phase
    const decayEnd = attackEnd + Math.max(0.002, envelope.decay);
    const sustainVal = maxGain * (envelope.sustain / 100);
    gainNode.gain.linearRampToValueAtTime(sustainVal, decayEnd);
  }

  /**
   * Note Off (Release key) - Sustain pedal aware
   */
  public noteOff(channelIndex: number, note: number, envelope: ADSR, state?: ChannelState) {
    const finalEnvelope = state?.adsrBypass ? { attack: 0.002, decay: 0.1, sustain: 100, release: 0.35 } : (state?.adsr || envelope);
    const sustainEnabled = state?.sustainEnabled ?? true;
    if (this.sustainActive[channelIndex] && sustainEnabled) {
      this.sustainedNotes[channelIndex].add(note);
      return;
    }
    this.stopNoteInternal(channelIndex, note, finalEnvelope);
  }

  /**
   * Set Sustain Pedal State
   */
  public setSustainPedal(channelIndex: number, active: boolean, envelope: ADSR, state?: ChannelState) {
    this.sustainActive[channelIndex] = active;
    const sustainEnabled = state?.sustainEnabled ?? true;
    const finalEnvelope = state?.adsrBypass ? { attack: 0.002, decay: 0.1, sustain: 100, release: 0.35 } : (state?.adsr || envelope);
    if (!active || !sustainEnabled) {
      // Release all notes currently held by sustain
      const notesToRelease = Array.from(this.sustainedNotes[channelIndex]);
      this.sustainedNotes[channelIndex].clear();
      for (const note of notesToRelease) {
        this.stopNoteInternal(channelIndex, note, finalEnvelope);
      }
    }
  }

  /**
   * Internal stopper of voice sounds
   */
  private stopNoteInternal(channelIndex: number, note: number, envelope: ADSR) {
    if (!this.ctx) return;
    const voicesKey = `${channelIndex}-${note}`;
    const voices = this.activeVoices.get(voicesKey);

    if (!voices || voices.length === 0) return;

    const now = this.ctx.currentTime;
    const remainingVoices: ActiveVoice[] = [];

    for (const voice of voices) {
      if (voice.releaseTriggered || voice.ended) {
        remainingVoices.push(voice);
        continue;
      }

      voice.releaseTriggered = true;

      const gain = voice.gainNode.gain;
      try {
        gain.cancelScheduledValues(now);
        // Smoothly transition from current gain to 0
        gain.setValueAtTime(gain.value, now);
        const releaseTime = Math.max(0.01, envelope.release);
        gain.linearRampToValueAtTime(0, now + releaseTime);

        voice.sourceNode.stop(now + releaseTime);

        // Automatically clean up memory after release completes
        setTimeout(() => {
          voice.ended = true;
          this.cleanEndedVoices();
        }, releaseTime * 1000 + 100);
      } catch (err) {
        voice.ended = true;
      }

      remainingVoices.push(voice);
    }

    this.activeVoices.set(voicesKey, remainingVoices);
    this.updateActiveVoiceCount();
  }

  public panic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    this.activeVoices.forEach((voices) => {
      for (const v of voices) {
        try {
          v.sourceNode.stop(now);
        } catch (e) {}
        try {
          v.gainNode.disconnect();
        } catch (e) {}
      }
    });

    this.activeVoices.clear();
    this.sustainedNotes.forEach(s => s.clear());
    this.updateActiveVoiceCount();
  }

  private cleanEndedVoices() {
    this.activeVoices.forEach((voices, key) => {
      const active = voices.filter(v => !v.ended);
      if (active.length === 0) {
        this.activeVoices.delete(key);
      } else {
        this.activeVoices.set(key, active);
      }
    });
    this.updateActiveVoiceCount();
  }

  private updateActiveVoiceCount() {
    let count = 0;
    this.activeVoices.forEach((voices) => {
      count += voices.filter(v => !v.ended).length;
    });
    this.onVoiceCountChange(count);
  }

  // MIDI input connection
  private initMIDI() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      console.log('Web MIDI API not supported in this browser.');
      return;
    }

    navigator.requestMIDIAccess()
      .then((midiAccess) => {
        for (const input of midiAccess.inputs.values()) {
          input.onmidimessage = (event) => this.handleMIDIMessage(event);
        }
        midiAccess.onstatechange = (e) => {
          if (e.port instanceof MIDIInput && e.port.state === 'connected') {
            e.port.onmidimessage = (event) => this.handleMIDIMessage(event);
          }
        };
      })
      .catch((err) => {
        console.warn('MIDI Access failed: ', err);
      });
  }

  private handleMIDIMessage(event: any) {
    if (!this.ctx) return;
    const [status, note, velocity] = event.data;
    const messageType = status & 0xf0;
    const midiChannel = status & 0x0f; // 0 to 15

    // Map MIDI channels 1-4 (0-3) directly to our channels.
    // If midi channel is not 0-3, we can play it on the active/selected channel, 
    // or distribute it. Let's make it map MIDI channel directly or route to channel 0.
    const targetChannel = midiChannel < 4 ? midiChannel : 0;

    // We fetch the channel state inside UI/App and forward it.
    // To enable MIDI triggering in a clean decoupled way, we dispatch a custom browser event
    // that App.tsx can listen to, ensuring single source of truth for channel states!
    if (messageType === 144 && velocity > 0) {
      // Note On
      const customEvent = new CustomEvent('synth-midi-on', {
        detail: { channel: targetChannel, note, velocity }
      });
      window.dispatchEvent(customEvent);
    } else if (messageType === 128 || (messageType === 144 && velocity === 0)) {
      // Note Off
      const customEvent = new CustomEvent('synth-midi-off', {
        detail: { channel: targetChannel, note }
      });
      window.dispatchEvent(customEvent);
    } else if (messageType === 176) {
      // Control Change (CC)
      if (note === 64) {
        // Sustain Pedal (CC 64)
        const sustainEvent = new CustomEvent('synth-midi-sustain', {
          detail: { channel: targetChannel, value: velocity }
        });
        window.dispatchEvent(sustainEvent);
      }
      // General MIDI CC event for MIDI Learn & Parameter Control
      const ccEvent = new CustomEvent('synth-midi-cc', {
        detail: { channel: targetChannel, cc: note, value: velocity }
      });
      window.dispatchEvent(ccEvent);
    }
  }
}

// Global engine instance to share easily
export const synthEngineInstance = new SynthEngine();
