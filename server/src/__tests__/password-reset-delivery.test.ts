import { describe, expect, it, vi } from "vitest";
import {
  PasswordResetDeliveryError,
  createPasswordResetDelivery,
} from "../auth/password-reset-delivery.js";

describe("password reset email delivery", () => {
  it("falls back without exposing a reset URL when email delivery is not configured", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const delivery = createPasswordResetDelivery({}, fetchMock);

    expect(delivery.configured).toBe(false);
    expect(delivery.provider).toBe("administrator_assisted");

    await delivery.send({
      email: "owner@example.test",
      name: "Owner",
      resetUrl: "https://sim.example.test/api/auth/reset-password/test-token",
      token: "test-token",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a one-time Resend message with a deterministic idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const delivery = createPasswordResetDelivery({
      RESEND_API_KEY: "re_test_only",
      SIMONE_PASSWORD_RESET_FROM: "SimOne <no-reply@example.test>",
    }, fetchMock);

    await delivery.send({
      email: "owner@example.test",
      name: "Owner <Admin>",
      resetUrl: "https://sim.example.test/api/auth/reset-password/test-token?callbackURL=%2Fauth%2Freset-password&x=<unsafe>",
      token: "test-token",
    });

    expect(delivery.configured).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test_only",
      "Content-Type": "application/json",
    });
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toMatch(
      /^simone-password-reset-[a-f0-9]{32}$/,
    );

    const body = JSON.parse(String(init?.body)) as { to: string[]; text: string; html: string };
    expect(body.to).toEqual(["owner@example.test"]);
    expect(body.text).toContain("This link expires in 15 minutes");
    expect(body.html).toContain("Owner &lt;Admin&gt;");
    expect(body.html).toContain("&lt;unsafe&gt;");
    expect(body.html).not.toContain("<unsafe>");
  });

  it("returns a sanitized error without reading the provider response body", async () => {
    const text = vi.fn().mockResolvedValue("sensitive provider echo");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 422,
      text,
    } as unknown as Response);
    const delivery = createPasswordResetDelivery({
      RESEND_API_KEY: "re_test_only",
      SIMONE_PASSWORD_RESET_FROM: "SimOne <no-reply@example.test>",
    }, fetchMock);

    await expect(delivery.send({
      email: "owner@example.test",
      resetUrl: "https://sim.example.test/reset/secret-token",
      token: "secret-token",
    })).rejects.toEqual(expect.objectContaining<Partial<PasswordResetDeliveryError>>({
      code: "delivery_failed",
      message: "Password reset email delivery failed",
    }));
    expect(text).not.toHaveBeenCalled();
  });
});
