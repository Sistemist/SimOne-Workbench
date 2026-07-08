import { BookOpenCheck, CheckCircle2, FileSearch, ListChecks, Map, Search, Share2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

type SimOneSprintZeroIssueLike = {
  title?: string | null;
  description?: string | null;
};

export function isSimOneSprintZeroFirstMapIssue(issue: SimOneSprintZeroIssueLike): boolean {
  const title = issue.title?.trim().toLowerCase() ?? "";
  const description = issue.description ?? "";
  return (
    title.includes("draft the first sim map") &&
    description.includes("## Messy venture context") &&
    description.includes("## Draft the first SIM map") &&
    description.includes("## Approval boundary")
  );
}

const guideSteps = [
  {
    icon: Search,
    title: "Read the messy context",
    body: "Use the founder note as source material. Do not ask the user to fill out engines by hand.",
  },
  {
    icon: FileSearch,
    title: "Check source provenance",
    body: "Confirm where the founder note came from and keep the first-map draft tied to this task.",
  },
  {
    icon: Map,
    title: "Draft Product, Customer, Cash, and Skills assumptions",
    body: "Turn the note into a first operating map with unknowns and proof gaps called out.",
  },
  {
    icon: ShieldCheck,
    title: "Ask for approval before customers, money, public claims, or structure",
    body: "Research and drafting can move quickly, but judgment boundaries stay with the human.",
  },
];

const reviewPrompts = [
  "What is clear enough to act on?",
  "What still needs proof?",
  "What requires human judgment?",
  "What is the first move?",
];

const promotionActions = [
  {
    icon: BookOpenCheck,
    label: "Save trusted decisions to SIM Wiki",
    href: "/wiki",
  },
  {
    icon: Share2,
    label: "Turn the reviewed map into a shareable artifact",
    href: "/artifacts",
  },
];

type SimOneSprintZeroGuideProps = {
  onCreateBoundedTasks?: () => void;
  createBoundedTasksPending?: boolean;
  boundedTasksCreated?: boolean;
  createBoundedTasksError?: string | null;
};

export function SimOneSprintZeroGuide({
  onCreateBoundedTasks,
  createBoundedTasksPending = false,
  boundedTasksCreated = false,
  createBoundedTasksError = null,
}: SimOneSprintZeroGuideProps = {}) {
  const createBoundedTasksLabel = boundedTasksCreated
    ? "Bounded tasks created"
    : createBoundedTasksPending
      ? "Creating bounded tasks..."
      : "Create bounded next tasks";

  return (
    <section className="rounded-md border border-border bg-muted/20 p-4 text-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-background p-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Sprint Zero first map</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Start by turning the messy context into a reviewable map. The goal is a useful draft,
            not a perfect system diagram.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {guideSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-foreground">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/70 p-3">
        <p className="text-xs font-semibold text-foreground">Review the draft before delegation</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {reviewPrompts.map((prompt) => (
            <div key={prompt} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="text-xs leading-5 text-muted-foreground">{prompt}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold text-foreground">Approve what becomes durable</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Promote only the parts you trust. Keep uncertain claims in this task until they have proof.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onCreateBoundedTasks}
              disabled={!onCreateBoundedTasks || createBoundedTasksPending || boundedTasksCreated}
            >
              <ListChecks className="h-3.5 w-3.5" />
              {createBoundedTasksLabel}
            </Button>
            {promotionActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button key={action.href} asChild variant="outline" size="sm" className="h-8">
                  <a href={action.href}>
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
        {createBoundedTasksError ? (
          <p className="mt-2 text-xs leading-5 text-destructive">{createBoundedTasksError}</p>
        ) : null}
      </div>
    </section>
  );
}
