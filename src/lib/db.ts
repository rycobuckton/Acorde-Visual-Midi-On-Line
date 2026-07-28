const DB_NAME = 'sf2_synth_db';
const STORE_NAME = 'soundfonts';
const METADATA_STORE_NAME = 'soundfonts_metadata';
const DB_VERSION = 2;

export interface StoredSoundFont {
  id: string;
  name: string;
  data: ArrayBuffer;
  timestamp?: number;
}

export interface SoundFontMetadata {
  id: string;
  name: string;
  sizeMb: number;
  presetsCount: number;
  presets: { name: string; preset: number; bank: number }[];
  timestamp?: number;
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save binary data AND optional metadata
export async function saveSoundFont(
  id: string, 
  name: string, 
  data: ArrayBuffer, 
  presets?: { name: string; preset: number; bank: number }[]
): Promise<void> {
  const db = await openDB();
  
  // 1. Save binary data
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, name, data, timestamp: Date.now() });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });

  // 2. Save metadata if presets list is provided
  if (presets) {
    await saveSoundFontMetadata({
      id,
      name,
      sizeMb: data.byteLength / (1024 * 1024),
      presetsCount: presets.length,
      presets,
      timestamp: Date.now()
    });
  }
}

// Save metadata record separately
export async function saveSoundFontMetadata(metadata: SoundFontMetadata): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.put({ ...metadata, timestamp: metadata.timestamp ?? Date.now() });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get metadata of a single SoundFont
export async function getSoundFontMetadata(id: string): Promise<SoundFontMetadata | null> {
  const db = await openDB();
  return new Promise<SoundFontMetadata | null>((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Check if metadata exists for a given ID
export async function hasMetadata(id: string): Promise<boolean> {
  const meta = await getSoundFontMetadata(id);
  return meta !== null;
}

// Get all stored keys from raw soundfonts store (for migration)
export async function getRawSoundFontKeys(): Promise<string[]> {
  const db = await openDB();
  return new Promise<string[]>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as string[]) || []);
  });
}

// Get raw record from soundfonts store (for migration)
export async function getRawSoundFontRecord(id: string): Promise<StoredSoundFont | null> {
  const db = await openDB();
  return new Promise<StoredSoundFont | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

// Load only the lightweight metadata for all SoundFonts
export async function loadAllSoundFontsMetadata(): Promise<SoundFontMetadata[]> {
  const db = await openDB();
  return new Promise<SoundFontMetadata[]>((resolve, reject) => {
    const transaction = db.transaction(METADATA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(METADATA_STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const rawResult = request.result || [];
      const result = rawResult.filter((item): item is SoundFontMetadata => item !== null && item !== undefined);
      result.sort((a, b) => {
        const tA = a.timestamp ?? 0;
        const tB = b.timestamp ?? 0;
        if (tA !== tB) {
          return tA - tB;
        }
        return (a.id || '').localeCompare(b.id || '');
      });
      resolve(result);
    };
  });
}

// Load full binary data for a specific SoundFont
export async function loadSoundFontData(id: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise<ArrayBuffer | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result && request.result.data) {
        resolve(request.result.data);
      } else {
        resolve(null);
      }
    };
  });
}

// Delete from both stores
export async function deleteSoundFont(id: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metaStore = transaction.objectStore(METADATA_STORE_NAME);
    
    const req1 = store.delete(id);
    const req2 = metaStore.delete(id);
    
    let err: any = null;
    req1.onerror = () => { err = req1.error; };
    req2.onerror = () => { err = req2.error; };
    
    transaction.oncomplete = () => {
      if (err) reject(err);
      else resolve();
    };
    transaction.onerror = () => reject(transaction.error || err);
  });
}

// Clear all records from both stores
export async function clearAllSoundFonts(): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const metaStore = transaction.objectStore(METADATA_STORE_NAME);
    
    store.clear();
    metaStore.clear();
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
