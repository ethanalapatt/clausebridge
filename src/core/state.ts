import type { Constraint, ConstraintRuleId, ConstraintSeverity } from "@/core/constraints";
import { CONSTRAINT_SEVERITIES, CONSTRAINT_SEVERITY_LABELS, findRule } from "@/core/constraints";
import { checkpointId, constraintId, eventId, toolCallId } from "@/core/ids";
import { applyMigration } from "@/core/migration";
import type { MigrationCandidate } from "@/core/migration";
import { buildSeedRevision, reviseDocument, segmentPastedText } from "@/core/segmentation";
import type { ClauseDraft } from "@/core/segmentation";
import type {
  ActivityEntry,
  ActivityKind,
  AppState,
  Checkpoint,
  CheckpointDecision,
  Clause,
  DecisionStatus,
  DemoSetup,
  DocumentRevision,
  ExportKind,
  InvocationSource,
  PartyRole,
  StagedEdit,
  ToolCallRecord,
  ToolName,
  WebMcpStatus,
} from "@/core/types";
import { EXPORT_KIND_LABELS } from "@/core/types";

/**
 * Application state and its transitions.
 *
 * Everything here is pure. Timestamps are passed in by the caller (`at`) rather
 * than read from the clock, so tests can assert on exact output and the Markdown
 * exports are reproducible.
 */

export function createInitialState(revision: DocumentRevision = buildSeedRevision()): AppState {
  return {
    revision,
    partyRole: "customer",
    selectedClauseIds: [],
    nonNegotiableClauseIds: [],
    priorityAreas: [],
    constraints: [],
    constraintSeq: 0,
    objectiveNote: "",
    focusedClauseId: null,
    focusPulse: 0,
    packages: [],
    edits: [],
    activity: [],
    toolCalls: [],
    checkpoints: [],
    seq: 0,
    webmcpStatus: { kind: "checking" },
  };
}

// ---------------------------------------------------------------- selectors

export function findClause(state: AppState, clauseId: string): Clause | null {
  return state.revision.clauses.find((clause) => clause.id === clauseId) ?? null;
}

/** True when a clause ID belonged to an earlier revision of this document. */
export function isStaleClauseId(state: AppState, clauseId: string): boolean {
  return Object.prototype.hasOwnProperty.call(state.revision.retiredClauseIds, clauseId);
}

/** An edit whose clause no longer exists in the active revision. */
export function isEditStale(state: AppState, edit: StagedEdit): boolean {
  return findClause(state, edit.clauseId) === null;
}

export function editsForClause(state: AppState, clauseId: string): StagedEdit[] {
  return state.edits.filter((edit) => edit.clauseId === clauseId);
}

/**
 * The edit that currently governs a clause: the most recently staged one that
 * the human has approved outright or approved with edits.
 */
export function governingEdit(state: AppState, clauseId: string): StagedEdit | null {
  const accepted = state.edits.filter(
    (edit) =>
      edit.clauseId === clauseId && (edit.status === "approved" || edit.status === "edited"),
  );
  return accepted[accepted.length - 1] ?? null;
}

/** Text a clause reads as right now. Falls back to the untouched source text. */
export function effectiveClauseText(state: AppState, clauseId: string): string {
  const clause = findClause(state, clauseId);
  if (clause === null) return "";

  const governing = governingEdit(state, clauseId);
  if (governing === null) return clause.text;
  return acceptedTextOf(governing);
}

/** The wording an accepted edit actually contributes. */
export function acceptedTextOf(edit: StagedEdit): string {
  return edit.status === "edited" && edit.humanText !== null ? edit.humanText : edit.proposedText;
}

/** Aggregate decision status shown next to a clause in the outline. */
export function clauseDecisionStatus(state: AppState, clauseId: string): DecisionStatus | "none" {
  const edits = editsForClause(state, clauseId);
  if (edits.length === 0) return "none";

  const governing = governingEdit(state, clauseId);
  if (governing !== null) return governing.status;
  if (edits.some((edit) => edit.status === "pending")) return "pending";
  return "rejected";
}

export function findEdit(state: AppState, editId: string): StagedEdit | null {
  return state.edits.find((edit) => edit.editId === editId) ?? null;
}

export function isSelected(state: AppState, clauseId: string): boolean {
  return state.selectedClauseIds.includes(clauseId);
}

export function isNonNegotiable(state: AppState, clauseId: string): boolean {
  return state.nonNegotiableClauseIds.includes(clauseId);
}

export function findConstraint(state: AppState, id: string): Constraint | null {
  return state.constraints.find((constraint) => constraint.id === id) ?? null;
}

export function findCheckpoint(state: AppState, id: string): Checkpoint | null {
  return state.checkpoints.find((checkpoint) => checkpoint.id === id) ?? null;
}

/** What every clause in the active revision currently reads as. */
export function effectiveTextMap(state: AppState): Record<string, string> {
  const map: Record<string, string> = {};
  for (const clause of state.revision.clauses) {
    map[clause.id] = effectiveClauseText(state, clause.id);
  }
  return map;
}

function sameTextMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/** A short, deterministic rendering of a clause body for the timeline. */
export function textPreview(value: string, max = 120): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * Records a preview revision whenever a human decision changes what the
 * agreement reads as.
 *
 * A checkpoint stores both the resulting text and the decisions that produced
 * it, so restoring one replays those decisions rather than overwriting clause
 * text. The source agreement is never captured here because it never changes.
 */
function withCheckpoint(
  previous: AppState,
  next: AppState,
  at: string,
  label: string,
): AppState {
  const after = effectiveTextMap(next);
  if (sameTextMap(effectiveTextMap(previous), after)) return next;

  const decisions: CheckpointDecision[] = next.edits.map((edit) => ({
    editId: edit.editId,
    status: edit.status,
    humanText: edit.humanText,
  }));

  const checkpoint: Checkpoint = {
    id: checkpointId(next.checkpoints.length + 1),
    seq: next.seq,
    at,
    label,
    revisionId: next.revision.revisionId,
    clauseTexts: after,
    decisions,
  };

  return { ...next, checkpoints: [...next.checkpoints, checkpoint] };
}

/**
 * Enforces one governing proposal per clause.
 *
 * Two accepted proposals for the same clause have no defined precedence, so
 * accepting one returns any rival to *awaiting decision*. The alternative stays
 * staged and comparable — it is deliberately not rejected on the human's behalf.
 */
function demoteRivals(
  edits: readonly StagedEdit[],
  winnerId: string,
  clauseId: string,
): StagedEdit[] {
  return edits.map((edit) =>
    edit.editId !== winnerId &&
    edit.clauseId === clauseId &&
    (edit.status === "approved" || edit.status === "edited")
      ? { ...edit, status: "pending" as DecisionStatus, humanText: null }
      : edit,
  );
}

/** IDs of accepted proposals on the same clause that a new acceptance displaces. */
function rivalEditIds(state: AppState, edit: StagedEdit): string[] {
  return state.edits
    .filter(
      (other) =>
        other.editId !== edit.editId &&
        other.clauseId === edit.clauseId &&
        (other.status === "approved" || other.status === "edited"),
    )
    .map((other) => other.editId);
}

function displacementDetail(displaced: readonly string[]): string | null {
  if (displaced.length === 0) return null;
  return (
    `Returned ${displaced.length} competing proposal(s) on the same clause to awaiting ` +
    `decision so one choice governs it: ${displaced.join(", ")}.`
  );
}

// ----------------------------------------------------------------- activity

export interface ActivityInput {
  source: InvocationSource;
  kind: ActivityKind;
  tool?: ToolName | null;
  summary: string;
  detail?: string | null;
  clauseIds?: readonly string[];
  packageIds?: readonly string[];
  before?: string | null;
  after?: string | null;
}

/**
 * Appends an audit entry and advances the deterministic sequence counter.
 *
 * The entry carries the clause and package IDs it touched and a before/after
 * pair, so the timeline can focus what an event affected and show what changed
 * without re-deriving it from the summary prose.
 */
export function withActivity(state: AppState, at: string, input: ActivityInput): AppState {
  const seq = state.seq + 1;
  const entry: ActivityEntry = {
    id: eventId(seq),
    seq,
    at,
    source: input.source,
    kind: input.kind,
    tool: input.tool ?? null,
    summary: input.summary,
    detail: input.detail ?? null,
    clauseIds: input.clauseIds ?? [],
    packageIds: input.packageIds ?? [],
    before: input.before ?? null,
    after: input.after ?? null,
    revisionId: state.revision.revisionId,
  };
  return { ...state, seq, activity: [...state.activity, entry] };
}

/**
 * Attaches the full provenance of a handler invocation to the entry that just
 * recorded its outcome.
 *
 * Call this immediately after `withActivity`, so `state.seq` is the outcome
 * entry's sequence and the timeline and the inspector agree about which call
 * they are describing.
 */
export function withToolCall(
  state: AppState,
  record: Omit<ToolCallRecord, "id" | "seq">,
): AppState {
  const entry: ToolCallRecord = {
    ...record,
    id: toolCallId(state.toolCalls.length + 1),
    seq: state.seq,
  };
  return { ...state, toolCalls: [...state.toolCalls, entry] };
}

// ------------------------------------------------------------------ actions

export type Action =
  | { type: "set-role"; role: PartyRole }
  | { type: "toggle-selected"; clauseId: string }
  | { type: "clear-selection" }
  | { type: "toggle-non-negotiable"; clauseId: string }
  | { type: "set-priority-areas"; areas: readonly string[] }
  | { type: "focus-clause"; clauseId: string | null }
  | { type: "load-seed" }
  | { type: "load-pasted"; text: string; title?: string }
  | { type: "revise-document"; drafts: readonly ClauseDraft[]; label: string }
  | { type: "approve-edit"; editId: string }
  | { type: "reject-edit"; editId: string }
  | { type: "edit-replacement"; editId: string; text: string }
  | { type: "reset-edit"; editId: string }
  | { type: "set-note"; editId: string; note: string | null }
  | { type: "apply-demo-setup"; setup: DemoSetup; label: string }
  | { type: "migrate-edits"; candidates: readonly MigrationCandidate[] }
  | { type: "decide-package"; packageId: string; decision: "approved" | "rejected" }
  | { type: "record-export"; kind: ExportKind; filename: string }
  | {
      type: "add-constraint";
      ruleId: ConstraintRuleId;
      severity: ConstraintSeverity;
      value: number | null;
      note?: string | null;
    }
  | { type: "remove-constraint"; constraintId: string }
  | {
      type: "update-constraint";
      constraintId: string;
      severity?: ConstraintSeverity;
      value?: number | null;
      note?: string | null;
    }
  | { type: "set-objective-note"; note: string }
  | { type: "restore-checkpoint"; checkpointId: string }
  | { type: "set-webmcp-status"; status: WebMcpStatus };

/**
 * Actions after which the agreement may read differently, so a preview revision
 * is recorded. Restoring a checkpoint is excluded: it reproduces a state the
 * timeline already holds.
 */
const CHECKPOINTING: ReadonlySet<Action["type"]> = new Set([
  "approve-edit",
  "reject-edit",
  "edit-replacement",
  "reset-edit",
  "decide-package",
  "migrate-edits",
]);

/** Actions that change nothing a human would want to undo. */
const NON_UNDOABLE: ReadonlySet<Action["type"]> = new Set([
  "focus-clause",
  "set-webmcp-status",
  // An export reads state and writes a file; it changes nothing to step back to.
  // It is still recorded, so the log shows what left the browser.
  "record-export",
]);

export function isUndoable(action: Action): boolean {
  return !NON_UNDOABLE.has(action.type);
}

function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function updateEdit(
  state: AppState,
  editId: string,
  update: (edit: StagedEdit) => StagedEdit,
): readonly StagedEdit[] {
  return state.edits.map((edit) => (edit.editId === editId ? update(edit) : edit));
}

function describeEdit(state: AppState, editId: string): string {
  const edit = findEdit(state, editId);
  if (edit === null) return editId;
  const clause = findClause(state, edit.clauseId);
  return clause === null ? edit.clauseId : `${clause.title} (${clause.id})`;
}

function reduceInner(state: AppState, action: Action, at: string): AppState {
  switch (action.type) {
    case "set-role":
      if (state.partyRole === action.role) return state;
      return withActivity({ ...state, partyRole: action.role }, at, {
        source: "ui",
        kind: "settings",
        summary: `Party role set to ${action.role}`,
      });

    case "toggle-selected": {
      if (findClause(state, action.clauseId) === null) return state;
      const next = toggle(state.selectedClauseIds, action.clauseId);
      return withActivity({ ...state, selectedClauseIds: next }, at, {
        source: "ui",
        kind: "settings",
        summary: next.includes(action.clauseId)
          ? `Selected ${action.clauseId}`
          : `Deselected ${action.clauseId}`,
      });
    }

    case "clear-selection":
      if (state.selectedClauseIds.length === 0) return state;
      return withActivity({ ...state, selectedClauseIds: [] }, at, {
        source: "ui",
        kind: "settings",
        summary: "Cleared clause selection",
      });

    case "toggle-non-negotiable": {
      if (findClause(state, action.clauseId) === null) return state;
      const next = toggle(state.nonNegotiableClauseIds, action.clauseId);
      return withActivity({ ...state, nonNegotiableClauseIds: next }, at, {
        source: "ui",
        kind: "settings",
        summary: next.includes(action.clauseId)
          ? `Marked ${action.clauseId} non-negotiable`
          : `Cleared non-negotiable on ${action.clauseId}`,
      });
    }

    case "set-priority-areas": {
      const areas = action.areas.map((area) => area.trim()).filter((area) => area.length > 0);
      return withActivity({ ...state, priorityAreas: areas }, at, {
        source: "ui",
        kind: "settings",
        summary:
          areas.length === 0 ? "Cleared priority areas" : `Priority areas: ${areas.join(", ")}`,
      });
    }

    case "focus-clause":
      return {
        ...state,
        focusedClauseId: action.clauseId,
        focusPulse: action.clauseId === null ? state.focusPulse : state.focusPulse + 1,
      };

    case "load-seed": {
      const fresh = createInitialState(buildSeedRevision());
      return withActivity(
        { ...fresh, seq: state.seq, activity: state.activity, webmcpStatus: state.webmcpStatus },
        at,
        {
          source: "ui",
          kind: "document",
          summary: "Loaded Northstar SaaS Services Agreement — Fictional Demo",
          detail: "Seeded fictional agreement, revision NSA-r1. All prior staging cleared.",
        },
      );
    }

    case "load-pasted": {
      const revision = segmentPastedText(action.text, { documentTitle: action.title });
      const fresh = createInitialState(revision);
      return withActivity(
        { ...fresh, seq: state.seq, activity: state.activity, webmcpStatus: state.webmcpStatus },
        at,
        {
          source: "ui",
          kind: "document",
          summary: `Segmented pasted text into ${revision.clauses.length} clause(s)`,
          detail:
            revision.segmentationConfidence === "low"
              ? "Low-confidence segmentation: no explicit headings found. Review clause boundaries before using the tools."
              : `Revision ${revision.revisionId}, segmented on explicit headings.`,
        },
      );
    }

    case "revise-document": {
      const revision = reviseDocument(state.revision, action.drafts);
      // Selections and non-negotiables are keyed by clause ID, and every ID has
      // just been retired, so they cannot survive the revision.
      return withActivity(
        {
          ...state,
          revision,
          selectedClauseIds: [],
          nonNegotiableClauseIds: [],
          focusedClauseId: null,
        },
        at,
        {
          source: "ui",
          kind: "document",
          summary: `${action.label} — now revision ${revision.revisionId}`,
          detail: `All ${state.revision.clauses.length} clause ID(s) from ${state.revision.revisionId} are retired. Staged edits referencing them are marked stale.`,
        },
      );
    }

    case "approve-edit": {
      const edit = findEdit(state, action.editId);
      if (edit === null || edit.status === "approved") return state;
      const label = describeEdit(state, action.editId);
      const displaced = rivalEditIds(state, edit);

      return withActivity(
        {
          ...state,
          edits: demoteRivals(
            updateEdit(state, action.editId, (current) => ({
              ...current,
              status: "approved",
              humanText: null,
            })),
            edit.editId,
            edit.clauseId,
          ),
        },
        at,
        {
          source: "ui",
          kind: "decision",
          summary: `Approved redline on ${label}`,
          detail: displacementDetail(displaced),
          clauseIds: [edit.clauseId],
          packageIds: [edit.packageId],
          before: textPreview(effectiveClauseText(state, edit.clauseId)),
          after: textPreview(edit.proposedText),
        },
      );
    }

    case "reject-edit": {
      const edit = findEdit(state, action.editId);
      if (edit === null || edit.status === "rejected") return state;
      const label = describeEdit(state, action.editId);
      const next: AppState = {
        ...state,
        edits: updateEdit(state, action.editId, (current) => ({
          ...current,
          status: "rejected",
          humanText: null,
        })),
      };

      return withActivity(next, at, {
        source: "ui",
        kind: "decision",
        summary: `Rejected redline on ${label}`,
        clauseIds: [edit.clauseId],
        packageIds: [edit.packageId],
        before: textPreview(effectiveClauseText(state, edit.clauseId)),
        after: textPreview(effectiveClauseText(next, edit.clauseId)),
      });
    }

    case "edit-replacement": {
      const edit = findEdit(state, action.editId);
      if (edit === null) return state;
      const text = action.text.trim();
      if (text.length === 0) return state;
      const label = describeEdit(state, action.editId);
      const displaced = rivalEditIds(state, edit);

      return withActivity(
        {
          ...state,
          edits: demoteRivals(
            updateEdit(state, action.editId, (current) => ({
              ...current,
              status: "edited",
              humanText: text,
            })),
            edit.editId,
            edit.clauseId,
          ),
        },
        at,
        {
          source: "ui",
          kind: "decision",
          summary: `Approved redline on ${label} with human edits`,
          detail: displacementDetail(displaced),
          clauseIds: [edit.clauseId],
          packageIds: [edit.packageId],
          before: textPreview(edit.proposedText),
          after: textPreview(text),
        },
      );
    }

    case "reset-edit": {
      const edit = findEdit(state, action.editId);
      if (edit === null || edit.status === "pending") return state;
      const label = describeEdit(state, action.editId);
      const next: AppState = {
        ...state,
        edits: updateEdit(state, action.editId, (current) => ({
          ...current,
          status: "pending",
          humanText: null,
        })),
      };

      return withActivity(next, at, {
        source: "ui",
        kind: "decision",
        summary: `Returned ${label} to awaiting decision`,
        clauseIds: [edit.clauseId],
        packageIds: [edit.packageId],
        before: textPreview(effectiveClauseText(state, edit.clauseId)),
        after: textPreview(effectiveClauseText(next, edit.clauseId)),
      });
    }

    case "set-note": {
      const edit = findEdit(state, action.editId);
      if (edit === null) return state;
      const note = action.note === null ? null : action.note.trim();
      const label = describeEdit(state, action.editId);
      return withActivity(
        {
          ...state,
          edits: updateEdit(state, action.editId, (current) => ({
            ...current,
            note: note === null || note.length === 0 ? null : note,
          })),
        },
        at,
        {
          source: "ui",
          kind: "decision",
          summary:
            note === null || note.length === 0
              ? `Cleared note on ${label}`
              : `Added note on ${label}`,
          detail: note === null || note.length === 0 ? null : note,
          clauseIds: [edit.clauseId],
          packageIds: [edit.packageId],
          before: edit.note,
          after: note === null || note.length === 0 ? null : note,
        },
      );
    }

    case "apply-demo-setup": {
      // Only IDs that exist in the active revision are accepted, so a setup built
      // for the seeded agreement cannot silently attach itself to pasted text.
      const known = (ids: readonly string[]) =>
        ids.filter((id) => findClause(state, id) !== null);
      const selectedClauseIds = known(action.setup.selectedClauseIds);
      const nonNegotiableClauseIds = known(action.setup.nonNegotiableClauseIds);
      const priorityAreas = action.setup.priorityAreas
        .map((area) => area.trim())
        .filter((area) => area.length > 0);

      // Only drafts naming a rule this build implements become constraints, and
      // a rule appears at most once so the board never holds two verdicts on the
      // same condition.
      const constraints: Constraint[] = [];
      let constraintSeq = state.constraintSeq;
      for (const draft of action.setup.constraints) {
        if (findRule(draft.ruleId) === null) continue;
        if (constraints.some((existing) => existing.ruleId === draft.ruleId)) continue;
        constraintSeq += 1;
        constraints.push({ ...draft, id: constraintId(constraintSeq) });
      }

      return withActivity(
        {
          ...state,
          partyRole: action.setup.partyRole,
          selectedClauseIds,
          nonNegotiableClauseIds,
          priorityAreas,
          constraints,
          constraintSeq,
          objectiveNote: action.setup.objectiveNote,
          focusedClauseId: null,
        },
        at,
        {
          source: "ui",
          kind: "settings",
          summary: action.label,
          detail:
            `Reviewing as ${action.setup.partyRole}. Selected ` +
            `${selectedClauseIds.length} clause(s); ` +
            `${nonNegotiableClauseIds.length} marked non-negotiable; ` +
            `${constraints.length} constraint(s); ` +
            `priorities: ${priorityAreas.length > 0 ? priorityAreas.join(", ") : "none"}.`,
          clauseIds: selectedClauseIds,
        },
      );
    }

    case "migrate-edits": {
      const outcome = applyMigration(state, action.candidates);
      if (outcome.migratedEditIds.length === 0) return state;

      return withActivity(outcome.state, at, {
        source: "ui",
        kind: "document",
        summary: `Carried ${outcome.migratedEditIds.length} staged redline(s) into ${state.revision.revisionId}`,
        detail:
          "Each migrated redline was returned to awaiting decision and re-diffed against the " +
          "current clause text.",
        clauseIds: action.candidates.map((candidate) => candidate.toClauseId),
      });
    }

    case "decide-package": {
      const pkg = state.packages.find((item) => item.packageId === action.packageId);
      if (pkg === undefined) return state;

      // Only undecided proposals move. A bulk action is a shortcut for the
      // remaining work, never a way to silently overwrite a call the human
      // already made on an individual redline.
      const targets = state.edits.filter(
        (edit) => edit.packageId === action.packageId && edit.status === "pending",
      );
      if (targets.length === 0) return state;

      const targetIds = new Set(targets.map((edit) => edit.editId));
      let edits = state.edits.map((edit) =>
        targetIds.has(edit.editId)
          ? { ...edit, status: action.decision, humanText: null }
          : edit,
      );

      // Approving in bulk must respect the same one-per-clause rule an
      // individual approval does, so a rival accepted from another package is
      // returned to awaiting decision rather than left as a second winner.
      const displaced = new Set<string>();
      if (action.decision === "approved") {
        for (const target of targets) {
          for (const id of rivalEditIds(state, target)) displaced.add(id);
          edits = demoteRivals(edits, target.editId, target.clauseId);
        }
      }

      return withActivity({ ...state, edits }, at, {
        source: "ui",
        kind: "decision",
        summary: `${action.decision === "approved" ? "Approved" : "Rejected"} ${targets.length} undecided redline(s) in “${pkg.packageLabel}”`,
        detail:
          "Redlines already approved, edited or rejected were left as they were." +
          (displaced.size === 0 ? "" : ` ${displacementDetail([...displaced])}`),
        clauseIds: targets.map((edit) => edit.clauseId),
        packageIds: [pkg.packageId],
      });
    }

    case "record-export":
      return withActivity(state, at, {
        source: "ui",
        kind: "export",
        summary: `Downloaded the ${EXPORT_KIND_LABELS[action.kind]}`,
        detail: action.filename,
      });

    case "add-constraint": {
      const rule = findRule(action.ruleId);
      if (rule === null) return state;
      if (!CONSTRAINT_SEVERITIES.includes(action.severity)) return state;
      // One verdict per condition: the board never holds two constraints that
      // read the same rule, because they could disagree about the same clause.
      if (state.constraints.some((existing) => existing.ruleId === action.ruleId)) return state;

      // A rule that takes no parameter is stored with `null`; one that does gets
      // a non-negative integer or nothing at all.
      let value: number | null = null;
      if (rule.defaultValue !== null) {
        const requested = action.value ?? rule.defaultValue;
        if (!Number.isInteger(requested) || requested < 0) return state;
        value = requested;
      }

      const note = action.note?.trim() ?? "";
      const constraintSeq = state.constraintSeq + 1;
      const constraint: Constraint = {
        id: constraintId(constraintSeq),
        ruleId: action.ruleId,
        severity: action.severity,
        value,
        note: note.length === 0 ? null : note,
      };

      return withActivity(
        { ...state, constraints: [...state.constraints, constraint], constraintSeq },
        at,
        {
          source: "ui",
          kind: "settings",
          summary: `Added ${CONSTRAINT_SEVERITY_LABELS[constraint.severity]} constraint: ${rule.label(value)}`,
          detail: `${constraint.id} · reads ${rule.clauseType.replace(/_/g, " ")} clauses · ${rule.inspects}`,
          after: rule.label(value),
        },
      );
    }

    case "remove-constraint": {
      const constraint = findConstraint(state, action.constraintId);
      if (constraint === null) return state;
      const rule = findRule(constraint.ruleId);

      return withActivity(
        {
          ...state,
          constraints: state.constraints.filter((item) => item.id !== constraint.id),
        },
        at,
        {
          source: "ui",
          kind: "settings",
          summary: `Removed constraint: ${rule?.label(constraint.value) ?? constraint.ruleId}`,
          before: rule?.label(constraint.value) ?? constraint.ruleId,
        },
      );
    }

    case "update-constraint": {
      const constraint = findConstraint(state, action.constraintId);
      if (constraint === null) return state;
      const rule = findRule(constraint.ruleId);
      if (rule === null) return state;

      const severity =
        action.severity !== undefined && CONSTRAINT_SEVERITIES.includes(action.severity)
          ? action.severity
          : constraint.severity;

      let value = constraint.value;
      if (action.value !== undefined && rule.defaultValue !== null) {
        if (action.value === null) return state;
        if (!Number.isInteger(action.value) || action.value < 0) return state;
        value = action.value;
      }

      const note =
        action.note === undefined
          ? constraint.note
          : action.note === null || action.note.trim().length === 0
            ? null
            : action.note.trim();

      const next: Constraint = { ...constraint, severity, value, note };
      if (
        next.severity === constraint.severity &&
        next.value === constraint.value &&
        next.note === constraint.note
      ) {
        return state;
      }

      return withActivity(
        {
          ...state,
          constraints: state.constraints.map((item) => (item.id === next.id ? next : item)),
        },
        at,
        {
          source: "ui",
          kind: "settings",
          summary: `Updated constraint ${next.id}`,
          detail: `${CONSTRAINT_SEVERITY_LABELS[next.severity]} — ${rule.label(next.value)}`,
          before: `${CONSTRAINT_SEVERITY_LABELS[constraint.severity]} — ${rule.label(constraint.value)}`,
          after: `${CONSTRAINT_SEVERITY_LABELS[next.severity]} — ${rule.label(next.value)}`,
        },
      );
    }

    case "set-objective-note": {
      const note = action.note.trim();
      if (note === state.objectiveNote) return state;

      return withActivity({ ...state, objectiveNote: note }, at, {
        source: "ui",
        kind: "settings",
        summary: note.length === 0 ? "Cleared the objective note" : "Updated the objective note",
        detail: note.length === 0 ? null : note,
        before: state.objectiveNote.length === 0 ? null : textPreview(state.objectiveNote),
        after: note.length === 0 ? null : textPreview(note),
      });
    }

    case "restore-checkpoint": {
      const checkpoint = findCheckpoint(state, action.checkpointId);
      if (checkpoint === null) return state;
      // A checkpoint belongs to the revision it was taken against; its clause
      // IDs mean nothing after a re-segmentation.
      if (checkpoint.revisionId !== state.revision.revisionId) return state;

      const recorded = new Map(
        checkpoint.decisions.map((decision) => [decision.editId, decision]),
      );

      // Proposals staged after the checkpoint are not in it. They return to
      // awaiting decision rather than being rejected on the human's behalf.
      const edits = state.edits.map((edit) => {
        const decision = recorded.get(edit.editId);
        if (decision === undefined) {
          return edit.status === "pending" ? edit : { ...edit, status: "pending" as DecisionStatus, humanText: null };
        }
        if (edit.status === decision.status && edit.humanText === decision.humanText) return edit;
        return { ...edit, status: decision.status, humanText: decision.humanText };
      });

      if (edits.every((edit, index) => edit === state.edits[index])) return state;

      const unknown = state.edits.filter((edit) => !recorded.has(edit.editId)).length;

      return withActivity({ ...state, edits }, at, {
        source: "ui",
        kind: "decision",
        summary: `Restored preview revision ${checkpoint.id} — ${checkpoint.label}`,
        detail:
          `Replayed ${checkpoint.decisions.length} recorded decision(s).` +
          (unknown === 0
            ? ""
            : ` ${unknown} proposal(s) staged after this point returned to awaiting decision.`),
        clauseIds: Object.keys(checkpoint.clauseTexts),
        before: `revision as of event #${state.seq}`,
        after: `revision as of event #${checkpoint.seq}`,
      });
    }

    case "set-webmcp-status":
      return { ...state, webmcpStatus: action.status };
  }
}

/**
 * Applies an action and, when the agreement now reads differently, records the
 * preview revision that resulted.
 *
 * Checkpointing lives here rather than inside each case so every path that
 * changes accepted wording — single decision, bulk decision, migration — records
 * one, and none can forget to.
 */
export function reduce(state: AppState, action: Action, at: string): AppState {
  const next = reduceInner(state, action, at);
  if (next === state) return state;
  if (!CHECKPOINTING.has(action.type)) return next;
  return withCheckpoint(state, next, at, describeAction(state, action));
}

// -------------------------------------------------------------- undo stack

export interface UndoFrame {
  state: AppState;
  label: string;
}

export interface Session {
  present: AppState;
  past: readonly UndoFrame[];
}

const UNDO_LIMIT = 50;

export function createSession(state: AppState = createInitialState()): Session {
  return { present: state, past: [] };
}

/** Records the pre-action state so the human can step back one decision. */
export function commit(session: Session, next: AppState, label: string): Session {
  if (next === session.present) return session;
  const past = [...session.past, { state: session.present, label }].slice(-UNDO_LIMIT);
  return { present: next, past };
}

export function applyAction(session: Session, action: Action, at: string): Session {
  const next = reduce(session.present, action, at);
  if (next === session.present) return session;
  if (!isUndoable(action)) return { ...session, present: next };
  return commit(session, next, describeAction(session.present, action));
}

/**
 * Restores the exact seeded starting state and drops the undo history.
 *
 * `load-seed` deliberately keeps the activity log so a mid-session document swap
 * stays auditable. A demo reset is the opposite: it must leave the app
 * indistinguishable from a fresh load, so the log, the sequence counter and the
 * undo stack all go too. `webmcpStatus` is carried over because it records what
 * this *browser* supports, which a reset does not re-detect.
 */
export function resetSession(session: Session): Session {
  return createSession({
    ...createInitialState(),
    webmcpStatus: session.present.webmcpStatus,
  });
}

export function canUndo(session: Session): boolean {
  return session.past.length > 0;
}

export function undoLabel(session: Session): string | null {
  return session.past[session.past.length - 1]?.label ?? null;
}

/**
 * Steps back one recorded change. The audit trail is deliberately *not* rolled
 * back — the undo itself is appended to it, so the log stays a truthful record
 * of what happened rather than a record of what survived.
 */
export function undo(session: Session, at: string): Session {
  const frame = session.past[session.past.length - 1];
  if (frame === undefined) return session;

  const restored = withActivity(
    {
      ...frame.state,
      seq: session.present.seq,
      activity: session.present.activity,
      // Records of what happened, like the log itself: an undo appends to them
      // rather than erasing them.
      toolCalls: session.present.toolCalls,
      checkpoints: session.present.checkpoints,
    },
    at,
    { source: "ui", kind: "decision", summary: `Undid: ${frame.label}` },
  );

  return { present: restored, past: session.past.slice(0, -1) };
}

function describeAction(state: AppState, action: Action): string {
  switch (action.type) {
    case "set-role":
      return `set role to ${action.role}`;
    case "toggle-selected":
      return `change selection (${action.clauseId})`;
    case "clear-selection":
      return "clear selection";
    case "toggle-non-negotiable":
      return `change non-negotiable (${action.clauseId})`;
    case "set-priority-areas":
      return "change priority areas";
    case "load-seed":
      return "load seeded agreement";
    case "load-pasted":
      return "load pasted agreement";
    case "revise-document":
      return action.label.toLowerCase();
    case "approve-edit":
      return `approve ${describeEdit(state, action.editId)}`;
    case "reject-edit":
      return `reject ${describeEdit(state, action.editId)}`;
    case "edit-replacement":
      return `edit ${describeEdit(state, action.editId)}`;
    case "reset-edit":
      return `reset ${describeEdit(state, action.editId)}`;
    case "set-note":
      return `note on ${describeEdit(state, action.editId)}`;
    case "apply-demo-setup":
      return action.label.toLowerCase();
    case "migrate-edits":
      return "carry staged redlines into this revision";
    case "decide-package":
      return `${action.decision === "approved" ? "approve" : "reject"} remaining redlines in package`;
    case "add-constraint":
      return `add ${action.severity} constraint`;
    case "remove-constraint":
      return `remove constraint ${action.constraintId}`;
    case "update-constraint":
      return `update constraint ${action.constraintId}`;
    case "set-objective-note":
      return "change the objective note";
    case "restore-checkpoint":
      return `restore preview revision ${action.checkpointId}`;
    case "focus-clause":
    case "record-export":
    case "set-webmcp-status":
      return action.type;
  }
}
