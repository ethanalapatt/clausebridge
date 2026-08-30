import { describe, expect, it } from "vitest";

import { compareRevisions } from "@/core/revisionDiff";
import { stageRedlinePackage } from "@/core/handlers";
import { toDraft } from "@/core/segmentation";
import { createInitialState, effectiveClauseText, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX = { source: "local-handler-test", at: AT } as const;

function compare(state: AppState, baseline = createInitialState().revision) {
  return compareRevisions(state, baseline, (id) => effectiveClauseText(state, id));
}

function stageOn(state: AppState, clauseType: string, text: string) {
  const clauseId = state.revision.clauses.find((c) => c.clauseType === clauseType)!.id;
  return stageRedlinePackage(
    state,
    {
      packageLabel: "Baseline",
      edits: [{ clauseId, replacementText: text, rationale: "demo", priorityTag: "required" }],
    },
    CTX,
  ).state;
}

describe("compareRevisions", () => {
  it("reports no changes for an untouched agreement", () => {
    const result = compare(createInitialState());

    expect(result.amendedCount).toBe(0);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.clauses.every((c) => c.kind === "unchanged")).toBe(true);
  });

  it("ignores a staged proposal until it is approved", () => {
    const staged = stageOn(createInitialState(), "liability", "Fictional replacement wording.");
    expect(compare(staged).amendedCount).toBe(0);

    const approved = reduce(staged, { type: "approve-edit", editId: staged.edits[0]!.editId }, AT);
    expect(compare(approved).amendedCount).toBe(1);
  });

  it("ignores a rejected proposal", () => {
    const staged = stageOn(createInitialState(), "liability", "Fictional replacement wording.");
    const rejected = reduce(staged, { type: "reject-edit", editId: staged.edits[0]!.editId }, AT);

    expect(compare(rejected).amendedCount).toBe(0);
  });

  it("counts the human's wording, not the agent's, for an edited redline", () => {
    const staged = stageOn(createInitialState(), "liability", "Agent wording.");
    const edited = reduce(
      staged,
      { type: "edit-replacement", editId: staged.edits[0]!.editId, text: "My own wording here." },
      AT,
    );

    const amended = compare(edited).clauses.find((c) => c.kind === "amended")!;
    expect(amended.currentText).toBe("My own wording here.");
  });

  it("reports word-level totals across every amended clause", () => {
    let state = stageOn(createInitialState(), "liability", "Short replacement.");
    state = reduce(state, { type: "approve-edit", editId: state.edits[0]!.editId }, AT);

    const result = compare(state);
    expect(result.amendedCount).toBe(1);
    expect(result.totalWordsAdded).toBeGreaterThan(0);
    expect(result.totalWordsRemoved).toBeGreaterThan(0);

    const amended = result.clauses.find((c) => c.kind === "amended")!;
    expect(amended.stats!.wordsAdded).toBe(result.totalWordsAdded);
  });

  it("detects an added and a removed clause", () => {
    const base = createInitialState();
    const kept = base.revision.clauses.filter((c) => c.clauseType !== "payment");
    const pruned = reduce(
      base,
      { type: "revise-document", drafts: kept.map(toDraft), label: "Pruned" },
      AT,
    );

    const result = compare(pruned, base.revision);
    expect(result.removedCount).toBe(1);
    expect(result.clauses.find((c) => c.kind === "removed")!.baselineText.length).toBeGreaterThan(0);
    expect(result.addedCount).toBe(0);
  });

  it("matches on title when a revision has retired every clause ID", () => {
    const base = createInitialState();
    const revised = reduce(
      base,
      { type: "revise-document", drafts: base.revision.clauses.map(toDraft), label: "Re-cut" },
      AT,
    );

    // IDs all changed, but the document is the same — nothing should read as
    // simultaneously added and removed.
    const result = compare(revised, base.revision);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.clauses.every((c) => c.kind === "unchanged")).toBe(true);
  });

  it("names both revisions it compared", () => {
    const result = compare(createInitialState());
    expect(result.baselineRevisionId).toBe("NSA-r1");
    expect(result.currentRevisionId).toBe("NSA-r1");
  });
});
