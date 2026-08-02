import { lt } from "drizzle-orm";
import { publicFunnelEvents, type Db } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

export const DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS = 90;
const MAX_PUBLIC_FUNNEL_RETENTION_DAYS = 365;
const DEFAULT_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export function resolvePublicFunnelRetentionDays(raw = process.env.PUBLIC_FUNNEL_EVENT_RETENTION_DAYS) {
  if (!raw) return DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PUBLIC_FUNNEL_RETENTION_DAYS) {
    logger.warn(
      { configuredValue: raw, fallbackDays: DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS },
      "Invalid public funnel retention; using the default",
    );
    return DEFAULT_PUBLIC_FUNNEL_RETENTION_DAYS;
  }
  return parsed;
}

export function publicFunnelRetentionCutoff(retentionDays: number, now = new Date()) {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000);
}

export async function prunePublicFunnelEvents(
  db: Db,
  retentionDays = resolvePublicFunnelRetentionDays(),
  now = new Date(),
) {
  const cutoff = publicFunnelRetentionCutoff(retentionDays, now);
  const deleted = await db
    .delete(publicFunnelEvents)
    .where(lt(publicFunnelEvents.createdAt, cutoff))
    .returning({ id: publicFunnelEvents.id });

  if (deleted.length > 0) {
    logger.info(
      { deleted: deleted.length, retentionDays, cutoff },
      "Pruned expired public funnel events",
    );
  }

  return deleted.length;
}

export function startPublicFunnelEventRetention(
  db: Db,
  intervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  retentionDays = resolvePublicFunnelRetentionDays(),
) {
  const sweep = () => {
    void prunePublicFunnelEvents(db, retentionDays).catch((err) => {
      logger.warn({ err, retentionDays }, "Public funnel retention sweep failed");
    });
  };

  sweep();
  const timer = setInterval(sweep, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
