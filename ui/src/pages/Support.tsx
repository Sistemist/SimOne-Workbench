import { useEffect, useState } from "react";
import {
  Activity,
  Check,
  ClipboardCopy,
  Compass,
  DollarSign,
  Inbox,
  LifeBuoy,
  Repeat,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { copyTextToClipboard } from "@/lib/clipboard";
import { Link } from "@/lib/router";

export interface SysdomSupportContextV1 {
  version: 1;
  product: "Sysdom AI";
  capturedAt: string;
  companyId: string | null;
  route: string;
  browser: string;
}

export function buildSysdomSupportContext(input: {
  capturedAt: string;
  companyId: string | null;
  route: string;
  browser: string;
}): SysdomSupportContextV1 {
  return {
    version: 1,
    product: "Sysdom AI",
    capturedAt: input.capturedAt,
    companyId: input.companyId,
    route: input.route,
    browser: input.browser,
  };
}

const RECOVERY_PATHS = [
  {
    title: "Venture state or SIM Cycle looks wrong",
    body: "Open the Founder Cockpit and review the active Constitution, state history, provenance, and current cycle before changing anything.",
    href: "/cockpit",
    action: "Open Founder Cockpit",
    icon: Compass,
  },
  {
    title: "A task or agent stopped",
    body: "Start with Inbox for failed work, then use Activity to inspect the recorded sequence instead of rerunning blindly.",
    href: "/inbox",
    action: "Open Inbox",
    icon: Inbox,
  },
  {
    title: "A routine ran unexpectedly",
    body: "Open Routines, pause the definition, and inspect Recent Runs. Do not delete the audit trail while diagnosing it.",
    href: "/routines",
    action: "Open Routines",
    icon: Repeat,
  },
  {
    title: "Usage or spend is unclear",
    body: "Open Costs and reconcile unknown or zero-priced metered events before any further paid execution.",
    href: "/costs",
    action: "Open Costs",
    icon: DollarSign,
  },
] as const;

export function Support() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    setBreadcrumbs([{ label: "Help & Recovery" }]);
  }, [setBreadcrumbs]);

  async function copySupportContext() {
    const context = buildSysdomSupportContext({
      capturedAt: new Date().toISOString(),
      companyId: selectedCompanyId ?? null,
      route: `${window.location.pathname}${window.location.search}`,
      browser: navigator.userAgent,
    });

    try {
      await copyTextToClipboard(JSON.stringify(context, null, 2));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-border">
            <LifeBuoy className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Help & Recovery</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recover from the recorded state first. Keep credentials and founder evidence out of support messages.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Choose the problem you can see</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These paths preserve provenance and approvals while you inspect the issue.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {RECOVERY_PATHS.map((path) => {
            const Icon = path.icon;
            return (
              <Card key={path.title}>
                <CardHeader className="px-5 pt-5 pb-2">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{path.title}</CardTitle>
                      <CardDescription className="mt-1 leading-6">{path.body}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={path.href}>{path.action}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader className="px-5 pt-5 pb-2">
            <CardTitle className="text-base">Safe support context</CardTitle>
            <CardDescription>
              Copy a bounded diagnostic header before contacting an authorized Sysdom support person.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-2">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="border border-border p-3">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Included</div>
                <div className="mt-1 leading-6">Product, timestamp, company ID, route, and browser identity.</div>
              </div>
              <div className="border border-border p-3">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Excluded</div>
                <div className="mt-1 leading-6">Prompts, task bodies, logs, model output, credentials, and customer evidence.</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void copySupportContext()}>
                {copyState === "copied" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copyState === "copied" ? "Support context copied" : "Copy safe support context"}
              </Button>
              {copyState === "error" ? (
                <span className="text-sm text-destructive">Clipboard access failed. Nothing was sent.</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30">
          <CardHeader className="px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <CardTitle className="text-base">Never paste into support</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2">
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              <li>API keys, bearer tokens, passwords, cookies, or private URLs.</li>
              <li>Raw founder prompts, customer records, payment details, or full logs.</li>
              <li>Unreviewed model output presented as a confirmed decision.</li>
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-4 px-0">
              <Link to="/activity">
                <Activity className="h-4 w-4" />
                Inspect recorded activity
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
