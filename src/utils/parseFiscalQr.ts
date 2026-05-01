export interface FiscalQrData {
  totalAmount: number;
  dateTime: Date;
  invoiceType: string;
  transactionType: string;
  requestedBy: string;
  signedBy: string;
  totalCounter: number;
  transactionTypeCounter: number;
}

const INVOICE_TYPES: Record<number, string> = {
  0x00: 'Normalan',
  0x01: 'Pro Forma',
  0x02: 'Kopija',
  0x03: 'Obuka',
  0x04: 'Avans',
};

const TRANSACTION_TYPES: Record<number, string> = {
  0x00: 'Prodaja',
  0x01: 'Refundacija',
};

function readUint64LE(bytes: Uint8Array, offset: number): number {
  let value = 0;
  let multiplier = 1;
  for (let i = 0; i < 8; i++) {
    value += bytes[offset + i] * multiplier;
    multiplier *= 256;
  }
  return value;
}

function readUint64BE(bytes: Uint8Array, offset: number): number {
  let value = 0;
  for (let i = 0; i < 8; i++) {
    value = value * 256 + bytes[offset + i];
  }
  return value;
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[offset + i];
    if (byte === 0) break;
    result += String.fromCharCode(byte);
  }
  return result;
}

export function parseFiscalQr(url: string): FiscalQrData | null {
  try {
    const urlObj = new URL(url);
    const vl = urlObj.searchParams.get('vl');
    if (!vl) return null;

    const binaryString = atob(vl);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length < 44) return null;
    if (bytes[0] !== 0x03) return null;

    const requestedBy = readAscii(bytes, 1, 8);
    const signedBy = readAscii(bytes, 9, 8);
    const totalCounter = readInt32LE(bytes, 17);
    const transactionTypeCounter = readInt32LE(bytes, 21);
    const totalAmountRaw = readUint64LE(bytes, 25);
    const totalAmount = totalAmountRaw / 10000;
    const timestampMs = readUint64BE(bytes, 33);
    const dateTime = new Date(timestampMs);
    const invoiceType = INVOICE_TYPES[bytes[41]] ?? 'Unknown';
    const transactionType = TRANSACTION_TYPES[bytes[42]] ?? 'Unknown';

    if (totalAmount < 0 || totalAmount > 100_000_000) return null;
    if (isNaN(dateTime.getTime())) return null;

    return {
      totalAmount,
      dateTime,
      invoiceType,
      transactionType,
      requestedBy,
      signedBy,
      totalCounter,
      transactionTypeCounter,
    };
  } catch {
    return null;
  }
}
