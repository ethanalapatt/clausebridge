import { describe, expect, it } from "vitest";

import {
  CONSTRAINT_RULES,
  applicableConstraints,
  addTallies,
  constraintClauseType,
  constraintLabel,
  evaluateConstraint,
  evaluateConstraints,
  parseDurations,
  sentencesOf,
  tallyResults,
} from "@/core/constraints";
import type { Constraint, ConstraintRuleId, ConstraintSeverity } from "@/core/constraints";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { NORTHSTAR_CLAUSES } from "@/core/seed/northstar";
import type { ClauseType } from "@/core/types";

function constraint(
  ruleId: ConstraintRuleId,
  value: number | null,
  severity: ConstraintSeverity = "must",
): Constraint {
  return { id: `con-${ruleId}`, ruleId, severity, value, note: null };
}

function seedText(clauseType: ClauseType): string {
  const clause = NORTHSTAR_CLAUSES.find((item) => item.clauseType === clauseType);
  if (clause === undefined) throw new Error(`no seed clause of type ${clauseType}`);
  return clause.text;
}

function fallbackText(id: string): string {
  const entry = FALLBACK_LIBRARY.find((item) => item.id === id);
  if (entry === undefined) throw new Error(`no fallback ${id}`);
  return entry.text;
}

describe("parseDurations", () => {
  it("reads the digits out of the spelled-then-numeric drafting style", () => {
    expect(parseDurations("within thirty (30) days")).toEqual([{ value: 30, unit: "day" }]);
    expect(parseDurations("successive twelve (12) month periods")).toEqual([
      { value: 12, unit: "month" },
    ]);
  });

  it("reads bare numeric durations too", () => {
    expect(parseDurations("a 45 day window")).toEqual([{ value: 45, unit: "day" }]);
  });

  it("does not treat percentages or money as durations", () => {
    expect(parseDurations("one and one-half percent (1.5%) per month")).toEqual([]);
    expect(parseDurations("TWENTY-FIVE THOUSAND DOLLARS ($25,000)")).toEqual([]);
  });

  it("returns every duration in order", () => {
    expect(parseDurations("ten (10) days, then ninety (90) days")).toEqual([
      { value: 10, unit: "day" },
      { value: 90, unit: "day" },
    ]);
  });
});

describe("sentencesOf", () => {
  it("splits on sentence-final punctuation and trims", () => {
    expect(sentencesOf("One. Two;  Three")).toEqual(["One.", "Two;", "Three"]);
  });

  it("returns nothing for blank text", () => {
    expect(sentencesOf("   ")).toEqual([]);
  });
});

describe("rule catalog", () => {
  it("has a unique id per rule and a label for every rule", () => {
    const ids = CONSTRAINT_RULES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of CONSTRAINT_RULES) {
      expect(rule.label(rule.defaultValue).length).toBeGreaterThan(0);
      expect(rule.inspects.length).toBeGreaterThan(0);
    }
  });

  it("labels a constraint from its rule and value", () => {
    expect(constraintLabel(constraint("termination_notice_min_days", 45))).toBe(
      "Termination notice of at least 45 days",
    );
  });

  it("reports which clause type a constraint reads", () => {
    expect(constraintClauseType(constraint("data_deletion_within_days", 30))).toBe(
      "data_retention",
    );
  });
});

describe("applicability", () => {
  it("returns not_applicable when the rule reads a different clause type", () => {
    const result = evaluateConstraint(
      constraint("data_deletion_within_days", 30),
      "liability",
      seedText("liability"),
    );
    expect(result.status).toBe("not_applicable");
    expect(result.requiresManualReview).toBe(false);
  });

  it("filters a board down to the constraints that read a clause type", () => {
    const board = [
      constraint("data_deletion_within_days", 30),
      constraint("termination_notice_min_days", 30),
      constraint("no_automatic_renewal", null, "avoid"),
    ];
    expect(applicableConstraints(board, "termination").map((item) => item.ruleId)).toEqual([
      "termination_notice_min_days",
      "no_automatic_renewal",
    ]);
  });
});

describe("termination_notice_min_days", () => {
  it("is satisfied by the seeded thirty-day convenience notice", () => {
    const result = evaluateConstraint(
      constraint("termination_notice_min_days", 30),
      "termination",
      seedText("termination"),
    );
    expect(result.status).toBe("satisfied");
    expect(result.evidence).toContain("thirty (30) days");
    expect(result.requiresManualReview).toBe(false);
  });

  it("is violated when every notice period found is shorter than required", () => {
    const result = evaluateConstraint(
      constraint("termination_notice_min_days", 90),
      "termination",
      seedText("termination"),
    );
    expect(result.status).toBe("violated");
    expect(result.explanation).toContain("30 days");
  });

  it("ignores non-renewal sentences when reading termination notice", () => {
    const result = evaluateConstraint(
      constraint("termination_notice_min_days", 30),
      "termination",
      "Either party may give written notice of non-renewal at least ninety (90) days before renewal.",
    );
    expect(result.status).toBe("unresolved");
  });

  it("is unresolved when no notice period is written at all", () => {
    const result = evaluateConstraint(
      constraint("termination_notice_min_days", 30),
      "termination",
      "This Agreement continues until the parties agree otherwise.",
    );
    expect(result.status).toBe("unresolved");
    expect(result.requiresManualReview).toBe(true);
    expect(result.evidence).toBe("No matching text found.");
  });
});

describe("non_renewal_notice_max_days", () => {
  it("is violated by the seeded ninety-day non-renewal window", () => {
    const result = evaluateConstraint(
      constraint("non_renewal_notice_max_days", 30, "prefer"),
      "termination",
      seedText("termination"),
    );
    expect(result.status).toBe("violated");
    expect(result.explanation).toContain("90 days");
  });

  it("is satisfied by the customer-side thirty-day window", () => {
    const result = evaluateConstraint(
      constraint("non_renewal_notice_max_days", 30, "prefer"),
      "termination",
      fallbackText("fb-termination-customer-1"),
    );
    expect(result.status).toBe("satisfied");
  });
});

describe("data_deletion_within_days", () => {
  it("leaves the seeded discretionary retention unresolved rather than guessing", () => {
    const result = evaluateConstraint(
      constraint("data_deletion_within_days", 30),
      "data_retention",
      seedText("data_retention"),
    );
    expect(result.status).toBe("unresolved");
    expect(result.requiresManualReview).toBe(true);
  });

  it("is satisfied by an explicit thirty-day deletion deadline", () => {
    const result = evaluateConstraint(
      constraint("data_deletion_within_days", 30),
      "data_retention",
      fallbackText("fb-data_retention-customer-1"),
    );
    expect(result.status).toBe("satisfied");
    expect(result.evidence).toContain("within thirty (30) days");
  });

  it("is violated when the only deadline found is later than required", () => {
    const result = evaluateConstraint(
      constraint("data_deletion_within_days", 30),
      "data_retention",
      "Northstar shall delete Customer Data within sixty (60) days after termination.",
    );
    expect(result.status).toBe("violated");
    expect(result.explanation).toContain("60 days");
  });

  it("reads the reversed phrasing as well", () => {
    const result = evaluateConstraint(
      constraint("data_deletion_within_days", 30),
      "data_retention",
      "Within fifteen (15) days after termination Northstar shall delete Customer Data.",
    );
    expect(result.status).toBe("satisfied");
  });
});

describe("no_automatic_renewal", () => {
  it("is violated by the seeded automatic renewal", () => {
    const result = evaluateConstraint(
      constraint("no_automatic_renewal", null, "avoid"),
      "termination",
      seedText("termination"),
    );
    expect(result.status).toBe("violated");
    expect(result.evidence).toContain("renews automatically");
  });

  it("is satisfied when renewal is discussed without an automatic trigger", () => {
    const result = evaluateConstraint(
      constraint("no_automatic_renewal", null, "avoid"),
      "termination",
      "The Subscription Term may be renewed only by a written order signed by both parties.",
    );
    expect(result.status).toBe("satisfied");
  });

  it("is unresolved when the clause never mentions renewal", () => {
    const result = evaluateConstraint(
      constraint("no_automatic_renewal", null, "avoid"),
      "termination",
      "Either party may terminate upon thirty (30) days' notice.",
    );
    expect(result.status).toBe("unresolved");
  });
});

describe("liability_cap_min_months", () => {
  it("is violated by the seeded three-month cap", () => {
    const result = evaluateConstraint(
      constraint("liability_cap_min_months", 12, "prefer"),
      "liability",
      seedText("liability"),
    );
    expect(result.status).toBe("violated");
    expect(result.explanation).toContain("3 months");
  });

  it("is satisfied by the twelve-month customer alternative", () => {
    const result = evaluateConstraint(
      constraint("liability_cap_min_months", 12, "prefer"),
      "liability",
      fallbackText("fb-liability-customer-1"),
    );
    expect(result.status).toBe("satisfied");
  });
});

describe("manual_review_only", () => {
  it("never decides, and always asks for a person", () => {
    const result = evaluateConstraint(
      constraint("manual_review_only", null),
      "liability",
      seedText("liability"),
    );
    expect(result.status).toBe("unresolved");
    expect(result.requiresManualReview).toBe(true);
  });
});

describe("determinism", () => {
  it("produces identical results for identical inputs", () => {
    const board = [
      constraint("termination_notice_min_days", 30),
      constraint("non_renewal_notice_max_days", 30, "prefer"),
      constraint("no_automatic_renewal", null, "avoid"),
    ];
    const first = evaluateConstraints(board, "termination", seedText("termination"));
    const second = evaluateConstraints(board, "termination", seedText("termination"));
    expect(first).toEqual(second);
  });

  it("returns one result per constraint, in board order", () => {
    const board = [
      constraint("data_deletion_within_days", 30),
      constraint("termination_notice_min_days", 30),
    ];
    const results = evaluateConstraints(board, "termination", seedText("termination"));
    expect(results.map((item) => item.constraintId)).toEqual([
      "con-data_deletion_within_days",
      "con-termination_notice_min_days",
    ]);
    expect(results[0]?.status).toBe("not_applicable");
  });
});

describe("tallyResults", () => {
  it("counts by severity and status, skipping not-applicable results", () => {
    const board = [
      constraint("termination_notice_min_days", 30),
      constraint("non_renewal_notice_max_days", 30, "prefer"),
      constraint("no_automatic_renewal", null, "avoid"),
      constraint("data_deletion_within_days", 30),
    ];
    const tally = tallyResults(evaluateConstraints(board, "termination", seedText("termination")));

    expect(tally.mustSatisfied).toBe(1);
    expect(tally.preferViolated).toBe(1);
    expect(tally.avoidViolated).toBe(1);
    // The data-retention constraint is not applicable here and is not counted.
    expect(tally.mustViolated).toBe(0);
    expect(tally.mustUnresolved).toBe(0);
  });

  it("counts manual review separately from status", () => {
    const tally = tallyResults(
      evaluateConstraints([constraint("manual_review_only", null)], "liability", "anything"),
    );
    expect(tally.manualReview).toBe(1);
    expect(tally.mustUnresolved).toBe(1);
  });

  it("adds tallies field by field", () => {
    const one = tallyResults(
      evaluateConstraints(
        [constraint("termination_notice_min_days", 30)],
        "termination",
        seedText("termination"),
      ),
    );
    expect(addTallies(one, one).mustSatisfied).toBe(2);
  });
});
