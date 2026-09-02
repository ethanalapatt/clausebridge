import { beforeEach, describe, expect, it } from "vitest";

import { PACKAGE_PRESETS, buildPackage } from "@/core/demo";
import { getNegotiationContext, stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import {
  checkpointAt,
  compareCheckpoints,
  documentAt,
  latestComparison,
  replaySteps,
  sourceTextMap,
} from "@/core/replay";
import { createInitialState, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

function clauseOf(state: AppState, clauseType: string): string {
  return state.revision.clauses.find((clause) => clause.clauseType === clauseType)!.id;
}

/** A short but complete session: context, two packages, two decisions. */
function session(): AppState {
  let state = createInitialState();
  state = getNegotiationContext(
    state,
    {
      clauseIds: [clauseOf(state, "termination"), clauseOf(state, "data_retention")],
      partyRole: "customer",
      priorityAreas: ["termination"],
    },
    CTX,
  ).state;

  for (const preset of PACKAGE_PRESETS.slice(0, 2)) {
    const input = buildPackage(state, preset.posture);
    if (input !== null) state = stageRedlinePackage(state, input, CTX).state;
  }

  state = reduce(state, { type: "approve-edit", editId: "pkg-0001-e02" }, AT);
  state = reduce(state, { type: "reject-edit", editId: "pkg-0002-e01" }, AT);
  return state;
}

describe("sourceTextMap", () => {
  it("returns the untouched wording for every clause", () => {
    const state = session();
    const map = sourceTextMap(state);

    expect(Object.keys(map)).toHaveLength(state.revision.clauses.length);
    for (const clause of state.revision.clauses) {
      expect(map[clause.id]).toBe(clause.text);
    }
  });
});

describe("checkpointAt", () => {
  it("returns nothing before the first preview revision", () => {
    expect(checkpointAt(session(), 1)).toBeNull();
  });

  it("returns the most recent preview revision at or before a sequence", () => {
    const state = session();
    const first = state.checkpoints[0]!;
    expect(checkpointAt(state, first.seq)?.id).toBe(first.id);
    expect(checkpointAt(state, first.seq - 1)).toBeNull();
    expect(checkpointAt(state, 9999)?.id).toBe(state.checkpoints.at(-1)?.id);
  });
});

describe("documentAt", () => {
  it("falls back to the source agreement before any decision", () => {
    const state = session();
    expect(documentAt(state, 1)).toEqual(sourceTextMap(state));
  });

  it("returns the wording in force at that point", () => {
    const state = session();
    const termination = clauseOf(state, "termination");
    const after = documentAt(state, state.checkpoints[0]!.seq);

    expect(after[termination]).not.toBe(sourceTextMap(state)[termination]);
    expect(after[termination]).toContain("Either party may terminate");
  });
});

describe("replaySteps", () => {
  let state: AppState;

  beforeEach(() => {
    state = session();
  });

  it("returns one step per recorded event, in order", () => {
    const steps = replaySteps(state);
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.map((step) => step.index)).toEqual(steps.map((_, index) => index));

    const seqs = steps.map((step) => step.event.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
  });

  it("drops the call entries so a tool call appears once, with its record", () => {
    const steps = replaySteps(state);
    expect(steps.some((step) => step.event.kind === "tool-call")).toBe(false);

    const withRecords = steps.filter((step) => step.toolCall !== null);
    expect(withRecords).toHaveLength(state.toolCalls.length);
    expect(withRecords[0]?.toolCall?.tool).toBe("get_negotiation_context");
    expect(withRecords[0]?.event.kind).toBe("tool-result");
  });

  it("attributes every step to the human or a named tool source", () => {
    for (const step of replaySteps(state)) {
      expect(["ui", "native-webmcp", "local-handler-test"]).toContain(step.event.source);
    }
  });

  it("shows the agreement as it read at each point, never re-running a tool", () => {
    const steps = replaySteps(state);
    const termination = clauseOf(state, "termination");

    expect(steps[0]?.clauseTexts[termination]).toBe(sourceTextMap(state)[termination]);
    expect(steps.at(-1)?.clauseTexts[termination]).toContain("Either party may terminate");

    // Replaying is a read: the recorded call log is untouched by it.
    const before = state.toolCalls.length;
    replaySteps(state);
    expect(state.toolCalls).toHaveLength(before);
  });

  it("is empty for a fresh session", () => {
    expect(replaySteps(createInitialState())).toEqual([]);
  });
});

describe("compareCheckpoints", () => {
  it("compares the first preview revision against the original agreement", () => {
    const state = session();
    const comparison = compareCheckpoints(state, null, state.checkpoints[0]!.id);

    expect(comparison?.fromLabel).toBe("Original agreement");
    expect(comparison?.changes).toHaveLength(1);
    expect(comparison?.changes[0]?.clauseId).toBe(clauseOf(state, "termination"));
    expect(comparison?.wordsAdded).toBeGreaterThan(0);
    expect(comparison?.changes[0]?.beforeText).toContain("This Agreement begins");
  });

  it("returns no changes when both sides are the same state", () => {
    const state = session();
    const id = state.checkpoints[0]!.id;
    expect(compareCheckpoints(state, id, id)?.changes).toEqual([]);
  });

  it("returns null for an unknown checkpoint on either side", () => {
    const state = session();
    expect(compareCheckpoints(state, "rev-9999", null)).toBeNull();
    expect(compareCheckpoints(state, null, "rev-9999")).toBeNull();
  });

  it("opens on the most recent revision and whatever came before it", () => {
    const state = session();
    const comparison = latestComparison(state);
    expect(comparison?.toId).toBe(state.checkpoints.at(-1)?.id);
  });

  it("has nothing to open before any decision", () => {
    expect(latestComparison(createInitialState())).toBeNull();
  });

  it("never reports the source agreement as changed", () => {
    const state = session();
    const comparison = compareCheckpoints(state, null, state.checkpoints.at(-1)!.id);
    for (const change of comparison?.changes ?? []) {
      const clause = state.revision.clauses.find((item) => item.id === change.clauseId);
      expect(clause?.text).toBe(sourceTextMap(state)[change.clauseId]);
    }
  });
});
