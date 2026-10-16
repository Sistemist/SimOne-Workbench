import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Request } from "express";

const MIN_TOKEN_LENGTH = 32;

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredToken() {
  const tokenFile = process.env.SYSDOM_HEALTH_MONITOR_TOKEN_FILE?.trim();
  if (!tokenFile) return null;

  try {
    const token = readFileSync(tokenFile, "utf8").trim();
    return token.length >= MIN_TOKEN_LENGTH ? token : null;
  } catch {
    return null;
  }
}

export function isAuthorizedHealthMonitor(req: Request) {
  const expected = configuredToken();
  if (!expected) return false;

  const authorization = req.header("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  const presented = match?.[1]?.trim() ?? "";
  return presented.length >= MIN_TOKEN_LENGTH && constantTimeEqual(presented, expected);
}
