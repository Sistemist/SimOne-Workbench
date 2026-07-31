import type { PublicFunnelEventName, PublicFunnelResultCategory } from "@paperclipai/shared";

const VISITOR_STORAGE_KEY = "sysdom:funnel-visitor";
const SESSION_STORAGE_KEY = "sysdom:funnel-session";
const ATTRIBUTION_STORAGE_KEY = "sysdom:funnel-attribution";

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  referrerHost?: string;
};

function safeUuid(storage: Storage, key: string) {
  const current = storage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}

function safeDimension(value: string | null) {
  const normalized = value?.trim().slice(0, 120) ?? "";
  return normalized && /^[a-zA-Z0-9._~:/?&=%+-]+$/.test(normalized) ? normalized : undefined;
}

function isExplicitTestTraffic() {
  return new URLSearchParams(window.location.search).get("sysdom_test") === "1";
}

function currentAttribution(): Attribution {
  const stored = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Attribution;
    } catch {
      window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    }
  }

  const params = new URLSearchParams(window.location.search);
  let referrerHost: string | undefined;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : undefined;
  } catch {
    referrerHost = undefined;
  }
  const attribution = {
    source: safeDimension(params.get("utm_source")),
    medium: safeDimension(params.get("utm_medium")),
    campaign: safeDimension(params.get("utm_campaign")),
    referrerHost,
  };
  window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  return attribution;
}

export function trackPublicFunnelEvent(
  eventName: PublicFunnelEventName,
  input: {
    resultCategory?: PublicFunnelResultCategory;
    eventKey?: string;
    isTest?: boolean;
  } = {},
) {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  try {
    const body = {
      eventKey: input.eventKey ?? crypto.randomUUID(),
      visitorId: safeUuid(window.localStorage, VISITOR_STORAGE_KEY),
      sessionId: safeUuid(window.sessionStorage, SESSION_STORAGE_KEY),
      eventName,
      path: window.location.pathname.slice(0, 160),
      ...currentAttribution(),
      ...(input.resultCategory ? { resultCategory: input.resultCategory } : {}),
      ...((input.isTest || isExplicitTestTraffic()) ? { isTest: true } : {}),
    };
    void fetch("/api/public/funnel-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Measurement must never block the public product path.
  }
}

export function scannerResultCategory(engine: string): PublicFunnelResultCategory {
  if (engine.startsWith("Customer")) return "customer";
  if (engine.startsWith("Cash")) return "cash";
  if (engine.startsWith("Skills")) return "skills";
  if (engine.startsWith("Product")) return "product";
  return "unclear";
}
