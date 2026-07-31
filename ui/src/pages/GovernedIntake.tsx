import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GovernedIntakeCompatibility,
  GovernedIntakeDecision,
  GovernedIntakeResourceKind,
  PluginRecord,
} from "@paperclipai/shared";
import { GitPullRequestArrow, ShieldCheck } from "lucide-react";
import { governedIntakeApi } from "@/api/governedIntake";
import { pluginsApi } from "@/api/plugins";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useToastActions } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";

const EMPTY_PLUGIN = "__select__";

export function GovernedIntake() {
  const { selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToastActions();
  const queryClient = useQueryClient();
  const [resourceKind, setResourceKind] = useState<GovernedIntakeResourceKind>("plugin");
  const [pluginId, setPluginId] = useState(EMPTY_PLUGIN);
  const [resourceId, setResourceId] = useState("");
  const [resourceVersion, setResourceVersion] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [decision, setDecision] = useState<GovernedIntakeDecision>("defer");
  const [compatibility, setCompatibility] = useState<GovernedIntakeCompatibility>("needs_review");
  const [permissionBoundary, setPermissionBoundary] = useState("");
  const [costBoundary, setCostBoundary] = useState("");
  const [productBoundary, setProductBoundary] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: "Settings", href: "/company/settings" },
      { label: "Instance settings", href: "/company/settings/instance/general" },
      { label: "Governed intake" },
    ]);
  }, [selectedCompany?.name, setBreadcrumbs]);

  const assessmentsQuery = useQuery({
    queryKey: queryKeys.governedIntake.all,
    queryFn: governedIntakeApi.list,
  });
  const pluginsQuery = useQuery({
    queryKey: queryKeys.plugins.all,
    queryFn: () => pluginsApi.list(),
  });
  const selectedPlugin = useMemo(
    () => pluginsQuery.data?.find((plugin) => plugin.id === pluginId) ?? null,
    [pluginId, pluginsQuery.data],
  );

  const latestByPluginVersion = useMemo(() => {
    const result = new Map<string, NonNullable<typeof assessmentsQuery.data>[number]>();
    for (const assessment of assessmentsQuery.data ?? []) {
      if (assessment.pluginId) {
        const key = `${assessment.pluginId}:${assessment.resourceVersion}`;
        if (!result.has(key)) result.set(key, assessment);
      }
    }
    return result;
  }, [assessmentsQuery.data]);

  const createMutation = useMutation({
    mutationFn: governedIntakeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.governedIntake.all });
      pushToast({ title: "Intake decision recorded", tone: "success" });
      setReviewNote("");
      setSourceLabel("");
      setSourceUrl("");
    },
    onError: (error: Error) => {
      pushToast({ title: "Could not record intake decision", body: error.message, tone: "error" });
    },
  });

  const submit = () => {
    const plugin = resourceKind === "plugin" ? selectedPlugin : null;
    createMutation.mutate({
      resourceKind,
      resourceId: plugin?.pluginKey ?? resourceId,
      resourceVersion: plugin?.version ?? resourceVersion,
      displayName: plugin?.manifestJson.displayName ?? plugin?.packageName ?? displayName,
      pluginId: plugin?.id ?? null,
      decision,
      compatibility,
      permissionBoundary,
      costBoundary,
      productBoundary,
      reviewNote,
      sourceRefs: [{
        kind: resourceKind === "plugin" ? "plugin_manifest" : "paperclip_upstream",
        id: plugin ? `${plugin.pluginKey}@${plugin.version}` : resourceId,
        label: sourceLabel,
        ...(sourceUrl.trim() ? { url: sourceUrl.trim() } : {}),
        capturedAt: new Date().toISOString(),
      }],
    });
  };

  const formReady = Boolean(
    (resourceKind === "plugin" ? selectedPlugin : resourceId && resourceVersion && displayName)
    && permissionBoundary
    && costBoundary
    && productBoundary
    && reviewNote
    && sourceLabel
    && !(decision === "adopt" && compatibility !== "compatible"),
  );

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Governed intake</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Review one exact plugin or Paperclip upstream version before it enters the operating system.
          A plugin can activate only after a compatible adopt or adapt decision for its installed version.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record an intake decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Intake kind">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={resourceKind}
                onChange={(event) => setResourceKind(event.target.value as GovernedIntakeResourceKind)}
              >
                <option value="plugin">Installed plugin</option>
                <option value="paperclip_upstream">Paperclip upstream change</option>
              </select>
            </Field>
            {resourceKind === "plugin" ? (
              <Field label="Exact installed version">
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pluginId}
                  onChange={(event) => setPluginId(event.target.value)}
                >
                  <option value={EMPTY_PLUGIN}>Select a plugin</option>
                  {(pluginsQuery.data ?? []).filter(isReviewablePlugin).map((plugin) => (
                    <option key={plugin.id} value={plugin.id}>
                      {plugin.manifestJson.displayName ?? plugin.packageName} · {plugin.version}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <>
                <Field label="Change name">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Upstream change title" />
                </Field>
                <Field label="Source identifier">
                  <Input value={resourceId} onChange={(event) => setResourceId(event.target.value)} placeholder="PR, commit, or release identifier" />
                </Field>
                <Field label="Exact version">
                  <Input value={resourceVersion} onChange={(event) => setResourceVersion(event.target.value)} placeholder="Commit SHA or release" />
                </Field>
              </>
            )}
            <Field label="Decision">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={decision}
                onChange={(event) => setDecision(event.target.value as GovernedIntakeDecision)}
              >
                <option value="adopt">Adopt</option>
                <option value="adapt">Adapt</option>
                <option value="defer">Defer</option>
                <option value="reject">Reject</option>
              </select>
            </Field>
            <Field label="Compatibility">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={compatibility}
                onChange={(event) => setCompatibility(event.target.value as GovernedIntakeCompatibility)}
              >
                <option value="compatible">Compatible</option>
                <option value="needs_review">Needs review</option>
                <option value="incompatible">Incompatible</option>
              </select>
            </Field>
          </div>

          {selectedPlugin ? <CapabilitySnapshot plugin={selectedPlugin} /> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Permission boundary">
              <Textarea value={permissionBoundary} onChange={(event) => setPermissionBoundary(event.target.value)} placeholder="Allowed data, actions, and credentials" />
            </Field>
            <Field label="Cost boundary">
              <Textarea value={costBoundary} onChange={(event) => setCostBoundary(event.target.value)} placeholder="Allowed spend, billing, and call limits" />
            </Field>
            <Field label="Product boundary">
              <Textarea value={productBoundary} onChange={(event) => setProductBoundary(event.target.value)} placeholder="What this cannot redefine or control" />
            </Field>
          </div>
          <Field label="Review note">
            <Textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Why this decision is safe and useful now" />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Evidence label">
              <Input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Manifest review, test run, PR review…" />
            </Field>
            <Field label="Evidence URL (optional)">
              <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" />
            </Field>
          </div>
          {decision === "adopt" && compatibility !== "compatible" ? (
            <p className="text-sm text-amber-700">Adoption requires compatible evidence. Choose adapt, defer, or reject while review remains open.</p>
          ) : null}
          <Button disabled={!formReady || createMutation.isPending} onClick={submit}>
            {createMutation.isPending ? "Recording…" : "Record decision"}
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <GitPullRequestArrow className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Installed plugin gate</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(pluginsQuery.data ?? []).filter(isReviewablePlugin).map((plugin) => {
            const assessment = latestByPluginVersion.get(`${plugin.id}:${plugin.version}`);
            const approved = assessment?.compatibility === "compatible"
              && (assessment.decision === "adopt" || assessment.decision === "adapt");
            return (
              <Card key={plugin.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{plugin.manifestJson.displayName ?? plugin.packageName}</p>
                      <p className="text-xs text-muted-foreground">{plugin.pluginKey}@{plugin.version}</p>
                    </div>
                    <Badge variant="outline">{approved ? "Activation approved" : "Review required"}</Badge>
                  </div>
                  {assessment ? (
                    <p className="text-sm text-muted-foreground">
                      {assessment.decision.replace("_", " ")} · {assessment.compatibility.replace("_", " ")} · {assessment.reviewNote}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No assessment exists for this exact installed version.</p>
                  )}
                  <p className="text-xs text-muted-foreground">Lifecycle: {plugin.status}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Decision history</h2>
        {(assessmentsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No governed intake decisions yet.</p>
        ) : (
          <div className="space-y-2">
            {(assessmentsQuery.data ?? []).map((assessment) => (
              <Card key={assessment.id}>
                <CardContent className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium">{assessment.displayName} · {assessment.resourceVersion}</p>
                    <p className="text-sm text-muted-foreground">{assessment.reviewNote}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{assessment.resourceKind.replace("_", " ")}</Badge>
                    <Badge variant="outline">{assessment.decision}</Badge>
                    <Badge variant="outline">{assessment.compatibility.replace("_", " ")}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CapabilitySnapshot({ plugin }: { plugin: PluginRecord }) {
  const capabilities = plugin.manifestJson.capabilities;
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manifest capability snapshot</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {capabilities.length > 0
          ? capabilities.map((capability) => <Badge key={capability} variant="outline">{capability}</Badge>)
          : <span className="text-sm text-muted-foreground">No host capabilities declared.</span>}
      </div>
    </div>
  );
}

function isReviewablePlugin(plugin: PluginRecord) {
  return plugin.status !== "uninstalled";
}
