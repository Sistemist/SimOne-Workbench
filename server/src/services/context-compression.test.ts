import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { compressJsonContextPayload } from "./context-compression.js";

interface ContextPreservationFixture {
  id: string;
  payload: Record<string, unknown>;
}

interface ContextPreservationCorpus {
  version: string;
  fixtures: ContextPreservationFixture[];
}

const corpusPath = new URL(
  "../../../evals/fixtures/sysdom-context-preservation.v1.json",
  import.meta.url,
);
const corpus = JSON.parse(await readFile(corpusPath, "utf8")) as ContextPreservationCorpus;

describe("Sysdom context compression preservation", () => {
  it("covers every M4 alpha context family", () => {
    expect(corpus.version).toBe("sysdom_context_preservation_corpus_v1");
    expect(corpus.fixtures.map((fixture) => fixture.id).sort()).toEqual([
      "customer-engine-bridge",
      "run-transcript",
      "scanner-context",
      "sim-wiki-retrieval",
      "venture-context-projection",
    ]);
  });

  it.each(corpus.fixtures)("$id retains every declared fact and provenance receipt", ({ payload }) => {
    const envelope = compressJsonContextPayload(payload);

    expect(envelope).toMatchObject({
      strategy: "sysdom_context_compression_v1",
      compressor: "simone_json_headroom_v0",
      preservation: {
        version: "sysdom_context_preservation_v1",
        status: "passed",
        retentionRatio: 1,
        blockers: [],
      },
    });
    expect(envelope.preservation.requiredFacts).toBeGreaterThan(0);
    expect(envelope.preservation.preservedFacts).toBe(envelope.preservation.requiredFacts);
    expect(envelope.preservation.sourceRefs.length).toBeGreaterThan(0);
    expect(envelope.preservation.facts.every((fact) => fact.status === "preserved")).toBe(true);
    expect(envelope.outputBytes).toBeLessThan(envelope.inputBytes);
  });

  it("fails closed when a declared transcript fact falls outside the retained sample", () => {
    const transcript = structuredClone(
      corpus.fixtures.find((fixture) => fixture.id === "run-transcript")!.payload,
    );
    transcript.preservationRequirements = [
      {
        id: "omitted-transcript-fact",
        pointer: "/content/entries/4/text",
      },
    ];

    const envelope = compressJsonContextPayload(transcript);

    expect(envelope.preservation).toMatchObject({
      status: "blocked",
      requiredFacts: 1,
      preservedFacts: 0,
      retentionRatio: 0,
    });
    expect(envelope.preservation.blockers).toContain(
      "required_fact_missing_output:omitted-transcript-fact",
    );
  });

  it("does not retain hashes for a declared secret-bearing fact", () => {
    const envelope = compressJsonContextPayload({
      sourceKind: "run-transcript",
      sourceRefs: [
        {
          kind: "heartbeat_run",
          id: "run-1",
          label: "Secret safety fixture",
        },
      ],
      preservationRequirements: [
        {
          id: "unsafe-token",
          pointer: "/content/apiToken",
        },
      ],
      content: {
        apiToken: "do-not-store",
      },
    });

    expect(envelope.preservation.status).toBe("blocked");
    expect(envelope.preservation.facts[0]).toMatchObject({
      status: "redacted",
      inputSha256: null,
      outputSha256: null,
    });
    expect(envelope.compressedJson).not.toContain("do-not-store");
  });

  it("keeps legacy ungoverned JSON measurable without inventing a quality pass", () => {
    const envelope = compressJsonContextPayload({
      sourceKind: "legacy-json",
      values: ["one", "two", "three", "four"],
    });

    expect(envelope.preservation).toMatchObject({
      status: "not_requested",
      requiredFacts: 0,
      preservedFacts: 0,
      retentionRatio: 1,
      blockers: [],
    });
  });

  it("is stable for identical payloads", () => {
    const payload = corpus.fixtures[0]!.payload;
    const first = compressJsonContextPayload(payload);
    const second = compressJsonContextPayload(payload);

    expect(second).toEqual(first);
  });
});
