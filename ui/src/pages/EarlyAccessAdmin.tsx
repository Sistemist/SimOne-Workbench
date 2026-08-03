import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import { earlyAccessApi } from "@/api/early-access";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { queryKeys } from "@/lib/queryKeys";

const DEFAULT_SOURCE = "founder-introduction";

function activationUrl(token: string) {
  return `${window.location.origin}/activate/${encodeURIComponent(token)}`;
}

export function EarlyAccessAdmin() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [founderName, setFounderName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [maxVentures, setMaxVentures] = useState(3);
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Early access" },
    ]);
  }, [setBreadcrumbs]);

  const stateQuery = useQuery({
    queryKey: queryKeys.earlyAccess.admin,
    queryFn: () => earlyAccessApi.getAdminState(),
  });

  const createMutation = useMutation({
    mutationFn: () => earlyAccessApi.createGrant({
      founderName: founderName.trim(),
      email: email.trim(),
      source: source.trim() || undefined,
      maxVentures,
      expiresInHours: 72,
    }),
    onSuccess: async ({ token }) => {
      setLatestLink(activationUrl(token));
      setCopyStatus("idle");
      setFounderName("");
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.earlyAccess.admin });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => earlyAccessApi.approveRequest(requestId, {
      source: "approved-request",
      maxVentures: 3,
      expiresInHours: 72,
    }),
    onSuccess: async ({ token }) => {
      setLatestLink(activationUrl(token));
      setCopyStatus("idle");
      await queryClient.invalidateQueries({ queryKey: queryKeys.earlyAccess.admin });
    },
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!founderName.trim() || !email.trim()) return;
    createMutation.mutate();
  }

  async function copyLatestLink() {
    if (!latestLink) return;
    await navigator.clipboard.writeText(latestLink);
    setCopyStatus("copied");
  }

  if (stateQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading early access…</div>;
  }
  if (stateQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {stateQuery.error instanceof Error
          ? stateQuery.error.message
          : "Instance admin access is required."}
      </div>
    );
  }

  const pendingRequests = (stateQuery.data?.requests ?? []).filter(
    (request) => request.status === "pending",
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Founder early access</h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Create a personal activation link on the spot or approve a public request. Links expire
          after 72 hours; activated founders receive a three-venture allowance by default.
        </p>
      </div>

      {latestLink ? (
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="text-sm font-medium">Activation link ready</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={latestLink}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
            <Button type="button" variant="outline" onClick={() => void copyLatestLink()}>
              <Copy className="mr-2 h-4 w-4" />
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This is the only time the full token is returned. Copy it before creating another link.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Create personal activation</h2>
        </div>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <label className="grid gap-1.5 text-sm font-medium">
            Founder name
            <input
              required
              value={founderName}
              onChange={(event) => setFounderName(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
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
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Source
            <input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Venture allowance
            <input
              type="number"
              min={1}
              max={10}
              value={maxVentures}
              onChange={(event) => setMaxVentures(Number(event.target.value))}
              className="h-10 rounded-md border border-input bg-background px-3"
            />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create activation link"}
            </Button>
            {createMutation.error ? (
              <p className="mt-2 text-sm text-destructive">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Could not create link."}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Pending requests ({pendingRequests.length})</h2>
        <div className="mt-4 grid gap-3">
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending founder requests.</p>
          ) : pendingRequests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <div className="font-medium">{request.founderName}</div>
                <div className="text-sm text-muted-foreground">{request.email}</div>
                {request.useCase ? (
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{request.useCase}</p>
                ) : null}
                <div className="mt-2 text-xs text-muted-foreground">
                  Source: {request.source ?? "unknown"}
                </div>
              </div>
              <Button
                type="button"
                onClick={() => approveMutation.mutate(request.id)}
                disabled={approveMutation.isPending}
              >
                Approve and create link
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Activation history</h2>
        <div className="mt-4 grid gap-2">
          {(stateQuery.data?.grants ?? []).map((grant) => (
            <div
              key={grant.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">{grant.founderName}</span>
                <span className="ml-2 text-muted-foreground">{grant.email}</span>
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {grant.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
