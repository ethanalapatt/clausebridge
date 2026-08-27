import { describe, expect, it } from "vitest";

import { buildBaselinePackage, buildContextInput, clauseIdsOfTypes } from "@/core/demo";
import { getNegotiationContext, stageRedlinePackage } from "@/core/handlers";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { segmentPastedText } from "@/core/segmentation";
import { createInitialState, effectiveClauseText, reduce } from "@/core/state";

const AT = "2026-01-01T00:00:00.000Z";
const CTX = { source: "local-handler-test", at: AT } as const;

describe("buildContextInput", () => {
  it("falls back to the golden-path clauses and priorities when nothing is selected", () => {
    const state = createInitialState();
    const input = buildContextInput(state);

    expect(input.clauseIds).toEqual(clauseIdsOfTypes(state, ["liability", "termination", "data_retention"]));
    expect(input.priorityAreas).toEqual(["termination", "data retention"]);
    expect(input.partyRole).toBe("customer");
  });

  it("uses the human's own selection and priorities once set", () => {
    let state = createInitialState();
    const first = state.revision.clauses[3]!.id;
    state = reduce(state, { type: "toggle-selected", clauseId: first }, AT);
    state = reduce(state, { type: "set-priority-areas", areas: ["security"] }, AT);
    state = reduce(state, { type: "set-role", role: "vendor" }, AT);

    expect(buildContextInput(state)).toEqual({
      clauseIds: [first],
      partyRole: "vendor",
      priorityAreas: ["security"],
    });
  });
});

describe("buildBaselinePackage", () => {
  it("builds a three-clause Customer Baseline entirely from the fictional library", () => {
    const state = createInitialState();
    const pkg = buildBaselinePackage(state);

    expect(pkg).not.toBeNull();
    expect(pkg!.packageLabel).toBe("Customer Baseline");
    expect(pkg!.edits).toHaveLength(3);

    for (const edit of pkg!.edits) {
      // Every replacement is verbatim library text; nothing is generated.
      const entry = FALLBACK_LIBRARY.find((item) => item.text === edit.replacementText);
      expect(entry).toBeDefined();
      expect(edit.rationale).toContain("ClauseBridge fictional demo library");
    }
  });

  it("tags liability and data retention as required and termination as preferred", () => {
    const state = createInitialState();
    const pkg = buildBaselinePackage(state)!;
    const byClause = new Map(
      pkg.edits.map((edit) => [
        state.revision.clauses.find((c) => c.id === edit.clauseId)?.clauseType,
        edit.priorityTag,
      ]),
    );

    expect(byClause.get("liability")).toBe("required");
    expect(byClause.get("data_retention")).toBe("required");
    expect(byClause.get("termination")).toBe("preferred");
  });

  it("never offers the other side's wording", () => {
    const state = reduce(createInitialState(), { type: "set-role", role: "vendor" }, AT);
    const pkg = buildBaselinePackage(state)!;

    expect(pkg.packageLabel).toBe("Vendor Baseline");
    for (const edit of pkg.edits) {
      const entry = FALLBACK_LIBRARY.find((item) => item.text === edit.replacementText);
      expect(["vendor", "neutral"]).toContain(entry?.role);
    }
  });

  it("returns null rather than inventing wording for a document without the demo clauses", () => {
    const revision = segmentPastedText("# Exhibit A\nSome fictional schedule text.\n\n# Exhibit B\nMore.");
    expect(buildBaselinePackage(createInitialState(revision))).toBeNull();
  });

  it("produces a package the real handler accepts, and the golden path completes", () => {
    const state = createInitialState();

    const context = getNegotiationContext(state, buildContextInput(state), CTX);
    expect(context.result.ok).toBe(true);

    const staged = stageRedlinePackage(context.state, buildBaselinePackage(state)!, CTX);
    expect(staged.result.ok).toBe(true);
    if (!staged.result.ok) return;
    expect(staged.result.staged).toHaveLength(3);

    // Approve one, edit one, reject one — the brief's independent-control demo.
    let next = reduce(staged.state, { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
    next = reduce(next, { type: "edit-replacement", editId: "pkg-0001-e02", text: "Human." }, AT);
    next = reduce(next, { type: "reject-edit", editId: "pkg-0001-e03" }, AT);

    expect(next.edits.map((e) => e.status)).toEqual(["approved", "edited", "rejected"]);

    const rejected = next.edits[2]!;
    expect(effectiveClauseText(next, rejected.clauseId)).toBe(rejected.originalText);
  });

  it("is deterministic", () => {
    const state = createInitialState();
    expect(buildBaselinePackage(state)).toEqual(buildBaselinePackage(state));
  });
});
