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

type SimOneSprintZeroGuideProps = {
  onCreateBoundedTasks?: () => void;
  createBoundedTasksPending?: boolean;
  boundedTasksCreated?: boolean;
  createBoundedTasksError?: string | null;
  onCreateArtifact?: () => void;
  createArtifactPending?: boolean;
  artifactCreated?: boolean;
  createArtifactError?: string | null;
  simWikiReady?: boolean;
  onSaveToWiki?: () => void;
  saveToWikiPending?: boolean;
  wikiSavedPath?: string | null;
  saveToWikiError?: string | null;
};

export function SimOneSprintZeroGuide({
  onCreateBoundedTasks,
  createBoundedTasksPending = false,
  boundedTasksCreated = false,
  createBoundedTasksError = null,
  onCreateArtifact,
  createArtifactPending = false,
  artifactCreated = false,
  createArtifactError = null,
  simWikiReady = false,
  onSaveToWiki,
  saveToWikiPending = false,
  wikiSavedPath = null,
  saveToWikiError = null,
}: SimOneSprintZeroGuideProps = {}) {
  const createBoundedTasksLabel = boundedTasksCreated
    ? "Bounded tasks created"
    : createBoundedTasksPending
      ? "Creating bounded tasks..."
      : "Create bounded next tasks";
  const createArtifactLabel = artifactCreated
    ? "Artifact record created"
    : createArtifactPending
      ? "Creating artifact record..."
      : "Turn the reviewed map into a shareable artifact";
  const saveToWikiLabel = wikiSavedPath
    ? "Saved to SIM Wiki"
    : saveToWikiPending
      ? "Saving to SIM Wiki..."
      : "Save trusted decisions to SIM Wiki";

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onCreateArtifact}
              disabled={!onCreateArtifact || createArtifactPending || artifactCreated}
            >
              <Share2 className="h-3.5 w-3.5" />
              {createArtifactLabel}
            </Button>
            {simWikiReady && onSaveToWiki ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onSaveToWiki}
                disabled={saveToWikiPending || Boolean(wikiSavedPath)}
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                {saveToWikiLabel}
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-8">
                <a href="/wiki">
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  Save trusted decisions to SIM Wiki
                </a>
              </Button>
            )}
          </div>
        </div>
        {createBoundedTasksError ? (
          <p className="mt-2 text-xs leading-5 text-destructive">{createBoundedTasksError}</p>
        ) : null}
        {createArtifactError ? (
          <p className="mt-2 text-xs leading-5 text-destructive">{createArtifactError}</p>
        ) : null}
        {wikiSavedPath ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs leading-5 text-muted-foreground">
            <span>Saved to SIM Wiki: {wikiSavedPath}</span>
            <a className="font-medium text-primary underline underline-offset-2" href={`/wiki/page/${wikiSavedPath}`}>
              Open saved page
            </a>
          </p>
        ) : null}
        {saveToWikiError ? (
          <p className="mt-2 text-xs leading-5 text-destructive">{saveToWikiError}</p>
        ) : null}
      </div>
    </section>
  );
}
