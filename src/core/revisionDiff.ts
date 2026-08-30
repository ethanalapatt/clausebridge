import { diffStats, diffWords } from "@/core/diff";
import type { DiffStats } from "@/core/diff";
import type { AppState, Clause, DocumentRevision } from "@/core/types";

/**
 * Comparing the agreement as it stands against the wording it started from.
 *
 * The redline diff answers "what is this proposal changing?". This answers the
 * different question a reviewer asks before sending anything back: "across the
 * whole document, what have I actually agreed to so far?" It is computed from
 * approved decisions only, so pending and rejected proposals never appear.
 */

export type ClauseChangeKind = "unchanged" | "amended" | "added" | "removed";

export interface ClauseComparison {
  clauseId: string;
  title: string;
  ordinal: number;
  kind: ClauseChangeKind;
  baselineText: string;
  currentText: string;
  stats: DiffStats | null;
}

export interface RevisionComparison {
  baselineRevisionId: string;
  currentRevisionId: string;
  clauses: readonly ClauseComparison[];
  amendedCount: number;
  addedCount: number;
  removedCount: number;
  totalWordsAdded: number;
  totalWordsRemoved: number;
}

function textOf(clause: Clause): string {
  return clause.text;
}

/**
 * Compares a baseline revision against the current agreement.
 *
 * Clauses are matched by ID first. A revision retires every ID, so when that
 * finds nothing the comparison falls back to matching on title — otherwise a
 * re-segmented document would report every clause as simultaneously removed and
 * added, which tells the reviewer nothing.
 */
export function compareRevisions(
  state: AppState,
  baseline: DocumentRevision,
  currentTextOf: (clauseId: string) => string,
): RevisionComparison {
  const current = state.revision;
  const comparisons: ClauseComparison[] = [];

  const baselineById = new Map(baseline.clauses.map((clause) => [clause.id, clause]));
  const baselineByTitle = new Map(
    baseline.clauses.map((clause) => [clause.title.trim().toLowerCase(), clause]),
  );
  const matched = new Set<string>();

  for (const clause of current.clauses) {
    const previous =
      baselineById.get(clause.id) ?? baselineByTitle.get(clause.title.trim().toLowerCase());

    const currentText = currentTextOf(clause.id);

    if (previous === undefined) {
      comparisons.push({
        clauseId: clause.id,
        title: clause.title,
        ordinal: clause.ordinal,
        kind: "added",
        baselineText: "",
        currentText,
        stats: null,
      });
      continue;
    }

    matched.add(previous.id);
    const baselineText = textOf(previous);

    if (baselineText === currentText) {
      comparisons.push({
        clauseId: clause.id,
        title: clause.title,
        ordinal: clause.ordinal,
        kind: "unchanged",
        baselineText,
        currentText,
        stats: null,
      });
      continue;
    }

    comparisons.push({
      clauseId: clause.id,
      title: clause.title,
      ordinal: clause.ordinal,
      kind: "amended",
      baselineText,
      currentText,
      stats: diffStats(diffWords(baselineText, currentText)),
    });
  }

  for (const clause of baseline.clauses) {
    if (matched.has(clause.id)) continue;
    comparisons.push({
      clauseId: clause.id,
      title: clause.title,
      ordinal: clause.ordinal,
      kind: "removed",
      baselineText: textOf(clause),
      currentText: "",
      stats: null,
    });
  }

  const amended = comparisons.filter((item) => item.kind === "amended");

  return {
    baselineRevisionId: baseline.revisionId,
    currentRevisionId: current.revisionId,
    clauses: comparisons,
    amendedCount: amended.length,
    addedCount: comparisons.filter((item) => item.kind === "added").length,
    removedCount: comparisons.filter((item) => item.kind === "removed").length,
    totalWordsAdded: amended.reduce((sum, item) => sum + (item.stats?.wordsAdded ?? 0), 0),
    totalWordsRemoved: amended.reduce((sum, item) => sum + (item.stats?.wordsRemoved ?? 0), 0),
  };
}
