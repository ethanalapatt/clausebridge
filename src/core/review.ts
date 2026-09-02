import { diffStats, diffWords } from "@/core/diff";
import {
  addTallies,
  constraintClauseType,
  evaluateConstraints,
  tallyResults,
} from "@/core/constraints";
import type { Constraint, ConstraintResult, ConstraintTally } from "@/core/constraints";
import type { DiffStats } from "@/core/diff";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import {
  acceptedTextOf,
  effectiveClauseText,
  findClause,
  governingEdit,
  isEditStale,
  isNonNegotiable,
} from "@/core/state";
import type {
  AppState,
  Clause,
  ClauseType,
  DecisionStatus,
  FallbackEntry,
  PriorityTag,
  RedlinePackage,
  StagedEdit,
} from "@/core/types";

/**
 * The review layer: everything the comparison surface needs about a proposal,
 * derived from state rather than stored beside it.
 *
 * Keeping this out of the reducer matters. Constraint verdicts must be a pure
 * function of the current wording, so they cannot go stale after an edit, an
 * approval, a rejection, or a change to the objective board — there is no cached
 * copy that could disagree with the text on screen.
 */

// ------------------------------------------------------------- provenance

export interface FallbackProvenance {
  fallbackId: string;
  label: string;
  source: string;
  note: string;
  /** True while the proposal still matches the library entry word for word. */
  verbatim: boolean;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Identifies which bundled entry a proposal's wording came from.
 *
 * Matched on exact text rather than trusted from the rationale string, so the
 * attribution reflects what was actually staged. A proposal whose wording is not
 * in the library returns `null` and the UI says so, rather than implying a
 * provenance it cannot show.
 */
export function fallbackProvenance(edit: StagedEdit): FallbackProvenance | null {
  const proposed = normalize(edit.proposedText);
  const entry: FallbackEntry | undefined = FALLBACK_LIBRARY.find(
    (item) => normalize(item.text) === proposed,
  );
  if (entry === undefined) return null;

  return {
    fallbackId: entry.id,
    label: entry.label,
    source: entry.source,
    note: entry.note,
    verbatim: normalize(acceptedTextOf(edit)) === proposed,
  };
}

// ---------------------------------------------------------------- proposals

export interface ProposalView {
  editId: string;
  packageId: string;
  packageLabel: string;
  clauseId: string;
  clauseTitle: string;
  clauseType: ClauseType;
  ordinal: number;
  /** Untouched wording from the source agreement. */
  originalText: string;
  /** What the clause reads as right now, before this proposal is applied. */
  currentText: string;
  /** Exactly what the tool proposed. Never overwritten by a human edit. */
  proposedText: string;
  /** The wording this proposal would contribute — the human's, if they wrote one. */
  acceptedText: string;
  humanEdited: boolean;
  rationale: string;
  priorityTag: PriorityTag;
  status: DecisionStatus;
  note: string | null;
  stale: boolean;
  /** True when this proposal touches a clause the human locked. */
  conflictsWithNonNegotiable: boolean;
  fallback: FallbackProvenance | null;
  constraints: readonly ConstraintResult[];
  tally: ConstraintTally;
  diff: DiffStats;
  /** True when this proposal is the one currently governing its clause. */
  governing: boolean;
}

/** Everything the review surface knows about one staged proposal. */
export function proposalView(state: AppState, edit: StagedEdit): ProposalView | null {
  const pkg = state.packages.find((item) => item.packageId === edit.packageId);
  const clause = findClause(state, edit.clauseId);
  if (pkg === undefined) return null;

  const accepted = acceptedTextOf(edit);
  const clauseType: ClauseType = clause?.clauseType ?? "other";
  // A stale proposal's clause is gone, so its own captured text is the only
  // honest basis for evaluation.
  const currentText = clause === null ? edit.originalText : effectiveClauseText(state, edit.clauseId);
  const constraints = evaluateConstraints(state.constraints, clauseType, accepted);
  const governing = governingEdit(state, edit.clauseId);

  return {
    editId: edit.editId,
    packageId: pkg.packageId,
    packageLabel: pkg.packageLabel,
    clauseId: edit.clauseId,
    clauseTitle: clause?.title ?? edit.clauseId,
    clauseType,
    ordinal: clause?.ordinal ?? 0,
    originalText: clause?.text ?? edit.originalText,
    currentText,
    proposedText: edit.proposedText,
    acceptedText: accepted,
    humanEdited: edit.status === "edited" && edit.humanText !== null,
    rationale: edit.rationale,
    priorityTag: edit.priorityTag,
    status: edit.status,
    note: edit.note,
    stale: isEditStale(state, edit),
    conflictsWithNonNegotiable: isNonNegotiable(state, edit.clauseId),
    fallback: fallbackProvenance(edit),
    constraints,
    tally: tallyResults(constraints),
    diff: diffStats(diffWords(edit.originalText, accepted)),
    governing: governing?.editId === edit.editId,
  };
}

export function proposalViews(state: AppState): ProposalView[] {
  return state.edits
    .map((edit) => proposalView(state, edit))
    .filter((view): view is ProposalView => view !== null);
}

// ----------------------------------------------------------------- packages

export interface PackageCounts {
  proposed: number;
  pending: number;
  approved: number;
  edited: number;
  rejected: number;
  /** Proposals touching a clause the human marked non-negotiable. */
  lockedClauses: number;
}

export interface PackageView {
  packageId: string;
  packageLabel: string;
  package: RedlinePackage;
  proposals: readonly ProposalView[];
  counts: PackageCounts;
  /** Constraint checks across every clause this package touches. */
  tally: ConstraintTally;
  clauseIds: readonly string[];
}

export function packageView(state: AppState, pkg: RedlinePackage): PackageView {
  const proposals = state.edits
    .filter((edit) => edit.packageId === pkg.packageId)
    .map((edit) => proposalView(state, edit))
    .filter((view): view is ProposalView => view !== null);

  const counts: PackageCounts = {
    proposed: proposals.length,
    pending: proposals.filter((item) => item.status === "pending").length,
    approved: proposals.filter((item) => item.status === "approved").length,
    edited: proposals.filter((item) => item.status === "edited").length,
    rejected: proposals.filter((item) => item.status === "rejected").length,
    lockedClauses: proposals.filter((item) => item.conflictsWithNonNegotiable).length,
  };

  return {
    packageId: pkg.packageId,
    packageLabel: pkg.packageLabel,
    package: pkg,
    proposals,
    counts,
    tally: proposals.map((item) => item.tally).reduce(addTallies, tallyResults([])),
    clauseIds: proposals.map((item) => item.clauseId),
  };
}

export function packageViews(state: AppState): PackageView[] {
  return state.packages.map((pkg) => packageView(state, pkg));
}

// --------------------------------------------------------------- comparison

export interface ClauseComparison {
  clauseId: string;
  title: string;
  ordinal: number;
  clauseType: ClauseType;
  originalText: string;
  currentText: string;
  nonNegotiable: boolean;
  /** How the clause scores as it currently stands, before any pending choice. */
  baselineConstraints: readonly ConstraintResult[];
  baselineTally: ConstraintTally;
  /** Every staged proposal for this clause, in staging order. */
  proposals: readonly ProposalView[];
  governingEditId: string | null;
  decisionStatus: DecisionStatus | "none";
}

/**
 * One row per clause that has at least one staged proposal, so the comparison
 * surface can put competing alternatives side by side against the clause as it
 * currently reads.
 */
export function clauseComparisons(state: AppState): ClauseComparison[] {
  const byClause = new Map<string, ProposalView[]>();
  for (const view of proposalViews(state)) {
    const bucket = byClause.get(view.clauseId);
    if (bucket === undefined) byClause.set(view.clauseId, [view]);
    else bucket.push(view);
  }

  const rows: ClauseComparison[] = [];
  for (const [clauseId, proposals] of byClause) {
    const clause: Clause | null = findClause(state, clauseId);
    const currentText = clause === null ? "" : effectiveClauseText(state, clauseId);
    const clauseType: ClauseType = clause?.clauseType ?? "other";
    const baselineConstraints = evaluateConstraints(state.constraints, clauseType, currentText);
    const governing = governingEdit(state, clauseId);

    rows.push({
      clauseId,
      title: clause?.title ?? clauseId,
      ordinal: clause?.ordinal ?? 0,
      clauseType,
      originalText: clause?.text ?? "",
      currentText,
      nonNegotiable: isNonNegotiable(state, clauseId),
      baselineConstraints,
      baselineTally: tallyResults(baselineConstraints),
      proposals,
      governingEditId: governing?.editId ?? null,
      decisionStatus:
        governing !== null
          ? governing.status
          : proposals.some((item) => item.status === "pending")
            ? "pending"
            : proposals.length === 0
              ? "none"
              : "rejected",
    });
  }

  // Document order, with stale proposals (ordinal 0) last.
  return rows.sort((a, b) => (a.ordinal || Number.MAX_SAFE_INTEGER) - (b.ordinal || Number.MAX_SAFE_INTEGER));
}

// ------------------------------------------------------------ board summary

export interface BoardConstraintStatus {
  constraint: Constraint;
  /** The clause the rule read, or `null` when the document has none of that type. */
  clauseId: string | null;
  clauseTitle: string | null;
  result: ConstraintResult | null;
}

/**
 * Where every constraint on the board stands against the agreement as it
 * currently reads.
 *
 * A rule reads one clause type. When the document holds more than one clause of
 * that type the first in document order is used, and the row names which clause
 * that was, so the verdict is always traceable to the text it came from.
 */
export function boardStatuses(state: AppState): BoardConstraintStatus[] {
  return state.constraints.map((constraint) => {
    const ruleClauseType = constraintClauseType(constraint);
    const clause =
      ruleClauseType === null
        ? undefined
        : state.revision.clauses.find((item) => item.clauseType === ruleClauseType);

    if (clause === undefined) {
      return { constraint, clauseId: null, clauseTitle: null, result: null };
    }

    const [result] = evaluateConstraints(
      [constraint],
      clause.clauseType,
      effectiveClauseText(state, clause.id),
    );

    return {
      constraint,
      clauseId: clause.id,
      clauseTitle: clause.title,
      result: result ?? null,
    };
  });
}

/** Factual counts for the objective board header. */
export function boardTally(state: AppState): ConstraintTally {
  return tallyResults(
    boardStatuses(state)
      .map((status) => status.result)
      .filter((result): result is ConstraintResult => result !== null),
  );
}

/** Clauses the human locked that nonetheless have a staged proposal. */
export function lockedClausesWithProposals(state: AppState): string[] {
  return [
    ...new Set(
      state.edits
        .filter((edit) => isNonNegotiable(state, edit.clauseId))
        .map((edit) => edit.clauseId),
    ),
  ];
}
