import { describe, expect, it } from "vitest";

import { applyMigration, planMigration } from "@/core/migration";
import { stageRedlinePackage } from "@/core/handlers";
import { toDraft } from "@/core/segmentation";
import { createInitialState, findClause, isEditStale, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX = { source: "local-handler-test", at: AT } as const;

function typeId(state: AppState, clauseType: string): string {
  return state.revision.clauses.find((c) => c.clauseType === clauseType)!.id;
}

/** Stages one redline, then revises the document so every ID is retired. */
function stagedThenRevised(): { state: AppState; editId: string; oldClauseId: string } {
  const base = createInitialState();
  const liability = typeId(base, "liability");

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
    CTX,
  );
  const editId = staged.state.edits[0]!.editId;

  // Re-segment into a new revision with the same clause bodies.
  const drafts = staged.state.revision.clauses.map(toDraft);
  const state = reduce(staged.state, { type: "revise-document", drafts, label: "Corrected" }, AT);

  return { state, editId, oldClauseId: liability };
}

describe("planMigration", () => {
  it("matches a stale redline to the clause whose text is unchanged", () => {
    const { state, editId, oldClauseId } = stagedThenRevised();
    expect(isEditStale(state, state.edits[0]!)).toBe(true);

    const plan = planMigration(state);
    expect(plan.unmatchedEditIds).toEqual([]);
    expect(plan.candidates).toHaveLength(1);

    const candidate = plan.candidates[0]!;
    expect(candidate.editId).toBe(editId);
    expect(candidate.fromClauseId).toBe(oldClauseId);
    expect(candidate.confidence).toBe("exact-text");
    expect(candidate.textChanged).toBe(false);
    expect(findClause(state, candidate.toClauseId)!.clauseType).toBe("liability");
  });

  it("proposes nothing when no edit is stale", () => {
    const base = createInitialState();
    const staged = stageRedlinePackage(
      base,
      {
        packageLabel: "Baseline",
        edits: [
          {
            clauseId: typeId(base, "termination"),
            replacementText: "Fictional replacement wording.",
            rationale: "demo",
            priorityTag: "preferred",
          },
        ],
      },
      CTX,
    );

    expect(planMigration(staged.state)).toEqual({ candidates: [], unmatchedEditIds: [] });
  });

  it("leaves an edit stale when its clause text no longer appears anywhere", () => {
    const { state, editId } = stagedThenRevised();

    // Drop the clause the redline targeted from the next revision entirely.
    const drafts = state.revision.clauses
      .filter((clause) => clause.clauseType !== "liability")
      .map(toDraft);
    const pruned = reduce(state, { type: "revise-document", drafts, label: "Pruned" }, AT);

    const plan = planMigration(pruned);
    expect(plan.candidates).toEqual([]);
    expect(plan.unmatchedEditIds).toEqual([editId]);
  });

  it("never proposes the same target clause for two stale redlines", () => {
    const base = createInitialState();
    const liability = typeId(base, "liability");
    const termination = typeId(base, "termination");

    const staged = stageRedlinePackage(
      base,
      {
        packageLabel: "Baseline",
        edits: [
          {
            clauseId: liability,
            replacementText: "Fictional liability wording.",
            rationale: "a",
            priorityTag: "required",
          },
          {
            clauseId: termination,
            replacementText: "Fictional termination wording.",
            rationale: "b",
            priorityTag: "preferred",
          },
        ],
      },
      CTX,
    );
    const drafts = staged.state.revision.clauses.map(toDraft);
    const revised = reduce(staged.state, { type: "revise-document", drafts, label: "r" }, AT);

    const plan = planMigration(revised);
    const targets = plan.candidates.map((c) => c.toClauseId);
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe("applyMigration", () => {
  it("re-points the edit and returns it to awaiting decision", () => {
    const { state } = stagedThenRevised();

    // Approving under the old revision must not carry across.
    const approved = reduce(state, { type: "approve-edit", editId: state.edits[0]!.editId }, AT);
    const plan = planMigration(approved);
    const result = applyMigration(approved, plan.candidates);

    const migrated = result.state.edits[0]!;
    expect(result.migratedEditIds).toEqual([migrated.editId]);
    expect(migrated.clauseId).toBe(plan.candidates[0]!.toClauseId);
    expect(isEditStale(result.state, migrated)).toBe(false);
    expect(migrated.status).toBe("pending");
    expect(migrated.humanText).toBeNull();
  });

  it("refreshes the captured original to the target's current text", () => {
    const { state } = stagedThenRevised();
    const plan = planMigration(state);
    const result = applyMigration(state, plan.candidates);

    const target = findClause(result.state, plan.candidates[0]!.toClauseId)!;
    expect(result.state.edits[0]!.originalText).toBe(target.text);
  });

  it("preserves the proposal, rationale, priority and note", () => {
    const { state } = stagedThenRevised();
    const withNote = reduce(
      state,
      { type: "set-note", editId: state.edits[0]!.editId, note: "keep me" },
      AT,
    );
    const before = withNote.edits[0]!;

    const result = applyMigration(withNote, planMigration(withNote).candidates);
    const after = result.state.edits[0]!;

    expect(after.proposedText).toBe(before.proposedText);
    expect(after.rationale).toBe(before.rationale);
    expect(after.priorityTag).toBe(before.priorityTag);
    expect(after.note).toBe("keep me");
    expect(after.editId).toBe(before.editId);
    expect(after.packageId).toBe(before.packageId);
  });

  it("is a no-op for an empty candidate list", () => {
    const { state } = stagedThenRevised();
    const result = applyMigration(state, []);

    expect(result.state).toBe(state);
    expect(result.migratedEditIds).toEqual([]);
  });

  it("ignores a candidate whose target is not in the active revision", () => {
    const { state, editId } = stagedThenRevised();
    const result = applyMigration(state, [
      {
        editId,
        fromClauseId: "gone",
        toClauseId: "NSA-r9-99",
        toClauseTitle: "Nowhere",
        confidence: "exact-text",
        textChanged: false,
      },
    ]);

    expect(result.migratedEditIds).toEqual([]);
    expect(result.state).toBe(state);
  });

  it("leaves the source agreement untouched", () => {
    const { state } = stagedThenRevised();
    const result = applyMigration(state, planMigration(state).candidates);

    expect(result.state.revision).toEqual(state.revision);
  });
});
