import { z } from "zod";

export const PUBLIC_FUNNEL_EVENT_NAMES = [
  "scanner_view",
  "scanner_start",
  "scanner_complete",
  "scanner_next_move_view",
  "scanner_share",
  "scanner_signup_click",
  "signup_complete",
  "starter_reached",
] as const;

const SAFE_DIMENSION_RE = /^[a-zA-Z0-9._~:/?&=%+-]+$/;

const optionalDimension = z.string().trim().max(120).refine(
  (value) => SAFE_DIMENSION_RE.test(value),
  "Attribution dimensions may contain only URL-safe characters",
).optional();

export const publicFunnelEventNameSchema = z.enum(PUBLIC_FUNNEL_EVENT_NAMES);
export const publicFunnelResultCategorySchema = z.enum([
  "product",
  "customer",
  "cash",
  "skills",
  "unclear",
]);

export const createPublicFunnelEventSchema = z.object({
  eventKey: z.string().uuid(),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventName: publicFunnelEventNameSchema,
  path: z.string().trim().max(160).regex(/^\/[a-zA-Z0-9/_.-]*$/),
  source: optionalDimension,
  medium: optionalDimension,
  campaign: optionalDimension,
  referrerHost: z.string().trim().max(120).regex(/^[a-zA-Z0-9.-]+$/).optional(),
  resultCategory: publicFunnelResultCategorySchema.optional(),
  isTest: z.boolean().optional().default(false),
}).strict();

export type PublicFunnelEventName = z.infer<typeof publicFunnelEventNameSchema>;
export type PublicFunnelResultCategory = z.infer<typeof publicFunnelResultCategorySchema>;
export type CreatePublicFunnelEvent = z.infer<typeof createPublicFunnelEventSchema>;
