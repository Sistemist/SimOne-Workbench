import type { ScannerSnapshot } from "@paperclipai/shared";

export const SCAN_STORAGE_KEY = "simone:bottleneck-scan";
export const SCAN_HISTORY_STORAGE_KEY = "sysdom:scanner-history:v1";
const MAX_LOCAL_SCANS = 20;

function isScannerSnapshot(value: unknown): value is ScannerSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ScannerSnapshot>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.algorithmVersion === "string" &&
    typeof candidate.savedAt === "string" &&
    Boolean(candidate.input) &&
    Boolean(candidate.result)
  );
}

export function readScannerHistory(): ScannerSnapshot[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SCAN_HISTORY_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(isScannerSnapshot);
  } catch {
    return [];
  }
}

export function findScannerSnapshot(id: string | null): ScannerSnapshot | null {
  if (!id) return null;
  return readScannerHistory().find((scan) => scan.id === id) ?? null;
}

export function readLatestScannerSnapshot(): ScannerSnapshot | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(SCAN_STORAGE_KEY) ?? "null");
    return isScannerSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveScannerSnapshot(snapshot: ScannerSnapshot) {
  const history = readScannerHistory().filter((scan) => scan.id !== snapshot.id);
  history.unshift(snapshot);
  window.localStorage.setItem(
    SCAN_HISTORY_STORAGE_KEY,
    JSON.stringify(history.slice(0, MAX_LOCAL_SCANS)),
  );
  // Keep the established latest-scan key for SIM Starter compatibility.
  window.localStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(snapshot));
}
