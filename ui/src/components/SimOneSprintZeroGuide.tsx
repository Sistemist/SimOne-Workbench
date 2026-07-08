import { CheckCircle2, FileSearch, Map, Search, ShieldCheck } from "lucide-react";

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

export function SimOneSprintZeroGuide() {
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
    </section>
  );
}
