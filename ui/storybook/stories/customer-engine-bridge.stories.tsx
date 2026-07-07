import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  CustomerEngineBridgeCard,
  bridgeSnapshotToCardState,
} from "@/components/CustomerEngineBridgeCard";
import type { CustomerEngineBridgeSnapshot } from "@/api/customerEngine";

const liveSnapshot: CustomerEngineBridgeSnapshot = {
  status: "live",
  generatedAt: "2026-07-07T08:53:06Z",
  digest: {
    headline: "35 items waiting on you (10 high-priority)",
    summary: "10 replies + 3 posts to review · 6 prospect touches · 9 voice candidates · 5 proof points",
    nextActions: [
      {
        title: "Approve reply to @fchollet",
        priority: "high",
        deepLink: "https://app.tissuu.ai/drafts",
      },
    ],
  },
  actions: {
    count: 35,
    items: [
      {
        id: "reply:286",
        kind: "approve_reply",
        title: "Approve reply to @fchollet",
        priority: "high",
        reason: "Grounded in a live customer signal.",
        deepLink: "https://app.tissuu.ai/drafts",
        dueAt: null,
        source: "voice-watch",
      },
    ],
  },
  metrics: {
    waitlistTotal: 11,
    weeklyNew: 0,
    qualifiedLeads: 2,
    replyRate: 0.03,
    proofEvents: 10,
  },
  ops: {
    overall: "healthy",
    jobs: [{ name: "voice-watch", status: "ok", lastRunAt: "2026-07-07T08:53:06Z" }],
    staleSignals: [],
  },
};

const meta = {
  title: "Product Surfaces/Customer Engine Bridge",
  component: CustomerEngineBridgeCard,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <main className="paperclip-story min-h-screen bg-background p-6">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta<typeof CustomerEngineBridgeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LiveTissuuSignal: Story = {
  args: {
    state: bridgeSnapshotToCardState(liveSnapshot),
  },
};

export const BridgeUnavailable: Story = {
  args: {
    state: bridgeSnapshotToCardState({
      status: "unavailable",
      reason: "bridge_not_configured",
      message: "Tissuu Customer Engine bridge token is not configured.",
    }),
  },
};

export const PendingReadout: Story = {};
