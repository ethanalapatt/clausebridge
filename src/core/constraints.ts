import type { ClauseType } from "@/core/types";

/**
 * Deterministic constraint evaluation.
 *
 * A constraint is a *product* rule the human states about the fictional
 * agreement — "deletion must happen within 30 days", "do not accept automatic
 * renewal". It is not a legal judgement and this module never claims one. Each
 * rule inspects exact clause text with a narrow, visible pattern and reports
 * what it found, including reporting `unresolved` when the text contains
 * nothing the rule knows how to read.
 *
 * Everything here is pure: same constraint plus same text always yields the
 * same result, evidence, and explanation. There is no clock, no randomness, and
 * no inference beyond the documented pattern.
 */

export type ConstraintSeverity = "must" | "prefer" | "avoid";

export const CONSTRAINT_SEVERITIES: readonly ConstraintSeverity[] = ["must", "prefer", "avoid"];

export const CONSTRAINT_SEVERITY_LABELS: Readonly<Record<ConstraintSeverity, string>> = {
  must: "Must",
  prefer: "Prefer",
  avoid: "Avoid",
};

export type ConstraintStatus = "satisfied" | "violated" | "unresolved" | "not_applicable";

export const CONSTRAINT_STATUS_LABELS: Readonly<Record<ConstraintStatus, string>> = {
  satisfied: "Satisfied",
  violated: "Not met",
  unresolved: "Unresolved",
  not_applicable: "Not applicable",
};

export type ConstraintRuleId =
  | "termination_notice_min_days"
  | "non_renewal_notice_max_days"
  | "data_deletion_within_days"
  | "no_automatic_renewal"
  | "liability_cap_min_months"
  | "manual_review_only";

/** A constraint the human has actually added to the objective board. */
export interface Constraint {
  /** Stable local ID, e.g. `con-0001`. */
  id: string;
  ruleId: ConstraintRuleId;
  severity: ConstraintSeverity;
  /** Numeric parameter for rules that take one; `null` for boolean rules. */
  value: number | null;
  /** Human note explaining intent. Never used by the evaluator. */
  note: string | null;
}

/** A constraint before the reducer assigns it a stable ID. */
export type ConstraintDraft = Omit<Constraint, "id">;

export interface ConstraintResult {
  constraintId: string;
  ruleId: ConstraintRuleId;
  severity: ConstraintSeverity;
  status: ConstraintStatus;
  /** Exact local text the rule read, or an explicit statement that it found none. */
  evidence: string;
  /** Describes the rule evaluation. Never a legal opinion. */
  explanation: string;
  requiresManualReview: boolean;
}

// ------------------------------------------------------------ text patterns

/**
 * Reads durations out of the fictional drafting style used here, which always
 * spells the number and then repeats it in digits: "thirty (30) days".
 *
 * Deliberately narrow. It matches digits immediately followed by an optional
 * closing parenthesis and a day/month/year unit, and nothing else, so "1.5% per
 * month" and "$25,000" are not durations.
 */
const DURATION_RE = /(\d{1,4})\s*\)?\s*(day|month|year)s?\b/gi;

export interface Duration {
  value: number;
  unit: "day" | "month" | "year";
}

export function parseDurations(text: string): Duration[] {
  const found: Duration[] = [];
  for (const match of text.matchAll(DURATION_RE)) {
    const digits = match[1];
    const unit = match[2];
    if (digits === undefined || unit === undefined) continue;
    const value = Number.parseInt(digits, 10);
    if (!Number.isFinite(value)) continue;
    found.push({ value, unit: unit.toLowerCase() as Duration["unit"] });
  }
  return found;
}

/** Splits on sentence-final punctuation so evidence can be quoted exactly. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.;:])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function firstOr(values: readonly string[], fallback: string): string {
  return values[0] ?? fallback;
}

function quote(sentence: string): string {
  return `“${sentence.replace(/\s+/g, " ").trim()}”`;
}

// ------------------------------------------------------------------- rules

export interface ConstraintRule {
  id: ConstraintRuleId;
  /** The one clause type this rule can read. Anything else is not applicable. */
  clauseType: ClauseType;
  defaultSeverity: ConstraintSeverity;
  /** `null` for boolean rules. */
  defaultValue: number | null;
  unit: "days" | "months" | null;
  /** What the rule inspects, shown in the UI so the grammar stays visible. */
  inspects: string;
  label: (value: number | null) => string;
}

export const CONSTRAINT_RULES: readonly ConstraintRule[] = [
  {
    id: "termination_notice_min_days",
    clauseType: "termination",
    defaultSeverity: "must",
    defaultValue: 30,
    unit: "days",
    inspects:
      "Sentences that mention terminating and a notice, excluding non-renewal sentences, and the day figures written in them.",
    label: (value) => `Termination notice of at least ${value ?? 0} days`,
  },
  {
    id: "non_renewal_notice_max_days",
    clauseType: "termination",
    defaultSeverity: "prefer",
    defaultValue: 30,
    unit: "days",
    inspects: "Sentences that mention non-renewal, and the day figures written in them.",
    label: (value) => `Non-renewal notice of no more than ${value ?? 0} days`,
  },
  {
    id: "data_deletion_within_days",
    clauseType: "data_retention",
    defaultSeverity: "must",
    defaultValue: 30,
    unit: "days",
    inspects: "A “delete … within N days” or “within N days … delete” phrase in a single sentence.",
    label: (value) => `Data deleted within ${value ?? 0} days`,
  },
  {
    id: "no_automatic_renewal",
    clauseType: "termination",
    defaultSeverity: "avoid",
    defaultValue: null,
    unit: null,
    inspects:
      "Automatic-renewal phrasing: “renews automatically”, “automatically renew”, “renewing/renews for successive”.",
    label: () => "No automatic renewal",
  },
  {
    id: "liability_cap_min_months",
    clauseType: "liability",
    defaultSeverity: "prefer",
    defaultValue: 12,
    unit: "months",
    inspects:
      "Sentences that mention liability together with a cap phrase, and the month figures written in them.",
    label: (value) => `Liability cap of at least ${value ?? 0} months of fees`,
  },
  {
    id: "manual_review_only",
    clauseType: "liability",
    defaultSeverity: "must",
    defaultValue: null,
    unit: null,
    inspects: "Nothing. This rule always defers to a person.",
    label: () => "Manual review required — no automated rule applies",
  },
];

export function findRule(ruleId: ConstraintRuleId): ConstraintRule | null {
  return CONSTRAINT_RULES.find((rule) => rule.id === ruleId) ?? null;
}

export function constraintLabel(constraint: Constraint): string {
  return findRule(constraint.ruleId)?.label(constraint.value) ?? constraint.ruleId;
}

export function constraintClauseType(constraint: Constraint): ClauseType | null {
  return findRule(constraint.ruleId)?.clauseType ?? null;
}

// -------------------------------------------------------------- evaluation

type RuleOutcome = Pick<
  ConstraintResult,
  "status" | "evidence" | "explanation" | "requiresManualReview"
>;

interface RuleInput {
  text: string;
  sentences: readonly string[];
  value: number | null;
}

const UNREADABLE: (what: string) => RuleOutcome = (what) => ({
  status: "unresolved",
  evidence: "No matching text found.",
  explanation: `The clause text contains no ${what} this rule can read, so the outcome is left unresolved rather than guessed.`,
  requiresManualReview: true,
});

const EVALUATORS: Readonly<Record<ConstraintRuleId, (input: RuleInput) => RuleOutcome>> = {
  termination_notice_min_days: ({ sentences, value }) => {
    const target = value ?? 0;
    const relevant = sentences.filter(
      (sentence) =>
        /terminat/i.test(sentence) &&
        /notice/i.test(sentence) &&
        !/non-renewal/i.test(sentence),
    );
    const days = relevant.flatMap((sentence) =>
      parseDurations(sentence)
        .filter((duration) => duration.unit === "day")
        .map((duration) => ({ duration, sentence })),
    );
    if (days.length === 0) return UNREADABLE("termination-notice period in days");

    const meeting = days.filter((item) => item.duration.value >= target);
    if (meeting.length > 0) {
      const hit = meeting[0];
      return {
        status: "satisfied",
        evidence: quote(hit?.sentence ?? ""),
        explanation: `Found a termination-notice period of ${hit?.duration.value ?? 0} days, which is at least the ${target} days you required.`,
        requiresManualReview: false,
      };
    }

    const shortest = days.reduce((min, item) =>
      item.duration.value < min.duration.value ? item : min,
    );
    return {
      status: "violated",
      evidence: quote(shortest.sentence),
      explanation: `Every termination-notice period this rule found is shorter than ${target} days; the shortest is ${shortest.duration.value} days.`,
      requiresManualReview: false,
    };
  },

  non_renewal_notice_max_days: ({ sentences, value }) => {
    const target = value ?? 0;
    const relevant = sentences.filter((sentence) => /non-renewal/i.test(sentence));
    const days = relevant.flatMap((sentence) =>
      parseDurations(sentence)
        .filter((duration) => duration.unit === "day")
        .map((duration) => ({ duration, sentence })),
    );
    if (days.length === 0) return UNREADABLE("non-renewal notice period in days");

    const overLong = days.filter((item) => item.duration.value > target);
    if (overLong.length === 0) {
      const hit = days[0];
      return {
        status: "satisfied",
        evidence: quote(hit?.sentence ?? ""),
        explanation: `The non-renewal notice period this rule found is ${hit?.duration.value ?? 0} days, within the ${target} days you allowed.`,
        requiresManualReview: false,
      };
    }

    const longest = overLong.reduce((max, item) =>
      item.duration.value > max.duration.value ? item : max,
    );
    return {
      status: "violated",
      evidence: quote(longest.sentence),
      explanation: `The non-renewal notice period this rule found is ${longest.duration.value} days, longer than the ${target} days you allowed.`,
      requiresManualReview: false,
    };
  },

  data_deletion_within_days: ({ sentences, value }) => {
    const target = value ?? 0;
    const found: { days: number; sentence: string }[] = [];

    for (const sentence of sentences) {
      // Both orderings of the same narrow phrase, so "delete … within 30 days"
      // and "within 30 days … delete" are read and nothing else is.
      const patterns = [
        /delet[a-z]*[^.;]{0,160}?within\s+[^.;]{0,40}?(\d{1,4})\s*\)?\s*days?/i,
        /within\s+[^.;]{0,40}?(\d{1,4})\s*\)?\s*days?[^.;]{0,160}?delet[a-z]*/i,
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(sentence);
        const digits = match?.[1];
        if (digits === undefined) continue;
        const days = Number.parseInt(digits, 10);
        if (Number.isFinite(days)) found.push({ days, sentence });
        break;
      }
    }

    if (found.length === 0) return UNREADABLE("“delete within N days” deadline");

    const meeting = found.filter((item) => item.days <= target);
    if (meeting.length > 0) {
      const hit = meeting[0];
      return {
        status: "satisfied",
        evidence: quote(hit?.sentence ?? ""),
        explanation: `Found a deletion deadline of ${hit?.days ?? 0} days, within the ${target} days you required.`,
        requiresManualReview: false,
      };
    }

    const soonest = found.reduce((min, item) => (item.days < min.days ? item : min));
    return {
      status: "violated",
      evidence: quote(soonest.sentence),
      explanation: `The earliest deletion deadline this rule found is ${soonest.days} days, later than the ${target} days you required.`,
      requiresManualReview: false,
    };
  },

  no_automatic_renewal: ({ sentences }) => {
    const auto = sentences.find((sentence) =>
      /renews?\s+automatically|automatically\s+renew|renew(?:s|ing)?\s+(?:automatically\s+)?for\s+successive/i.test(
        sentence,
      ),
    );
    if (auto !== undefined) {
      return {
        status: "violated",
        evidence: quote(auto),
        explanation:
          "This rule found automatic-renewal phrasing, which is the wording you asked to avoid.",
        requiresManualReview: false,
      };
    }

    const renewal = sentences.filter((sentence) => /renew/i.test(sentence));
    if (renewal.length === 0) return UNREADABLE("renewal language");

    return {
      status: "satisfied",
      evidence: quote(firstOr(renewal, "")),
      explanation:
        "The clause discusses renewal but contains none of the automatic-renewal phrasings this rule looks for.",
      requiresManualReview: false,
    };
  },

  liability_cap_min_months: ({ sentences, value }) => {
    const target = value ?? 0;
    const relevant = sentences.filter(
      (sentence) => /liabilit/i.test(sentence) && /exceed|cap\b|capped/i.test(sentence),
    );
    const months = relevant.flatMap((sentence) =>
      parseDurations(sentence)
        .filter((duration) => duration.unit === "month")
        .map((duration) => ({ duration, sentence })),
    );
    if (months.length === 0) return UNREADABLE("liability cap expressed in months of fees");

    const meeting = months.filter((item) => item.duration.value >= target);
    if (meeting.length > 0) {
      const hit = meeting[0];
      return {
        status: "satisfied",
        evidence: quote(hit?.sentence ?? ""),
        explanation: `Found a cap measured over ${hit?.duration.value ?? 0} months of fees, at least the ${target} months you asked for.`,
        requiresManualReview: false,
      };
    }

    const largest = months.reduce((max, item) =>
      item.duration.value > max.duration.value ? item : max,
    );
    return {
      status: "violated",
      evidence: quote(largest.sentence),
      explanation: `The longest cap period this rule found is ${largest.duration.value} months of fees, fewer than the ${target} months you asked for.`,
      requiresManualReview: false,
    };
  },

  manual_review_only: () => ({
    status: "unresolved",
    evidence: "Not evaluated.",
    explanation:
      "You marked this clause for manual review, so no automated rule decides it. A person has to read the wording and make the call.",
    requiresManualReview: true,
  }),
};

/**
 * Evaluates one constraint against one clause's text.
 *
 * Returns `not_applicable` when the constraint's rule targets a different clause
 * type — a constraint about data retention says nothing about a liability
 * clause, and pretending otherwise would be a fabricated finding.
 */
export function evaluateConstraint(
  constraint: Constraint,
  clauseType: ClauseType,
  text: string,
): ConstraintResult {
  const rule = findRule(constraint.ruleId);

  if (rule === null) {
    return {
      constraintId: constraint.id,
      ruleId: constraint.ruleId,
      severity: constraint.severity,
      status: "unresolved",
      evidence: "No rule is registered under this identifier.",
      explanation:
        "This constraint names a rule this build does not implement, so nothing was evaluated.",
      requiresManualReview: true,
    };
  }

  if (rule.clauseType !== clauseType) {
    return {
      constraintId: constraint.id,
      ruleId: constraint.ruleId,
      severity: constraint.severity,
      status: "not_applicable",
      evidence: "Not evaluated.",
      explanation: `This rule only reads ${rule.clauseType.replace(/_/g, " ")} clauses.`,
      requiresManualReview: false,
    };
  }

  const evaluate = EVALUATORS[constraint.ruleId];
  const outcome = evaluate({
    text,
    sentences: sentencesOf(text),
    value: constraint.value,
  });

  return {
    constraintId: constraint.id,
    ruleId: constraint.ruleId,
    severity: constraint.severity,
    ...outcome,
  };
}

/** Every constraint's verdict on one clause, applicable ones included. */
export function evaluateConstraints(
  constraints: readonly Constraint[],
  clauseType: ClauseType,
  text: string,
): ConstraintResult[] {
  return constraints.map((constraint) => evaluateConstraint(constraint, clauseType, text));
}

/** Only the constraints whose rule actually reads this clause type. */
export function applicableConstraints(
  constraints: readonly Constraint[],
  clauseType: ClauseType,
): Constraint[] {
  return constraints.filter((constraint) => constraintClauseType(constraint) === clauseType);
}

// ---------------------------------------------------------------- counting

export interface ConstraintTally {
  mustSatisfied: number;
  mustUnresolved: number;
  mustViolated: number;
  preferSatisfied: number;
  preferUnresolved: number;
  preferViolated: number;
  avoidSatisfied: number;
  avoidUnresolved: number;
  avoidViolated: number;
  manualReview: number;
}

export const EMPTY_TALLY: ConstraintTally = {
  mustSatisfied: 0,
  mustUnresolved: 0,
  mustViolated: 0,
  preferSatisfied: 0,
  preferUnresolved: 0,
  preferViolated: 0,
  avoidSatisfied: 0,
  avoidUnresolved: 0,
  avoidViolated: 0,
  manualReview: 0,
};

/**
 * Factual counts only. Deliberately never a score: a weighted number would imply
 * a judgement about which wording is better, which this product does not make.
 */
export function tallyResults(results: readonly ConstraintResult[]): ConstraintTally {
  const tally: ConstraintTally = { ...EMPTY_TALLY };

  for (const result of results) {
    if (result.requiresManualReview) tally.manualReview += 1;
    if (result.status === "not_applicable") continue;

    const key = `${result.severity}${result.status === "satisfied" ? "Satisfied" : result.status === "violated" ? "Violated" : "Unresolved"}` as keyof ConstraintTally;
    tally[key] += 1;
  }

  return tally;
}

export function addTallies(a: ConstraintTally, b: ConstraintTally): ConstraintTally {
  return {
    mustSatisfied: a.mustSatisfied + b.mustSatisfied,
    mustUnresolved: a.mustUnresolved + b.mustUnresolved,
    mustViolated: a.mustViolated + b.mustViolated,
    preferSatisfied: a.preferSatisfied + b.preferSatisfied,
    preferUnresolved: a.preferUnresolved + b.preferUnresolved,
    preferViolated: a.preferViolated + b.preferViolated,
    avoidSatisfied: a.avoidSatisfied + b.avoidSatisfied,
    avoidUnresolved: a.avoidUnresolved + b.avoidUnresolved,
    avoidViolated: a.avoidViolated + b.avoidViolated,
    manualReview: a.manualReview + b.manualReview,
  };
}
