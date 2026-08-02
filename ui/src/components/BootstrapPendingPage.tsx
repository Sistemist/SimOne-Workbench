import type { ReactNode } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Link } from "@/lib/router";
import { Button } from "@/components/ui/button";
import type { AuthSession } from "@paperclipai/shared";

type BootstrapPendingPageProps = {
  claimAvailable: boolean;
  hasActiveInvite?: boolean;
  session: AuthSession | null | undefined;
  claimState: "idle" | "claiming" | "success";
  claimError?: { status?: number; message?: string } | null;
  onClaim: () => void;
};

function StateChrome({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-lg border border-border bg-card p-6">{children}</div>
    </div>
  );
}

function displayIdentity(session: AuthSession) {
  return session.user.email || session.user.name || session.user.id;
}

function claimErrorCopy(error: BootstrapPendingPageProps["claimError"]) {
  if (error?.status === 409) {
    return {
      title: "Someone else has already claimed this workspace.",
      body: "Refresh to sign in, or ask the existing admin to invite you from Instance settings -> Access.",
    };
  }
  if (error?.status === 401) {
    return {
      title: "Your session expired. Sign in again to claim this workspace.",
      body: "",
    };
  }
  return {
    title: "We couldn't reach the server. Try again in a moment.",
    body: "",
  };
}

export function BootstrapPendingPage({
  claimAvailable,
  session,
  claimState,
  claimError,
  onClaim,
}: BootstrapPendingPageProps) {
  if (!claimAvailable) {
    return (
      <StateChrome>
        <h1 className="text-xl font-semibold">This Sysdom AI workspace is waiting on its first admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This Sysdom AI workspace is invite-only. Ask the workspace owner for an invite link, then open it
          from this browser to finish setup.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Browser-based claim is intentionally disabled so visitors cannot promote themselves.
        </p>
      </StateChrome>
    );
  }

  if (claimState === "success") {
    return (
      <StateChrome>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-semibold">You're the workspace admin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Setup is complete. Taking you to onboarding to create your first company...
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-sm text-muted-foreground">Redirecting...</span>
        </div>
        <div className="mt-5">
          <Button asChild variant="outline">
            <a href="/app">Continue to dashboard</a>
          </Button>
        </div>
      </StateChrome>
    );
  }

  if (!session) {
    return (
      <StateChrome>
        <h1 className="text-xl font-semibold">Finish setting up Sysdom AI</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your account to claim the first Sysdom AI workspace for this installation.
        </p>
        <div className="mt-5">
          <Button asChild>
            <Link to="/auth?next=/app">Sign in / Create account</Link>
          </Button>
        </div>
      </StateChrome>
    );
  }

  const errorCopy = claimErrorCopy(claimError);
  const isClaiming = claimState === "claiming";
  return (
    <StateChrome>
      <h1 className="text-xl font-semibold">Finish setting up Sysdom AI</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Claim this workspace to become the first admin and start onboarding.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={onClaim} disabled={isClaiming}>
          {isClaiming && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
          {isClaiming ? "Claiming..." : "Claim this workspace"}
        </Button>
        <span className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{displayIdentity(session)}</span>
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Wrong account?{" "}
        <Link to="/auth?next=/app" className="underline underline-offset-2">
          Switch account
        </Link>
        .
      </p>
      {claimError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 flex-shrink-0" aria-hidden />
          <div>
            <p className="font-medium">{errorCopy.title}</p>
            {errorCopy.body && <p className="mt-1 text-destructive/90">{errorCopy.body}</p>}
          </div>
        </div>
      )}
    </StateChrome>
  );
}
