import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'receipts_cache';
const IMAGE_CACHE_PREFIX = 'receipt_img_';
const PENDING_KEY = 'receipts_pending';

interface CachedReceiptItem {
  id: string;
  sequenceNumber: number;
  fileName: string;
  description: string | null;
  period: string;
  isFiscal: boolean;
  submittedAt: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  aiConfidence: number | null;
}

interface CachedReceipts {
  items: CachedReceiptItem[];
  cachedAt: string;
}

export interface PendingReceipt {
  localId: string;
  imageUri: string;
  description: string;
  savedAt: string;
}

// --- Receipt list cache ---

export async function cacheReceipts(items: CachedReceiptItem[]): Promise<void> {
  try {
    const payload: CachedReceipts = {
      items,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // silent fail
  }
}

export async function getCachedReceipts(): Promise<CachedReceiptItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedReceipts = JSON.parse(raw);
    return parsed.items;
  } catch {
    return null;
  }
}

// --- Image cache ---

export async function cacheReceiptImage(receiptId: string, base64Uri: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${IMAGE_CACHE_PREFIX}${receiptId}`, base64Uri);
  } catch {
    // silent fail
  }
}

export async function getCachedReceiptImage(receiptId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(`${IMAGE_CACHE_PREFIX}${receiptId}`);
  } catch {
    return null;
  }
}

// --- Pending receipts (offline queue) ---

export async function savePendingReceipt(receipt: PendingReceipt): Promise<void> {
  try {
    const existing = await getPendingReceipts();
    existing.push(receipt);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(existing));
  } catch {
    // silent fail
  }
}

export async function getPendingReceipts(): Promise<PendingReceipt[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingReceipt[];
  } catch {
    return [];
  }
}

export async function removePendingReceipt(localId: string): Promise<void> {
  try {
    const existing = await getPendingReceipts();
    const filtered = existing.filter((r) => r.localId !== localId);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(filtered));
  } catch {
    // silent fail
  }
}
