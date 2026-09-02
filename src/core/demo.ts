import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { effectiveClauseText } from "@/core/state";
import type { ConstraintDraft } from "@/core/constraints";
import type {
  AppState,
  ClauseType,
  DemoSetup,
  PartyRole,
  PriorityTag,
} from "@/core/types";
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

// -------------------------------------------------------------- golden path

/** Clause the golden path marks non-negotiable. */
export const GOLDEN_PATH_NON_NEGOTIABLE: readonly ClauseType[] = ["liability"];

/**
 * The constraints the guided demo puts on the board.
 *
 * Two Musts drive the walkthrough; the Prefer and the Avoid are there because a
 * board that only ever reports success would be a worse demonstration than one
 * that honestly shows a stated objective no staged alternative meets.
 */
export const GOLDEN_PATH_CONSTRAINTS: readonly ConstraintDraft[] = [
  { ruleId: "data_deletion_within_days", severity: "must", value: 30, note: "Exit has to be clean and time-bound." },
  { ruleId: "termination_notice_min_days", severity: "must", value: 30, note: "We need warning before service stops." },
  { ruleId: "non_renewal_notice_max_days", severity: "prefer", value: 30, note: null },
  { ruleId: "no_automatic_renewal", severity: "avoid", value: null, note: null },
  { ruleId: "manual_review_only", severity: "must", value: null, note: "Counsel reads liability, not a rule." },
];

export const GOLDEN_PATH_OBJECTIVE_NOTE =
  "Reviewing as the customer. Liability is off the table for automated handling — it goes to a person. " +
  "Termination and data retention are where we want movement.";

export const GOLDEN_PATH_SETUP_LABEL =
  "Applied the demo setup: Customer, Liability locked, Termination and Data retention prioritised";

/**
 * The one-click reviewer configuration the brief's walkthrough starts from:
 * negotiating as the Customer, Liability locked, Termination and Data retention
 * prioritised, and all three clauses selected for the agent.
 *
 * Built from the *active* revision, so pasted text simply yields whichever of
 * those clause types it actually has instead of dangling IDs.
 */
export function goldenPathSetup(state: AppState): DemoSetup {
  return {
    partyRole: "customer",
    selectedClauseIds: clauseIdsOfTypes(state, GOLDEN_PATH_CLAUSE_TYPES),
    nonNegotiableClauseIds: clauseIdsOfTypes(state, GOLDEN_PATH_NON_NEGOTIABLE),
    priorityAreas: [...GOLDEN_PATH_PRIORITIES],
    constraints: GOLDEN_PATH_CONSTRAINTS.map((draft) => ({ ...draft })),
    objectiveNote: GOLDEN_PATH_OBJECTIVE_NOTE,
  };
}

export type DemoStepId =
  | "load"
  | "setup"
  | "context"
  | "stage"
  | "decide"
  | "export";

export interface DemoStep {
  id: DemoStepId;
  label: string;
  hint: string;
  done: boolean;
}

/**
 * The in-product checklist.
 *
 * Every step is *derived* from real state — a tool result actually recorded, a
 * package actually staged, a decision actually taken. Nothing here is a scripted
 * animation, so a step can only tick when the underlying operation really ran.
 */
export function goldenPathSteps(state: AppState): DemoStep[] {
  const setup = goldenPathSetup(state);
  const has = (list: readonly string[], ids: readonly string[]) =>
    ids.length > 0 && ids.every((id) => list.includes(id));

  const setupDone =
    state.partyRole === setup.partyRole &&
    has(state.selectedClauseIds, setup.selectedClauseIds) &&
    has(state.nonNegotiableClauseIds, setup.nonNegotiableClauseIds) &&
    GOLDEN_PATH_PRIORITIES.every((area) => state.priorityAreas.includes(area));

  const contextDone = state.activity.some(
    (entry) => entry.tool === "get_negotiation_context" && entry.kind === "tool-result",
  );

  const decided = state.edits.filter((edit) => edit.status !== "pending");

  return [
    {
      id: "load",
      label: "Open the fictional agreement",
      hint: "Northstar SaaS Services Agreement — Fictional Demo",
      done: state.revision.clauses.length > 0,
    },
    {
      id: "setup",
      label: "Set your posture",
      hint: "Customer · Liability locked · Termination and Data retention prioritised",
      done: setupDone,
    },
    {
      id: "context",
      label: "Retrieve clause context",
      hint: "get_negotiation_context returns exact text and fictional fallbacks",
      done: contextDone,
    },
    {
      id: "stage",
      label: "Stage the Customer Baseline",
      hint: "stage_redline_package proposes three redlines; nothing is applied yet",
      done: state.packages.length > 0,
    },
    {
      id: "decide",
      label: "Approve, edit, reject",
      hint: "Each redline is decided independently, with an optional note",
      done: state.edits.length > 0 && decided.length === state.edits.length,
    },
    {
      id: "export",
      label: "Preview and download",
      hint: "Deterministic negotiation brief and redlined Markdown",
      done: state.activity.some((entry) => entry.kind === "export"),
    },
  ];
}
