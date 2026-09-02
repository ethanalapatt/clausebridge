import { describe, expect, it } from "vitest";

import {
  buildBaselinePackage,
  buildPackage,
  buildContextInput,
  clauseIdsOfTypes,
  goldenPathSetup,
  goldenPathSteps,
} from "@/core/demo";
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

describe("goldenPathSetup", () => {
  it("describes the brief's starting posture against the seeded revision", () => {
    const state = createInitialState();
    const setup = goldenPathSetup(state);

    expect(setup.partyRole).toBe("customer");
    expect(setup.priorityAreas).toEqual(["termination", "data retention"]);
    expect(setup.selectedClauseIds).toEqual(
      clauseIdsOfTypes(state, ["liability", "termination", "data_retention"]),
    );
    expect(setup.nonNegotiableClauseIds).toEqual(clauseIdsOfTypes(state, ["liability"]));
  });

  it("yields only clauses the active document actually has", () => {
    const state = createInitialState(
      segmentPastedText("1. Notices\n\nFictional notices go to the addresses on the order form."),
    );
    const setup = goldenPathSetup(state);

    expect(setup.selectedClauseIds).toEqual([]);
    expect(setup.nonNegotiableClauseIds).toEqual([]);
  });
});

describe("goldenPathSteps", () => {
  it("starts with only the steps that are genuinely already true", () => {
    const steps = goldenPathSteps(createInitialState());
    const done = Object.fromEntries(steps.map((step) => [step.id, step.done]));

    expect(steps).toHaveLength(13);
    // The seeded agreement is loaded and the default role is already Customer.
    expect(done.load).toBe(true);
    expect(done.role).toBe(true);
    expect(steps.filter((step) => step.done)).toHaveLength(2);
  });

  it("gives every step a distinct id, label and one-sentence hint", () => {
    const steps = goldenPathSteps(createInitialState());
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
    for (const step of steps) {
      expect(step.label.length).toBeGreaterThan(0);
      expect(step.hint.length).toBeGreaterThan(0);
    }
  });

  it("ticks each step only once the real operation has happened", () => {
    let state = createInitialState();
    const setup = goldenPathSetup(state);
    const done = () => Object.fromEntries(goldenPathSteps(state).map((s) => [s.id, s.done]));

    expect(done().load).toBe(true);
    expect(done().role).toBe(true);
    expect(done().lock).toBe(false);

    state = reduce(state, { type: "apply-demo-setup", setup, label: "setup" }, AT);
    expect(done().lock).toBe(true);
    expect(done().constraints).toBe(true);
    expect(done().context).toBe(false);

    state = getNegotiationContext(state, buildContextInput(state), CTX).state;
    expect(done().context).toBe(true);
    expect(done().stage).toBe(false);

    // One package is not two contrasting alternatives.
    state = stageRedlinePackage(state, buildPackage(state, "protective")!, CTX).state;
    expect(done().stage).toBe(false);
    state = stageRedlinePackage(state, buildPackage(state, "fast-close")!, CTX).state;
    expect(done().stage).toBe(true);

    expect(done().compare).toBe(false);
    state = reduce(state, { type: "record-view", surface: "compare" }, AT);
    expect(done().compare).toBe(true);

    const on = (clauseType: string) => {
      const clauseId = state.revision.clauses.find((c) => c.clauseType === clauseType)!.id;
      return state.edits.filter((edit) => edit.clauseId === clauseId);
    };

    expect(done()["accept-termination"]).toBe(false);
    state = reduce(state, { type: "approve-edit", editId: on("termination")[0]!.editId }, AT);
    expect(done()["accept-termination"]).toBe(true);

    expect(done()["edit-retention"]).toBe(false);
    state = reduce(
      state,
      {
        type: "edit-replacement",
        editId: on("data_retention")[0]!.editId,
        text: "Northstar shall delete Customer Data within fifteen (15) days after termination.",
      },
      AT,
    );
    expect(done()["edit-retention"]).toBe(true);

    expect(done()["reject-liability"]).toBe(false);
    state = reduce(state, { type: "reject-edit", editId: on("liability")[0]!.editId }, AT);
    expect(done()["reject-liability"]).toBe(true);

    // A preview revision exists, but the step waits until the human opens it.
    expect(state.checkpoints.length).toBeGreaterThan(0);
    expect(done().preview).toBe(false);
    state = reduce(state, { type: "record-view", surface: "preview" }, AT);
    expect(done().preview).toBe(true);

    expect(done().timeline).toBe(false);
    state = reduce(state, { type: "record-view", surface: "replay" }, AT);
    expect(done().timeline).toBe(true);

    // Both Markdown exports are required, not just one.
    state = reduce(state, { type: "record-export", kind: "brief", filename: "b.md" }, AT);
    expect(done().export).toBe(false);
    state = reduce(state, { type: "record-export", kind: "redline", filename: "r.md" }, AT);
    expect(done().export).toBe(true);
  });

  it("does not tick the lock or constraint steps from a partial configuration", () => {
    let state = createInitialState();
    state = reduce(state, { type: "set-role", role: "customer" }, AT);
    state = reduce(state, { type: "set-priority-areas", areas: ["termination"] }, AT);

    const done = Object.fromEntries(goldenPathSteps(state).map((s) => [s.id, s.done]));
    expect(done.role).toBe(true);
    expect(done.lock).toBe(false);
    expect(done.constraints).toBe(false);
  });

  it("does not tick the constraint step for a Prefer of the same rule", () => {
    let state = createInitialState();
    state = reduce(
      state,
      { type: "add-constraint", ruleId: "termination_notice_min_days", severity: "prefer", value: 30 },
      AT,
    );
    state = reduce(
      state,
      { type: "add-constraint", ruleId: "data_deletion_within_days", severity: "must", value: 30 },
      AT,
    );
    expect(goldenPathSteps(state).find((step) => step.id === "constraints")?.done).toBe(false);
  });

  it("does not tick retrieval when the tool call was rejected", () => {
    const state = createInitialState();
    const outcome = getNegotiationContext(
      state,
      { clauseIds: ["NSA-r1-999"], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(outcome.result.ok).toBe(false);
    expect(goldenPathSteps(outcome.state).find((step) => step.id === "context")?.done).toBe(false);
  });
});
