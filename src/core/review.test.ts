import { beforeEach, describe, expect, it } from "vitest";

import { stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import { PACKAGE_PRESETS, availablePresets, buildPackage } from "@/core/demo";
import {
  boardStatuses,
  boardTally,
  clauseComparisons,
  fallbackProvenance,
  lockedClausesWithProposals,
  packageViews,
  proposalView,
  proposalViews,
} from "@/core/review";
import { createInitialState, findEdit, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

function withGoldenBoard(state: AppState): AppState {
  let next = state;
  next = reduce(
    next,
    { type: "add-constraint", ruleId: "data_deletion_within_days", severity: "must", value: 30 },
    AT,
  );
  next = reduce(
    next,
    { type: "add-constraint", ruleId: "termination_notice_min_days", severity: "must", value: 30 },
    AT,
  );
  next = reduce(
    next,
    {
      type: "add-constraint",
      ruleId: "non_renewal_notice_max_days",
      severity: "prefer",
      value: 30,
    },
    AT,
  );
  next = reduce(
    next,
    { type: "add-constraint", ruleId: "no_automatic_renewal", severity: "avoid", value: null },
    AT,
  );
  return next;
}

function stageAll(state: AppState): AppState {
  let next = state;
  for (const preset of PACKAGE_PRESETS) {
    const input = buildPackage(next, preset.posture);
    if (input === null) continue;
    next = stageRedlinePackage(next, input, CTX).state;
  }
  return next;
}

describe("alternative packages", () => {
  it("builds three contrasting packages for a customer reviewer", () => {
    const state = createInitialState();
    expect(availablePresets(state).map((preset) => preset.label)).toEqual([
      "Customer-Protective",
      "Balanced Compromise",
      "Fast Close",
    ]);
  });

  it("gives each package the same three clauses but different wording", () => {
    const state = createInitialState();
    const built = PACKAGE_PRESETS.map((preset) => buildPackage(state, preset.posture));

    for (const input of built) {
      expect(input?.edits).toHaveLength(3);
    }

    const texts = built.flatMap((input) =>
      (input?.edits ?? []).map((edit) => `${edit.clauseId}::${edit.replacementText}`),
    );
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("never hands a reviewer the other side's wording", () => {
    const state = createInitialState();
    const neutral = buildPackage(state, "balanced", "neutral");
    // A neutral reviewer sees only neutral entries, so the fast-close package —
    // which is authored customer-side — is not available to them at all.
    expect(neutral?.edits.length).toBeGreaterThan(0);
    expect(buildPackage(state, "fast-close", "neutral")).toBeNull();
  });

  it("is deterministic", () => {
    const state = createInitialState();
    expect(buildPackage(state, "protective")).toEqual(buildPackage(state, "protective"));
  });

  it("all three coexist without colliding", () => {
    const state = stageAll(createInitialState());
    expect(state.packages.map((pkg) => pkg.packageLabel)).toEqual([
      "Customer-Protective",
      "Balanced Compromise",
      "Fast Close",
    ]);
    expect(state.packages.map((pkg) => pkg.packageId)).toEqual([
      "pkg-0001",
      "pkg-0002",
      "pkg-0003",
    ]);
    expect(state.edits).toHaveLength(9);
    expect(new Set(state.edits.map((edit) => edit.editId)).size).toBe(9);
  });

  it("leaves the source agreement byte-identical after staging all three", () => {
    const base = createInitialState();
    const staged = stageAll(base);
    expect(staged.revision.clauses).toEqual(base.revision.clauses);
  });
});

describe("fallback provenance", () => {
  it("identifies the library entry a proposal's wording came from", () => {
    const state = stageAll(createInitialState());
    const liability = state.revision.clauses.find((c) => c.clauseType === "liability")!.id;
    const edit = state.edits.find(
      (item) => item.packageId === "pkg-0001" && item.clauseId === liability,
    );
    const provenance = fallbackProvenance(edit!);

    expect(provenance?.fallbackId).toBe("fb-liability-customer-1");
    expect(provenance?.source).toBe("ClauseBridge fictional demo library");
    expect(provenance?.verbatim).toBe(true);
  });

  it("reports a human-edited proposal as no longer verbatim, keeping the attribution", () => {
    let state = stageAll(createInitialState());
    state = reduce(
      state,
      { type: "edit-replacement", editId: "pkg-0001-e01", text: "My own wording." },
      AT,
    );
    const provenance = fallbackProvenance(findEdit(state, "pkg-0001-e01")!);

    expect(provenance?.fallbackId).toBe("fb-liability-customer-1");
    expect(provenance?.verbatim).toBe(false);
  });

  it("returns null for wording that is not in the library", () => {
    const state = stageRedlinePackage(
      createInitialState(),
      {
        packageLabel: "Hand-written",
        edits: [
          {
            clauseId: "NSA-r1-09",
            replacementText: "Something nobody bundled.",
            rationale: "Typed by hand.",
            priorityTag: "optional",
          },
        ],
      },
      CTX,
    ).state;

    expect(fallbackProvenance(state.edits[0]!)).toBeNull();
  });
});

describe("proposal views", () => {
  let state: AppState;

  beforeEach(() => {
    state = stageAll(withGoldenBoard(createInitialState()));
  });

  it("carries everything the comparison surface needs", () => {
    const view = proposalView(state, findEdit(state, "pkg-0001-e01")!);

    expect(view?.packageLabel).toBe("Customer-Protective");
    expect(view?.clauseTitle).toBe("Limitation of Liability");
    expect(view?.status).toBe("pending");
    expect(view?.priorityTag).toBe("required");
    expect(view?.fallback?.fallbackId).toBe("fb-liability-customer-1");
    expect(view?.diff.changed).toBe(true);
    expect(view?.governing).toBe(false);
    // The source wording is exposed alongside the proposal, never replaced by it.
    expect(view?.originalText).toContain("IN NO EVENT SHALL NORTHSTAR");
  });

  it("flags a proposal that touches a clause the human locked", () => {
    const liability = state.revision.clauses.find((c) => c.clauseType === "liability")!.id;
    const locked = reduce(state, { type: "toggle-non-negotiable", clauseId: liability }, AT);

    const view = proposalView(locked, findEdit(locked, "pkg-0001-e01")!);
    expect(view?.conflictsWithNonNegotiable).toBe(true);
    expect(lockedClausesWithProposals(locked)).toEqual([liability]);
  });

  it("marks the governing proposal once one is approved", () => {
    const approved = reduce(state, { type: "approve-edit", editId: "pkg-0002-e01" }, AT);
    const views = proposalViews(approved).filter((view) => view.clauseType === "liability");

    expect(views.filter((view) => view.governing)).toHaveLength(1);
    expect(views.find((view) => view.governing)?.packageLabel).toBe("Balanced Compromise");
  });

  it("evaluates constraints against the wording the proposal would contribute", () => {
    const retention = proposalViews(state).filter((view) => view.clauseType === "data_retention");

    const byPackage = new Map(retention.map((view) => [view.packageLabel, view]));
    // The protective and balanced alternatives both name a 30-day deletion
    // deadline; the fast-close one names 60 days and is reported as unmet.
    expect(byPackage.get("Customer-Protective")?.tally.mustSatisfied).toBe(1);
    expect(byPackage.get("Balanced Compromise")?.tally.mustSatisfied).toBe(1);
    expect(byPackage.get("Fast Close")?.tally.mustViolated).toBe(1);
  });

  it("recomputes constraint results after a human edit", () => {
    const before = proposalView(state, findEdit(state, "pkg-0003-e03")!);
    expect(before?.tally.mustViolated).toBe(1);

    const edited = reduce(
      state,
      {
        type: "edit-replacement",
        editId: "pkg-0003-e03",
        text: "Northstar shall delete Customer Data within fifteen (15) days after termination.",
      },
      AT,
    );
    const after = proposalView(edited, findEdit(edited, "pkg-0003-e03")!);

    expect(after?.tally.mustViolated).toBe(0);
    expect(after?.tally.mustSatisfied).toBe(1);
  });

  it("recomputes constraint results when the objective board changes", () => {
    const stricter = reduce(
      state,
      { type: "update-constraint", constraintId: "con-0001", value: 10 },
      AT,
    );
    const view = proposalViews(stricter).find(
      (item) => item.packageLabel === "Customer-Protective" && item.clauseType === "data_retention",
    );
    expect(view?.tally.mustViolated).toBe(1);
  });
});

describe("package views", () => {
  it("summarizes each package with factual counts, never a score", () => {
    const state = stageAll(withGoldenBoard(createInitialState()));
    const views = packageViews(state);

    expect(views).toHaveLength(3);
    for (const view of views) {
      expect(view.counts.proposed).toBe(3);
      expect(view.counts.pending).toBe(3);
      expect(view.counts.approved).toBe(0);
      expect(Object.keys(view.tally)).not.toContain("score");
    }
  });

  it("separates the alternatives' constraint outcomes", () => {
    const state = stageAll(withGoldenBoard(createInitialState()));
    const byLabel = new Map(packageViews(state).map((view) => [view.packageLabel, view]));

    expect(byLabel.get("Customer-Protective")?.tally.mustViolated).toBe(0);
    expect(byLabel.get("Fast Close")?.tally.mustViolated).toBe(1);
    // Both alternatives keep automatic renewal, which the board asked to avoid.
    expect(byLabel.get("Customer-Protective")?.tally.avoidViolated).toBe(1);
    expect(byLabel.get("Fast Close")?.tally.avoidViolated).toBe(1);
  });

  it("counts decisions as they are made", () => {
    let state = stageAll(withGoldenBoard(createInitialState()));
    state = reduce(state, { type: "approve-edit", editId: "pkg-0001-e02" }, AT);
    state = reduce(state, { type: "reject-edit", editId: "pkg-0001-e01" }, AT);

    const view = packageViews(state).find((item) => item.packageId === "pkg-0001");
    expect(view?.counts).toMatchObject({ approved: 1, rejected: 1, pending: 1 });
  });
});

describe("clause comparisons", () => {
  it("puts every alternative for a clause in one row, against how it reads now", () => {
    const state = stageAll(withGoldenBoard(createInitialState()));
    const rows = clauseComparisons(state);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.ordinal)).toEqual([...rows.map((row) => row.ordinal)].sort((a, b) => a - b));

    for (const row of rows) {
      expect(row.proposals).toHaveLength(3);
      expect(row.governingEditId).toBeNull();
      expect(row.decisionStatus).toBe("pending");
      expect(row.currentText).toBe(row.originalText);
    }
  });

  it("reports the baseline verdicts for the clause as it currently stands", () => {
    const state = stageAll(withGoldenBoard(createInitialState()));
    const retention = clauseComparisons(state).find((row) => row.clauseType === "data_retention");

    // The seeded clause lets Northstar delete "at its discretion", which names no
    // deadline any rule can read.
    expect(retention?.baselineTally.mustUnresolved).toBe(1);
    expect(retention?.baselineTally.mustViolated).toBe(0);
  });

  it("names the governing choice once one is approved and keeps the rivals", () => {
    let state = stageAll(withGoldenBoard(createInitialState()));
    state = reduce(state, { type: "approve-edit", editId: "pkg-0001-e03" }, AT);

    const row = clauseComparisons(state).find((item) => item.clauseType === "data_retention");
    expect(row?.governingEditId).toBe("pkg-0001-e03");
    expect(row?.decisionStatus).toBe("approved");
    expect(row?.proposals).toHaveLength(3);
    expect(row?.proposals.filter((item) => item.status === "pending")).toHaveLength(2);
    // The clause now reads as the accepted alternative, and its baseline verdict
    // moves with it.
    expect(row?.baselineTally.mustSatisfied).toBe(1);
  });

  it("returns nothing before anything is staged", () => {
    expect(clauseComparisons(createInitialState())).toEqual([]);
  });
});

describe("board statuses", () => {
  it("reports where each constraint stands against the current agreement", () => {
    const state = withGoldenBoard(createInitialState());
    const statuses = boardStatuses(state);

    expect(statuses).toHaveLength(4);
    const byRule = new Map(statuses.map((item) => [item.constraint.ruleId, item]));

    expect(byRule.get("data_deletion_within_days")?.result?.status).toBe("unresolved");
    expect(byRule.get("termination_notice_min_days")?.result?.status).toBe("satisfied");
    expect(byRule.get("non_renewal_notice_max_days")?.result?.status).toBe("violated");
    expect(byRule.get("no_automatic_renewal")?.result?.status).toBe("violated");
    // Every verdict names the clause it read.
    expect(byRule.get("data_deletion_within_days")?.clauseTitle).toBe("Data Retention and Deletion");
  });

  it("moves when a decision changes the wording", () => {
    let state = stageAll(withGoldenBoard(createInitialState()));
    expect(boardTally(state).mustUnresolved).toBe(1);

    state = reduce(state, { type: "approve-edit", editId: "pkg-0001-e03" }, AT);
    expect(boardTally(state).mustUnresolved).toBe(0);
    expect(boardTally(state).mustSatisfied).toBe(2);
  });

  it("reports no result when the document has no clause of the rule's type", () => {
    const base = createInitialState();
    const trimmed: AppState = {
      ...base,
      revision: {
        ...base.revision,
        clauses: base.revision.clauses.filter((clause) => clause.clauseType !== "data_retention"),
      },
    };
    const state = reduce(
      trimmed,
      { type: "add-constraint", ruleId: "data_deletion_within_days", severity: "must", value: 30 },
      AT,
    );

    expect(boardStatuses(state)[0]?.result).toBeNull();
    expect(boardStatuses(state)[0]?.clauseId).toBeNull();
  });
});
