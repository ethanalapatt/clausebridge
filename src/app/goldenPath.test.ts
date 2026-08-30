import { describe, expect, it } from "vitest";

import { ClauseBridgeStore } from "@/app/store";
import {
  CUSTOMER_BASELINE_LABEL,
  GOLDEN_PATH_SETUP_LABEL,
  buildBaselinePackage,
  buildContextInput,
  goldenPathSetup,
  goldenPathSteps,
} from "@/core/demo";
import { renderNegotiationBrief, renderRedlinedMarkdown } from "@/core/exports";
import {
  clauseDecisionStatus,
  createInitialState,
  effectiveClauseText,
  findClause,
} from "@/core/state";
import type { AppState } from "@/core/types";

/**
 * The full golden path from the brief, driven through the store — the same
 * object the UI dispatches into and the same one a native WebMCP agent calls.
 * This covers the ten-step walkthrough as one continuous flow rather than as
 * isolated unit assertions.
 */

function typeId(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((c) => c.clauseType === clauseType);
  if (clause === undefined) throw new Error(`missing ${clauseType}`);
  return clause.id;
}

describe("golden path", () => {
  it("runs the brief's ten steps end to end", () => {
    const saved: { filename: string; contents: string }[] = [];
    const store = new ClauseBridgeStore(undefined, (filename, contents) =>
      saved.push({ filename, contents }),
    );
    const now = () => store.getSnapshot().present;
    const stepDone = (id: string) =>
      goldenPathSteps(now()).find((step) => step.id === id)?.done ?? false;

    // 1. The seeded fictional agreement is open.
    expect(now().revision.documentTitle).toBe(
      "Northstar SaaS Services Agreement — Fictional Demo",
    );
    expect(now().revision.fictional).toBe(true);
    expect(now().revision.clauses.length).toBeGreaterThanOrEqual(8);
    expect(stepDone("load")).toBe(true);

    const liability = typeId(now(), "liability");
    const termination = typeId(now(), "termination");
    const retention = typeId(now(), "data_retention");
    const originalLiability = findClause(now(), liability)!.text;

    // 2 + 3. Customer role, Liability non-negotiable, Termination and Data
    // retention prioritised.
    store.dispatch({
      type: "apply-demo-setup",
      setup: goldenPathSetup(now()),
      label: GOLDEN_PATH_SETUP_LABEL,
    });
    expect(now().partyRole).toBe("customer");
    expect(now().nonNegotiableClauseIds).toEqual([liability]);
    expect(now().priorityAreas).toEqual(["termination", "data retention"]);
    expect(stepDone("setup")).toBe(true);

    // 4. get_negotiation_context returns exact text, priorities, decision state
    // and matching fictional fallbacks.
    const context = store.getNegotiationContext(
      buildContextInput(now()),
      "local-handler-test",
    );
    expect(context.ok).toBe(true);
    if (!context.ok) throw new Error("context failed");

    expect(context.clauses.map((c) => c.clauseId).sort()).toEqual(
      [liability, termination, retention].sort(),
    );
    expect(context.partyRole).toBe("customer");
    expect(context.priorityAreas).toEqual(["termination", "data retention"]);

    const liabilityContext = context.clauses.find((c) => c.clauseId === liability)!;
    // Exact source text, never a paraphrase.
    expect(liabilityContext.originalText).toBe(originalLiability);
    expect(liabilityContext.currentText).toBe(originalLiability);
    expect(liabilityContext.isNonNegotiable).toBe(true);
    expect(liabilityContext.isSelected).toBe(true);
    expect(liabilityContext.decisionStatus).toBe("none");
    expect(liabilityContext.hasApprovedChange).toBe(false);

    // Fallbacks are local, fictional, and filtered to the reviewer's posture.
    expect(context.fallbackOptions.length).toBeGreaterThan(0);
    for (const fallback of context.fallbackOptions) {
      expect(["customer", "neutral"]).toContain(fallback.role);
      expect(fallback.appliesToClauseIds.length).toBeGreaterThan(0);
    }
    expect(
      context.fallbackOptions.some((f) => f.appliesToClauseIds.includes(liability)),
    ).toBe(true);
    expect(stepDone("context")).toBe(true);

    // 5. The requested clauses are focused in the document.
    expect(now().focusedClauseId).not.toBeNull();
    expect(now().focusPulse).toBeGreaterThan(0);

    // 6. A three-clause Customer Baseline is staged, and the approved document
    // is untouched by staging.
    const pkg = buildBaselinePackage(now())!;
    expect(pkg.packageLabel).toBe(CUSTOMER_BASELINE_LABEL);
    expect(pkg.edits).toHaveLength(3);

    const staged = store.stageRedlinePackage(pkg, "local-handler-test");
    expect(staged.ok).toBe(true);
    expect(now().edits).toHaveLength(3);
    expect(now().edits.every((edit) => edit.status === "pending")).toBe(true);
    expect(findClause(now(), liability)!.text).toBe(originalLiability);
    expect(effectiveClauseText(now(), liability)).toBe(originalLiability);
    expect(stepDone("stage")).toBe(true);

    // 7. Exact original-versus-proposed text is held per clause.
    for (const edit of now().edits) {
      expect(edit.originalText).toBe(findClause(now(), edit.clauseId)!.text);
      expect(edit.proposedText.length).toBeGreaterThan(0);
      expect(edit.proposedText).not.toBe(edit.originalText);
      expect(edit.rationale.length).toBeGreaterThan(0);
    }

    const editFor = (clauseId: string) =>
      now().edits.find((edit) => edit.clauseId === clauseId)!;

    // 8. Accept Termination, edit and accept Data retention, reject Liability,
    // and add a note.
    store.dispatch({ type: "approve-edit", editId: editFor(termination).editId });

    const humanWording = "Either party may terminate this fictional order form on 45 days notice.";
    store.dispatch({
      type: "edit-replacement",
      editId: editFor(retention).editId,
      text: humanWording,
    });

    store.dispatch({ type: "reject-edit", editId: editFor(liability).editId });
    store.dispatch({
      type: "set-note",
      editId: editFor(liability).editId,
      note: "Liability was marked non-negotiable before the agent ran.",
    });

    // 9. Decision states and the approved document agree.
    expect(clauseDecisionStatus(now(), termination)).toBe("approved");
    expect(clauseDecisionStatus(now(), retention)).toBe("edited");
    expect(clauseDecisionStatus(now(), liability)).toBe("rejected");
    expect(stepDone("decide")).toBe(true);

    // The rejected clause still reads as the untouched source text; the edited
    // one reads as the human's wording, not the agent's.
    expect(effectiveClauseText(now(), liability)).toBe(originalLiability);
    expect(effectiveClauseText(now(), retention)).toBe(humanWording);
    expect(effectiveClauseText(now(), termination)).toBe(editFor(termination).proposedText);

    // The agent's superseded proposal is retained, not overwritten.
    expect(editFor(retention).proposedText).not.toBe(humanWording);
    expect(editFor(liability).note).toContain("non-negotiable");

    // 10. Both exports download and reflect only the observed state.
    const briefName = store.downloadExport("brief");
    const redlineName = store.downloadExport("redline");
    expect(saved.map((file) => file.filename)).toEqual([briefName, redlineName]);
    expect(briefName.endsWith("-negotiation-brief.md")).toBe(true);
    expect(redlineName.endsWith("-redlined.md")).toBe(true);
    expect(stepDone("export")).toBe(true);

    const brief = saved[0]!.contents;
    expect(brief).toContain(CUSTOMER_BASELINE_LABEL);
    expect(brief).toContain("Proposed replacement (rejected — not applied)");
    expect(brief).toContain("Human-edited replacement (applied)");
    expect(brief).toContain(humanWording);

    const redline = saved[1]!.contents;
    expect(redline).toContain(humanWording);
    // A rejected redline leaves no diff marks on its clause.
    const liabilitySection = redline.split("## ").find((s) => s.includes(originalLiability))!;
    expect(liabilitySection).not.toContain("~~");

    // Every step of the checklist is now genuinely satisfied.
    expect(goldenPathSteps(now()).every((step) => step.done)).toBe(true);

    // Undo steps back the last decision without rewriting history.
    const beforeUndo = now().activity.length;
    store.undo();
    expect(now().activity.length).toBe(beforeUndo + 1);
    expect(now().activity.at(-1)!.summary).toMatch(/^Undid: /);

    // Reset returns the app to the exact initial state.
    store.resetDemo();
    expect(store.getSnapshot().past).toEqual([]);
    expect(store.getSnapshot().present).toEqual(createInitialState());
  });

  it("keeps the source agreement byte-identical through the whole flow", () => {
    const before = createInitialState().revision;
    const store = new ClauseBridgeStore(undefined, () => {});

    store.dispatch({
      type: "apply-demo-setup",
      setup: goldenPathSetup(store.getSnapshot().present),
      label: GOLDEN_PATH_SETUP_LABEL,
    });
    store.getNegotiationContext(
      buildContextInput(store.getSnapshot().present),
      "local-handler-test",
    );
    store.stageRedlinePackage(
      buildBaselinePackage(store.getSnapshot().present)!,
      "local-handler-test",
    );
    for (const edit of store.getSnapshot().present.edits) {
      store.dispatch({ type: "approve-edit", editId: edit.editId });
    }

    expect(store.getSnapshot().present.revision).toEqual(before);
  });

  it("produces byte-identical exports for the same decisions", () => {
    function run(): { brief: string; redline: string } {
      const store = new ClauseBridgeStore(undefined, () => {});
      store.dispatch({
        type: "apply-demo-setup",
        setup: goldenPathSetup(store.getSnapshot().present),
        label: GOLDEN_PATH_SETUP_LABEL,
      });
      store.stageRedlinePackage(
        buildBaselinePackage(store.getSnapshot().present)!,
        "local-handler-test",
      );
      const first = store.getSnapshot().present.edits[0]!;
      store.dispatch({ type: "approve-edit", editId: first.editId });
      const state = store.getSnapshot().present;
      return {
        brief: renderNegotiationBrief(state),
        redline: renderRedlinedMarkdown(state),
      };
    }

    const a = run();
    const b = run();
    expect(a.brief).toBe(b.brief);
    expect(a.redline).toBe(b.redline);
    // No wall-clock time leaked into either document.
    expect(a.brief).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(a.redline).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });
});
