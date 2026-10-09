import type { ScannerSnapshot } from "@paperclipai/shared";
import { trackPublicFunnelEvent } from "@/lib/publicFunnel";
import { FormEvent, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { earlyAccessApi } from "@/api/early-access";
import { findScannerSnapshot } from "@/lib/scanner-storage";

export function EarlyAccessRequestPage() {
  const [searchParams] = useSearchParams();
  const scan = findScannerSnapshot(searchParams.get("scan"));
  return <EarlyAccessRequestForm scan={scan ?? undefined} source={searchParams.get("source") ?? "product"} />;
}

export function EarlyAccessRequestForm({ scan, source = "product", reviewSummary, embedded = false, isTest = false }: {
  scan?: ScannerSnapshot; source?: string; reviewSummary?: string; embedded?: boolean; isTest?: boolean;
}) {
  const requestKey = useRef(crypto.randomUUID());
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
        source,
        consentToRetainScan: retainScan,
        scan: retainScan && scan ? scan : undefined,
      });
      setStatus("done");
      if (embedded) trackPublicFunnelEvent("venture_review_access_request", { isTest });
    } catch (nextError) {
      setStatus("idle");
      setError(nextError instanceof Error ? nextError.message : "Your request could not be sent. Please try again.");
    }
  }

  const Container = embedded ? "section" : "main";
  const Heading = embedded ? "h3" : "h1";
  return (
    <Container className={embedded ? "text-foreground" : "min-h-screen bg-background px-4 py-10 text-foreground"}>
      <div className="mx-auto max-w-2xl">
        {!embedded ? <a href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sysdom AI
        </a> : null}
        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium">
            Invite-only early access
          </div>
          <Heading className="mt-4 text-2xl font-semibold">Request early access to Sysdom</Heading>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            We are inviting a small group of founders to try Sysdom with our help. This is a
            request for an invitation, not account creation or a Venture Review.
          </p>

          {isTest ? <p className="mt-4 text-sm" role="status">Local demonstration only: use an @example.test address. No real access request is stored.</p> : null}
          {status === "done" ? (
            <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                Request received
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                We will review your request personally. If approved, you will receive an
                invitation to create an account or sign in, then activate your access.
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
                What are you building? (optional)
                <textarea
                  value={useCase}
                  onChange={(event) => setUseCase(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="rounded-md border border-input bg-background px-3 py-2"
                  placeholder="A sentence or two is enough."
                />
              </label>
              {embedded ? <div className="space-y-3 text-sm">
                {reviewSummary ? <Button type="button" variant="outline" onClick={() => setUseCase(reviewSummary.slice(0, 2000))}>Use a short summary from my review</Button> : null}
                <p>Only your name, email and the message above are sent to Sysdom with this access request. Edit or remove the summary before sending. Your full review, original note and source excerpts are not saved by this form; download the review to keep it.</p>
              </div> : null}
              {scan ? (
                <label className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={retainScan}
                    onChange={(event) => setRetainScan(event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium">Include my note and result with this request</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      With your consent, Sysdom keeps your original note and result for up to
                      30 days before you activate access. Activation links them to your account.
                      They are not added to a venture until you choose one.
                    </span>
                  </span>
                </label>
              ) : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? "Sending request…" : "Request early access"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </Container>
  );
}
