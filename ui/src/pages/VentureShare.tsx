import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Compass, Layers, ShieldCheck, Users } from "lucide-react";
import { useParams } from "react-router-dom";
import type { VentureShareRecord } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { ventureSharesApi } from "../api/ventureShares";

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function VentureShare() {
  const { shareId } = useParams();
  const [share, setShare] = useState<VentureShareRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!shareId) {
      setError("Share link not found.");
      return;
    }
    ventureSharesApi.get(shareId)
      .then((record) => {
        if (!cancelled) setShare(record);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Share link not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const snapshot = share?.snapshot ?? null;
  const firstNextMove = snapshot?.nextMoves[0] ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <header className="border-b border-border pb-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <span>SimOne</span>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal sm:text-3xl">
            {snapshot?.company.name ?? "Venture Architecture Map"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {snapshot?.company.description ?? "A public readout of the operating shape this venture is building."}
          </p>
        </header>

        {error ? (
          <section className="rounded-lg border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Share link not available</h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </section>
        ) : snapshot ? (
          <>
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                What this map means
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                A public, safe view of how {snapshot.company.name} is organized to move work forward.
                Private setup details are left out; this page shows the shape of the work, the current
                streams, and the moves that need attention.
              </p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="font-medium">{countLabel(snapshot.agents.length, "operating role", "operating roles")}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Who carries responsibility.</p>
                </div>
                <div>
                  <div className="font-medium">{countLabel(snapshot.projects.length, "work stream", "work streams")}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Where the venture is moving.</p>
                </div>
                <div>
                  <div className="font-medium">{countLabel(snapshot.nextMoves.length, "next move", "next moves")}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">What needs judgment next.</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Sprint Zero brief
              </div>
              <div className="mt-3 grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <h2 className="font-medium text-foreground">What is clear</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {snapshot.company.name} has {countLabel(snapshot.agents.length, "operating role", "operating roles")}{" "}
                    and {countLabel(snapshot.projects.length, "work stream", "work streams")} in motion.
                  </p>
                </div>
                <div>
                  <h2 className="font-medium text-foreground">What needs proof</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {firstNextMove
                      ? `${firstNextMove.title} is the next move to test.`
                      : "The next proof move is not listed yet."}
                  </p>
                </div>
                <div>
                  <h2 className="font-medium text-foreground">Human review boundary</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Review the next move before customers, money, public claims, or structure change.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Operating roles
                </div>
                <div className="mt-3 space-y-3">
                  {snapshot.agents.map((agent) => (
                    <div key={`${agent.role}-${agent.name}`}>
                      <div className="text-sm font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[agent.title, agent.role].filter(Boolean).join(" · ")}
                      </div>
                      {agent.capabilities ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{agent.capabilities}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  Work streams
                </div>
                <div className="mt-3 space-y-3">
                  {snapshot.projects.map((project) => (
                    <div key={project.name}>
                      <div className="text-sm font-medium">{project.name}</div>
                      {project.description ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{project.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                  <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Next moves
                </div>
                <div className="mt-3 space-y-3">
                  {snapshot.nextMoves.map((move) => (
                    <div key={`${move.projectName ?? "venture"}-${move.title}`}>
                      <div className="text-sm font-medium">{move.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {[move.projectName, move.priority].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Venture Architecture Map
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                {snapshot.principles.map((principle) => (
                  <p key={principle}>{principle}</p>
                ))}
              </div>
            </section>

            <div>
              <Button asChild>
                <a href="/scanner">
                  Scan your own system
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </>
        ) : (
          <section className="rounded-lg border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Loading venture map...
          </section>
        )}
      </div>
    </main>
  );
}
