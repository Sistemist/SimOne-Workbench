import { createHash } from "node:crypto";

const DEFAULT_MAX_ARRAY_ITEMS = 3;
const DEFAULT_MAX_OBJECT_KEYS = 24;
const DEFAULT_MAX_STRING_LENGTH = 240;
const MAX_PRESERVATION_REQUIREMENTS = 50;
const MAX_SOURCE_REFS = 50;
const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|bearer|password|secret|token/i;
const SENSITIVE_VALUE_PATTERNS = [
  /authorization:\s*bearer\s+[a-z0-9._~+/=-]+/gi,
  /bearer\s+[a-z0-9._~+/=-]+/gi,
  /session=[^;\s]+/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const GOVERNED_SOURCE_KINDS = new Set([
  "venture-context-projection",
  "tissuu-customer-engine-bridge",
  "sim-wiki-retrieval",
  "run-transcript",
  "scanner-context",
]);
const REQUIREMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/i;

export interface CompressJsonContextOptions {
  maxArrayItems?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
  sourceKind?: string;
}

export interface ContextPreservationFactReceipt {
  id: string;
  pointer: string;
  status: "preserved" | "changed" | "missing_input" | "missing_output" | "redacted";
  inputSha256: string | null;
  outputSha256: string | null;
}

export interface ContextSourceRefReceipt {
  kind: string;
  id: string | null;
  capturedAt: string | null;
  labelSha256: string;
}

export interface ContextPreservationEvidence {
  version: "sysdom_context_preservation_v1";
  status: "passed" | "blocked" | "not_requested";
  requiredFacts: number;
  preservedFacts: number;
  retentionRatio: number;
  sourceRefs: ContextSourceRefReceipt[];
  facts: ContextPreservationFactReceipt[];
  blockers: string[];
}

export interface JsonContextCompressionEnvelope {
  strategy: "sysdom_context_compression_v1";
  compressor: "simone_json_headroom_v0";
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
  preservation: ContextPreservationEvidence;
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

function payloadObject(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}

function payloadForCompression(payload: unknown): unknown {
  const object = payloadObject(payload);
  if (!object) return payload;
  const { preservationRequirements: _requirements, ...content } = object;
  return content;
}

function parseRequirements(payload: unknown) {
  const raw = payloadObject(payload)?.preservationRequirements;
  if (raw === undefined) {
    return { requirements: [] as Array<{ id: string; pointer: string }>, invalid: false };
  }
  if (!Array.isArray(raw) || raw.length > MAX_PRESERVATION_REQUIREMENTS) {
    return { requirements: [] as Array<{ id: string; pointer: string }>, invalid: true };
  }

  const requirements: Array<{ id: string; pointer: string }> = [];
  const ids = new Set<string>();
  let invalid = false;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      invalid = true;
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const pointer = typeof record.pointer === "string" ? record.pointer : "";
    if (
      !REQUIREMENT_ID_PATTERN.test(id)
      || !isValidJsonPointer(pointer)
      || ids.has(id)
    ) {
      invalid = true;
      continue;
    }
    ids.add(id);
    requirements.push({ id, pointer });
  }
  return { requirements, invalid };
}

function parseSourceRefs(payload: unknown) {
  const raw = payloadObject(payload)?.sourceRefs;
  if (raw === undefined) {
    return { sourceRefs: [] as ContextSourceRefReceipt[], invalid: false };
  }
  if (!Array.isArray(raw) || raw.length > MAX_SOURCE_REFS) {
    return { sourceRefs: [] as ContextSourceRefReceipt[], invalid: true };
  }

  const sourceRefs: ContextSourceRefReceipt[] = [];
  let invalid = false;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      invalid = true;
      continue;
    }
    const record = item as Record<string, unknown>;
    const kind = typeof record.kind === "string" ? record.kind.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const id = record.id == null
      ? null
      : typeof record.id === "string" && record.id.trim().length > 0
        ? record.id.trim()
        : undefined;
    const capturedAt = record.capturedAt == null
      ? null
      : typeof record.capturedAt === "string" && !Number.isNaN(Date.parse(record.capturedAt))
        ? new Date(record.capturedAt).toISOString()
        : undefined;
    if (!kind || !label || id === undefined || capturedAt === undefined) {
      invalid = true;
      continue;
    }
    sourceRefs.push({
      kind,
      id,
      capturedAt,
      labelSha256: sha256(label),
    });
  }
  return { sourceRefs, invalid };
}

function isValidJsonPointer(pointer: string) {
  return (
    pointer.startsWith("/")
    && pointer
      .split("/")
      .slice(1)
      .every((segment) => !/~(?:[^01]|$)/.test(segment))
  );
}

function pointerSegments(pointer: string) {
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function valueAtPointer(root: unknown, pointer: string): { found: boolean; value?: unknown } {
  let current = root;
  for (const segment of pointerSegments(pointer)) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return { found: false };
      const index = Number.parseInt(segment, 10);
      if (index >= current.length) return { found: false };
      current = current[index];
      continue;
    }
    if (!current || typeof current !== "object" || !(segment in current)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function pointerContainsSensitiveKey(pointer: string) {
  return pointerSegments(pointer).some((segment) => SENSITIVE_KEY_PATTERN.test(segment));
}

function preservationEvidence(
  payload: unknown,
  compressedPayload: unknown,
  sourceKind: string,
): ContextPreservationEvidence {
  const { requirements, invalid: requirementsInvalid } = parseRequirements(payload);
  const { sourceRefs, invalid: sourceRefsInvalid } = parseSourceRefs(payload);
  const governed = GOVERNED_SOURCE_KINDS.has(sourceKind);
  const blockers = [
    ...(requirementsInvalid ? ["requirements_invalid"] : []),
    ...(sourceRefsInvalid ? ["source_refs_invalid"] : []),
    ...(governed && requirements.length === 0 ? ["requirements_missing"] : []),
    ...(governed && sourceRefs.length === 0 ? ["source_refs_missing"] : []),
  ];
  const facts = requirements.map<ContextPreservationFactReceipt>((requirement) => {
    const input = valueAtPointer(payloadForCompression(payload), requirement.pointer);
    const output = valueAtPointer(compressedPayload, requirement.pointer);
    if (!input.found) {
      blockers.push(`required_fact_missing_input:${requirement.id}`);
      return {
        ...requirement,
        status: "missing_input",
        inputSha256: null,
        outputSha256: output.found ? sha256(stableStringify(output.value)) : null,
      };
    }
    if (pointerContainsSensitiveKey(requirement.pointer)) {
      blockers.push(`required_fact_redacted:${requirement.id}`);
      return {
        ...requirement,
        status: "redacted",
        inputSha256: null,
        outputSha256: null,
      };
    }
    const inputHash = sha256(stableStringify(input.value));
    if (!output.found) {
      blockers.push(`required_fact_missing_output:${requirement.id}`);
      return {
        ...requirement,
        status: "missing_output",
        inputSha256: inputHash,
        outputSha256: null,
      };
    }
    const outputHash = sha256(stableStringify(output.value));
    if (inputHash !== outputHash) {
      blockers.push(`required_fact_changed:${requirement.id}`);
      return {
        ...requirement,
        status: "changed",
        inputSha256: inputHash,
        outputSha256: outputHash,
      };
    }
    return {
      ...requirement,
      status: "preserved",
      inputSha256: inputHash,
      outputSha256: outputHash,
    };
  });
  const preservedFacts = facts.filter((fact) => fact.status === "preserved").length;
  const requested = requirements.length > 0 || governed;

  return {
    version: "sysdom_context_preservation_v1",
    status: blockers.length > 0 ? "blocked" : requested ? "passed" : "not_requested",
    requiredFacts: requirements.length,
    preservedFacts,
    retentionRatio: requirements.length > 0
      ? Number((preservedFacts / requirements.length).toFixed(4))
      : 1,
    sourceRefs,
    facts,
    blockers: Array.from(new Set(blockers)).sort(),
  };
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
      const suffix = `... [truncated ${redactedValue.length - options.maxStringLength} chars]`;
      return `${redactedValue.slice(0, Math.max(0, options.maxStringLength - suffix.length))}${suffix}`;
    }
    return redactedValue;
  }

  if (Array.isArray(value)) {
    if (value.length > options.maxArrayItems) {
      const retained = value
        .slice(0, options.maxArrayItems)
        .map((item) => compressValue(item, options, stats));
      const omittedItems = value.length - options.maxArrayItems;
      stats.omittedArrayItems += omittedItems;
      return retained;
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
        ...compressedObject,
        __sysdomOmittedKeys: omittedKeys,
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
  const sourceKind = sourceKindFromPayload(payload, resolvedOptions.sourceKind);
  const compressiblePayload = payloadForCompression(payload);
  const inputJson = stableStringify(compressiblePayload);
  const stats: CompressionStats = {
    truncatedStrings: 0,
    omittedArrayItems: 0,
    omittedObjectKeys: 0,
    redactedKeys: new Set(),
    redactedValues: 0,
  };
  const compressedPayload = compressValue(compressiblePayload, resolvedOptions, stats);
  const compressedJson = stableStringify(compressedPayload);
  const inputBytes = Buffer.byteLength(inputJson, "utf8");
  const outputBytes = Buffer.byteLength(compressedJson, "utf8");

  return {
    strategy: "sysdom_context_compression_v1",
    compressor: "simone_json_headroom_v0",
    sourceKind,
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
    preservation: preservationEvidence(payload, compressedPayload, sourceKind),
    compressedJson,
  };
}
