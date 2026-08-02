const ASSIGNMENT_RE =
  /\b(?:api[-_]?key|access[-_]?token|auth[-_]?token|bearer[-_]?token|client[-_]?secret|private[-_]?key|password|passwd)\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{8,}/i;
const BEARER_RE =
  /\b(?:authorization\s*:\s*)?bearer\s+[A-Za-z0-9._~+/=-]{12,}/i;
const JWT_RE =
  /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/;
const PROVIDER_KEY_RE =
  /\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const SENSITIVE_QUERY_KEY_RE =
  /^(?:api[-_]?key|access[-_]?token|auth[-_]?token|token|authorization|bearer|secret|signature|password|credential|jwt|private[-_]?key)$/i;

function hasSecretBearingUrl(value: string): boolean {
  for (const match of value.matchAll(URL_RE)) {
    const candidate = match[0].replace(/[),.;]+$/, "");
    try {
      const parsed = new URL(candidate);
      if (parsed.username || parsed.password) return true;
      if (
        Array.from(parsed.searchParams.keys()).some((key) =>
          SENSITIVE_QUERY_KEY_RE.test(key)
        )
      ) {
        return true;
      }
    } catch {
      // A malformed URL is handled as ordinary founder context.
    }
  }
  return false;
}

export function hasRecognizableCredentialMaterial(value: string): boolean {
  return (
    PROVIDER_KEY_RE.test(value) ||
    BEARER_RE.test(value) ||
    JWT_RE.test(value) ||
    ASSIGNMENT_RE.test(value) ||
    hasSecretBearingUrl(value)
  );
}
