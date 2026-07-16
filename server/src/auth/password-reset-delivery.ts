import { createHash } from "node:crypto";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DELIVERY_TIMEOUT_MS = 10_000;

export type PasswordResetEmail = {
  email: string;
  name?: string | null;
  resetUrl: string;
  token: string;
};

export type PasswordResetDelivery = {
  configured: boolean;
  provider: "resend" | "administrator_assisted";
  send(input: PasswordResetEmail): Promise<void>;
};

type PasswordResetDeliveryEnv = {
  RESEND_API_KEY?: string;
  SIMONE_PASSWORD_RESET_FROM?: string;
};

export class PasswordResetDeliveryError extends Error {
  readonly code: "delivery_failed" | "delivery_timeout";

  constructor(code: PasswordResetDeliveryError["code"]) {
    super(code === "delivery_timeout" ? "Password reset email delivery timed out" : "Password reset email delivery failed");
    this.name = "PasswordResetDeliveryError";
    this.code = code;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildIdempotencyKey(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `simone-password-reset-${digest}`;
}

export function createPasswordResetDelivery(
  env: PasswordResetDeliveryEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): PasswordResetDelivery {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.SIMONE_PASSWORD_RESET_FROM?.trim();

  if (!apiKey || !from) {
    return {
      configured: false,
      provider: "administrator_assisted",
      async send() {
        // Deliberately do nothing. Better Auth still returns its generic response,
        // so delivery readiness cannot be used to enumerate registered accounts.
      },
    };
  }

  return {
    configured: true,
    provider: "resend",
    async send(input) {
      const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
      const safeResetUrl = escapeHtml(input.resetUrl);
      let response: Response;
      try {
        response = await fetchImpl(RESEND_EMAILS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": buildIdempotencyKey(input.token),
          },
          body: JSON.stringify({
            from,
            to: [input.email],
            subject: "Reset your SimOne password",
            text: `${greeting}\n\nUse this one-time link to choose a new SimOne password:\n${input.resetUrl}\n\nThis link expires in 15 minutes. If you did not request it, you can ignore this email.`,
            html: `<p>${escapeHtml(greeting)}</p><p>Use this one-time link to choose a new SimOne password:</p><p><a href="${safeResetUrl}">Reset your password</a></p><p>This link expires in 15 minutes. If you did not request it, you can ignore this email.</p>`,
          }),
          signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
          throw new PasswordResetDeliveryError("delivery_timeout");
        }
        throw new PasswordResetDeliveryError("delivery_failed");
      }

      if (!response.ok) {
        // Never include the provider response body: it can echo recipient data
        // or message content containing the one-time reset URL.
        throw new PasswordResetDeliveryError("delivery_failed");
      }
    },
  };
}
