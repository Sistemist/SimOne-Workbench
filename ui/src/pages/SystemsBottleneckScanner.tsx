import { PublicVentureReview } from "@/components/PublicVentureReview";
import { VentureReviewRehearsal } from "@/components/VentureReviewRehearsal";
import type { VentureReviewClient, VentureReviewShareDraft } from "@paperclipai/shared";
import {
  type ScannerModelAnalysisResponse,
  type ScannerModelAssessment,
} from "@paperclipai/shared";

export type ScannerResult = {
  headline: string;
  engine: "Product Engine" | "Customer Engine" | "Cash Engine" | "Skills Engine";
  severity: "medium" | "high";
  reason: string;
  nextAction: string;
  watches: string;
  quickWin: {
    title: string;
    steps: string[];
  };
  signalStrength: {
    primaryMatches: number;
    summary: string;
    secondaryEngine?: ScannerResult["engine"];
    secondaryMatches?: number;
    secondarySummary?: string;
  };
  clarification?: {
    status: "weak_signal" | "close_call";
    summary: string;
    question: string;
  };
  calibration: {
    status: "early_pattern_match" | "model_assisted_hypothesis";
    label: string;
    summary: string;
    reviewNeeded: boolean;
    publicSummaryExcludes: Array<"founderNote" | "startupUrl">;
  };
  diagnosisSignals: string[];
  questions: string[];
  mapPreview: {
    artifact: "Venture Architecture Map";
    primaryEngine: ScannerResult["engine"];
    firstSection: string;
  };
  sprintZeroBrief: {
    clear: string[];
    needsProof: string[];
    humanReview: string[];
    firstMove: string;
  };
  approvalPath: {
    doNow: string;
    needsHumanYes: string;
    carryForward: string;
  };
  shareSummary: {
    title: string;
    publicText: string;
    excludes: Array<"founderNote" | "startupUrl">;
  };
  conversionPath: {
    title: string;
    summary: string;
    primaryCta: string;
    onboardingHref: string;
  };
  handoffPreview: {
    title: string;
    items: string[];
  };
  signupAssurance: {
    title: string;
    items: string[];
  };
  trustFrame: {
    canSee: string;
    cannotSee: string;
    stillUseful: string;
  };
  analysisProvenance?: ScannerModelAnalysisResponse["provenance"] & {
    analysisId: string;
  };
};

const SCANNER_ALGORITHM_VERSION = "scanner-patterns-v1";
function signUpHref(next: string) {
  return `/auth?mode=sign_up&next=${encodeURIComponent(next)}`;
}

const SCANNER_COACH_HREF = signUpHref("/sim-coach?from=scanner");

const scannerExamples = [
  {
    label: "Customer follow-up",
    note: "We have interested leads and waitlist replies, but follow-up is scattered and approvals sit in my inbox.",
  },
  {
    label: "Cash runway",
    note: "Our runway is getting tight, pricing keeps changing, and I am not sure which paid offer needs approval next.",
  },
  {
    label: "Skills capacity",
    note: "The same manual ops work keeps coming back to me, the team is overwhelmed, and I do not know who should own it.",
  },
  {
    label: "Product proof",
    note: "The roadmap has too many feature ideas, the prototype keeps expanding, and we need one promise we can prove before launch.",
  },
];

const fallbackResult: ScannerResult = {
  headline: "Feedback loop is unclear",
  engine: "Product Engine",
  severity: "medium",
  reason: "The note has a goal, but the system that turns feedback into a decision is not visible yet.",
  nextAction: "Write down the next customer decision and who approves it.",
  watches: "Sysdom AI would watch for missing feedback, ownership, and approval boundaries.",
  quickWin: {
    title: "Try this in 10 minutes",
    steps: [
      "Write the decision as one sentence.",
      "Name the person who can say yes.",
      "Save the answer in one place you will check tomorrow.",
    ],
  },
  signalStrength: {
    primaryMatches: 0,
    summary: "A first signal was visible, but not enough signs pointed to one engine yet.",
  },
  calibration: {
    status: "early_pattern_match",
    label: "Early pattern match",
    summary: "Early pattern match. Real submission review still needed.",
    reviewNeeded: true,
    publicSummaryExcludes: ["founderNote", "startupUrl"],
  },
  diagnosisSignals: [
    "A goal or stuck point was present.",
    "The decision loop was not yet visible.",
    "Human approval should be made explicit.",
  ],
  questions: [
    "What decision is waiting for a human yes?",
    "What proof would make this worth doing now?",
    "Where should the answer be saved so it is not lost?",
  ],
  mapPreview: {
    artifact: "Venture Architecture Map",
    primaryEngine: "Product Engine",
    firstSection: "Decision loop",
  },
  sprintZeroBrief: {
    clear: [
      "Likely bottleneck: Feedback loop is unclear.",
      "Primary engine: Product Engine.",
      "The note has a goal, but the system that turns feedback into a decision is not visible yet.",
    ],
    needsProof: [
      "What proof would make this worth doing now?",
      "Show the next decision and one place where the answer will be saved.",
    ],
    humanReview: [
      "Approve the next decision before agents act.",
      "Keep customers, money, public claims, and company structure behind human review.",
    ],
    firstMove: "Write down the next customer decision and who approves it.",
  },
  approvalPath: {
    doNow: "Write down the next customer decision and who approves it.",
    needsHumanYes: "Approve the next decision before agents act.",
    carryForward: "Save this scan as Sprint Zero context after sign-in.",
  },
  shareSummary: {
    title: "Share this result",
    publicText:
      "Built with Sysdom AI: Feedback loop is unclear. Focus: Product Engine. Next move: Write down the next customer decision and who approves it.",
    excludes: ["founderNote", "startupUrl"],
  },
  conversionPath: {
    title: "Turn this into a Product Engine map",
    summary:
      "Sysdom AI will keep the product loop, proof question, and approval boundary together after sign-in.",
    primaryCta: "Save the full Product Engine map",
    onboardingHref: signUpHref("/onboarding?from=scanner&focus=product-engine"),
  },
  handoffPreview: {
    title: "What happens after sign-in",
    items: [
      "Prefill the starter map with this product loop readout.",
      "Create the first setup task: Write down the next customer decision and who approves it.",
      "Keep any customer, money, public-claim, or structure decision behind your approval.",
    ],
  },
  signupAssurance: {
    title: "What will not happen",
    items: [
      "No technical setup before you see the map.",
      "Nothing posts publicly.",
      "Customer, money, public-claim, and company-structure decisions still require your explicit approval.",
    ],
  },
  trustFrame: {
    canSee: "It read patterns in the text you provided.",
    cannotSee: "It did not crawl your site, inspect private tools, or verify the facts.",
    stillUseful: "It gives you one focused next question instead of a full-company diagnosis.",
  },
};

const patterns: Array<{
  engine: ScannerResult["engine"];
  headline: string;
  keywords: string[];
  reason: string;
  nextAction: string;
  watches: string;
  diagnosisSignals: string[];
  questions: string[];
  firstSection: string;
  quickWinSteps: string[];
}> = [
  {
    engine: "Customer Engine",
    headline: "Customer loop is leaking",
    keywords: [
      "lead",
      "customer",
      "reply",
      "waitlist",
      "prospect",
      "follow-up",
      "follow up",
      "inbox",
      "signup",
      "sign up",
    ],
    reason: "Customer signal exists, but it is not moving through one trusted review loop.",
    nextAction: "Make one review queue for replies, prospects, and proof points.",
    watches: "Sysdom AI would watch the handoff from signal to human approval to durable memory.",
    diagnosisSignals: [
      "Customer signal was present.",
      "Follow-up or inbox work looked scattered.",
      "Approval was part of the bottleneck.",
    ],
    questions: [
      "Who should approve the next customer reply or offer?",
      "What proof would make this worth doing now?",
      "Where should the answer be saved so it is not lost?",
    ],
    firstSection: "Customer review loop",
    quickWinSteps: [
      "Open one place where replies or prospects currently land.",
      "Move three waiting items into one short review list.",
      "Mark the next reply that needs your yes before anyone sends it.",
    ],
  },
  {
    engine: "Cash Engine",
    headline: "Cash pressure is steering the system",
    keywords: ["cash", "burn", "revenue", "pricing", "runway", "sales", "paid", "budget"],
    reason: "The business constraint is financial, but the next pricing or revenue decision is not explicit.",
    nextAction: "Name the next money decision and the evidence needed to make it.",
    watches: "Sysdom AI would watch budget pressure, pricing assumptions, and approval thresholds.",
    diagnosisSignals: [
      "A money constraint was present.",
      "Pricing, runway, or revenue pressure appeared.",
      "The next financial decision needs human approval.",
    ],
    questions: [
      "Which money decision needs a human yes next?",
      "What proof would make this worth doing now?",
      "What number should Sysdom AI keep visible each week?",
    ],
    firstSection: "Money decision loop",
    quickWinSteps: [
      "Write the next pricing or revenue decision as one sentence.",
      "Name the number that would make the choice safer.",
      "Decide who must approve it before it changes in public.",
    ],
  },
  {
    engine: "Skills Engine",
    headline: "Capacity is the constraint",
    keywords: ["hire", "hiring", "team", "capacity", "manual", "ops", "skills", "overwhelmed"],
    reason: "The work depends on people or skills that are not yet mapped to a clear operating role.",
    nextAction: "List the recurring work and assign one accountable role for the next week.",
    watches: "Sysdom AI would watch ownership, missing skills, and work that keeps bouncing back to the founder.",
    diagnosisSignals: [
      "Capacity or recurring work pressure was present.",
      "Ownership looked unclear.",
      "The next role boundary needs to be named.",
    ],
    questions: [
      "Which recurring work keeps coming back to the founder?",
      "Who should own the next visible step?",
      "What proof would show this role is working?",
    ],
    firstSection: "Ownership loop",
    quickWinSteps: [
      "Name one recurring task that keeps returning to you.",
      "Pick one person or role to own it for a week.",
      "Write what finished looks like before assigning it.",
    ],
  },
  {
    engine: "Product Engine",
    headline: "Product direction is diffused",
    keywords: ["feature", "roadmap", "product", "prototype", "launch", "scope", "positioning"],
    reason: "The product surface is moving, but the next sharp decision is not anchored to customer evidence.",
    nextAction: "Pick one user promise and one proof point that would make it believable.",
    watches: "Sysdom AI would watch product promises, proof, and the approval point before building more.",
    diagnosisSignals: [
      "Product or positioning movement was present.",
      "The next user promise needs sharper proof.",
      "A build decision should wait for human review.",
    ],
    questions: [
      "Which user promise should be protected first?",
      "What proof would make this worth doing now?",
      "Who should approve the next product move?",
    ],
    firstSection: "Product proof loop",
    quickWinSteps: [
      "Write one promise a user should believe.",
      "Name one proof point that would make it credible.",
      "Pause the next build decision until that proof is visible.",
    ],
  },
];

function engineFocusSlug(engine: ScannerResult["engine"]) {
  return engine.toLowerCase().replace(/\s+/g, "-");
}

function engineLoopLabel(engine: ScannerResult["engine"]) {
  if (engine === "Customer Engine") return "customer loop";
  if (engine === "Cash Engine") return "money loop";
  if (engine === "Skills Engine") return "capacity loop";
  return "product loop";
}

function signalClarification(
  primary: { pattern: (typeof patterns)[number]; score: number },
  secondary?: { pattern: (typeof patterns)[number]; score: number },
): ScannerResult["clarification"] {
  if (secondary && primary.score - secondary.score <= 1) {
    return {
      status: "close_call",
      summary: `The ${engineLoopLabel(primary.pattern.engine)} and ${engineLoopLabel(secondary.pattern.engine)} are close. Treat the first result as a hypothesis, not a settled diagnosis.`,
      question: `Which needs a decision first: the ${engineLoopLabel(primary.pattern.engine)} or the ${engineLoopLabel(secondary.pattern.engine)}?`,
    };
  }
  if (primary.score <= 1) {
    return {
      status: "weak_signal",
      summary: `Only one direct cue selected ${primary.pattern.engine}. Treat this result as tentative.`,
      question: `What observable evidence would confirm that the ${engineLoopLabel(primary.pattern.engine)} is the active constraint rather than a symptom?`,
    };
  }
  return undefined;
}

export function scanBottleneck(
  input: string,
  modelAssessment?: ScannerModelAssessment,
): ScannerResult {
  const normalized = input.toLowerCase();
  const scored = patterns
    .map((pattern) => ({
      pattern,
      score: pattern.keywords.reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.score - a.score);
  const deterministicBest = scored[0];
  const modelPattern = modelAssessment
    ? patterns.find((pattern) => pattern.engine === modelAssessment.primaryEngine)
    : null;
  const best = modelPattern
    ? {
        pattern: modelPattern,
        score: scored.find((candidate) => candidate.pattern.engine === modelPattern.engine)?.score ?? 0,
      }
    : deterministicBest;

  if (!best || (!modelAssessment && best.score === 0)) return fallbackResult;

  const modelSecondary = modelAssessment?.secondaryEngine
    ? patterns.find((pattern) => pattern.engine === modelAssessment.secondaryEngine)
    : null;
  const secondary = modelSecondary
    ? {
        pattern: modelSecondary,
        score: scored.find((candidate) => candidate.pattern.engine === modelSecondary.engine)?.score ?? 0,
      }
    : scored.find(
        (candidate) => candidate.score > 0 && candidate.pattern.engine !== best.pattern.engine,
      );
  const severity: ScannerResult["severity"] = best.score > 2 ? "high" : "medium";
  const result: Omit<
    ScannerResult,
    | "sprintZeroBrief"
    | "approvalPath"
    | "shareSummary"
    | "conversionPath"
    | "handoffPreview"
    | "signupAssurance"
    | "trustFrame"
  > = {
    headline: best.pattern.headline,
    engine: best.pattern.engine,
    severity,
    reason: best.pattern.reason,
    nextAction: best.pattern.nextAction,
    watches: best.pattern.watches,
    quickWin: {
      title: "Try this in 10 minutes",
      steps: best.pattern.quickWinSteps,
    },
    signalStrength: {
      primaryMatches: best.score,
      summary: modelAssessment?.summary
        ?? `${best.score} ${best.score === 1 ? "sign" : "signs"} pointed to ${best.pattern.engine}.`,
      secondaryEngine: secondary?.pattern.engine,
      secondaryMatches: secondary?.score,
      secondarySummary: secondary
        ? modelSecondary
          ? "Model-assisted secondary signal."
          : `${secondary.score} ${secondary.score === 1 ? "sign" : "signs"} pointed there.`
        : undefined,
    },
    clarification: modelAssessment
      ? modelAssessment.confidence === "low" || modelAssessment.secondaryEngine
        ? {
            status: modelAssessment.secondaryEngine ? "close_call" : "weak_signal",
            summary: modelAssessment.secondaryEngine
              ? `The model-assisted read also found ${modelAssessment.secondaryEngine}. Founder judgment is still required.`
              : "The model-assisted read has low confidence. Founder judgment is still required.",
            question: modelAssessment.clarificationQuestion
              ?? `What evidence would confirm that the ${engineLoopLabel(best.pattern.engine)} is the active constraint?`,
          }
        : undefined
      : signalClarification(best, secondary),
    calibration: {
      status: modelAssessment ? "model_assisted_hypothesis" : "early_pattern_match",
      label: modelAssessment ? "Model-assisted hypothesis" : "Early pattern match",
      summary: modelAssessment
        ? "Model-assisted hypothesis. Founder review still needed."
        : "Early pattern match. Real submission review still needed.",
      reviewNeeded: true,
      publicSummaryExcludes: ["founderNote", "startupUrl"],
    },
    diagnosisSignals: modelAssessment?.evidenceCues.length
      ? modelAssessment.evidenceCues
      : best.pattern.diagnosisSignals,
    questions: modelAssessment?.clarificationQuestion
      ? [
          modelAssessment.clarificationQuestion,
          ...best.pattern.questions.filter((question) => question !== modelAssessment.clarificationQuestion),
        ].slice(0, 3)
      : best.pattern.questions,
    mapPreview: {
      artifact: "Venture Architecture Map",
      primaryEngine: best.pattern.engine,
      firstSection: best.pattern.firstSection,
    },
  };
  return {
    ...result,
    sprintZeroBrief: {
      clear: [
        `Likely bottleneck: ${result.headline}.`,
        `Primary engine: ${result.engine}.`,
        result.reason,
      ],
      needsProof: [
        result.questions.find((question) => /proof/i.test(question)) ?? "What proof would make this worth doing now?",
        `Show the next signal in one review queue before scaling ${result.engine === "Customer Engine" ? "follow-up" : "the work"}.`,
      ],
      humanReview: [
        result.engine === "Customer Engine"
          ? "Approve the next customer-facing reply or offer before agents act."
          : "Approve the next judgment call before agents act.",
        "Keep customers, money, public claims, and company structure behind human review.",
      ],
      firstMove: result.nextAction,
    },
    approvalPath: {
      doNow: result.nextAction,
      needsHumanYes:
        result.engine === "Customer Engine"
          ? "Approve the next customer-facing reply or offer before agents act."
          : "Approve the next judgment call before agents act.",
      carryForward: "Save this scan as Sprint Zero context after sign-in.",
    },
    shareSummary: {
      title: "Share this result",
      publicText: `Built with Sysdom AI: ${result.headline}. Focus: ${result.engine}. Next move: ${result.nextAction}`,
      excludes: ["founderNote", "startupUrl"],
    },
    conversionPath: {
      title: `Turn this into a ${result.engine} map`,
      summary: `Sysdom AI will keep the ${engineLoopLabel(result.engine)}, proof question, and approval boundary together after sign-in.`,
      primaryCta: `Save the full ${result.engine} map`,
      onboardingHref: signUpHref(`/onboarding?from=scanner&focus=${engineFocusSlug(result.engine)}`),
    },
    handoffPreview: {
      title: "What happens after sign-in",
      items: [
        `Prefill the starter map with this ${engineLoopLabel(result.engine)} readout.`,
        `Create the first setup task: ${result.nextAction}`,
        "Keep any customer, money, public-claim, or structure decision behind your approval.",
      ],
    },
    signupAssurance: {
      title: "What will not happen",
      items: [
        "No technical setup before you see the map.",
        "Nothing posts publicly.",
        "Customer, money, public-claim, and company-structure decisions still require your explicit approval.",
      ],
    },
    trustFrame: {
      canSee: "It read patterns in the text you provided.",
      cannotSee: "It did not crawl your site, inspect private tools, or verify the facts.",
      stillUseful: "It gives you one focused next question instead of a full-company diagnosis.",
    },
  };
}

export function SystemsBottleneckScanner({ reviewClient, reviewExample }: { reviewClient?: VentureReviewClient; reviewExample?: { question: string; draft: VentureReviewShareDraft } } = {}) {
  return reviewClient ? <VentureReviewRehearsal client={reviewClient} example={reviewExample} /> : <PublicVentureReview />;
}
