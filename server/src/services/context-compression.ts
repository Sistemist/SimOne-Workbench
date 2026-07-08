import { createHash } from "node:crypto";

const DEFAULT_MAX_ARRAY_ITEMS = 3;
const DEFAULT_MAX_OBJECT_KEYS = 24;
const DEFAULT_MAX_STRING_LENGTH = 240;
const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|bearer|password|secret|token/i;
const SENSITIVE_VALUE_PATTERNS = [
  /authorization:\s*bearer\s+[a-z0-9._~+/=-]+/gi,
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /session=[^;\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export interface CompressJsonContextOptions {
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
  sourceKind?: string;
}

export interface JsonContextCompressionEnvelope {
  strategy: "simone_json_headroom_v0";
  sourceKind: string;
  lossy: true;
  inputBytes: number;
  outputBytes: number;
  inputSha256: string;
  outputSha256: string;
  compressionRatio: number;
  truncatedStrings: number;
  omittedArrayItems: number;
  omittedObjectKeys: number;
  redactedKeys: string[];
  redactedValues: number;
  compressedJson: string;
}

interface CompressionStats {
  truncatedStrings: number;
  omittedArrayItems: number;
  omittedObjectKeys: number;
  redactedKeys: Set<string>;
  redactedValues: number;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJsonValue(item)]),
    );
  }
  return value;
}

function sourceKindFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const sourceKind = (payload as Record<string, unknown>).sourceKind;
    if (typeof sourceKind === "string" && sourceKind.trim().length > 0) {
      return sourceKind.trim();
    }
  }
  return fallback;
}

function redactSensitiveString(value: string, stats: CompressionStats): string {
  let redacted = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, (match) => {
      stats.redactedValues += 1;
      if (/^authorization:/i.test(match)) return "Authorization: [redacted]";
      return "[redacted]";
    });
  }
  return redacted;
}

function compressValue(value: unknown, options: Required<CompressJsonContextOptions>, stats: CompressionStats): unknown {
  if (typeof value === "string") {
    const redactedValue = redactSensitiveString(value, stats);
    if (redactedValue.length > options.maxStringLength) {
      stats.truncatedStrings += 1;
      return `${redactedValue.slice(0, options.maxStringLength)}... [truncated ${redactedValue.length - options.maxStringLength} chars]`;
    }
    return redactedValue;
  }

  if (Array.isArray(value)) {
    if (value.length > options.maxArrayItems) {
      const sample = value
        .slice(0, options.maxArrayItems)
        .map((item) => compressValue(item, options, stats));
      const omittedItems = value.length - options.maxArrayItems;
      stats.omittedArrayItems += omittedItems;
      return {
        __simoneCompressedArray: {
          totalItems: value.length,
          sample,
          omittedItems,
        },
      };
    }
    return value.map((item) => compressValue(item, options, stats));
  }

  if (value && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    const visibleEntries = sortedEntries.slice(0, options.maxObjectKeys);
    const omittedKeys = sortedEntries.length - visibleEntries.length;
    const compressedObject = Object.fromEntries(
      visibleEntries.map(([key, item]) => {
          if (SENSITIVE_KEY_PATTERN.test(key)) {
            stats.redactedKeys.add(key);
            return [key, "[redacted]"];
          }
          return [key, compressValue(item, options, stats)];
        }),
    );
    if (omittedKeys > 0) {
      stats.omittedObjectKeys += omittedKeys;
      return {
        __simoneCompressedObject: {
          totalKeys: sortedEntries.length,
          visibleKeys: visibleEntries.length,
          omittedKeys,
          value: compressedObject,
        },
      };
    }
    return compressedObject;
  }

  return value;
}

export function compressJsonContextPayload(
  payload: unknown,
  options: CompressJsonContextOptions = {},
): JsonContextCompressionEnvelope {
  const resolvedOptions: Required<CompressJsonContextOptions> = {
    maxArrayItems: options.maxArrayItems ?? DEFAULT_MAX_ARRAY_ITEMS,
    maxObjectKeys: options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    sourceKind: options.sourceKind ?? "json-context",
  };
  const inputJson = stableStringify(payload);
  const stats: CompressionStats = {
    truncatedStrings: 0,
    omittedArrayItems: 0,
    omittedObjectKeys: 0,
    redactedKeys: new Set(),
    redactedValues: 0,
  };
  const compressedJson = stableStringify(compressValue(payload, resolvedOptions, stats));
  const inputBytes = Buffer.byteLength(inputJson, "utf8");
  const outputBytes = Buffer.byteLength(compressedJson, "utf8");

  return {
    strategy: "simone_json_headroom_v0",
    sourceKind: sourceKindFromPayload(payload, resolvedOptions.sourceKind),
    lossy: true,
    inputBytes,
    outputBytes,
    inputSha256: sha256(inputJson),
    outputSha256: sha256(compressedJson),
    compressionRatio: inputBytes > 0 ? Number((outputBytes / inputBytes).toFixed(4)) : 1,
    truncatedStrings: stats.truncatedStrings,
    omittedArrayItems: stats.omittedArrayItems,
    omittedObjectKeys: stats.omittedObjectKeys,
    redactedKeys: Array.from(stats.redactedKeys).sort(),
    redactedValues: stats.redactedValues,
    compressedJson,
  };
}
