import { Note, Chord, Scale } from '@tonaljs/tonal';
import { ChordAnalysis } from '../types';

// Tradução de intervalos para o Português
export const translateInterval = (interval: string): string => {
  const map: Record<string, string> = {
    '1P': 'Uníssono Justo',
    '2m': 'Segunda Menor',
    '2M': 'Segunda Maior',
    '3m': 'Terça Menor',
    '3M': 'Terça Maior',
    '4P': 'Quarta Justa',
    '4A': 'Quarta Aumentada',
    '5d': 'Quinta Diminuta',
    '5P': 'Quinta Justa',
    '5A': 'Quinta Aumentada',
    '6m': 'Sexta Menor',
    '6M': 'Sexta Maior',
    '7m': 'Sétima Menor',
    '7M': 'Sétima Maior',
    '8P': 'Oitava Justa',
    '9m': 'Nona Menor',
    '9M': 'Nona Maior',
    '11P': 'Décima Primeira Justa',
    '11A': 'Décima Primeira Aumentada',
    '13m': 'Décima Terceira Menor',
    '13M': 'Décima Terceira Maior',
  };

  if (map[interval]) return map[interval];

  // Caso seja um intervalo composto ou não mapeado diretamente
  let quality = '';
  const q = interval.replace(/[0-9]/g, '');
  const num = parseInt(interval.replace(/[^0-9]/g, ''), 10);

  if (q === 'm') quality = 'Menor';
  else if (q === 'M') quality = 'Maior';
  else if (q === 'P') quality = 'Justo';
  else if (q === 'd') quality = 'Diminuto';
  else if (q === 'A') quality = 'Aumentado';

  return `${num}ª ${quality}`.trim();
};

// Tradução de tipos de acordes para o Português
export const translateChordType = (type: string): string => {
  const map: Record<string, string> = {
    'major': 'Maior',
    'minor': 'Menor',
    'diminished': 'Diminuto',
    'augmented': 'Aumentado',
    'suspended': 'Suspenso',
    'dominant': 'Dominante',
    'major seventh': 'Maior com Sétima Maior',
    'minor seventh': 'Menor com Sétima',
    'half-diminished': 'Meio-Diminuto',
    'diminished seventh': 'Diminuto com Sétima',
    'minor major seventh': 'Menor com Sétima Maior',
    'augmented seventh': 'Aumentado com Sétima',
    'suspended fourth seventh': 'Suspenso com Sétima',
    'suspended second seventh': 'Suspenso com Segunda e Sétima',
    'sixth': 'com Sexta',
    'minor sixth': 'Menor com Sexta',
  };

  return map[type.toLowerCase()] || type;
};

// Converter MIDI para nome de nota legível em português
export const midiToNoteNamePT = (midi: number): string => {
  const noteName = Note.fromMidi(midi);
  return noteName;
};

export interface ChordDefinition {
  name: string;
  symbol: string;
  intervals: number[]; // Intervalos essenciais em semitons relativos à tônica (0 a 11)
  priority: number;
  quality: string;
  podeTerTensoes: boolean;
  pontuacaoInversaoPermitida: number; // 0 a 100
}

const CHORD_DEFINITIONS: ChordDefinition[] = [
  // =============================================================================
  // 1. BASES COMUNS (Tríades e Sétimas)
  // =============================================================================
  { name: "Maior", symbol: "", intervals: [0, 4, 7], priority: 98, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 95 },
  { name: "Menor", symbol: "m", intervals: [0, 3, 7], priority: 91, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Dominante 7", symbol: "7", intervals: [0, 4, 7, 10], priority: 120, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 95 },
  { name: "Dominante 7", symbol: "7(9#)", intervals: [0, 3, 4, 7, 10], priority: 145, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 55 },
  { name: "Maior com 7M", symbol: "7M", intervals: [0, 4, 7, 11], priority: 112, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 95 },
  { name: "Maior 7M(9#)", symbol: "7M(9#)", intervals: [0, 3, 4, 7, 11], priority: 136, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 25 },
  { name: "Maior 7M(9b)", symbol: "7M(9b)", intervals: [0, 1, 4, 7, 11], priority: 108, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 25 },
  { name: "Menor com 7", symbol: "m7", intervals: [0, 3, 7, 10], priority: 108, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 95 },
  { name: "Menor com 7", symbol: "m7(9b)", intervals: [0, 1, 3, 7, 10], priority: 100, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 0 },
  { name: "Menor com m7M", symbol: "m7M", intervals: [0, 3, 7, 11], priority: 103, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 75 },

  // =============================================================================
  // 2. FAMÍLIA DIMINUTA E MEIO-DIMINUTA
  // =============================================================================
  { name: "Diminuto com 7", symbol: "°7", intervals: [0, 3, 6, 9], priority: 75, quality: "Diminuto", podeTerTensoes: false, pontuacaoInversaoPermitida: 98 },
  { name: "Diminuto", symbol: "°", intervals: [0, 3, 6], priority: 65, quality: "Diminuto", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Meio-Diminuto", symbol: "m7b5", intervals: [0, 3, 6, 10], priority: 85, quality: "Meio-Diminuto", podeTerTensoes: true, pontuacaoInversaoPermitida: 85 },
  { name: "Meio-Diminuto", symbol: "m7(5#)", intervals: [0, 3, 8, 10], priority: 83, quality: "Meio-Diminuto", podeTerTensoes: false, pontuacaoInversaoPermitida: 20 },
  { name: "Meio-Diminuto", symbol: "m7b5(9b)", intervals: [0, 1, 3, 6, 10], priority: 80, quality: "Meio-Diminuto", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Meio-Diminuto", symbol: "m7b5(9)", intervals: [0, 2, 3, 6, 10], priority: 80, quality: "Meio-Diminuto", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Meio-Diminuto", symbol: "m7b5(9,11)", intervals: [0, 2, 3, 5, 6, 10], priority: 80, quality: "Meio-Diminuto", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Meio-Diminuto", symbol: "m7b5(9,11,13)", intervals: [0, 2, 3, 5, 6, 9, 10], priority: 135, quality: "Meio-Diminuto", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },

  // =============================================================================
  // 3. QUINTAS ALTERADAS E AUMENTADOS
  // =============================================================================
  { name: "Aumentado", symbol: "5b", intervals: [0, 4, 6], priority: 60, quality: "Aumentado", podeTerTensoes: false, pontuacaoInversaoPermitida: 1 },
  { name: "Dominante 7(5b)", symbol: "7(5b)", intervals: [0, 4, 6, 10], priority: 54, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 50 },
  { name: "Aumentado", symbol: "5#", intervals: [0, 4, 8], priority: 30, quality: "Aumentado", podeTerTensoes: true, pontuacaoInversaoPermitida: 0 },
  { name: "Maior (b5,b13)", symbol: "(b5,b13)", intervals: [0, 4, 6, 8], priority: 110, quality: "Aumentado", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Aumentado", symbol: "5#(9,11)", intervals: [0, 2, 4, 5, 8], priority: 84, quality: "Aumentado", podeTerTensoes: false, pontuacaoInversaoPermitida: 0 },
  { name: "Aumentado", symbol: "5#(9)", intervals: [0, 2, 4, 8], priority: 72, quality: "Aumentado", podeTerTensoes: false, pontuacaoInversaoPermitida: 0 },

  // =============================================================================
  // 4. SUSPENSOS E ADD
  // =============================================================================
  { name: "Suspenso 4", symbol: "sus4", intervals: [0, 5, 7], priority: 88, quality: "Suspenso", podeTerTensoes: true, pontuacaoInversaoPermitida: 45 },
  { name: "Suspenso 2", symbol: "sus4(b5)", intervals: [0, 5, 6], priority: 40, quality: "Suspenso", podeTerTensoes: false, pontuacaoInversaoPermitida: 40 },
  { name: "Maior com 4", symbol: "4", intervals: [0, 5, 6], priority: 98, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 40 },
  { name: "Suspenso 2", symbol: "sus2", intervals: [0, 2, 7], priority: 86, quality: "Suspenso", podeTerTensoes: false, pontuacaoInversaoPermitida: 1 },
  { name: "Suspenso 4", symbol: "7sus4", intervals: [0, 5, 7, 10], priority: 96, quality: "Suspenso", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Suspenso 4", symbol: "7sus4(9)", intervals: [0, 2, 5, 7, 10], priority: 92, quality: "Suspenso", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Suspenso 2", symbol: "sus2b", intervals: [0, 1, 7], priority: 36, quality: "Suspenso", podeTerTensoes: false, pontuacaoInversaoPermitida: 1 },

  // =============================================================================
  // 5. SEXTAS E ADD9
  // =============================================================================
  { name: "Maior com 6", symbol: "6", intervals: [0, 4, 7, 9], priority: 90, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Maior com 6", symbol: "6(9)", intervals: [0, 2, 4, 7, 9], priority: 100, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 45 },
  { name: "Maior com 6", symbol: "6(9,11)", intervals: [0, 2, 4, 5, 7, 9], priority: 106, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Maior com 6", symbol: "6(9#)", intervals: [0, 3, 4, 7, 9], priority: 100, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 60 },
  { name: "Menor com 6", symbol: "m6", intervals: [0, 3, 7, 9], priority: 85, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Menor com 6 e 11", symbol: "m6(11)", intervals: [0, 3, 5, 7, 9], priority: 102, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Menor com 6", symbol: "m6(9,11)", intervals: [0, 2, 3, 5, 7, 9], priority: 101, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Menor com 5#", symbol: "m5#", intervals: [0, 3, 8], priority: 55, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 0 },
  { name: "Add4", symbol: "(add4)", intervals: [0, 4, 5, 7], priority: 95, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Add4", symbol: "(add4)", intervals: [0, 4, 5], priority: 75, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 50 },
  { name: "Add9", symbol: "(add9)", intervals: [0, 4, 7, 2], priority: 88, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 85 },
  { name: "Add13b", symbol: "add13b", intervals: [0, 4, 7, 8], priority: 81, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 20 },
  { name: "Maior com 9#", symbol: "(9#)", intervals: [0, 4, 7, 3], priority: 81, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 30 },
  { name: "Add9", symbol: "m(add9)", intervals: [0, 2, 3, 7], priority: 90, quality: "Menor", podeTerTensoes: false, pontuacaoInversaoPermitida: 80 },
  { name: "Maior com 9b", symbol: "(9b)", intervals: [0, 1, 4, 7], priority: 80, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 55 },

  // =============================================================================
  // 6. EXTENSÕES EXPLÍCITAS (9, 11, 13)
  // =============================================================================
  { name: "Dominante 9", symbol: "9", intervals: [0, 4, 7, 10, 2], priority: 92, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  { name: "Menor com 9", symbol: "m9", intervals: [0, 3, 7, 10, 2], priority: 98, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 50 },
  { name: "Menor com 7M e 9", symbol: "m7M(9)", intervals: [0, 3, 7, 11, 2], priority: 65, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  { name: "Menor 11", symbol: "m11", intervals: [0, 3, 5, 7, 10], priority: 95, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 60 },
  { name: "Menor 11", symbol: "m(4)", intervals: [0, 3, 5, 7], priority: 88, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 85 },
  { name: "Menor com 7M e 13", symbol: "m7M(13)", intervals: [0, 3, 7, 11, 2, 9], priority: 65, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  { name: "Dominante 13", symbol: "7(13)", intervals: [0, 2, 4, 7, 9, 10], priority: 115, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 90 },
  { name: "Menor 13", symbol: "m13", intervals: [0, 3, 7, 10, 2, 5, 9], priority: 94, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 45 },

  // --- Extensões Maiores com 7M ---
  { name: "Maior 7M(9)", symbol: "7M(9)", intervals: [0, 2, 4, 7, 11], priority: 110, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 90 },
  { name: "Maior 7M(13)", symbol: "7M(13)", intervals: [0, 2, 4, 7, 9, 11], priority: 105, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 85 },

  // =============================================================================
  // 7. ACORDES SEM QUINTA (no5)
  // =============================================================================
  // --- Dominantes ---
  { name: "Dominante 7 sem 5", symbol: "7", intervals: [0, 4, 10], priority: 64, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Dominante 9 sem 5", symbol: "9", intervals: [0, 2, 4, 10], priority: 60, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 40 },
  { name: "Dominante 13 sem 5", symbol: "7(13)", intervals: [0, 4, 9, 10], priority: 75, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 45 },
  { name: "Dom 13(9) sem 5", symbol: "7(13)", intervals: [0, 2, 4, 9, 10], priority: 85, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 85 },
  { name: "Dom 7(9b) sem 5", symbol: "7(9b)", intervals: [0, 1, 4, 10], priority: 65, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 50 },
  { name: "Dom 7(9#) sem 5", symbol: "7(9#)", intervals: [0, 3, 4, 10], priority: 68, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 60 },
  { name: "Dom 9(11#) sem 5", symbol: "9(11#)", intervals: [0, 2, 4, 6, 10], priority: 76, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 80 },
  { name: "Dom 13(9b) sem 5", symbol: "7(9b,13)", intervals: [0, 1, 4, 9, 10], priority: 75, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  { name: "Dom 13 sem 5", symbol: "(b13)", intervals: [0, 4, 8, 10], priority: 55, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  { name: "Dominante 7(5#)", symbol: "7(5#)", intervals: [0, 4, 8, 10], priority: 115, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 95 },
  { name: "Dom 7(11#) sem 5", symbol: "7(11#)", intervals: [0, 4, 6, 10], priority: 70, quality: "Dominante", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  // --- Menores ---
  { name: "Menor 7 sem 5", symbol: "m7", intervals: [0, 3, 10], priority: 49, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 88 },
  { name: "Menor 9 sem 5", symbol: "m9", intervals: [0, 2, 3, 10], priority: 64, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 88 },
  { name: "Menor 11 sem 5", symbol: "m11", intervals: [0, 3, 5, 10], priority: 42, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 45 },
  { name: "Menor 13 sem 5", symbol: "m13", intervals: [0, 3, 9, 10], priority: 50, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 40 },
  { name: "m11 sem 5 e 7", symbol: "m(add9,11)", intervals: [0, 2, 3, 5], priority: 64, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 0 },
  { name: "Menor 7M sem 5", symbol: "m7M", intervals: [0, 3, 11], priority: 60, quality: "Menor", podeTerTensoes: true, pontuacaoInversaoPermitida: 70 },
  // --- Maiores ---
  { name: "Maior 7M(9) sem 5", symbol: "7M(9)", intervals: [0, 2, 4, 11], priority: 70, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 50 },
  { name: "Maior 13M sem 5", symbol: "7M13", intervals: [0, 4, 9, 11], priority: 85, quality: "Maior", podeTerTensoes: false, pontuacaoInversaoPermitida: 50 },
  { name: "Maior 7M sem 5", symbol: "7M", intervals: [0, 4, 11], priority: 45, quality: "Maior", podeTerTensoes: true, pontuacaoInversaoPermitida: 60 },
  // --- Suspensos ---
  { name: "7sus4 sem 5", symbol: "7sus4", intervals: [0, 5, 10], priority: 45, quality: "Suspenso", podeTerTensoes: true, pontuacaoInversaoPermitida: 55 }
];

// Pré-ordenar definições: mais notas essenciais primeiro, depois prioridade base descendente
const SORTED_CHORD_DEFINITIONS = [...CHORD_DEFINITIONS].sort((a, b) => {
  if (b.intervals.length !== a.intervals.length) {
    return b.intervals.length - a.intervals.length;
  }
  return b.priority - a.priority;
});

// Classificação de notas adicionais (tensões e alterações)
const tensionMap: Record<number, string> = {
  1: '9b',
  2: '9',
  3: '9#',
  5: '11',
  6: '11#',
  8: '13b',
  9: '13'
};

const intervalMapDesc: Record<number, string> = {
  0: 'Fundamental',
  1: 'Segunda Menor',
  2: 'Segunda Maior',
  3: 'Terça Menor',
  4: 'Terça Maior',
  5: 'Quarta Justa',
  6: 'Quinta Diminuta / Quarta Aumentada',
  7: 'Quinta Justa',
  8: 'Quinta Aumentada / Sexta Menor',
  9: 'Sexta Maior',
  10: 'Sétima Menor',
  11: 'Sétima Maior'
};

const formulaMap: Record<number, string> = {
  0: '1',
  1: 'b2',
  2: '2',
  3: 'b3',
  4: '3',
  5: '4',
  6: '#4',
  7: '5',
  8: '#5',
  9: '6',
  10: 'b7',
  11: '7'
};

// Tradução de nota em letra cifra para português por extenso
export const noteToPT = (note: string): string => {
  if (!note) return '';
  const pc = note.replace(/[0-9#b]/g, '');
  const acc = note.replace(/[^#b]/g, '');
  const baseMap: Record<string, string> = {
    'C': 'Dó', 'D': 'Ré', 'E': 'Mi', 'F': 'Fá', 'G': 'Sol', 'A': 'Lá', 'B': 'Si'
  };
  const accMap: Record<string, string> = {
    '#': ' Sustenido', 'b': ' Bemol', '##': ' Dobrado Sustenido', 'bb': ' Dobrado Bemol'
  };
  const base = baseMap[pc.toUpperCase()] || pc;
  const alteration = accMap[acc] || acc;
  return `${base}${alteration}`;
};

// Converte qualquer nota para a notação desejada (bemóis ou sustenidos)
export const getNoteNameWithNotation = (note: string, useFlat: boolean): string => {
  if (!note) return '';
  const pc = Note.pitchClass(note);
  const oct = Note.octave(note);
  
  let convertedPc = pc;
  if (useFlat) {
    const sharpToFlat: Record<string, string> = {
      'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
      'C##': 'D', 'D##': 'E', 'F##': 'G', 'G##': 'A', 'A##': 'B',
    };
    if (sharpToFlat[pc]) {
      convertedPc = sharpToFlat[pc];
    }
  } else {
    const flatToSharp: Record<string, string> = {
      'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
      'Dbb': 'C', 'Ebb': 'D', 'Gbb': 'F', 'Abb': 'G', 'Bbb': 'A',
    };
    if (flatToSharp[pc]) {
      convertedPc = flatToSharp[pc];
    }
  }
  
  return (oct !== null && oct !== undefined) ? `${convertedPc}${oct}` : convertedPc;
};

// Formata uma cifra de acorde completa (como C#/E# ou F#m7/C#) para a notação escolhida
export const formatChordNameWithNotation = (chordName: string, useFlat: boolean): string => {
  if (!chordName) return '';
  return chordName.replace(/([A-G])(##|bb|#|b)?/g, (match) => {
    return getNoteNameWithNotation(match, useFlat);
  });
};

// Lista Negra de Padrões (ListaNegraPadroes) para evitar matches musicalmente incoerentes
function isBlacklisted(def: ChordDefinition, relativeSemitones: Set<number>): boolean {
  // Se o acorde for suspenso, não pode conter terças (3 ou 4), pois descaracteriza a suspensão
  if (def.quality === "Suspenso") {
    if (relativeSemitones.has(3) || relativeSemitones.has(4)) {
      return true;
    }
  }

  // Se o acorde for Maior ou Dominante, e não prever terça menor (3) na definição (como 7(9#)),
  // mas o usuário tocou terça menor (3) junto com a terça maior (4), isso indica choque direto inapropriado
  if ((def.quality === "Maior" || def.quality === "Dominante") && !def.intervals.includes(3)) {
    if (relativeSemitones.has(3)) {
      return true;
    }
  }

  // Se o acorde for Menor, e o usuário tocou terça maior (4), gera choque direto com a terça menor (3)
  if (def.quality === "Menor" && !def.intervals.includes(4)) {
    if (relativeSemitones.has(4)) {
      return true;
    }
  }

  // Se o acorde tem sétima menor (10) mas tocou sétima maior (11) (sem que 11 seja parte da definição), conflito
  if (def.intervals.includes(10) && relativeSemitones.has(11) && !def.intervals.includes(11)) {
    return true;
  }

  // Se o acorde tem sétima maior (11) mas tocou sétima menor (10) (sem que 10 seja parte da definição), conflito
  if (def.intervals.includes(11) && relativeSemitones.has(10) && !def.intervals.includes(10)) {
    return true;
  }

  // Acorde Diminuto com quinta justa (7) gera conflito com a quinta diminuta (6)
  if (def.quality === "Diminuto" && relativeSemitones.has(7)) {
    return true;
  }

  // Se o acorde for de 6ª (Maior com 6 ou Menor com 6), mas o usuário tocou alguma sétima (10 ou 11),
  // isso deve ser considerado um acorde com 7ª e 13ª, então desqualificamos o de 6ª.
  if (def.name.includes("com 6") || def.symbol.startsWith("6") || def.symbol.startsWith("m6")) {
    if (relativeSemitones.has(10) || relativeSemitones.has(11)) {
      return true;
    }
  }

  return false;
}

function isIntervalTensionForChord(interval: number, quality: string): boolean {
  if (interval === 0 || interval === 3 || interval === 4 || interval === 7 || interval === 10 || interval === 11) {
    return false;
  }
  if (interval === 1) {
    return true; // 9b
  }
  if (interval === 2) {
    return quality !== "Suspenso"; // 9
  }
  if (interval === 5) {
    return quality !== "Suspenso"; // 11
  }
  if (interval === 6) {
    return quality !== "Diminuto" && quality !== "Meio-Diminuto"; // 11# vs b5
  }
  if (interval === 8) {
    return quality !== "Aumentado" && quality !== "Meio-Diminuto"; // 13b vs #5
  }
  if (interval === 9) {
    return true; // 13
  }
  return false;
}

export const analyzePlayedNotes = (midiNumbers: number[], useFlat: boolean = false, useEasyMode: boolean = false, onlyChords: boolean = false): ChordAnalysis | null => {
  if (!midiNumbers || midiNumbers.length === 0) return null;

  // Ordenar MIDI números
  const sortedMidis = [...midiNumbers].sort((a, b) => a - b);
  const lowestMidi = sortedMidis[0];
  
  // Converter notas usando a preferência de notação
  const notesWithOctave = sortedMidis.map(m => getNoteNameWithNotation(Note.fromMidi(m), useFlat));
  const notesWithoutOctave = sortedMidis.map(m => getNoteNameWithNotation(Note.pitchClass(Note.fromMidi(m)), useFlat));
  
  const uniqueNotes = Array.from(new Set(notesWithoutOctave));
  const bassNote = getNoteNameWithNotation(Note.pitchClass(Note.fromMidi(lowestMidi)), useFlat);
  const bassChroma = lowestMidi % 12;

  // Encontra o grupo contíguo de baixo (mesma nota/oitavas consecutivas no início)
  let bassGroupCount = 1;
  for (let i = 1; i < sortedMidis.length; i++) {
    if (sortedMidis[i] % 12 === bassChroma) {
      bassGroupCount++;
    } else {
      break;
    }
  }

  const upperMidis = sortedMidis.slice(bassGroupCount);
  const upperChromas = new Set(upperMidis.map(m => m % 12));
  const isBassDoubled = upperChromas.has(bassChroma);

  // 1. Apenas 1 nota tocada
  if (sortedMidis.length === 1) {
    if (onlyChords) {
      return null;
    }
    const singleNote = notesWithOctave[0];
    const noteName = getNoteNameWithNotation(Note.pitchClass(Note.fromMidi(sortedMidis[0])), useFlat);
    const notePT = noteToPT(noteName);
    return {
      name: `Nota Isolada: ${notePT}`,
      chordName: noteName,
      formula: 'Fundamental',
      intervals: ['Fundamental'],
      notes: [singleNote],
      root: noteName,
      bass: noteName,
      type: 'Nota Única',
      scales: [
        `${noteName} Maior (${notePT} Jônio)`, 
        `${noteName} Menor (${notePT} Eólio)`, 
        `Pentatônica de ${notePT}`
      ],
    };
  }

  // 2. Duas notas tocadas (Intervalo Harmônico)
  if (sortedMidis.length === 2) {
    if (onlyChords) {
      return null;
    }
    const note1 = Note.fromMidi(sortedMidis[0]);
    const note2 = Note.fromMidi(sortedMidis[1]);
    const pc1 = getNoteNameWithNotation(Note.pitchClass(note1), useFlat);
    const pc2 = getNoteNameWithNotation(Note.pitchClass(note2), useFlat);
    const intervalCode = Note.distance(note1, note2);
    const intervalPT = translateInterval(intervalCode);

    return {
      name: `Intervalo: ${intervalPT}`,
      chordName: `${pc1} + ${pc2} (${intervalCode})`,
      formula: `1 + ${intervalCode}`,
      intervals: [intervalPT],
      notes: [pc1, pc2],
      root: pc1,
      bass: pc1,
      type: 'Intervalo Harmônico',
      scales: [
        `Escala de ${noteToPT(pc1)} Maior`, 
        `Escala de ${noteToPT(pc2)} Maior`
      ],
    };
  }

  // 3. Três ou mais notas (Detecção com base no algoritmo customizado de pontuação e inversão)
  const uniqueChromas = Array.from(new Set(sortedMidis.map(m => m % 12)));

  interface CandidateMatch {
    definition: ChordDefinition;
    rootChroma: number;
    rootName: string;
    isFundamental: boolean;
    displayChordName: string;
    score: number;
  }

  const matches: CandidateMatch[] = [];

  // Tenta cada nota tocada como a tônica (root) candidata
  for (const rootChroma of uniqueChromas) {
    // Calcular semitons relativos em relação a este root candidato para o conjunto total
    const relativeSemitones = new Set<number>();
    for (const chroma of uniqueChromas) {
      relativeSemitones.add((chroma - rootChroma + 12) % 12);
    }

    // Procura na nossa base customizada
    for (const def of SORTED_CHORD_DEFINITIONS) {
      // REGRA: Omitir acordes da definição "sem 5a" se o usuário tocou poucas notas (<= 3 notas)
      const lacksFifth = !def.intervals.includes(7) && (def.intervals.includes(3) || def.intervals.includes(4)) && (def.intervals.includes(10) || def.intervals.includes(11));
      if (lacksFifth && sortedMidis.length <= 3) {
        continue;
      }

      // Constrói o conjunto de semitons do "acorde em si" para esta definição candidata.
      // Se a nota for de mesma classe de altura que o baixo (bassChroma), e NÃO for um dos intervalos
      // essenciais definidos para este acorde, nós a ignoramos para que atue apenas como baixo de slash chord
      // (por exemplo, em C7/B ou C/D), independentemente de o baixo estar dobrado ou não.
      const chordItselfSemitones = new Set<number>();
      for (const chroma of uniqueChromas) {
        const semitone = (chroma - rootChroma + 12) % 12;
        if (chroma === bassChroma) {
          if (!def.intervals.includes(semitone)) {
            continue;
          }
        }
        chordItselfSemitones.add(semitone);
      }

      // O acorde da base é considerado compatível se TODOS os seus intervalos essenciais
      // forem encontrados no conjunto de semitons do "acorde em si"
      const matchesAll = def.intervals.every(semitone => chordItselfSemitones.has(semitone));
      if (!matchesAll) continue;

      // Filtra pela Lista Negra de Padrões usando o conjunto de semitons do "acorde em si"
      if (isBlacklisted(def, chordItselfSemitones)) {
        continue;
      }

      const rootMidi = sortedMidis.find(m => m % 12 === rootChroma) ?? sortedMidis[0] ?? 60;
      const rootName = getNoteNameWithNotation(Note.pitchClass(Note.fromMidi(rootMidi)), useFlat);

      // Se a tônica corresponde ao baixo real, é posição fundamental
      const isFundamental = rootChroma === bassChroma;

      // Se for inversão de acorde com pontuação permitida zero, descarta
      if (!isFundamental && def.pontuacaoInversaoPermitida === 0) {
        continue;
      }

      // Detecção de tensões e alterações adicionais tocadas (ignorando o baixo a menos que ele esteja dobrado nas vozes superiores)
      const extraNotes = Array.from(relativeSemitones).filter(n => !def.intervals.includes(n));
      const filteredExtraNotes = extraNotes.filter(n => {
        const isBassInterval = n === (bassChroma - rootChroma + 12) % 12;
        if (isBassInterval) {
          return isBassDoubled;
        }
        return true;
      });

      const tensions: number[] = [];
      const alterations: number[] = [];

      for (const extra of filteredExtraNotes) {
        if (extra === 2 || extra === 5 || extra === 9) {
          tensions.push(extra);
        } else if (extra === 1 || extra === 3 || extra === 6 || extra === 8) {
          alterations.push(extra);
        }
      }

      // Calcular Prioridade Efetiva (CalcularPrioridadeEfetiva)
      let score = def.priority;

      // Recompensa pelo tamanho do padrão essencial
      score += def.intervals.length * 15;

      // REGRA: Recompensa para matches exatos (evita que notas extras poluam o matching de tríades simples)
      if (filteredExtraNotes.length === 0 && def.intervals.length === chordItselfSemitones.size) {
        score += 20;
      }

      // REGRA: Penalização de acordes sem quinta se a quinta não for tocada
      const isStandardQuality = def.quality === "Maior" || def.quality === "Menor" || def.quality === "Dominante";
      const lacksFifthInDef = !def.intervals.includes(7);
      if (isStandardQuality && lacksFifthInDef) {
        const hasFifthPlayed = relativeSemitones.has(7);
        if (!hasFifthPlayed) {
          score -= 15; // Penalização leve se o acorde for de qualidade padrão mas não tiver a quinta tocada
        }
      }

      // Penalidade de Inversão / Bônus de Fundamental
      if (!isFundamental) {
        const inversionPenalty = (100 - def.pontuacaoInversaoPermitida) * 0.5;
        score -= inversionPenalty;

        const bassRelative = (bassChroma - rootChroma + 12) % 12;

        // Estrutura superior disfarçada
        if (def.symbol !== "m7M" && (def.quality === "Menor" || def.quality === "Meio-Diminuto")) {
          if (bassRelative === 11 || bassRelative === 2) {
            score -= 40;
          }
        }

        // Se o baixo for uma tensão/extensão (e não uma nota tonal básica como 1, 3, 5, 7),
        // aplicamos uma penalidade extra significativa para priorizar fundamentais ou inversões padrão.
        if (isIntervalTensionForChord(bassRelative, def.quality)) {
          // Reduzimos a penalidade para a 9ª (2) e 11ª/4ª (5) se for um acorde Maior, Menor ou Dominante,
          // pois baixo em 9 e 11 são baixos extremamente comuns em slash chords (ex: C/D, C/F, F/G).
          const isCommonSlashBass = (bassRelative === 2 || bassRelative === 5) && 
                                    (def.quality === "Maior" || def.quality === "Menor" || def.quality === "Dominante");
          score -= isCommonSlashBass ? 10 : 35;
        }

        // Penalidade para inversão complexa (acorde invertido com mais de 4 notas na definição ou com notas extras)
        if (def.intervals.length > 4 || filteredExtraNotes.length > 0) {
          score -= 30;
        }
      } else {
        score += 25; // Bônus significativo para preferir posição fundamental sobre inversões equivalentes
      }

      // Penalidade por notas extras
      const extraCount = filteredExtraNotes.length;
      if (extraCount > 0) {
        if (def.podeTerTensoes) {
          score -= extraCount * 5; // Pequena penalidade
        } else {
          score -= extraCount * 30; // Grande penalidade por poluição no acorde restrito
        }
      }

      // Montar Símbolo Final com TENSÕES E ALTERAÇÕES se permitido
      let finalSymbol = def.symbol;

      const isBassOnlyInBass = !isBassDoubled;
      const bassRelative = (bassChroma - rootChroma + 12) % 12;

      // 1. Limpeza do baixo na sétima
      if (!isFundamental && (bassRelative === 10 || bassRelative === 11) && isBassOnlyInBass) {
        const tipoCoincide = (bassRelative === 10 && finalSymbol.includes("7") && !finalSymbol.includes("7M")) ||
                             (bassRelative === 11 && finalSymbol.includes("7M"));
        const ehSimbSimples = ["7", "m7", "7M", "m7M", "7sus4"].includes(finalSymbol);
        if (tipoCoincide && ehSimbSimples) {
          finalSymbol = finalSymbol.replace("7M", "").replace("7", "");
          if (def.quality === "Menor" && !finalSymbol.includes("m")) {
            finalSymbol = "m" + finalSymbol;
          }
        }
      }

      // 2. Limpeza do baixo na quarta
      if (!isFundamental && bassRelative === 5 && isBassOnlyInBass) {
        if (finalSymbol.includes("sus4")) {
          finalSymbol = finalSymbol.replace("sus4", "");
        } else if (finalSymbol.includes("add4")) {
          finalSymbol = finalSymbol.replace("add4", "").replace("()", "");
        } else if (finalSymbol.includes("4")) {
          finalSymbol = finalSymbol.replace("4", "").replace("()", "");
        }
      }

      // 3. Limpeza do baixo na terça (transformação em sus4)
      if (!isFundamental && (bassRelative === 3 || bassRelative === 4) && isBassOnlyInBass) {
        if (relativeSemitones.has(5)) {
          if (finalSymbol === "7" || finalSymbol === "m7") {
            finalSymbol = "7sus4";
            const idx5 = tensions.indexOf(5);
            if (idx5 > -1) tensions.splice(idx5, 1);
          } else if (finalSymbol === "4" || finalSymbol === "add4") {
            finalSymbol = "sus4";
            const idx5 = tensions.indexOf(5);
            if (idx5 > -1) tensions.splice(idx5, 1);
          } else if (finalSymbol === "m(4)") {
            finalSymbol = "sus4";
            const idx5 = tensions.indexOf(5);
            if (idx5 > -1) tensions.splice(idx5, 1);
          } else if (finalSymbol === "" || finalSymbol === "m") {
            finalSymbol = "sus4";
            const idx5 = tensions.indexOf(5);
            if (idx5 > -1) tensions.splice(idx5, 1);
          }
        }
      }

      // 4. Limpeza do baixo na nona
      if (!isFundamental && bassRelative === 2) {
        if (isBassOnlyInBass && finalSymbol.includes("add9")) {
          finalSymbol = finalSymbol.replace("add9", "").replace("()", "");
        }
      }

      if (def.podeTerTensoes && (tensions.length > 0 || alterations.length > 0)) {
        // Ordena tensões/alterações na ordem musical: 9 -> 11 -> 13
        const sortedExtras = [...tensions, ...alterations].sort((a, b) => {
          const getDegree = (n: number) => {
            if (n <= 3) return 9;
            if (n <= 6) return 11;
            return 13;
          };
          return getDegree(a) - getDegree(b);
        });

        const formattedExtras = sortedExtras.map(n => {
          // Se for uma 9 sem sétima, retorna add9
          if (n === 2 && !relativeSemitones.has(10) && !relativeSemitones.has(11)) {
            return "add9";
          }
          // Se for uma 11/4 sem sétima, retorna add11 (se tiver 9 junto) ou add4
          if (n === 5 && !relativeSemitones.has(10) && !relativeSemitones.has(11)) {
            if (relativeSemitones.has(2)) {
              return "add11";
            }
            return "add4";
          }
          if (n === 5 && def.quality === "Maior" && !relativeSemitones.has(10) && !relativeSemitones.has(11)) {
            return "add4";
          }
          return tensionMap[n];
        }).filter(Boolean);

        if (formattedExtras.length > 0) {
          if (finalSymbol.endsWith(')')) {
            const inside = finalSymbol.slice(finalSymbol.indexOf('(') + 1, -1);
            const insideList = inside.split(',').map(s => s.trim()).filter(Boolean);
            const combinedList = [...insideList, ...formattedExtras];
            const tensionOrder = ["9b", "9", "9#", "11", "11#", "13b", "13"];
            combinedList.sort((a, b) => tensionOrder.indexOf(a) - tensionOrder.indexOf(b));

            // Remove o "9" se o "13" também estiver presente (ex: C7(11,13) em vez de C7(9,11,13))
            if (def.quality !== "Meio-Diminuto" && def.quality !== "Menor") {
              if (combinedList.includes("13") && combinedList.includes("9")) {
                const idx9 = combinedList.indexOf("9");
                if (idx9 > -1) combinedList.splice(idx9, 1);
              }
            }

            finalSymbol = `${finalSymbol.slice(0, finalSymbol.indexOf('('))}(${combinedList.join(',')})`;
          } else {
            // Remove o "9" se o "13" também estiver presente (ex: C7(11,13) em vez de C7(9,11,13))
            if (def.quality !== "Meio-Diminuto" && def.quality !== "Menor") {
              if (formattedExtras.includes("13") && formattedExtras.includes("9")) {
                const idx9 = formattedExtras.indexOf("9");
                if (idx9 > -1) formattedExtras.splice(idx9, 1);
              }
            }

            if (finalSymbol === "" && formattedExtras.length === 1 && formattedExtras[0] === "9") {
              finalSymbol = "9"; // Exibe C9 em vez de C(9) de forma mais elegante
            } else {
              finalSymbol = `${finalSymbol}(${formattedExtras.join(',')})`;
            }
          }
        }
      }

      // Se "Easy Mode" estiver ligado e for tríade (com no máximo 3 notas tocadas no total), removemos a inversão
      const isTriad = def.intervals.length === 3;
      const hideInversion = useEasyMode && isTriad && sortedMidis.length <= 3;
      const actualIsFundamental = isFundamental || hideInversion;

      // No fundamental, NUNCA exibir barra de baixo (ex: mostrar apenas C em vez de C/C ou CM/C)
      const displayChordName = actualIsFundamental
        ? `${rootName}${finalSymbol}`
        : `${rootName}${finalSymbol}/${bassNote}`;

      matches.push({
        definition: def,
        rootChroma,
        rootName,
        isFundamental: actualIsFundamental,
        displayChordName,
        score
      });
    }
  }

  if (matches.length > 0) {
    // Ordena os resultados pela pontuação descrescente para obter o match ideal
    matches.sort((a, b) => b.score - a.score);
    const bestMatch = matches[0];
    const root = bestMatch.rootName;
    const quality = bestMatch.definition.quality;
    const chordTitleName = bestMatch.definition.name || 'Maior';

    // Sugerir escalas didáticas apropriadas em português
    const suggestedScales: string[] = [];
    const rootPT = noteToPT(root);

    if (quality === 'Maior') {
      suggestedScales.push(`${rootPT} Jônio (Maior)`, `${rootPT} Lídio`, `${rootPT} Pentatônica Maior`);
    } else if (quality === 'Menor') {
      suggestedScales.push(`${rootPT} Eólio (Menor Natural)`, `${rootPT} Dórico`, `${rootPT} Menor Harmônica`);
    } else if (quality === 'Dominante') {
      suggestedScales.push(`${rootPT} Mixolídio`, `${rootPT} Lídio b7`, `${rootPT} Alterada`);
    } else if (quality === 'Diminuto') {
      suggestedScales.push(`${rootPT} Diminuta (Tom/Semitom)`, `${rootPT} Lócrio`);
    } else if (quality === 'Meio-Diminuto') {
      suggestedScales.push(`${rootPT} Lócrio`, `${rootPT} Lócrio 9#`);
    } else if (quality === 'Aumentado') {
      suggestedScales.push(`${rootPT} Tons Inteiros`, `${rootPT} Lídio #5`);
    } else if (quality === 'Suspenso') {
      suggestedScales.push(`${rootPT} Mixolídio`, `${rootPT} Pentatônica Menor`);
    } else {
      suggestedScales.push(`${rootPT} Maior`, `${rootPT} Pentatônica`);
    }

    const intervalsPT = bestMatch.definition.intervals.map(semitone => intervalMapDesc[semitone] || `${semitone} semitons`);
    const formula = bestMatch.definition.intervals.map(semitone => formulaMap[semitone] || `${semitone}`).join(' - ');

    const rootNamePT = noteToPT(root);
    const bassNotePT = noteToPT(bassNote);

    const isTriad = bestMatch.definition.intervals.length === 3;
    const hideInversionName = useEasyMode && isTriad && !bestMatch.isFundamental;

    const parsedSymbolMatch = bestMatch.displayChordName.split('/');
    const symbolWithoutBass = parsedSymbolMatch[0].substring(root.length);
    let descriptiveName = getFullChordDescriptionPT(root, symbolWithoutBass);
    if (hideInversionName) {
      descriptiveName += ` (Inversão Omitida para Iniciantes)`;
    } else if (!bestMatch.isFundamental) {
      descriptiveName += ` (Invertido com Baixo em ${bassNotePT})`;
    } else {
      descriptiveName += ` (Fundamental)`;
    }

    return {
      name: descriptiveName,
      chordName: bestMatch.displayChordName,
      formula: formula,
      intervals: intervalsPT,
      notes: uniqueNotes,
      root: root,
      bass: bassNote,
      type: chordTitleName,
      scales: suggestedScales,
    };
  }

  // Fallback para TonalJS Chord.detect se não houver correspondência exata na base de dados customizada
  const otherUniqueNotes = uniqueNotes.filter(n => n !== bassNote);
  const uniqueNotesWithBassFirst = [bassNote, ...otherUniqueNotes];

  const detectedNames = Chord.detect(uniqueNotesWithBassFirst);

  // Filtra nomes detectados que sejam power chords (quintas) invertidos com baixo na quinta (ex: C5/G)
  const validDetectedNames = detectedNames.filter(name => {
    const parts = name.split('/');
    const baseSymbol = parts[0];
    const bassSymbol = parts.length > 1 ? parts[1] : null;
    if (!bassSymbol) return true; // Se não tem baixo invertido, é válido

    const chordInfo = Chord.get(baseSymbol);
    if (chordInfo.empty) return true;

    const isPowerChord = chordInfo.type === 'fifth' || chordInfo.type === '5' || baseSymbol.endsWith('5');
    if (isPowerChord) {
      // Verifica se o baixo é a quinta justa do root
      const rootChroma = Note.chroma(chordInfo.tonic || chordInfo.root || '');
      const bassChroma = Note.chroma(bassSymbol);
      if (rootChroma !== undefined && bassChroma !== undefined) {
        const distance = (bassChroma - rootChroma + 12) % 12;
        if (distance === 7) {
          // É um X5/sua quinta! Vamos rejeitar
          return false;
        }
      }
    }
    return true;
  });

  if (validDetectedNames.length > 0) {
    const bestMatch = formatChordNameWithNotation(validDetectedNames[0], useFlat);
    const parts = bestMatch.split('/');
    const baseSymbol = parts[0];
    const bassFromDetect = parts.length > 1 ? parts[1] : null;

    const chordInfo = Chord.get(baseSymbol);
    
    if (!chordInfo.empty) {
      const root = getNoteNameWithNotation(chordInfo.tonic || chordInfo.root || '', useFlat);
      const intervalsPT = chordInfo.intervals.map(translateInterval);
      const formula = chordInfo.intervals.join(' - ');
      const isFundamental = !bassFromDetect || Note.chroma(bassFromDetect) === Note.chroma(root);
      
      const isTriad = chordInfo.intervals.length === 3;
      const hideInversion = useEasyMode && isTriad && sortedMidis.length <= 3;
      const actualIsFundamental = isFundamental || hideInversion;

      let displayBaseSymbol = baseSymbol;
      if (chordInfo.type === 'major' || chordInfo.type === 'major triad' || baseSymbol === `${root}M` || baseSymbol === `${root}maj`) {
        displayBaseSymbol = root;
      }
      
      const displayChordName = actualIsFundamental 
        ? displayBaseSymbol 
        : `${displayBaseSymbol}/${bassFromDetect}`;

      const rootPT = noteToPT(root);
      const suggestedScales: string[] = [`${rootPT} Maior`, `Pentatônica de ${rootPT}`];

      const parsedSymbolMatch = displayChordName.split('/');
      const symbolWithoutBass = parsedSymbolMatch[0].substring(root.length);
      let descriptiveName = getFullChordDescriptionPT(root, symbolWithoutBass);
      if (!actualIsFundamental) {
        descriptiveName += ` (Invertido com Baixo em ${noteToPT(bassFromDetect || root)})`;
      } else {
        descriptiveName += ` (Fundamental)`;
      }

      return {
        name: descriptiveName,
        chordName: displayChordName,
        formula: formula,
        intervals: intervalsPT,
        notes: uniqueNotesWithBassFirst,
        root: root,
        bass: bassFromDetect || root,
        type: translateChordType(chordInfo.type),
        scales: suggestedScales,
      };
    }
  }

  // Fallback final: representação de Cluster / Sons avulsos (deixado vazio para não poluir a exibição)
  return {
    name: '',
    chordName: '',
    formula: 'Personalizada',
    intervals: uniqueNotes.map((n, idx) => {
      if (idx === 0) return 'Fundamental';
      const dist = Note.distance(uniqueNotes[0], n);
      return translateInterval(dist);
    }),
    notes: uniqueNotes,
    root: bassNote,
    bass: bassNote,
    type: 'Sons Avulsos',
    scales: [`Escala de ${noteToPT(bassNote)} Cromática`, `Escala Pentatônica de ${noteToPT(bassNote)}`],
  };
};

// Gera descrição ultra completa em português, incluindo as tensões dinâmicas (9, 11, 13) que foram detectadas
export const getFullChordDescriptionPT = (root: string, symbol: string): string => {
  const rootPT = noteToPT(root);
  
  if (!symbol) return `${rootPT} Maior`;

  // Extrair o conteúdo dos parênteses se houver
  const parenMatch = symbol.match(/\(([^)]+)\)/);
  let baseSymbol = symbol;
  let tensions: string[] = [];
  
  if (parenMatch) {
    baseSymbol = symbol.slice(0, symbol.indexOf('('));
    tensions = parenMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }

  let basePT = "";
  if (baseSymbol === "") basePT = "Maior";
  else if (baseSymbol === "m") basePT = "Menor";
  else if (baseSymbol === "7") basePT = "com Sétima";
  else if (baseSymbol === "7M") basePT = "Maior com Sétima Maior";
  else if (baseSymbol === "m7") basePT = "Menor com Sétima";
  else if (baseSymbol === "m7M") basePT = "Menor com Sétima Maior";
  else if (baseSymbol === "m7b5") basePT = "Meio-Diminuto";
  else if (baseSymbol === "°") basePT = "Diminuto";
  else if (baseSymbol === "°7") basePT = "Diminuto com Sétima";
  else if (baseSymbol === "6") basePT = "Maior com Sexta";
  else if (baseSymbol === "m6") basePT = "Menor com Sexta";
  else if (baseSymbol === "sus4") basePT = "Suspenso 4";
  else if (baseSymbol === "sus2") basePT = "Suspenso 2";
  else if (baseSymbol === "7sus4") basePT = "Suspenso com Sétima";
  else if (baseSymbol === "5#") basePT = "Aumentado";
  else if (baseSymbol === "5b") basePT = "Maior com Quinta Diminuta";
  else {
    basePT = translateChordType(baseSymbol) || baseSymbol;
  }

  const tensionTranslation: Record<string, string> = {
    "9b": "nona bemol",
    "9": "nona",
    "9#": "nona aumentada",
    "11": "décima primeira",
    "11#": "décima primeira aumentada",
    "13b": "décima terceira bemol",
    "13": "décima terceira",
    "add9": "nona adicionada",
    "add11": "décima primeira adicionada",
    "add4": "quarta adicionada",
  };

  const translatedTensions = tensions.map(t => tensionTranslation[t] || t);

  let fullDescription = `${rootPT}`;
  if (basePT === "Maior" || basePT === "Menor" || basePT === "Meio-Diminuto" || basePT === "Diminuto" || basePT === "Aumentado") {
    fullDescription += ` ${basePT}`;
    if (translatedTensions.length > 0) {
      if (translatedTensions.length === 1) {
        fullDescription += ` com ${translatedTensions[0]}`;
      } else {
        const last = translatedTensions.pop();
        fullDescription += ` com ${translatedTensions.join(', ')} e ${last}`;
      }
    }
  } else if (basePT.includes("com")) {
    fullDescription += ` ${basePT}`;
    if (translatedTensions.length > 0) {
      if (translatedTensions.length === 1) {
        fullDescription += ` e ${translatedTensions[0]}`;
      } else {
        const last = translatedTensions.pop();
        fullDescription += `, ${translatedTensions.join(', ')} e ${last}`;
      }
    }
  } else {
    fullDescription += ` ${basePT}`;
    if (translatedTensions.length > 0) {
      fullDescription += ` (${translatedTensions.join(', ')})`;
    }
  }

  return fullDescription;
};
