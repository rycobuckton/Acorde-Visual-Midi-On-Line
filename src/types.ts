export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
}

export interface ActiveNote {
  midi: number;
  name: string;
  pc: string; // Pitch class (e.g. "C", "F#")
  octave: number;
  velocity: number;
}

export interface ChordAnalysis {
  name: string;
  chordName: string; // Tonal.js format
  formula: string;
  intervals: string[];
  notes: string[];
  root: string;
  bass: string;
  type: string;
  scales: string[];
}
