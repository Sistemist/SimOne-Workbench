import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { earlyAccessApi } from "@/api/early-access";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/lib/queryKeys";

export function EarlyAccessActivationPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const activationPath = `/activate/${encodeURIComponent(token)}`;
  const grantQuery = useQuery({
    queryKey: ["early-access", "activation", token],
    queryFn: () => earlyAccessApi.getActivation(token),
    enabled: Boolean(token),
    retry: false,
  });
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: () => earlyAccessApi.activate(token),
    onSuccess: () =>
      navigate("/onboarding?from=scanner&via=early-access", { replace: true }),
  });

  const grant = grantQuery.data;
  const authHref = (mode: "sign_in" | "sign_up") => {
    const params = new URLSearchParams({
      mode,
      next: activationPath,
      ...(grant?.email ? { email: grant.email } : {}),
    });
    return `/auth?${params.toString()}`;
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4" />
          Your Sysdom invitation
        </div>
        {grantQuery.isLoading || sessionQuery.isLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Checking your invitation…</p>
        ) : grantQuery.error || !grant ? (
          <p className="mt-6 text-sm text-destructive">
            {grantQuery.error instanceof Error
              ? grantQuery.error.message
              : "This invitation is unavailable. Ask the Sysdom team for a new link."}
          </p>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Welcome, {grant.founderName}</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your invitation includes space for up to {grant.maxVentures} ventures. A venture
              is a business or business idea, with its own workspace.
            </p>
            {grant.status === "expired" || grant.status === "revoked" ? (
              <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                This invitation is {grant.status}. Ask the Sysdom team for a new link.
              </p>
            ) : sessionQuery.data ? (
              <div className="mt-6">
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Activating access…" : "Activate my access"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {mutation.error ? (
                  <p className="mt-3 text-sm text-destructive">
                    {mutation.error instanceof Error ? mutation.error.message : "We could not activate your access. Please try again or ask the Sysdom team for help."}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <a
                  href={authHref("sign_up")}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  Create account
                </a>
                <a
                  href={authHref("sign_in")}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium"
                >
                  Sign in
                </a>
              </div>
            )}
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Create an account or sign in with {grant.email}, then activate your access.
              Any note and result you chose to keep with your request will be linked to your account.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
