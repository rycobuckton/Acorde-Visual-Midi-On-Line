export function noteToMidi(noteStr: string): number {
  if (!noteStr) return 60;
  
  const cleanStr = noteStr.trim().toUpperCase();
  // Handle literal MIDI numbers
  if (/^\d+$/.test(cleanStr)) {
    return parseInt(cleanStr);
  }
  
  const pcMap: Record<string, number> = {
    'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4,
    'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9,
    'A#': 10, 'BB': 10, 'B': 11
  };
  
  const match = cleanStr.match(/^([A-G][#B]?)(-?\d+)$/i);
  if (!match) return 60;
  
  const noteName = match[1];
  const octave = parseInt(match[2]);
  const accidental = noteName.length > 1 ? noteName.charAt(1) : '';
  
  let semitone = pcMap[noteName];
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  
  return (octave + 1) * 12 + semitone;
}
