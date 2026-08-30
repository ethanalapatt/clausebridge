import { applyMigration } from "@/core/migration";
import type { MigrationCandidate } from "@/core/migration";
import { buildSeedRevision, reviseDocument, segmentPastedText } from "@/core/segmentation";
import type { ClauseDraft } from "@/core/segmentation";
import type {
  ActivityEntry,
  ActivityKind,
  AppState,
  Clause,
  DecisionStatus,
  DemoSetup,
  DocumentRevision,
  ExportKind,
  InvocationSource,
  PartyRole,
  StagedEdit,
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
    focusedClauseId: null,
    focusPulse: 0,
    packages: [],
    edits: [],
    activity: [],
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

// ----------------------------------------------------------------- activity

export interface ActivityInput {
  source: InvocationSource;
  kind: ActivityKind;
  tool?: ToolName | null;
  summary: string;
  detail?: string | null;
}

/** Appends an audit entry and advances the deterministic sequence counter. */
export function withActivity(state: AppState, at: string, input: ActivityInput): AppState {
  const seq = state.seq + 1;
  const entry: ActivityEntry = {
    seq,
    at,
    source: input.source,
    kind: input.kind,
    tool: input.tool ?? null,
    summary: input.summary,
    detail: input.detail ?? null,
  };
  return { ...state, seq, activity: [...state.activity, entry] };
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
  | { type: "record-export"; kind: ExportKind; filename: string }
  | { type: "set-webmcp-status"; status: WebMcpStatus };

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

export function reduce(state: AppState, action: Action, at: string): AppState {
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
      return withActivity(
        {
          ...state,
          edits: updateEdit(state, action.editId, (current) => ({
            ...current,
            status: "approved",
            humanText: null,
          })),
        },
        at,
        { source: "ui", kind: "decision", summary: `Approved redline on ${label}` },
      );
    }

    case "reject-edit": {
      const edit = findEdit(state, action.editId);
      if (edit === null || edit.status === "rejected") return state;
      const label = describeEdit(state, action.editId);
      return withActivity(
        {
          ...state,
          edits: updateEdit(state, action.editId, (current) => ({
            ...current,
            status: "rejected",
            humanText: null,
          })),
        },
        at,
        { source: "ui", kind: "decision", summary: `Rejected redline on ${label}` },
      );
    }

    case "edit-replacement": {
      const edit = findEdit(state, action.editId);
      if (edit === null) return state;
      const text = action.text.trim();
      if (text.length === 0) return state;
      const label = describeEdit(state, action.editId);
      return withActivity(
        {
          ...state,
          edits: updateEdit(state, action.editId, (current) => ({
            ...current,
            status: "edited",
            humanText: text,
          })),
        },
        at,
        {
          source: "ui",
          kind: "decision",
          summary: `Approved redline on ${label} with human edits`,
        },
      );
    }

    case "reset-edit": {
      const edit = findEdit(state, action.editId);
      if (edit === null || edit.status === "pending") return state;
      const label = describeEdit(state, action.editId);
      return withActivity(
        {
          ...state,
          edits: updateEdit(state, action.editId, (current) => ({
            ...current,
            status: "pending",
            humanText: null,
          })),
        },
        at,
        { source: "ui", kind: "decision", summary: `Returned ${label} to awaiting decision` },
      );
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

      return withActivity(
        {
          ...state,
          partyRole: action.setup.partyRole,
          selectedClauseIds,
          nonNegotiableClauseIds,
          priorityAreas,
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
            `priorities: ${priorityAreas.length > 0 ? priorityAreas.join(", ") : "none"}.`,
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
      });
    }

    case "record-export":
      return withActivity(state, at, {
        source: "ui",
        kind: "export",
        summary: `Downloaded the ${EXPORT_KIND_LABELS[action.kind]}`,
        detail: action.filename,
      });

    case "set-webmcp-status":
      return { ...state, webmcpStatus: action.status };
  }
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
    { ...frame.state, seq: session.present.seq, activity: session.present.activity },
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
    case "focus-clause":
    case "record-export":
    case "set-webmcp-status":
      return action.type;
  }
}
