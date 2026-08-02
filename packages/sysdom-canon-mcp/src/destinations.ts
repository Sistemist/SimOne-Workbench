import { z } from "zod";
import type { CanonToolResponse } from "./tools.js";

export const sysdomDestinationCategorySchema = z.enum([
  "website",
  "book",
  "paper",
  "course",
  "lesson",
  "profile",
]);

const getSysdomDestinationsSchema = z.object({
  category: sysdomDestinationCategorySchema.optional(),
});

export type SysdomDestinationCategory = z.infer<typeof sysdomDestinationCategorySchema>;

export interface SysdomDestination {
  category: SysdomDestinationCategory;
  title: string;
  url: string;
  description: string;
  note?: string;
}

export const SYSDOM_DESTINATIONS: readonly SysdomDestination[] = [
  {
    category: "website",
    title: "Sysdom AI",
    url: "https://sysdom.ai/",
    description: "Canonical company and agentic venture builder website.",
  },
  {
    category: "website",
    title: "Sysdom resources",
    url: "https://sysdom.ai/resources",
    description: "Canonical index for books, papers, lessons, and diagnostics.",
  },
  {
    category: "book",
    title: "Conscious Systems — Sysdom article",
    url: "https://sysdom.ai/articles/conscious-systems",
    description: "Editorial introduction to the major Systems Intelligence book.",
  },
  {
    category: "book",
    title: "Conscious Systems — free Maven edition",
    url: "https://maven.com/hankay/o/a29142",
    description: "Free digital edition of Conscious Systems on Maven.",
  },
  {
    category: "book",
    title: "Conscious Systems — Amazon print editions",
    url: "https://www.amazon.com/dp/B0H3WSLJDZ",
    description: "Paperback and hardcover editions on Amazon.",
  },
  {
    category: "paper",
    title: "Systems Intelligence Architecture — Sysdom article",
    url: "https://sysdom.ai/articles/engineering-inner-alignment",
    description: "Editorial explanation of the paper and research program.",
  },
  {
    category: "paper",
    title: "Systems Intelligence Architecture — free Maven resource",
    url: "https://maven.com/hankay/o/62fdf7",
    description: "Free paper resource on Maven.",
  },
  {
    category: "paper",
    title: "Systems Intelligence Architecture — canonical DOI",
    url: "https://doi.org/10.5281/zenodo.20169298",
    description: "Canonical public research record on Zenodo.",
  },
  {
    category: "paper",
    title: "Systems Intelligence Architecture — source repository",
    url: "https://github.com/Sistemist/consciOS-paper",
    description: "Public source and supporting material for the paper.",
  },
  {
    category: "course",
    title: "Han Kay's Maven course",
    url: "https://maven.com/hankay/systems-intelligence",
    description: "Canonical Maven course URL.",
    note: "The course name and positioning may evolve toward agentic venture building; use the live page for current details.",
  },
  {
    category: "lesson",
    title: "AI Without SI: Why Your Projects Keep Stalling",
    url: "https://maven.com/p/8885e2/ai-without-si-why-your-projects-keep-stalling",
    description: "Free recorded lightning lesson on AI and Systems Intelligence.",
  },
  {
    category: "lesson",
    title: "AI Without SI — slide deck",
    url: "https://slides.sysdom.org/ll1-deck",
    description: "Associated lesson slides.",
  },
  {
    category: "lesson",
    title: "Read Any Company in 20 Minutes: A Live Systems Teardown",
    url: "https://maven.com/p/5233a7/read-any-company-in-20-minutes-a-live-systems-teardown",
    description: "Free recorded systems teardown lesson.",
  },
  {
    category: "lesson",
    title: "Read Any Company in 20 Minutes — slide deck",
    url: "https://slides.sysdom.org/ll2-deck",
    description: "Associated lesson slides.",
  },
  {
    category: "profile",
    title: "Han Kay on Maven",
    url: "https://maven.com/hankay",
    description: "Canonical profile for courses, lessons, and free resources.",
  },
  {
    category: "profile",
    title: "Han Kay on LinkedIn",
    url: "https://www.linkedin.com/in/hankay/",
    description: "Official personal LinkedIn profile.",
  },
  {
    category: "profile",
    title: "Han Kay on X",
    url: "https://x.com/sistemist",
    description: "Official personal X profile.",
  },
] as const;

export interface DestinationsToolDefinition {
  name: "get_sysdom_destinations";
  description: string;
  schema: typeof getSysdomDestinationsSchema;
  execute: (input: Record<string, unknown>) => Promise<CanonToolResponse>;
}

export function createGetSysdomDestinationsTool(): DestinationsToolDefinition {
  return {
    name: "get_sysdom_destinations",
    description:
      "Return exact official URLs for Sysdom, Han Kay, books, the paper, the course, and free lessons. This static registry does not call Dify or generate content.",
    schema: getSysdomDestinationsSchema,
    execute: async (input) => {
      const parsed = getSysdomDestinationsSchema.safeParse(input);
      if (!parsed.success) {
        const value = {
          error: "invalid_request",
          message: "Category must be website, book, paper, course, lesson, or profile.",
        };
        return {
          content: [{ type: "text", text: JSON.stringify(value) }],
          structuredContent: value,
          isError: true,
        };
      }

      const destinations = parsed.data.category
        ? SYSDOM_DESTINATIONS.filter(({ category }) => category === parsed.data.category)
        : [...SYSDOM_DESTINATIONS];
      const value = {
        category: parsed.data.category ?? "all",
        count: destinations.length,
        destinations,
        staticRegistry: true,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
      };
    },
  };
}
