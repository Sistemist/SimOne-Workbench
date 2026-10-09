import { z } from "zod";

const PUBLIC_REVIEW_FUNNEL_EVENT_NAMES = ["venture_review_view", "venture_review_click", "venture_review_start", "venture_review_result", "venture_review_access_click", "venture_review_access_request"] as const;

export const PUBLIC_FUNNEL_EVENT_NAMES = [
  ...PUBLIC_REVIEW_FUNNEL_EVENT_NAMES,
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

const legacyPublicFunnelEventSchema = z.object({
  eventKey: z.string().uuid(),
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventName: publicFunnelEventNameSchema.refine(name => !name.startsWith("venture_review_")),
  path: z.string().trim().max(160).regex(/^\/[a-zA-Z0-9/_.-]*$/),
  source: optionalDimension,
  medium: optionalDimension,
  campaign: optionalDimension,
  referrerHost: z.string().trim().max(120).regex(/^[a-zA-Z0-9.-]+$/).optional(),
  resultCategory: publicFunnelResultCategorySchema.optional(),
  isTest: z.boolean().optional().default(false),
}).strict();

export const publicReviewFunnelEventSchema = z.object({
  eventKey: z.string().uuid(),
  eventName: z.enum(PUBLIC_REVIEW_FUNNEL_EVENT_NAMES),
  path: z.literal("/venture-review"),
  isTest: z.boolean().optional().default(false),
}).strict();
export const createPublicFunnelEventSchema = z.union([legacyPublicFunnelEventSchema, publicReviewFunnelEventSchema]);

export type PublicFunnelEventName = z.infer<typeof publicFunnelEventNameSchema>;
export type PublicFunnelResultCategory = z.infer<typeof publicFunnelResultCategorySchema>;
export type CreatePublicFunnelEvent = z.infer<typeof createPublicFunnelEventSchema>;
