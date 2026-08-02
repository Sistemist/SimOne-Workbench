import { unprocessable } from "../errors.js";
import { redactSensitiveText } from "../redaction.js";

const SENSITIVE_URL_QUERY_KEY =
  /(?:api[-_]?key|access[-_]?token|auth(?:[-_]?token)?|token|authorization|bearer|secret|signature|passwd|password|credential|jwt|private[-_]?key|cookie|connectionstring)/i;

function isSecretBearingUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return true;
    return Array.from(parsed.searchParams.keys()).some((key) =>
      SENSITIVE_URL_QUERY_KEY.test(key),
    );
  } catch {
    return false;
  }
}

function collectSensitivePaths(value: unknown, path: string, paths: string[]): void {
  if (typeof value === "string") {
    if (redactSensitiveText(value) !== value || isSecretBearingUrl(value)) {
      paths.push(path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitivePaths(item, `${path}[${index}]`, paths));
    return;
  }
  if (typeof value !== "object" || value === null) return;

  for (const [key, item] of Object.entries(value)) {
    collectSensitivePaths(item, `${path}.${key}`, paths);
  }
}

export function assertNoSecretBearingVentureInput(value: unknown): void {
  const sensitivePaths: string[] = [];
  collectSensitivePaths(value, "$", sensitivePaths);
  if (sensitivePaths.length === 0) return;

  const visiblePaths = sensitivePaths.slice(0, 5);
  const remainder = sensitivePaths.length - visiblePaths.length;
  throw unprocessable(
    [
      `Canonical venture input contains secret-like material at ${visiblePaths.join(", ")}`,
      remainder > 0 ? `and ${remainder} more field(s)` : null,
      "Store credentials in the scoped secret store and keep only safe provenance metadata in canonical venture state.",
    ]
      .filter((part): part is string => Boolean(part))
      .join("; "),
  );
}
