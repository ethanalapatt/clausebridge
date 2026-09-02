import { beforeEach, describe, expect, it } from "vitest";

import { stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import {
  applyAction,
  createInitialState,
  createSession,
  effectiveClauseText,
  findCheckpoint,
  findConstraint,
  findEdit,
  reduce,
  textPreview,
  undo,
} from "@/core/state";
import type { AppState } from "@/core/types";

/**
 * The objective board, preview-revision checkpoints and tool-call provenance
 * added by the elevation pass. The decision transitions themselves live in
 * `state.test.ts`; this covers what was layered on top of them.
 */

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

function clauseIdOf(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((item) => item.clauseType === clauseType);
  if (clause === undefined) throw new Error(`no ${clauseType} clause`);
  return clause.id;
}

describe("objective board", () => {
  let base: AppState;

  beforeEach(() => {
    base = createInitialState();
  });

  it("starts with an empty board", () => {
    expect(base.constraints).toEqual([]);
    expect(base.objectiveNote).toBe("");
    expect(base.constraintSeq).toBe(0);
  });

  it("adds a constraint with a stable ID and records it", () => {
    const next = reduce(
      base,
      { type: "add-constraint", ruleId: "data_deletion_within_days", severity: "must", value: 30 },
      AT,
    );

    expect(next.constraints).toHaveLength(1);
    expect(next.constraints[0]?.id).toBe("con-0001");
    expect(next.constraints[0]?.value).toBe(30);
    expect(next.activity.at(-1)?.summary).toContain("Must constraint");
    expect(next.activity.at(-1)?.after).toBe("Data deleted within 30 days");
  });

  it("falls back to the rule's default when no value is supplied", () => {
    const next = reduce(
      base,
      {
        type: "add-constraint",
        ruleId: "termination_notice_min_days",
        severity: "must",
        value: null,
      },
      AT,
    );
    expect(next.constraints[0]?.value).toBe(30);
  });

  it("stores null for a rule that takes no parameter", () => {
    const next = reduce(
      base,
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: 12 },
      AT,
    );
    expect(next.constraints[0]?.value).toBeNull();
  });

  it("refuses an unknown rule, a bad severity, and a negative or fractional value", () => {
    const bogus = reduce(
      base,
      {
        type: "add-constraint",
        ruleId: "not_a_rule" as never,
        severity: "must",
        value: 1,
      },
      AT,
    );
    expect(bogus).toBe(base);

    expect(
      reduce(
        base,
        {
          type: "add-constraint",
          ruleId: "data_deletion_within_days",
          severity: "maybe" as never,
          value: 30,
        },
        AT,
      ),
    ).toBe(base);

    expect(
      reduce(
        base,
        { type: "add-constraint", ruleId: "data_deletion_within_days", severity: "must", value: -1 },
        AT,
      ),
    ).toBe(base);

    expect(
      reduce(
        base,
        {
          type: "add-constraint",
          ruleId: "data_deletion_within_days",
          severity: "must",
          value: 1.5,
        },
        AT,
      ),
    ).toBe(base);
  });

  it("holds at most one constraint per rule", () => {
    const once = reduce(
      base,
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: null },
      AT,
    );
    const twice = reduce(
      once,
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "prefer", value: null },
      AT,
    );
    expect(twice).toBe(once);
  });

  it("never reuses a constraint ID after a removal", () => {
    let state = reduce(
      base,
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: null },
      AT,
    );
    state = reduce(state, { type: "remove-constraint", constraintId: "con-0001" }, AT);
    expect(state.constraints).toEqual([]);

    state = reduce(
      state,
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: null },
      AT,
    );
    expect(state.constraints[0]?.id).toBe("con-0002");
  });

  it("updates severity, value and note, and ignores a no-op update", () => {
    let state = reduce(
      base,
      {
        type: "add-constraint",
        ruleId: "termination_notice_min_days",
        severity: "must",
        value: 30,
      },
      AT,
    );
    state = reduce(
      state,
      { type: "update-constraint", constraintId: "con-0001", severity: "prefer", value: 45 },
      AT,
    );

    const updated = findConstraint(state, "con-0001");
    expect(updated?.severity).toBe("prefer");
    expect(updated?.value).toBe(45);
    expect(state.activity.at(-1)?.before).toContain("Must");
    expect(state.activity.at(-1)?.after).toContain("45 days");

    expect(
      reduce(
        state,
        { type: "update-constraint", constraintId: "con-0001", severity: "prefer", value: 45 },
        AT,
      ),
    ).toBe(state);
  });

  it("ignores updates and removals for an unknown constraint", () => {
    expect(reduce(base, { type: "remove-constraint", constraintId: "con-9999" }, AT)).toBe(base);
    expect(
      reduce(base, { type: "update-constraint", constraintId: "con-9999", value: 1 }, AT),
    ).toBe(base);
  });

  it("trims the objective note and ignores an unchanged one", () => {
    const next = reduce(base, { type: "set-objective-note", note: "  Exit cleanly.  " }, AT);
    expect(next.objectiveNote).toBe("Exit cleanly.");
    expect(reduce(next, { type: "set-objective-note", note: "Exit cleanly." }, AT)).toBe(next);
  });

  it("is undoable", () => {
    const session = applyAction(
      createSession(base),
      { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: null },
      AT,
    );
    expect(session.present.constraints).toHaveLength(1);
    expect(undo(session, AT).present.constraints).toEqual([]);
  });
});

describe("timeline events", () => {
  it("gives every event a stable ID matching its sequence, and the revision it saw", () => {
    const state = reduce(createInitialState(), { type: "set-role", role: "vendor" }, AT);
    const entry = state.activity.at(-1);
    expect(entry?.id).toBe("ev-0001");
    expect(entry?.seq).toBe(1);
    expect(entry?.revisionId).toBe(state.revision.revisionId);
  });

  it("records which clauses an event affected", () => {
    const base = createInitialState();
    const clauseId = clauseIdOf(base, "termination");
    const next = reduce(base, { type: "toggle-non-negotiable", clauseId }, AT);
    // Selection events name the clause in the summary; decisions carry the IDs.
    expect(next.activity.at(-1)?.summary).toContain(clauseId);
  });

  it("carries before and after wording on a decision", () => {
    const base = createInitialState();
    const clauseId = clauseIdOf(base, "termination");
    const staged = stageRedlinePackage(
      base,
      {
        packageLabel: "P",
        edits: [
          {
            clauseId,
            replacementText: "Either party may terminate on sixty (60) days' notice.",
            rationale: "Symmetry.",
            priorityTag: "preferred",
          },
        ],
      },
      CTX,
    );
    const approved = reduce(staged.state, { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    const entry = approved.activity.at(-1);

    expect(entry?.clauseIds).toEqual([clauseId]);
    expect(entry?.packageIds).toEqual(["pkg-0001"]);
    expect(entry?.after).toBe("Either party may terminate on sixty (60) days' notice.");
    expect(entry?.before).toContain("This Agreement begins on the Effective Date");
  });

  it("truncates a long preview without losing the start of it", () => {
    expect(textPreview("a b c", 120)).toBe("a b c");
    expect(textPreview("x".repeat(200))).toHaveLength(120);
    expect(textPreview("x".repeat(200)).endsWith("…")).toBe(true);
    expect(textPreview("  spaced\n\nout  ")).toBe("spaced out");
  });
});

describe("tool-call provenance", () => {
  const base = createInitialState();

  it("records a successful call with its input, validation and state effect", () => {
    const clauseId = clauseIdOf(base, "liability");
    const outcome = stageRedlinePackage(
      base,
      {
        packageLabel: "Customer-Protective",
        edits: [
          {
            clauseId,
            replacementText: "Replacement liability wording for the fictional demo.",
            rationale: "Alternative from the demo library.",
            priorityTag: "required",
          },
        ],
      },
      CTX,
    );

    const record = outcome.state.toolCalls.at(-1);
    expect(record?.id).toBe("call-0001");
    expect(record?.tool).toBe("stage_redline_package");
    expect(record?.source).toBe("local-handler-test");
    expect(record?.outcome).toBe("ok");
    expect(record?.revisionId).toBe(base.revision.revisionId);
    expect(record?.clauseIds).toEqual([clauseId]);
    expect(record?.inputSummary).toBe("“Customer-Protective” — 1 proposed edit(s)");
    expect(record?.validation).toContain("Accepted");
    expect(record?.stateEffect).toContain("awaiting a separate human decision");
    expect(record?.errorCode).toBeNull();
    // The stored input is the exact serialized payload, not a re-rendering.
    expect(JSON.parse(record?.input ?? "{}")).toMatchObject({
      packageLabel: "Customer-Protective",
    });
    expect(JSON.parse(record?.output ?? "{}")).toMatchObject({ ok: true, packageId: "pkg-0001" });
  });

  it("records a rejected call, including the clause IDs it named", () => {
    const outcome = stageRedlinePackage(
      base,
      {
        packageLabel: "Bad",
        edits: [
          {
            clauseId: "NSA-r1-99",
            replacementText: "x",
            rationale: "y",
            priorityTag: "optional",
          },
        ],
      },
      CTX,
    );

    const record = outcome.state.toolCalls.at(-1);
    expect(record?.outcome).toBe("rejected");
    expect(record?.errorCode).toBe("INVALID_CLAUSE_IDS");
    expect(record?.clauseIds).toEqual(["NSA-r1-99"]);
    expect(record?.stateEffect).toContain("Nothing changed");
    expect(outcome.state.packages).toEqual([]);
  });

  it("pairs each record with the sequence of the event that reported it", () => {
    const outcome = stageRedlinePackage(
      base,
      { packageLabel: "", edits: [] },
      CTX,
    );
    expect(outcome.state.toolCalls.at(-1)?.seq).toBe(outcome.state.activity.at(-1)?.seq);
  });

  it("keeps a record even when the input cannot be serialized", () => {
    const cyclic: Record<string, unknown> = { packageLabel: "Cyclic", edits: [] };
    cyclic.self = cyclic;

    const outcome = stageRedlinePackage(base, cyclic as never, CTX);
    expect(outcome.state.toolCalls).toHaveLength(1);
    expect(outcome.state.toolCalls[0]?.input).toBe("(input could not be serialized)");
  });
});

describe("preview revisions", () => {
  const base = createInitialState();
  const terminationId = clauseIdOf(base, "termination");

  function stageTwo(): AppState {
    return stageRedlinePackage(
      base,
      {
        packageLabel: "Alternatives",
        edits: [
          {
            clauseId: terminationId,
            replacementText: "Either party may terminate on sixty (60) days' notice.",
            rationale: "Symmetry.",
            priorityTag: "preferred",
          },
        ],
      },
      CTX,
    ).state;
  }

  it("records nothing until a decision changes what the agreement reads as", () => {
    const staged = stageTwo();
    expect(staged.checkpoints).toEqual([]);

    const rejected = reduce(staged, { type: "reject-edit", editId: "pkg-0001-e01" }, AT);
    // A rejection leaves the agreement reading exactly as before.
    expect(rejected.checkpoints).toEqual([]);
  });

  it("records a checkpoint when an approval changes the wording", () => {
    const approved = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    const checkpoint = approved.checkpoints.at(-1);

    expect(approved.checkpoints).toHaveLength(1);
    expect(checkpoint?.id).toBe("rev-0001");
    expect(checkpoint?.revisionId).toBe(base.revision.revisionId);
    expect(checkpoint?.clauseTexts[terminationId]).toBe(
      "Either party may terminate on sixty (60) days' notice.",
    );
    expect(checkpoint?.decisions).toEqual([
      { editId: "pkg-0001-e01", status: "approved", humanText: null },
    ]);
    // Every other clause is captured at its untouched source wording.
    expect(Object.keys(checkpoint?.clauseTexts ?? {})).toHaveLength(
      base.revision.clauses.length,
    );
  });

  it("records another checkpoint when the human rewrites the accepted wording", () => {
    let state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    state = reduce(
      state,
      { type: "edit-replacement", editId: "pkg-0001-e01", text: "My own wording." },
      AT,
    );

    expect(state.checkpoints).toHaveLength(2);
    expect(state.checkpoints.at(-1)?.id).toBe("rev-0002");
    expect(state.checkpoints.at(-1)?.decisions[0]?.humanText).toBe("My own wording.");
  });

  it("restores a prior preview revision by replaying its decisions", () => {
    let state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    const first = state.checkpoints[0]?.id ?? "";

    state = reduce(state, { type: "reject-edit", editId: "pkg-0001-e01" }, AT);
    expect(effectiveClauseText(state, terminationId)).toContain("This Agreement begins");

    state = reduce(state, { type: "restore-checkpoint", checkpointId: first }, AT);
    expect(findEdit(state, "pkg-0001-e01")?.status).toBe("approved");
    expect(effectiveClauseText(state, terminationId)).toBe(
      "Either party may terminate on sixty (60) days' notice.",
    );
    expect(state.activity.at(-1)?.summary).toContain("Restored preview revision");
  });

  it("returns proposals staged after a checkpoint to awaiting decision", () => {
    let state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    const first = state.checkpoints[0]?.id ?? "";

    const liabilityId = clauseIdOf(state, "liability");
    state = stageRedlinePackage(
      state,
      {
        packageLabel: "Later",
        edits: [
          {
            clauseId: liabilityId,
            replacementText: "Later liability wording for the fictional demo.",
            rationale: "Counterparty response.",
            priorityTag: "optional",
          },
        ],
      },
      CTX,
    ).state;
    state = reduce(state, { type: "approve-edit", editId: "pkg-0002-e01" }, AT);
    state = reduce(state, { type: "restore-checkpoint", checkpointId: first }, AT);

    expect(findEdit(state, "pkg-0002-e01")?.status).toBe("pending");
    expect(findEdit(state, "pkg-0001-e01")?.status).toBe("approved");
    expect(state.activity.at(-1)?.detail).toContain("returned to awaiting decision");
  });

  it("does not record a checkpoint for restoring one", () => {
    let state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    // The rejection changes the wording back, so it is itself a checkpoint.
    state = reduce(state, { type: "reject-edit", editId: "pkg-0001-e01" }, AT);
    const before = state.checkpoints.length;
    expect(before).toBe(2);

    state = reduce(state, { type: "restore-checkpoint", checkpointId: "rev-0001" }, AT);
    expect(state.checkpoints).toHaveLength(before);
  });

  it("ignores an unknown checkpoint and one from another revision", () => {
    const state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    expect(reduce(state, { type: "restore-checkpoint", checkpointId: "rev-9999" }, AT)).toBe(
      state,
    );

    const foreign: AppState = {
      ...state,
      checkpoints: state.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        revisionId: "NSA-r9",
      })),
    };
    expect(
      reduce(foreign, { type: "restore-checkpoint", checkpointId: "rev-0001" }, AT),
    ).toBe(foreign);
  });

  it("is findable by ID", () => {
    const state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    expect(findCheckpoint(state, "rev-0001")?.label).toContain("approve");
    expect(findCheckpoint(state, "nope")).toBeNull();
  });

  it("never captures the source agreement, only what it reads as", () => {
    const state = reduce(stageTwo(), { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    const clause = state.revision.clauses.find((item) => item.id === terminationId);
    expect(clause?.text).toContain("This Agreement begins on the Effective Date");
  });
});
