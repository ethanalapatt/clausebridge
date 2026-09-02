import { describe, expect, it } from "vitest";

import { ClauseBridgeStore } from "@/app/store";
import {
  GOLDEN_PATH_SETUP_LABEL,
  buildBaselinePackage,
  buildContextInput,
  buildPackage,
  goldenPathSetup,
  goldenPathSteps,
} from "@/core/demo";
import { renderNegotiationBrief, renderRedlinedMarkdown } from "@/core/exports";
import { compareCheckpoints, replaySteps } from "@/core/replay";
import { boardStatuses, clauseComparisons, packageViews } from "@/core/review";
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
 * This covers the thirteen-step walkthrough as one continuous flow rather than
 * as isolated unit assertions.
 */

function typeId(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((c) => c.clauseType === clauseType);
  if (clause === undefined) throw new Error(`missing ${clauseType}`);
  return clause.id;
}

describe("golden path", () => {
  it("runs the brief's thirteen-step walkthrough end to end", () => {
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
    const originalTermination = findClause(now(), termination)!.text;

    // 2, 3 + 4. Customer role, Liability locked, Must constraints for
    // termination notice and data deletion.
    store.dispatch({
      type: "apply-demo-setup",
      setup: goldenPathSetup(now()),
      label: GOLDEN_PATH_SETUP_LABEL,
    });
    expect(now().partyRole).toBe("customer");
    expect(now().nonNegotiableClauseIds).toEqual([liability]);
    expect(now().priorityAreas).toEqual(["termination", "data retention"]);
    expect(stepDone("role")).toBe(true);
    expect(stepDone("lock")).toBe(true);
    expect(stepDone("constraints")).toBe(true);

    // The board reports honestly on the agreement as it stands: the seeded
    // retention clause names no deletion deadline any rule can read.
    const opening = new Map(
      boardStatuses(now()).map((status) => [status.constraint.ruleId, status.result?.status]),
    );
    expect(opening.get("data_deletion_within_days")).toBe("unresolved");
    expect(opening.get("termination_notice_min_days")).toBe("satisfied");
    expect(opening.get("non_renewal_notice_max_days")).toBe("violated");

    // 5. get_negotiation_context returns exact text, priorities, decision state
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

    // The requested clauses are focused in the document, and the call is
    // recorded with its full provenance.
    expect(now().focusedClauseId).not.toBeNull();
    expect(now().focusPulse).toBeGreaterThan(0);
    const contextCall = now().toolCalls.at(-1)!;
    expect(contextCall.tool).toBe("get_negotiation_context");
    expect(contextCall.source).toBe("local-handler-test");
    expect(contextCall.outcome).toBe("ok");
    expect(contextCall.stateEffect).toContain("Read-only");

    // 6. Two contrasting packages are staged through the same handler, and the
    // approved document is untouched by staging.
    const protective = buildPackage(now(), "protective")!;
    const fastClose = buildPackage(now(), "fast-close")!;
    expect(protective.packageLabel).toBe("Customer-Protective");
    expect(fastClose.packageLabel).toBe("Fast Close");
    expect(protective.edits).toHaveLength(3);
    expect(fastClose.edits).toHaveLength(3);

    expect(store.stageRedlinePackage(protective, "local-handler-test").ok).toBe(true);
    expect(stepDone("stage")).toBe(false);
    expect(store.stageRedlinePackage(fastClose, "local-handler-test").ok).toBe(true);
    expect(stepDone("stage")).toBe(true);

    expect(now().packages).toHaveLength(2);
    expect(now().edits).toHaveLength(6);
    expect(now().edits.every((edit) => edit.status === "pending")).toBe(true);
    expect(findClause(now(), liability)!.text).toBe(originalLiability);
    expect(effectiveClauseText(now(), liability)).toBe(originalLiability);

    // Exact original-versus-proposed text is held per clause, per package.
    for (const edit of now().edits) {
      expect(edit.originalText).toBe(findClause(now(), edit.clauseId)!.text);
      expect(edit.proposedText.length).toBeGreaterThan(0);
      expect(edit.proposedText).not.toBe(edit.originalText);
      expect(edit.rationale.length).toBeGreaterThan(0);
    }

    // 7. Comparing the alternatives: same clauses, different constraint
    // outcomes, and every proposal traced to a bundled library entry.
    const rows = clauseComparisons(now());
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.proposals).toHaveLength(2);
      for (const proposal of row.proposals) {
        expect(proposal.fallback?.source).toBe("ClauseBridge fictional demo library");
        expect(proposal.fallback?.verbatim).toBe(true);
      }
    }

    const byLabel = new Map(packageViews(now()).map((view) => [view.packageLabel, view]));
    expect(byLabel.get("Customer-Protective")!.tally.mustViolated).toBe(0);
    expect(byLabel.get("Fast Close")!.tally.mustViolated).toBe(1);
    // Both alternatives touch the clause the human locked, and say so.
    expect(byLabel.get("Customer-Protective")!.counts.lockedClauses).toBe(1);

    store.dispatch({ type: "record-view", surface: "compare" });
    expect(stepDone("compare")).toBe(true);

    const editIn = (packageId: string, clauseId: string) =>
      now().edits.find((edit) => edit.packageId === packageId && edit.clauseId === clauseId)!;

    // 8. Accept one Termination proposal — the protective one — and confirm the
    // rival alternative stays staged rather than being decided for the human.
    store.dispatch({ type: "approve-edit", editId: editIn("pkg-0001", termination).editId });
    expect(stepDone("accept-termination")).toBe(true);
    expect(editIn("pkg-0002", termination).status).toBe("pending");
    expect(effectiveClauseText(now(), termination)).toBe(
      editIn("pkg-0001", termination).proposedText,
    );

    // 9. Edit and accept a Data retention proposal.
    const humanWording =
      "Northstar shall delete Customer Data from all systems within fifteen (15) days after termination.";
    store.dispatch({
      type: "edit-replacement",
      editId: editIn("pkg-0002", retention).editId,
      text: humanWording,
    });
    expect(stepDone("edit-retention")).toBe(true);

    // 10. Reject the Liability proposals and leave the clause locked.
    store.dispatch({ type: "reject-edit", editId: editIn("pkg-0001", liability).editId });
    store.dispatch({ type: "reject-edit", editId: editIn("pkg-0002", liability).editId });
    store.dispatch({
      type: "set-note",
      editId: editIn("pkg-0001", liability).editId,
      note: "Liability was marked non-negotiable before the agent ran.",
    });
    expect(stepDone("reject-liability")).toBe(true);

    // Decision states and the approved document agree.
    expect(clauseDecisionStatus(now(), termination)).toBe("approved");
    expect(clauseDecisionStatus(now(), retention)).toBe("edited");
    expect(clauseDecisionStatus(now(), liability)).toBe("rejected");

    // The rejected clause still reads as the untouched source text; the edited
    // one reads as the human's wording, not the agent's.
    expect(effectiveClauseText(now(), liability)).toBe(originalLiability);
    expect(effectiveClauseText(now(), retention)).toBe(humanWording);
    expect(findClause(now(), termination)!.text).toBe(originalTermination);

    // The agent's superseded proposal is retained, not overwritten.
    expect(editIn("pkg-0002", retention).proposedText).not.toBe(humanWording);
    expect(editIn("pkg-0001", liability).note).toContain("non-negotiable");

    // The human's own wording satisfies the Must the fast-close proposal missed.
    const finalBoard = new Map(
      boardStatuses(now()).map((status) => [status.constraint.ruleId, status.result?.status]),
    );
    expect(finalBoard.get("data_deletion_within_days")).toBe("satisfied");
    expect(finalBoard.get("manual_review_only")).toBe("unresolved");

    // 11. The preview revision the decisions produced.
    expect(now().checkpoints.length).toBeGreaterThan(0);
    store.dispatch({ type: "record-view", surface: "preview" });
    expect(stepDone("preview")).toBe(true);

    const comparison = compareCheckpoints(now(), null, now().checkpoints.at(-1)!.id)!;
    expect(comparison.changes.map((change) => change.clauseId).sort()).toEqual(
      [termination, retention].sort(),
    );

    // 12. Replaying the timeline reads recorded events; it runs no tool.
    const callsBeforeReplay = now().toolCalls.length;
    const steps = replaySteps(now());
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.some((step) => step.toolCall?.tool === "stage_redline_package")).toBe(true);
    expect(now().toolCalls).toHaveLength(callsBeforeReplay);
    store.dispatch({ type: "record-view", surface: "replay" });
    expect(stepDone("timeline")).toBe(true);

    // 13. The whole export bundle downloads and reflects only observed state.
    const briefName = store.downloadExport("brief");
    const redlineName = store.downloadExport("redline");
    const decisionName = store.downloadExport("decision-log");
    const activityName = store.downloadExport("tool-activity");

    expect(saved.map((file) => file.filename)).toEqual([
      briefName,
      redlineName,
      decisionName,
      activityName,
    ]);
    expect(briefName.endsWith("-negotiation-brief.md")).toBe(true);
    expect(redlineName.endsWith("-redlined.md")).toBe(true);
    expect(decisionName.endsWith("-decision-log.json")).toBe(true);
    expect(activityName.endsWith("-tool-activity.json")).toBe(true);
    expect(stepDone("export")).toBe(true);

    const brief = saved[0]!.contents;
    expect(brief).toContain("Customer-Protective");
    expect(brief).toContain("Fast Close");
    expect(brief).toContain("Proposed replacement (rejected — not applied)");
    expect(brief).toContain("Human-edited replacement (applied)");
    expect(brief).toContain(humanWording);

    const redline = saved[1]!.contents;
    expect(redline).toContain(humanWording);
    // A rejected redline leaves no diff marks on its clause.
    const liabilitySection = redline.split("## ").find((s) => s.includes(originalLiability))!;
    expect(liabilitySection).not.toContain("~~");

    const decisionLog = JSON.parse(saved[2]!.contents);
    expect(decisionLog.document.revisionId).toBe("NSA-r1");
    expect(decisionLog.packages).toHaveLength(2);
    expect(decisionLog.disclaimer).toContain("not legal advice");

    const toolLog = JSON.parse(saved[3]!.contents);
    expect(toolLog.calls).toHaveLength(3);
    expect(toolLog.calls.every((call: { source: string }) => call.source === "local-handler-test")).toBe(
      true,
    );

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
