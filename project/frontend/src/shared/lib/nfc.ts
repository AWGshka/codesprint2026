// Web NFC (Chrome on Android, secure context only). Payment cards are EMV smartcards,
// not NDEF tags, so the browser can never read their PAN — but tapping one still fires
// `readingerror` (tag present, not NDEF-readable). That event is how the kiosk detects a
// real physical tap while the payment itself stays simulated with a mock card number.

type NdefReaderLike = {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: { serialNumber?: string }) => void) | null;
  onreadingerror: (() => void) | null;
};

export const nfcAvailable = (): boolean => typeof window !== "undefined" && "NDEFReader" in window && window.isSecureContext;

/** Starts an NFC tap scan; `onTap` fires for any tag (NDEF tags pass their serial, payment
 * cards pass undefined). Resolves to a stop function. Rejects when NFC is off or denied. */
export const startNfcTapScan = async (onTap: (serial?: string) => void): Promise<() => void> => {
  const controller = new AbortController();
  const reader = new (window as unknown as { NDEFReader: new () => NdefReaderLike }).NDEFReader();
  reader.onreading = (event) => onTap(event.serialNumber);
  reader.onreadingerror = () => onTap(undefined);
  await reader.scan({ signal: controller.signal });
  return () => controller.abort();
};

/** Deterministic demo PAN for a detected tap — NDEF serials map to a stable pseudo-number,
 * payment cards (no serial readable) get the standard test card. Never ends in the 0002
 * decline trigger. */
export const mockPanForTap = (serial?: string): string => {
  const hex = serial?.replace(/[^0-9a-f]/gi, "");
  if (!hex) return "4242424242424242";
  const digits = (BigInt(`0x${hex}`) % 10n ** 12n).toString().padStart(12, "0");
  const pan = `4242${digits}`;
  return pan.endsWith("0002") ? `${pan.slice(0, 15)}3` : pan;
};
