import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { effectiveClauseText } from "@/core/state";
import type { AppState, ClauseType, PartyRole, PriorityTag } from "@/core/types";
import type {
  NegotiationContextInput,
  RedlineEditInput,
  StageRedlineInput,
} from "@/core/handlers";

/**
 * Prefills for the golden-path demo.
 *
 * These build the *inputs* an agent would send, so the demo can be driven from
 * the labeled local test console when no WebMCP agent is attached. The
 * replacement text comes straight from the fictional fallback library — nothing
 * is generated here, and the same handlers do the work either way.
 */

export const GOLDEN_PATH_CLAUSE_TYPES: readonly ClauseType[] = [
  "liability",
  "termination",
  "data_retention",
];

export const GOLDEN_PATH_PRIORITIES: readonly string[] = ["termination", "data retention"];

export const CUSTOMER_BASELINE_LABEL = "Customer Baseline";

/** Priority the demo attaches to each clause type, mirroring the brief's script. */
const DEMO_PRIORITY: Readonly<Record<string, PriorityTag>> = {
  liability: "required",
  data_retention: "required",
  termination: "preferred",
};

export function clauseIdsOfTypes(
  state: AppState,
  types: readonly ClauseType[],
): string[] {
  return types
    .map((type) => state.revision.clauses.find((clause) => clause.clauseType === type)?.id)
    .filter((id): id is string => id !== undefined);
}

export function buildContextInput(state: AppState): NegotiationContextInput {
  const selected =
    state.selectedClauseIds.length > 0
      ? [...state.selectedClauseIds]
      : clauseIdsOfTypes(state, GOLDEN_PATH_CLAUSE_TYPES);

  return {
    clauseIds: selected,
    partyRole: state.partyRole,
    priorityAreas:
      state.priorityAreas.length > 0 ? [...state.priorityAreas] : [...GOLDEN_PATH_PRIORITIES],
  };
}

/**
 * Builds the three-clause Customer Baseline package from library text.
 *
 * Returns null when the active document has none of the demo clause types — a
 * pasted agreement, for instance — rather than inventing wording to fill the gap.
 */
export function buildBaselinePackage(
  state: AppState,
  role: PartyRole = state.partyRole,
): StageRedlineInput | null {
  const edits: RedlineEditInput[] = [];

  for (const type of GOLDEN_PATH_CLAUSE_TYPES) {
    const clause = state.revision.clauses.find((item) => item.clauseType === type);
    if (clause === undefined) continue;

    // Prefer the reviewer's own posture, fall back to neutral, never the other side's.
    const entry =
      FALLBACK_LIBRARY.find((item) => item.clauseType === type && item.role === role) ??
      FALLBACK_LIBRARY.find((item) => item.clauseType === type && item.role === "neutral");
    if (entry === undefined) continue;

    // A library entry identical to the current text would be a rejected no-op.
    if (entry.text.trim() === effectiveClauseText(state, clause.id).trim()) continue;

    edits.push({
      clauseId: clause.id,
      replacementText: entry.text,
      rationale: `${entry.label} — ${entry.note} (source: ${entry.source})`,
      priorityTag: DEMO_PRIORITY[type] ?? "optional",
    });
  }

  if (edits.length === 0) return null;

  return {
    packageLabel: role === "customer" ? CUSTOMER_BASELINE_LABEL : `${roleLabel(role)} Baseline`,
    edits,
  };
}

function roleLabel(role: PartyRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
