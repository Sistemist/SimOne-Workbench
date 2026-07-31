import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import type {
  ModelExecutionBillingType,
  ModelExecutionPolicyInput,
  ModelExecutionPolicySnapshot,
} from "../../api/modelRouting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelExecutionPolicyEditorProps {
  policies: ModelExecutionPolicySnapshot[];
  isSaving: boolean;
  saveError: string | null;
  savedPolicy: ModelExecutionPolicySnapshot | null;
  onSave: (agentId: string, input: ModelExecutionPolicyInput) => void;
}

function humanize(value: string) {
  const label = value.replaceAll("_", " ");
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;
}

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function datetimeLocalValue(value: string | null) {
  return value ? value.slice(0, 16) : "";
}

function isoFromDatetimeLocal(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function evidenceWindowNow() {
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    verifiedAt: verifiedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function Field({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help ? <p className="text-xs leading-5 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function ModelExecutionPolicyEditor({
  policies,
  isSaving,
  saveError,
  savedPolicy,
  onSave,
}: ModelExecutionPolicyEditorProps) {
  const [agentId, setAgentId] = useState(policies[0]?.agentId ?? "");
  const selectedPolicy = useMemo(
    () => policies.find((item) => item.agentId === agentId) ?? policies[0] ?? null,
    [agentId, policies],
  );
  const [draft, setDraft] = useState<ModelExecutionPolicyInput | null>(
    selectedPolicy?.policy ?? null,
  );

  useEffect(() => {
    if (!selectedPolicy) {
      setDraft(null);
      return;
    }
    if (!agentId) setAgentId(selectedPolicy.agentId);
    setDraft(selectedPolicy.policy);
  }, [agentId, selectedPolicy]);

  if (policies.length === 0 || !selectedPolicy || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution policy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Add an agent before configuring a governed model route.
        </CardContent>
      </Card>
    );
  }

  const status = savedPolicy?.agentId === selectedPolicy.agentId
    ? savedPolicy.assessment
    : selectedPolicy.assessment;
  const isMetered = draft.billingType === "metered_api";
  const isSubscription = draft.billingType === "subscription_included";
  const setDraftValue = <K extends keyof ModelExecutionPolicyInput>(
    key: K,
    value: ModelExecutionPolicyInput[K],
  ) => setDraft((current) => current ? { ...current, [key]: value } : current);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Execution policy</CardTitle>
          <Badge variant="outline" className={
            status.status === "ready"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : status.status === "blocked"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700"
          }>
            {status.status}
          </Badge>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Pin the route and record fresh external billing evidence before any governed provider invocation.
          Saving never tests or calls the provider.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="model-policy-agent" label="Agent">
            <Select value={selectedPolicy.agentId} onValueChange={setAgentId}>
              <SelectTrigger id="model-policy-agent" aria-label="Policy agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {policies.map((item) => (
                  <SelectItem key={item.agentId} value={item.agentId}>
                    {item.agentName} · {item.adapterType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="model-policy-billing" label="Billing boundary">
            <Select
              value={draft.billingType}
              onValueChange={(value) => setDraftValue("billingType", value as ModelExecutionBillingType)}
            >
              <SelectTrigger id="model-policy-billing" aria-label="Billing boundary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="free">Verified free</SelectItem>
                <SelectItem value="subscription_included">Subscription included</SelectItem>
                <SelectItem value="metered_api">Metered API</SelectItem>
                <SelectItem value="unknown">Unknown — block execution</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="model-policy-provider" label="Pinned provider">
            <Input
              id="model-policy-provider"
              value={draft.provider}
              onChange={(event) => setDraftValue("provider", event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field id="model-policy-model" label="Pinned model">
            <Input
              id="model-policy-model"
              value={draft.model}
              onChange={(event) => setDraftValue("model", event.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field id="model-policy-timeout" label="Timeout (seconds)">
            <Input
              id="model-policy-timeout"
              type="number"
              min={1}
              value={draft.timeoutSec}
              onChange={(event) => setDraftValue("timeoutSec", Number(event.target.value))}
            />
          </Field>
          <Field id="model-policy-turns" label="Maximum turns per run">
            <Input
              id="model-policy-turns"
              type="number"
              min={1}
              value={draft.maxTurnsPerRun}
              onChange={(event) => setDraftValue("maxTurnsPerRun", Number(event.target.value))}
            />
          </Field>
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fixed fail-closed controls
          </div>
          <p className="mt-1 text-sm">1 run per day · 0 automatic retries · concurrency 1</p>
        </div>

        {isMetered ? (
          <div className="space-y-4 rounded-md border border-border px-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Provider hard-cap evidence</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use a provider account cap, not an internal application budget.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const window = evidenceWindowNow();
                  setDraft((current) => current ? {
                    ...current,
                    providerHardCapVerifiedAt: window.verifiedAt,
                    providerHardCapExpiresAt: window.expiresAt,
                  } : current);
                }}
              >
                Verify now · 24h freshness
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="model-policy-run-cap" label="Per-run allowance (cents)">
                <Input
                  id="model-policy-run-cap"
                  type="number"
                  min={1}
                  value={draft.maxRunCostCents ?? ""}
                  onChange={(event) => setDraftValue("maxRunCostCents", nullableNumber(event.target.value))}
                />
              </Field>
              <Field id="model-policy-provider-cap" label="Provider/account hard cap (cents)">
                <Input
                  id="model-policy-provider-cap"
                  type="number"
                  min={1}
                  value={draft.providerHardCapCents ?? ""}
                  onChange={(event) => setDraftValue("providerHardCapCents", nullableNumber(event.target.value))}
                />
              </Field>
              <Field id="model-policy-cap-source" label="Evidence source">
                <Input
                  id="model-policy-cap-source"
                  placeholder="e.g. provider billing settings"
                  value={draft.providerHardCapEvidenceSource ?? ""}
                  onChange={(event) => setDraftValue(
                    "providerHardCapEvidenceSource",
                    event.target.value.trimStart() || null,
                  )}
                />
              </Field>
              <div />
              <Field id="model-policy-cap-verified" label="Verified at">
                <Input
                  id="model-policy-cap-verified"
                  type="datetime-local"
                  value={datetimeLocalValue(draft.providerHardCapVerifiedAt)}
                  onChange={(event) => setDraftValue(
                    "providerHardCapVerifiedAt",
                    isoFromDatetimeLocal(event.target.value),
                  )}
                />
              </Field>
              <Field id="model-policy-cap-expires" label="Fresh until">
                <Input
                  id="model-policy-cap-expires"
                  type="datetime-local"
                  value={datetimeLocalValue(draft.providerHardCapExpiresAt)}
                  onChange={(event) => setDraftValue(
                    "providerHardCapExpiresAt",
                    isoFromDatetimeLocal(event.target.value),
                  )}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {isSubscription ? (
          <div className="space-y-4 rounded-md border border-border px-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-medium">Subscription evidence</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Confirm the selected route is included and metered overage is disabled.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const window = evidenceWindowNow();
                  setDraft((current) => current ? {
                    ...current,
                    subscriptionVerifiedAt: window.verifiedAt,
                    subscriptionExpiresAt: window.expiresAt,
                    meteredOverageAllowed: false,
                  } : current);
                }}
              >
                Verify now · 24h freshness
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="model-policy-subscription-source" label="Evidence source">
                <Input
                  id="model-policy-subscription-source"
                  value={draft.subscriptionEvidenceSource ?? ""}
                  onChange={(event) => setDraftValue(
                    "subscriptionEvidenceSource",
                    event.target.value.trimStart() || null,
                  )}
                />
              </Field>
              <div />
              <Field id="model-policy-subscription-verified" label="Verified at">
                <Input
                  id="model-policy-subscription-verified"
                  type="datetime-local"
                  value={datetimeLocalValue(draft.subscriptionVerifiedAt)}
                  onChange={(event) => setDraftValue(
                    "subscriptionVerifiedAt",
                    isoFromDatetimeLocal(event.target.value),
                  )}
                />
              </Field>
              <Field id="model-policy-subscription-expires" label="Fresh until">
                <Input
                  id="model-policy-subscription-expires"
                  type="datetime-local"
                  value={datetimeLocalValue(draft.subscriptionExpiresAt)}
                  onChange={(event) => setDraftValue(
                    "subscriptionExpiresAt",
                    isoFromDatetimeLocal(event.target.value),
                  )}
                />
              </Field>
            </div>
          </div>
        ) : null}

        <div className={
          status.status === "ready"
            ? "rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-3"
            : "rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3"
        }>
          <div className="flex items-center gap-2 text-sm font-medium">
            {status.status === "ready"
              ? <ShieldCheck className="h-4 w-4 text-emerald-700" />
              : <TriangleAlert className="h-4 w-4 text-amber-700" />}
            Safety assessment: {status.status}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {status.blockers.length > 0
              ? status.blockers.map(humanize).join(" · ")
              : "Pinned route, bounded execution, and fresh external billing evidence are recorded."}
          </p>
        </div>

        {saveError ? (
          <p className="text-sm text-destructive">{saveError}</p>
        ) : null}
        {savedPolicy?.agentId === selectedPolicy.agentId ? (
          <p className="text-sm text-emerald-700">
            Policy saved. Current safety status: {savedPolicy.assessment.status}.
          </p>
        ) : null}

        <Button
          type="button"
          onClick={() => onSave(selectedPolicy.agentId, draft)}
          disabled={isSaving || !draft.provider.trim() || !draft.model.trim()}
        >
          {isSaving ? "Saving…" : "Save execution policy"}
        </Button>
      </CardContent>
    </Card>
  );
}
