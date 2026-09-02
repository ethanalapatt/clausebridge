import { beforeEach, describe, expect, it } from "vitest";

import { stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import { planMigration } from "@/core/migration";
import { toDraft } from "@/core/segmentation";
import {
  applyAction,
  canUndo,
  clauseDecisionStatus,
  commit,
  createInitialState,
  createSession,
  effectiveClauseText,
  findClause,
  findEdit,
  governingEdit,
  isEditStale,
  reduce,
  resetSession,
  undo,
  undoLabel,
} from "@/core/state";
import type { Session } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

const REPLACEMENT = "Replacement wording authored for the fictional demo.";

function typeId(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((c) => c.clauseType === clauseType);
  if (clause === undefined) throw new Error(`missing ${clauseType}`);
  return clause.id;
}

/** A state with a three-clause package staged and every edit pending. */
function stagedState(): { state: AppState; ids: Record<string, string>; edits: string[] } {
  const base = createInitialState();
  const ids = {
    termination: typeId(base, "termination"),
    retention: typeId(base, "data_retention"),
    liability: typeId(base, "liability"),
  };

  const { state } = stageRedlinePackage(
    base,
    {
      packageLabel: "Customer Baseline",
      edits: [
        {
          clauseId: ids.termination,
          replacementText: `${REPLACEMENT} Termination.`,
          rationale: "Mirror the convenience right.",
          priorityTag: "preferred",
        },
        {
          clauseId: ids.retention,
          replacementText: `${REPLACEMENT} Retention.`,
          rationale: "Bound the retention window.",
          priorityTag: "required",
        },
        {
          clauseId: ids.liability,
          replacementText: `${REPLACEMENT} Liability.`,
          rationale: "Raise the cap.",
          priorityTag: "required",
        },
      ],
    },
    CTX,
  );

  return { state, ids, edits: state.edits.map((edit) => edit.editId) };
}

describe("decision transitions", () => {
  let staged: ReturnType<typeof stagedState>;

  beforeEach(() => {
    staged = stagedState();
  });

  it("keeps staged state separate from the approved source", () => {
    const clause = findClause(staged.state, staged.ids.liability!);
    expect(effectiveClauseText(staged.state, staged.ids.liability!)).toBe(clause?.text);
    expect(governingEdit(staged.state, staged.ids.liability!)).toBeNull();
    expect(clauseDecisionStatus(staged.state, staged.ids.liability!)).toBe("pending");
  });

  it("applies an approval to the effective text but never to the source clause", () => {
    const editId = staged.edits[0]!;
    const clauseId = staged.ids.termination!;
    const sourceText = findClause(staged.state, clauseId)?.text;

    const next = reduce(staged.state, { type: "approve-edit", editId }, AT);

    expect(effectiveClauseText(next, clauseId)).toBe(`${REPLACEMENT} Termination.`);
    expect(findClause(next, clauseId)?.text).toBe(sourceText);
    expect(clauseDecisionStatus(next, clauseId)).toBe("approved");
  });

  it("treats each decision independently", () => {
    let state = staged.state;
    state = reduce(state, { type: "approve-edit", editId: staged.edits[0]! }, AT);
    state = reduce(
      state,
      { type: "edit-replacement", editId: staged.edits[1]!, text: "Human wording." },
      AT,
    );
    state = reduce(state, { type: "reject-edit", editId: staged.edits[2]! }, AT);

    expect(state.edits.map((e) => e.status)).toEqual(["approved", "edited", "rejected"]);

    // Approved and edited apply; rejected leaves the clause untouched.
    expect(effectiveClauseText(state, staged.ids.termination!)).toBe(`${REPLACEMENT} Termination.`);
    expect(effectiveClauseText(state, staged.ids.retention!)).toBe("Human wording.");
    expect(effectiveClauseText(state, staged.ids.liability!)).toBe(
      findClause(state, staged.ids.liability!)?.text,
    );
  });

  it("prefers the human's wording over the agent's once edited", () => {
    const editId = staged.edits[1]!;
    const state = reduce(
      staged.state,
      { type: "edit-replacement", editId, text: "  Human wording.  " },
      AT,
    );

    const edit = state.edits.find((e) => e.editId === editId);
    expect(edit?.status).toBe("edited");
    expect(edit?.humanText).toBe("Human wording.");
    // The agent's proposal is retained for the audit trail, not overwritten.
    expect(edit?.proposedText).toBe(`${REPLACEMENT} Retention.`);
  });

  it("clears human wording when the edit is later approved as proposed or rejected", () => {
    const editId = staged.edits[1]!;
    let state = reduce(staged.state, { type: "edit-replacement", editId, text: "Human." }, AT);
    state = reduce(state, { type: "approve-edit", editId }, AT);

    expect(state.edits.find((e) => e.editId === editId)?.humanText).toBeNull();
    expect(effectiveClauseText(state, staged.ids.retention!)).toBe(`${REPLACEMENT} Retention.`);
  });

  it("ignores a blank human replacement", () => {
    const editId = staged.edits[1]!;
    const state = reduce(staged.state, { type: "edit-replacement", editId, text: "   " }, AT);
    expect(state).toBe(staged.state);
  });

  it("returns a decided edit to pending", () => {
    const editId = staged.edits[0]!;
    let state = reduce(staged.state, { type: "approve-edit", editId }, AT);
    state = reduce(state, { type: "reset-edit", editId }, AT);

    expect(state.edits[0]?.status).toBe("pending");
    expect(effectiveClauseText(state, staged.ids.termination!)).toBe(
      findClause(state, staged.ids.termination!)?.text,
    );
  });

  it("attaches and clears notes without changing the decision", () => {
    const editId = staged.edits[2]!;
    let state = reduce(staged.state, { type: "reject-edit", editId }, AT);
    state = reduce(state, { type: "set-note", editId, note: "  Escalate to counsel.  " }, AT);

    expect(state.edits[2]?.note).toBe("Escalate to counsel.");
    expect(state.edits[2]?.status).toBe("rejected");

    state = reduce(state, { type: "set-note", editId, note: null }, AT);
    expect(state.edits[2]?.note).toBeNull();
    expect(state.edits[2]?.status).toBe("rejected");
  });

  it("keeps exactly one approved proposal per clause, leaving rivals staged", () => {
    const clauseId = staged.ids.liability!;
    const first = staged.edits[2]!;
    let state = reduce(staged.state, { type: "approve-edit", editId: first }, AT);

    const second = stageRedlinePackage(
      state,
      {
        packageLabel: "Second Pass",
        edits: [
          {
            clauseId,
            replacementText: "Later wording.",
            rationale: "Counterparty response.",
            priorityTag: "optional",
          },
        ],
      },
      CTX,
    );
    state = reduce(second.state, { type: "approve-edit", editId: "pkg-0002-e01" }, AT);

    expect(effectiveClauseText(state, clauseId)).toBe("Later wording.");
    // The displaced alternative is returned to awaiting decision — still staged
    // and still comparable — never rejected on the human's behalf.
    expect(findEdit(state, first)?.status).toBe("pending");
    expect(
      state.edits.filter(
        (edit) =>
          edit.clauseId === clauseId &&
          (edit.status === "approved" || edit.status === "edited"),
      ),
    ).toHaveLength(1);
    expect(state.activity.at(-1)?.detail).toContain(first);

    // Rejecting the winner falls back to the source clause, not to wording no
    // live decision supports.
    state = reduce(state, { type: "reject-edit", editId: "pkg-0002-e01" }, AT);
    expect(effectiveClauseText(state, clauseId)).toBe(
      staged.state.revision.clauses.find((clause) => clause.id === clauseId)?.text,
    );
  });

  it("ignores decisions on unknown edit IDs", () => {
    expect(reduce(staged.state, { type: "approve-edit", editId: "nope" }, AT)).toBe(staged.state);
    expect(reduce(staged.state, { type: "reject-edit", editId: "nope" }, AT)).toBe(staged.state);
  });

  it("records every decision in the audit trail with an increasing sequence", () => {
    let state = staged.state;
    state = reduce(state, { type: "approve-edit", editId: staged.edits[0]! }, AT);
    state = reduce(state, { type: "reject-edit", editId: staged.edits[2]! }, AT);

    const seqs = state.activity.map((entry) => entry.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(state.activity.at(-1)?.kind).toBe("decision");
  });
});

describe("document revision and stale edits", () => {
  it("marks edits stale when their clause ID is retired, and excludes them from effective text", () => {
    const staged = stagedState();
    const approved = reduce(staged.state, { type: "approve-edit", editId: staged.edits[0]! }, AT);

    const revised = reduce(
      approved,
      {
        type: "revise-document",
        drafts: approved.revision.clauses.map(toDraft),
        label: "Corrected boundaries",
      },
      AT,
    );

    expect(revised.revision.revisionId).toBe("NSA-r2");
    for (const edit of revised.edits) {
      expect(isEditStale(revised, edit)).toBe(true);
    }
    // The new revision's clauses read as their original source text.
    for (const clause of revised.revision.clauses) {
      expect(effectiveClauseText(revised, clause.id)).toBe(clause.text);
    }
    expect(revised.selectedClauseIds).toEqual([]);
    expect(revised.nonNegotiableClauseIds).toEqual([]);
  });
});

describe("settings transitions", () => {
  it("toggles selection and non-negotiable markers only for real clauses", () => {
    const base = createInitialState();
    const id = typeId(base, "liability");

    let state = reduce(base, { type: "toggle-selected", clauseId: id }, AT);
    expect(state.selectedClauseIds).toEqual([id]);
    state = reduce(state, { type: "toggle-selected", clauseId: id }, AT);
    expect(state.selectedClauseIds).toEqual([]);

    expect(reduce(base, { type: "toggle-selected", clauseId: "ghost" }, AT)).toBe(base);
    expect(reduce(base, { type: "toggle-non-negotiable", clauseId: "ghost" }, AT)).toBe(base);
  });

  it("trims and drops blank priority areas", () => {
    const state = reduce(
      createInitialState(),
      { type: "set-priority-areas", areas: [" termination ", "", "   ", "data retention"] },
      AT,
    );
    expect(state.priorityAreas).toEqual(["termination", "data retention"]);
  });

  it("does not record an activity entry for a no-op role change", () => {
    const base = createInitialState();
    expect(reduce(base, { type: "set-role", role: base.partyRole }, AT)).toBe(base);
  });

  it("clears staged work when a new document is loaded but keeps the audit trail", () => {
    const staged = stagedState();
    const next = reduce(staged.state, { type: "load-seed" }, AT);

    expect(next.edits).toEqual([]);
    expect(next.packages).toEqual([]);
    expect(next.activity.length).toBe(staged.state.activity.length + 1);
    expect(next.activity.at(-1)?.kind).toBe("document");
  });
});

describe("undo", () => {
  let session: Session;
  let editIds: string[];

  beforeEach(() => {
    const staged = stagedState();
    session = { present: staged.state, past: [] };
    editIds = staged.edits;
  });

  it("starts with nothing to undo", () => {
    expect(canUndo(createSession())).toBe(false);
    expect(undoLabel(createSession())).toBeNull();
    expect(undo(createSession(), AT).present).toEqual(createSession().present);
  });

  it("steps back one decision at a time", () => {
    let s = applyAction(session, { type: "approve-edit", editId: editIds[0]! }, AT);
    s = applyAction(s, { type: "reject-edit", editId: editIds[2]! }, AT);
    expect(s.present.edits.map((e) => e.status)).toEqual(["approved", "pending", "rejected"]);

    s = undo(s, AT);
    expect(s.present.edits.map((e) => e.status)).toEqual(["approved", "pending", "pending"]);

    s = undo(s, AT);
    expect(s.present.edits.map((e) => e.status)).toEqual(["pending", "pending", "pending"]);
    expect(canUndo(s)).toBe(false);
  });

  it("appends the undo to the audit trail rather than erasing history", () => {
    const before = session.present.activity.length;
    let s = applyAction(session, { type: "approve-edit", editId: editIds[0]! }, AT);
    s = undo(s, AT);

    // The approval entry and the undo entry both survive.
    expect(s.present.activity.length).toBe(before + 2);
    expect(s.present.activity.at(-1)?.summary).toMatch(/^Undid: approve /);
  });

  it("labels the pending undo for the human", () => {
    const s = applyAction(session, { type: "reject-edit", editId: editIds[2]! }, AT);
    expect(undoLabel(s)).toMatch(/^reject /);
  });

  it("does not record focus or WebMCP status changes as undoable", () => {
    let s = applyAction(session, { type: "focus-clause", clauseId: null }, AT);
    s = applyAction(s, { type: "set-webmcp-status", status: { kind: "unavailable", reason: "x" } }, AT);
    expect(canUndo(s)).toBe(false);
  });

  it("ignores actions that change nothing", () => {
    const s = applyAction(session, { type: "approve-edit", editId: "ghost" }, AT);
    expect(s).toBe(session);
  });

  it("caps the undo stack", () => {
    let s = session;
    for (let i = 0; i < 60; i += 1) {
      s = commit(s, { ...s.present, focusPulse: i + 1 }, `change ${i}`);
    }
    expect(s.past.length).toBe(50);
    expect(s.past[0]?.label).toBe("change 10");
  });
});

describe("apply-demo-setup", () => {
  it("applies role, selection, non-negotiables and priorities in one step", () => {
    const base = createInitialState();
    const liability = base.revision.clauses.find((c) => c.clauseType === "liability")!.id;
    const termination = base.revision.clauses.find((c) => c.clauseType === "termination")!.id;

    const next = reduce(
      base,
      {
        type: "apply-demo-setup",
        label: "Applied the demo setup",
        setup: {
          partyRole: "customer",
          selectedClauseIds: [liability, termination],
          nonNegotiableClauseIds: [liability],
          priorityAreas: ["termination", "  data retention  ", "   "],
          constraints: [],
          objectiveNote: "",
        },
      },
      AT,
    );

    expect(next.partyRole).toBe("customer");
    expect(next.selectedClauseIds).toEqual([liability, termination]);
    expect(next.nonNegotiableClauseIds).toEqual([liability]);
    // Blank areas are dropped and the rest are trimmed.
    expect(next.priorityAreas).toEqual(["termination", "data retention"]);
    expect(next.activity.at(-1)?.summary).toBe("Applied the demo setup");
  });

  it("drops clause IDs that do not exist in the active revision", () => {
    const base = createInitialState();
    const real = base.revision.clauses[0]!.id;

    const next = reduce(
      base,
      {
        type: "apply-demo-setup",
        label: "setup",
        setup: {
          partyRole: "vendor",
          selectedClauseIds: [real, "NSA-r1-999", "not-a-clause"],
          nonNegotiableClauseIds: ["NSA-r1-999"],
          priorityAreas: [],
          constraints: [],
          objectiveNote: "",
        },
      },
      AT,
    );

    expect(next.selectedClauseIds).toEqual([real]);
    expect(next.nonNegotiableClauseIds).toEqual([]);
  });

  it("is undoable", () => {
    const session = createSession();
    const s = applyAction(
      session,
      {
        type: "apply-demo-setup",
        label: "Applied the demo setup",
        setup: {
          partyRole: "customer",
          selectedClauseIds: [],
          nonNegotiableClauseIds: [],
          priorityAreas: ["termination"],
          constraints: [],
          objectiveNote: "",
        },
      },
      AT,
    );

    expect(canUndo(s)).toBe(true);
    expect(undo(s, AT).present.priorityAreas).toEqual([]);
  });
});

describe("record-export", () => {
  it("appends a truthful export entry without changing any document state", () => {
    const base = createInitialState();
    const next = reduce(
      base,
      { type: "record-export", kind: "brief", filename: "northstar-r1-negotiation-brief.md" },
      AT,
    );

    const entry = next.activity.at(-1)!;
    expect(entry.kind).toBe("export");
    expect(entry.summary).toBe("Downloaded the negotiation brief");
    expect(entry.detail).toBe("northstar-r1-negotiation-brief.md");
    expect(next.revision).toBe(base.revision);
    expect(next.edits).toBe(base.edits);
  });

  it("is not undoable — there is nothing to step back to", () => {
    const s = applyAction(
      createSession(),
      { type: "record-export", kind: "redline", filename: "x.md" },
      AT,
    );
    expect(canUndo(s)).toBe(false);
    expect(s.present.activity.length).toBe(1);
  });
});

describe("resetSession", () => {
  it("restores the exact initial state after a full golden path", () => {
    const initial = createInitialState();
    let session = createSession();
    const liability = initial.revision.clauses.find((c) => c.clauseType === "liability")!.id;

    session = applyAction(session, { type: "set-role", role: "vendor" }, AT);
    session = applyAction(session, { type: "toggle-selected", clauseId: liability }, AT);
    session = applyAction(session, { type: "toggle-non-negotiable", clauseId: liability }, AT);
    session = applyAction(session, { type: "set-priority-areas", areas: ["liability"] }, AT);
    session = applyAction(session, { type: "focus-clause", clauseId: liability }, AT);

    const staged = stageRedlinePackage(
      session.present,
      {
        packageLabel: "Baseline",
        edits: [
          {
            clauseId: liability,
            replacementText: "A different fictional liability allocation.",
            rationale: "demo",
            priorityTag: "required",
          },
        ],
      },
      { source: "local-handler-test", at: AT },
    );
    session = commit(session, staged.state, "stage");

    const reset = resetSession(session);

    expect(reset.past).toEqual([]);
    expect(reset.present).toEqual(initial);
  });

  it("keeps the WebMCP status, which describes the browser rather than the demo", () => {
    let session = createSession();
    session = applyAction(
      session,
      {
        type: "set-webmcp-status",
        status: { kind: "registered", toolNames: ["get_negotiation_context"] },
      },
      AT,
    );

    const reset = resetSession(session);
    expect(reset.present.webmcpStatus).toEqual({
      kind: "registered",
      toolNames: ["get_negotiation_context"],
    });
    expect(reset.present.activity).toEqual([]);
    expect(reset.present.seq).toBe(0);
  });
});

describe("migrate-edits", () => {
  it("carries a stranded redline into the active revision and logs it", () => {
    const base = createInitialState();
    const liability = base.revision.clauses.find((c) => c.clauseType === "liability")!.id;

    const staged = stageRedlinePackage(
      base,
      {
        packageLabel: "Baseline",
        edits: [
          {
            clauseId: liability,
            replacementText: "A different fictional liability allocation applies.",
            rationale: "demo",
            priorityTag: "required",
          },
        ],
      },
      { source: "local-handler-test", at: AT },
    );

    const drafts = staged.state.revision.clauses.map(toDraft);
    const revised = reduce(staged.state, { type: "revise-document", drafts, label: "r" }, AT);
    expect(isEditStale(revised, revised.edits[0]!)).toBe(true);

    const plan = planMigration(revised);
    const migrated = reduce(revised, { type: "migrate-edits", candidates: plan.candidates }, AT);

    expect(isEditStale(migrated, migrated.edits[0]!)).toBe(false);
    expect(migrated.activity.at(-1)!.summary).toContain("Carried 1 staged redline");
  });

  it("changes nothing when there is nothing to migrate", () => {
    const state = createInitialState();
    expect(reduce(state, { type: "migrate-edits", candidates: [] }, AT)).toBe(state);
  });
});

describe("decide-package", () => {
  function threeStaged() {
    const base = createInitialState();
    const ids = ["liability", "termination", "data_retention"].map(
      (t) => base.revision.clauses.find((c) => c.clauseType === t)!.id,
    );
    const staged = stageRedlinePackage(
      base,
      {
        packageLabel: "Customer Baseline",
        edits: ids.map((clauseId, i) => ({
          clauseId,
          replacementText: `Fictional replacement ${i}.`,
          rationale: `reason ${i}`,
          priorityTag: "preferred" as const,
        })),
      },
      { source: "local-handler-test", at: AT },
    );
    return { state: staged.state, packageId: staged.state.packages[0]!.packageId };
  }

  it("approves every undecided redline in the package", () => {
    const { state, packageId } = threeStaged();
    const next = reduce(state, { type: "decide-package", packageId, decision: "approved" }, AT);

    expect(next.edits.every((edit) => edit.status === "approved")).toBe(true);
    expect(next.activity.at(-1)!.summary).toContain("Approved 3 undecided redline(s)");
    expect(next.activity.at(-1)!.summary).toContain("Customer Baseline");
  });

  it("rejects every undecided redline in the package", () => {
    const { state, packageId } = threeStaged();
    const next = reduce(state, { type: "decide-package", packageId, decision: "rejected" }, AT);

    expect(next.edits.every((edit) => edit.status === "rejected")).toBe(true);
  });

  it("never overwrites a decision the human already made", () => {
    const { state, packageId } = threeStaged();
    const first = state.edits[0]!.editId;
    const second = state.edits[1]!.editId;

    let next = reduce(state, { type: "reject-edit", editId: first }, AT);
    next = reduce(next, { type: "edit-replacement", editId: second, text: "my wording" }, AT);
    next = reduce(next, { type: "decide-package", packageId, decision: "approved" }, AT);

    expect(next.edits.find((e) => e.editId === first)!.status).toBe("rejected");
    expect(next.edits.find((e) => e.editId === second)!.status).toBe("edited");
    expect(next.edits.find((e) => e.editId === second)!.humanText).toBe("my wording");
    // Only the one remaining pending redline was approved.
    expect(next.edits.filter((e) => e.status === "approved")).toHaveLength(1);
    expect(next.activity.at(-1)!.summary).toContain("Approved 1 undecided");
  });

  it("leaves other packages alone", () => {
    const { state, packageId } = threeStaged();
    const second = stageRedlinePackage(
      state,
      {
        packageLabel: "Second",
        edits: [
          {
            clauseId: state.revision.clauses.find((c) => c.clauseType === "payment")!.id,
            replacementText: "Fictional payment wording.",
            rationale: "x",
            priorityTag: "optional",
          },
        ],
      },
      { source: "local-handler-test", at: AT },
    ).state;

    const next = reduce(second, { type: "decide-package", packageId, decision: "approved" }, AT);
    const otherPackageId = second.packages[1]!.packageId;

    expect(
      next.edits.filter((e) => e.packageId === otherPackageId).every((e) => e.status === "pending"),
    ).toBe(true);
  });

  it("changes nothing for an unknown package or one with nothing pending", () => {
    const { state, packageId } = threeStaged();
    expect(reduce(state, { type: "decide-package", packageId: "nope", decision: "approved" }, AT)).toBe(state);

    const decided = reduce(state, { type: "decide-package", packageId, decision: "approved" }, AT);
    expect(reduce(decided, { type: "decide-package", packageId, decision: "approved" }, AT)).toBe(decided);
  });

  it("is undoable as one step", () => {
    const { state, packageId } = threeStaged();
    const session = createSession(state);
    const bulk = applyAction(session, { type: "decide-package", packageId, decision: "approved" }, AT);

    expect(canUndo(bulk)).toBe(true);
    expect(undo(bulk, AT).present.edits.every((edit) => edit.status === "pending")).toBe(true);
  });

  it("leaves the source agreement untouched", () => {
    const { state, packageId } = threeStaged();
    const next = reduce(state, { type: "decide-package", packageId, decision: "approved" }, AT);
    expect(next.revision).toEqual(state.revision);
  });
});
