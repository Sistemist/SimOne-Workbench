import { FormEvent, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { earlyAccessApi } from "@/api/early-access";
import { findScannerSnapshot } from "@/lib/scanner-storage";

export function EarlyAccessRequestPage() {
  const [searchParams] = useSearchParams();
  const requestKey = useRef(crypto.randomUUID());
  const scan = findScannerSnapshot(searchParams.get("scan"));
  const [founderName, setFounderName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [retainScan, setRetainScan] = useState(Boolean(scan));
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      await earlyAccessApi.requestAccess({
        requestKey: requestKey.current,
        founderName: founderName.trim(),
        email: email.trim(),
        useCase: useCase.trim() || undefined,
        source: searchParams.get("source") ?? "product",
        consentToRetainScan: retainScan,
        scan: retainScan && scan ? scan : undefined,
      });
      setStatus("done");
    } catch (nextError) {
      setStatus("idle");
      setError(nextError instanceof Error ? nextError.message : "Could not submit request.");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <a href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sysdom AI
        </a>
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium">
            Invite-only early access
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Request founder access</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We are onboarding a small founder cohort personally. Requesting access does not create
            an account; if approved, you receive a private activation link.
          </p>

          {status === "done" ? (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Request received
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We will review it personally. Your account is created only after you receive and
                open an activation link.
              </p>
            </div>
          ) : (
            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-1.5 text-sm font-medium">
                Your name
                <input
                  required
                  value={founderName}
                  onChange={(event) => setFounderName(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3"
                  autoComplete="name"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3"
                  autoComplete="email"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                What are you building?
                <textarea
                  value={useCase}
                  onChange={(event) => setUseCase(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="rounded-md border border-input bg-background px-3 py-2"
                  placeholder="A sentence or two is enough."
                />
              </label>
              {scan ? (
                <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={retainScan}
                    onChange={(event) => setRetainScan(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Keep this scan with my request</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      With your consent, Sysdom retains the raw note and result for up to 30 days
                      while unclaimed. Activation claims it to your account; it does not become
                      canonical venture state until you assign it to a venture.
                    </span>
                  </span>
                </label>
              ) : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? "Submitting…" : "Request early access"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
