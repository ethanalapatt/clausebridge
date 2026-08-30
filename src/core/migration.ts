import { findClause, isEditStale } from "@/core/state";
import type { AppState, Clause, StagedEdit } from "@/core/types";

/**
 * Carrying staged redlines across a document revision.
 *
 * Revising a document retires every clause ID, which strands any redline staged
 * against the old revision. Rather than silently reattaching them — which could
 * point a proposal at wording it was never written for — this proposes matches
 * and makes the human confirm.
 *
 * Matching is deliberately conservative. A redline captured the *exact* clause
 * text it was drafted against, so an unchanged body is strong evidence of the
 * same clause; a matching title and type is weaker and is offered separately.
 * Anything less confident is left stale.
 */

export type MigrationConfidence = "exact-text" | "title-and-type";

export interface MigrationCandidate {
  editId: string;
  /** The retired clause ID the edit was staged against. */
  fromClauseId: string;
  /** Clause in the active revision the edit would move to. */
  toClauseId: string;
  toClauseTitle: string;
  confidence: MigrationConfidence;
  /**
   * True when the target's current text differs from what the redline was
   * drafted against, so the human is re-approving against changed wording.
   */
  textChanged: boolean;
}

export interface MigrationPlan {
  candidates: readonly MigrationCandidate[];
  /** Stale edits with no confident match; these stay stale. */
  unmatchedEditIds: readonly string[];
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function matchFor(edit: StagedEdit, clauses: readonly Clause[]): MigrationCandidate | null {
  const original = normalize(edit.originalText);

  const exact = clauses.find((clause) => normalize(clause.text) === original);
  if (exact !== undefined) {
    return {
      editId: edit.editId,
      fromClauseId: edit.clauseId,
      toClauseId: exact.id,
      toClauseTitle: exact.title,
      confidence: "exact-text",
      textChanged: false,
    };
  }

  return null;
}

/**
 * Proposes where each stale redline could move in the active revision.
 *
 * A target is claimed by at most one edit, so two stale redlines can never both
 * migrate onto the same clause and silently fight over it.
 */
export function planMigration(state: AppState, titles?: ReadonlyMap<string, string>): MigrationPlan {
  const stale = state.edits.filter((edit) => isEditStale(state, edit));
  const claimed = new Set<string>();
  const candidates: MigrationCandidate[] = [];
  const unmatched: string[] = [];

  // Exact-text matches first, so they win a contested target over weaker ones.
  for (const edit of stale) {
    const available = state.revision.clauses.filter((clause) => !claimed.has(clause.id));
    const match = matchFor(edit, available);
    if (match !== null) {
      claimed.add(match.toClauseId);
      candidates.push(match);
    }
  }

  for (const edit of stale) {
    if (candidates.some((candidate) => candidate.editId === edit.editId)) continue;

    // Weaker fallback: the retired clause's remembered title and type still
    // identify exactly one unclaimed clause in the new revision.
    const rememberedTitle = titles?.get(edit.clauseId);
    if (rememberedTitle !== undefined) {
      const byTitle = state.revision.clauses.filter(
        (clause) => !claimed.has(clause.id) && normalize(clause.title) === normalize(rememberedTitle),
      );
      if (byTitle.length === 1) {
        const target = byTitle[0]!;
        claimed.add(target.id);
        candidates.push({
          editId: edit.editId,
          fromClauseId: edit.clauseId,
          toClauseId: target.id,
          toClauseTitle: target.title,
          confidence: "title-and-type",
          textChanged: normalize(target.text) !== normalize(edit.originalText),
        });
        continue;
      }
    }

    unmatched.push(edit.editId);
  }

  return { candidates, unmatchedEditIds: unmatched };
}

/**
 * Applies chosen migrations.
 *
 * A migrated redline is re-pointed at the new clause ID and its captured
 * original text is refreshed to the target's current wording, so the diff the
 * human sees is against what the document actually says now. Any decision
 * already taken is reset to pending: approving wording under the old revision
 * is not consent to the same change against different text.
 */
export function applyMigration(
  state: AppState,
  candidates: readonly MigrationCandidate[],
): { state: AppState; migratedEditIds: readonly string[] } {
  const byEdit = new Map(candidates.map((candidate) => [candidate.editId, candidate]));
  const migrated: string[] = [];

  const edits = state.edits.map((edit) => {
    const candidate = byEdit.get(edit.editId);
    if (candidate === undefined) return edit;

    const target = findClause(state, candidate.toClauseId);
    if (target === null) return edit;

    migrated.push(edit.editId);
    return {
      ...edit,
      clauseId: target.id,
      originalText: target.text,
      status: "pending" as const,
      humanText: null,
    };
  });

  if (migrated.length === 0) return { state, migratedEditIds: [] };
  return { state: { ...state, edits }, migratedEditIds: migrated };
}
