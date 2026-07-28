/**
 * SoundFont 2 (SF2) Binary Parser
 * Implements standard RIFF/LIST parsing and SF2 generator structure parsing.
 */

export interface SF2SampleHeader {
  name: string;
  start: number;
  end: number;
  startLoop: number;
  endLoop: number;
  sampleRate: number;
  originalPitch: number;
  pitchCorrection: number; // cents
  sampleLink: number;
  sampleType: number;
  audioBuffer?: AudioBuffer; // Decoded Web Audio buffer
  _origStart?: number;
  _origEnd?: number;
  _origStartLoop?: number;
  _origEndLoop?: number;
  _origSampleRate?: number;
}

export interface SF2InstrumentZone {
  keyRange: { min: number; max: number };
  velRange: { min: number; max: number };
  coarseTune: number;
  fineTune: number;
  pan: number; // -500 to 500
  sampleHeaderIndex: number | null;
  sampleHeader?: SF2SampleHeader;
  sampleModes?: number;
  overridingRootKey?: number | null;
  scaleTuning?: number;
}

export interface SF2Instrument {
  name: string;
  zones: SF2InstrumentZone[];
}

export interface SF2PresetZone {
  keyRange: { min: number; max: number };
  velRange: { min: number; max: number };
  coarseTune: number;
  fineTune: number;
  pan: number; // -500 to 500
  instrumentIndex: number | null;
  instrument?: SF2Instrument;
  overridingRootKey?: number | null;
  scaleTuning?: number;
}

export interface SF2Preset {
  name: string;
  preset: number;
  bank: number;
  zones: SF2PresetZone[];
}

export interface ParsedSoundFont {
  id?: string;
  name?: string;
  presets: SF2Preset[];
  instruments: SF2Instrument[];
  sampleHeaders: SF2SampleHeader[];
  sampleData: Int16Array;
}

export class SF2Parser {
  private view: DataView;
  private bytes: Uint8Array;
  private offset: number = 0;

  constructor(arrayBuffer: ArrayBuffer) {
    this.view = new DataView(arrayBuffer);
    this.bytes = new Uint8Array(arrayBuffer);
  }

  public parse(): ParsedSoundFont {
    this.offset = 0;

    // Read RIFF Header
    const riffId = this.readString(4);
    if (riffId !== 'RIFF') {
      throw new Error(`Invalid file format: Expected 'RIFF', got '${riffId}'`);
    }

    const riffSize = this.view.getUint32(this.offset, true);
    this.offset += 4;

    const sfbkId = this.readString(4);
    if (sfbkId !== 'sfbk') {
      throw new Error(`Invalid SoundFont format: Expected 'sfbk', got '${sfbkId}'`);
    }

    let sampleData: Int16Array = new Int16Array(0);
    const rawChunks: { [key: string]: Uint8Array } = {};

    // Parse sub-chunks of sfbk
    const endOffset = riffSize + 8;
    while (this.offset < endOffset && this.offset < this.bytes.length) {
      const chunkId = this.readString(4);
      const chunkSize = this.view.getUint32(this.offset, true);
      this.offset += 4;

      const chunkEnd = this.offset + chunkSize;

      if (chunkId === 'LIST') {
        const listType = this.readString(4);
        
        while (this.offset < chunkEnd) {
          const subChunkId = this.readString(4);
          const subChunkSize = this.view.getUint32(this.offset, true);
          this.offset += 4;

          const subChunkData = this.bytes.subarray(this.offset, this.offset + subChunkSize);
          
          if (subChunkId === 'smpl') {
            // Sample data: 16-bit signed PCM
            // Avoid slicing the buffer if byteOffset is even-aligned (as is standard in RIFF files),
            // which eliminates redundant memory allocation of hundreds of megabytes.
            if (subChunkData.byteOffset % 2 === 0) {
              sampleData = new Int16Array(subChunkData.buffer, subChunkData.byteOffset, subChunkSize / 2);
            } else {
              const alignedBuffer = subChunkData.buffer.slice(
                subChunkData.byteOffset,
                subChunkData.byteOffset + subChunkSize
              );
              sampleData = new Int16Array(alignedBuffer);
            }
          } else {
            rawChunks[subChunkId] = subChunkData;
          }

          this.offset += subChunkSize;
          // RIFF chunks are padded to even sizes
          if (subChunkSize % 2 !== 0) {
            this.offset++;
          }
        }
      } else {
        this.offset += chunkSize;
      }

      if (chunkSize % 2 !== 0) {
        this.offset++;
      }
    }

    // Now, decode pdta chunks
    return this.decodePdta(rawChunks, sampleData);
  }

  private decodePdta(chunks: { [key: string]: Uint8Array }, sampleData: Int16Array): ParsedSoundFont {
    // Helper to read records from a chunk
    const getRecords = <T>(chunkId: string, recordSize: number, decodeFn: (view: DataView, offset: number) => T): T[] => {
      const data = chunks[chunkId];
      if (!data) return [];
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const records: T[] = [];
      const count = data.byteLength / recordSize;
      // Subtract the terminal record (the last record is always a sentinel)
      for (let i = 0; i < count - 1; i++) {
        records.push(decodeFn(view, i * recordSize));
      }
      return records;
    };

    // Decode phdr (Preset Header)
    // Size: 38 bytes
    const presets = getRecords('phdr', 38, (view, offset) => {
      return {
        name: this.readStringFromBuffer(view, offset, 20),
        preset: view.getUint16(offset + 20, true),
        bank: view.getUint16(offset + 22, true),
        presetBagIndex: view.getUint16(offset + 24, true),
        zones: [] as SF2PresetZone[],
      };
    });

    // Decode pbag (Preset Bag)
    // Size: 4 bytes
    const pbag = getRecords('pbag', 4, (view, offset) => {
      return {
        genNdx: view.getUint16(offset, true),
        modNdx: view.getUint16(offset + 2, true),
      };
    });

    // Add sentinel terminal pbag index for boundary check
    const pbagData = chunks['pbag'];
    const pbagTotalCount = pbagData ? pbagData.byteLength / 4 : 0;
    const getPbagRange = (index: number) => {
      if (!pbagData) return { start: 0, end: 0 };
      const view = new DataView(pbagData.buffer, pbagData.byteOffset, pbagData.byteLength);
      const start = view.getUint16(index * 4, true);
      const end = view.getUint16((index + 1) * 4, true);
      return { start, end };
    };

    // Decode pgen (Preset Generator)
    // Size: 4 bytes
    const pgen = getRecords('pgen', 4, (view, offset) => {
      return {
        genOper: view.getUint16(offset, true),
        genVal: view.getUint16(offset + 2, true), // Treat raw as uint16, convert inside if needed
      };
    });

    // Decode inst (Instrument Header)
    // Size: 22 bytes
    const instruments = getRecords('inst', 22, (view, offset) => {
      return {
        name: this.readStringFromBuffer(view, offset, 20),
        instBagIndex: view.getUint16(offset + 20, true),
        zones: [] as SF2InstrumentZone[],
      };
    });

    // Decode ibag (Instrument Bag)
    // Size: 4 bytes
    const ibag = getRecords('ibag', 4, (view, offset) => {
      return {
        genNdx: view.getUint16(offset, true),
        modNdx: view.getUint16(offset + 2, true),
      };
    });

    // Add sentinel terminal ibag index
    const ibagData = chunks['ibag'];
    const ibagTotalCount = ibagData ? ibagData.byteLength / 4 : 0;
    const getIbagRange = (index: number) => {
      if (!ibagData) return { start: 0, end: 0 };
      const view = new DataView(ibagData.buffer, ibagData.byteOffset, ibagData.byteLength);
      const start = view.getUint16(index * 4, true);
      const end = view.getUint16((index + 1) * 4, true);
      return { start, end };
    };

    // Decode igen (Instrument Generator)
    // Size: 4 bytes
    const igen = getRecords('igen', 4, (view, offset) => {
      return {
        genOper: view.getUint16(offset, true),
        genVal: view.getUint16(offset + 2, true),
      };
    });

    // Decode shdr (Sample Header)
    // Size: 46 bytes
    const sampleHeaders = getRecords('shdr', 46, (view, offset) => {
      return {
        name: this.readStringFromBuffer(view, offset, 20),
        start: view.getUint32(offset + 20, true),
        end: view.getUint32(offset + 24, true),
        startLoop: view.getUint32(offset + 28, true),
        endLoop: view.getUint32(offset + 32, true),
        sampleRate: view.getUint32(offset + 36, true),
        originalPitch: view.getUint8(offset + 40),
        pitchCorrection: view.getInt8(offset + 41),
        sampleLink: view.getUint16(offset + 42, true),
        sampleType: view.getUint16(offset + 44, true),
      };
    });

    // --- RECONSTRUCT STRUCTURAL HIERARCHY ---

    // 1. Build Instrument Zones
    for (let i = 0; i < instruments.length; i++) {
      const inst = instruments[i];
      const instNextBagIndex = (i + 1 < instruments.length) ? instruments[i + 1].instBagIndex : ibagTotalCount - 1;
      
      let globalZone: SF2InstrumentZone | null = null;

      for (let b = inst.instBagIndex; b < instNextBagIndex; b++) {
        const range = getIbagRange(b);
        const zone: SF2InstrumentZone = {
          keyRange: { min: 0, max: 127 },
          velRange: { min: 0, max: 127 },
          coarseTune: 0,
          fineTune: 0,
          pan: 0,
          sampleHeaderIndex: null,
          sampleModes: 0,
          overridingRootKey: null,
          scaleTuning: 100,
        };

        const isGeneratorSet = {
          keyRange: false,
          velRange: false,
          coarseTune: false,
          fineTune: false,
          pan: false,
          sampleModes: false,
          overridingRootKey: false,
          scaleTuning: false,
        };

        // Parse Generators in this bag
        for (let g = range.start; g < range.end && g < igen.length; g++) {
          const gen = igen[g];
          if (!gen) continue;

          switch (gen.genOper) {
            case 43: // keyRange
              zone.keyRange = {
                min: gen.genVal & 0x00FF,
                max: (gen.genVal & 0xFF00) >> 8,
              };
              isGeneratorSet.keyRange = true;
              break;
            case 44: // velRange
              zone.velRange = {
                min: gen.genVal & 0x00FF,
                max: (gen.genVal & 0xFF00) >> 8,
              };
              isGeneratorSet.velRange = true;
              break;
            case 51: // coarseTune (SoundFont 2 generator 51)
              zone.coarseTune = this.toSigned16(gen.genVal);
              isGeneratorSet.coarseTune = true;
              break;
            case 52: // fineTune (SoundFont 2 generator 52)
              zone.fineTune = this.toSigned16(gen.genVal);
              isGeneratorSet.fineTune = true;
              break;
            case 56: // scaleTuning (SoundFont 2 generator 56)
              zone.scaleTuning = this.toSigned16(gen.genVal);
              isGeneratorSet.scaleTuning = true;
              break;
            case 58: // overridingRootKey (SoundFont 2 generator 58)
              zone.overridingRootKey = gen.genVal;
              isGeneratorSet.overridingRootKey = true;
              break;
            case 17: // pan
              zone.pan = this.toSigned16(gen.genVal);
              isGeneratorSet.pan = true;
              break;
            case 53: // sampleID
              zone.sampleHeaderIndex = gen.genVal;
              break;
            case 54: // sampleModes
              zone.sampleModes = gen.genVal;
              isGeneratorSet.sampleModes = true;
              break;
          }
        }

        const isGlobal = zone.sampleHeaderIndex === null;

        if (isGlobal && b === inst.instBagIndex) {
          globalZone = zone;
        } else if (globalZone) {
          // Inherit unset generators from the global zone
          if (!isGeneratorSet.keyRange) zone.keyRange = { ...globalZone.keyRange };
          if (!isGeneratorSet.velRange) zone.velRange = { ...globalZone.velRange };
          if (!isGeneratorSet.coarseTune) zone.coarseTune = globalZone.coarseTune;
          if (!isGeneratorSet.fineTune) zone.fineTune = globalZone.fineTune;
          if (!isGeneratorSet.pan) zone.pan = globalZone.pan;
          if (!isGeneratorSet.sampleModes) zone.sampleModes = globalZone.sampleModes;
          if (!isGeneratorSet.overridingRootKey) zone.overridingRootKey = globalZone.overridingRootKey;
          if (!isGeneratorSet.scaleTuning) zone.scaleTuning = globalZone.scaleTuning;
        }

        // Only add if it points to a sample
        if (zone.sampleHeaderIndex !== null && zone.sampleHeaderIndex < sampleHeaders.length) {
          zone.sampleHeader = sampleHeaders[zone.sampleHeaderIndex];
          inst.zones.push(zone);
        }
      }
    }

    // 2. Build Preset Zones
    for (let i = 0; i < presets.length; i++) {
      const prst = presets[i];
      const prstNextBagIndex = (i + 1 < presets.length) ? presets[i + 1].presetBagIndex : pbagTotalCount - 1;

      let globalZone: SF2PresetZone | null = null;

      for (let b = prst.presetBagIndex; b < prstNextBagIndex; b++) {
        const range = getPbagRange(b);
        const zone: SF2PresetZone = {
          keyRange: { min: 0, max: 127 },
          velRange: { min: 0, max: 127 },
          coarseTune: 0,
          fineTune: 0,
          pan: 0,
          instrumentIndex: null,
          overridingRootKey: null,
          scaleTuning: 100,
        };

        const isGeneratorSet = {
          keyRange: false,
          velRange: false,
          coarseTune: false,
          fineTune: false,
          pan: false,
          overridingRootKey: false,
          scaleTuning: false,
        };

        // Parse Generators in this bag
        for (let g = range.start; g < range.end && g < pgen.length; g++) {
          const gen = pgen[g];
          if (!gen) continue;

          switch (gen.genOper) {
            case 43: // keyRange
              zone.keyRange = {
                min: gen.genVal & 0x00FF,
                max: (gen.genVal & 0xFF00) >> 8,
              };
              isGeneratorSet.keyRange = true;
              break;
            case 44: // velRange
              zone.velRange = {
                min: gen.genVal & 0x00FF,
                max: (gen.genVal & 0xFF00) >> 8,
              };
              isGeneratorSet.velRange = true;
              break;
            case 51: // coarseTune (SoundFont 2 generator 51)
              zone.coarseTune = this.toSigned16(gen.genVal);
              isGeneratorSet.coarseTune = true;
              break;
            case 52: // fineTune (SoundFont 2 generator 52)
              zone.fineTune = this.toSigned16(gen.genVal);
              isGeneratorSet.fineTune = true;
              break;
            case 56: // scaleTuning (SoundFont 2 generator 56)
              zone.scaleTuning = this.toSigned16(gen.genVal);
              isGeneratorSet.scaleTuning = true;
              break;
            case 58: // overridingRootKey (SoundFont 2 generator 58)
              zone.overridingRootKey = gen.genVal;
              isGeneratorSet.overridingRootKey = true;
              break;
            case 17: // pan
              zone.pan = this.toSigned16(gen.genVal);
              isGeneratorSet.pan = true;
              break;
            case 41: // instrument
              zone.instrumentIndex = gen.genVal;
              break;
          }
        }

        const isGlobal = zone.instrumentIndex === null;

        if (isGlobal && b === prst.presetBagIndex) {
          globalZone = zone;
        } else if (globalZone) {
          if (!isGeneratorSet.keyRange) zone.keyRange = { ...globalZone.keyRange };
          if (!isGeneratorSet.velRange) zone.velRange = { ...globalZone.velRange };
          if (!isGeneratorSet.coarseTune) zone.coarseTune = globalZone.coarseTune;
          if (!isGeneratorSet.fineTune) zone.fineTune = globalZone.fineTune;
          if (!isGeneratorSet.pan) zone.pan = globalZone.pan;
          if (!isGeneratorSet.overridingRootKey) zone.overridingRootKey = globalZone.overridingRootKey;
          if (!isGeneratorSet.scaleTuning) zone.scaleTuning = globalZone.scaleTuning;
        }

        if (zone.instrumentIndex !== null && zone.instrumentIndex < instruments.length) {
          zone.instrument = instruments[zone.instrumentIndex];
          prst.zones.push(zone);
        }
      }
    }

    return {
      presets,
      instruments,
      sampleHeaders,
      sampleData,
    };
  }

  private readString(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      if (this.offset >= this.bytes.length) break;
      result += String.fromCharCode(this.bytes[this.offset++]);
    }
    return result;
  }

  private readStringFromBuffer(view: DataView, startOffset: number, maxLength: number): string {
    let result = '';
    for (let i = 0; i < maxLength; i++) {
      const charCode = view.getUint8(startOffset + i);
      if (charCode === 0) break; // Null terminator
      result += String.fromCharCode(charCode);
    }
    return result.trim();
  }

  private toSigned16(val: number): number {
    return val > 32767 ? val - 65536 : val;
  }
}
