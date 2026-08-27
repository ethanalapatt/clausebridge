import { diffStats, diffWords } from "@/core/diff";
import { editId as makeEditId, packageId as makePackageId } from "@/core/ids";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import {
  clauseDecisionStatus,
  editsForClause,
  effectiveClauseText,
  findClause,
  isNonNegotiable,
  isSelected,
  isStaleClauseId,
  withActivity,
} from "@/core/state";
import type {
  AppState,
  ClauseType,
  DecisionStatus,
  HandlerError,
  HandlerResult,
  InvocationSource,
  PartyRole,
  PriorityTag,
  RedlinePackage,
  StagedEdit,
} from "@/core/types";
import { PARTY_ROLES, PRIORITY_TAGS } from "@/core/types";

/**
 * The two deterministic handlers behind the WebMCP tool contracts.
 *
 * These are the *only* implementation. Native WebMCP `execute` callbacks and the
 * labeled local test control both call exactly these functions, so there is no
 * path where the demo behaves differently from the real tool surface.
 *
 * Neither handler generates legal language. `get_negotiation_context` returns
 * exact stored text and pre-authored fictional fallbacks; `stage_redline_package`
 * only records text the caller supplied, and never writes it into the source
 * agreement.
 */

const NON_LEGAL_ADVICE_NOTICE =
  "ClauseBridge is a document-operations prototype using fictional sample text. " +
  "This is not legal advice, and no wording is asserted to be legally correct, safer, or preferable.";

export interface HandlerContext {
  source: InvocationSource;
  /** ISO timestamp supplied by the caller so the handlers stay pure. */
  at: string;
}

/** Every handler returns the result *and* the next state; nothing mutates. */
export interface HandlerOutcome<T> {
  result: HandlerResult<T>;
  state: AppState;
}

// ------------------------------------------------------- shared validation

interface ClauseIdValidation {
  unknown: string[];
  stale: string[];
}

function validateClauseIds(state: AppState, ids: readonly string[]): ClauseIdValidation {
  const unknown: string[] = [];
  const stale: string[] = [];

  for (const id of ids) {
    if (findClause(state, id) !== null) continue;
    // A retired ID is reported as stale so the caller learns the document moved
    // on, rather than being told the clause never existed.
    if (isStaleClauseId(state, id)) stale.push(id);
    else unknown.push(id);
  }

  return { unknown, stale };
}

function clauseIdError(state: AppState, validation: ClauseIdValidation): HandlerError {
  const parts: string[] = [];
  if (validation.unknown.length > 0) {
    parts.push(`unknown clause ID(s): ${validation.unknown.join(", ")}`);
  }
  if (validation.stale.length > 0) {
    parts.push(
      `stale clause ID(s) from a retired revision: ${validation.stale.join(", ")}. ` +
        `The active revision is ${state.revision.revisionId}.`,
    );
  }

  return {
    code: "INVALID_CLAUSE_IDS",
    message: `Rejected without changing the agreement — ${parts.join("; ")}.`,
    unknownClauseIds: validation.unknown,
    staleClauseIds: validation.stale,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// ------------------------------------------------- get_negotiation_context

export interface NegotiationContextInput {
  clauseIds: readonly string[];
  partyRole: PartyRole;
  priorityAreas: readonly string[];
}

export interface NegotiationContextClause {
  clauseId: string;
  ordinal: number;
  title: string;
  clauseType: ClauseType;
  /** Text the clause reads as right now, including any approved redline. */
  currentText: string;
  /** Untouched text from the source agreement. */
  originalText: string;
  hasApprovedChange: boolean;
  isSelected: boolean;
  isNonNegotiable: boolean;
  decisionStatus: DecisionStatus | "none";
  stagedEditIds: string[];
}

export interface NegotiationContextFallback {
  fallbackId: string;
  label: string;
  clauseType: ClauseType;
  role: PartyRole;
  text: string;
  note: string;
  source: string;
  appliesToClauseIds: string[];
}

export interface NegotiationContextPayload {
  document: {
    documentId: string;
    documentTitle: string;
    revisionId: string;
    revisionNumber: number;
    source: string;
    clauseCount: number;
    segmentationConfidence: string;
    fictional: true;
  };
  partyRole: PartyRole;
  priorityAreas: string[];
  clauses: NegotiationContextClause[];
  fallbackOptions: NegotiationContextFallback[];
  notice: string;
}

/**
 * Retrieves exact text, approved fictional fallback language, and current
 * decision status for the requested clause IDs. Never changes the agreement.
 *
 * Validation is strict: if *any* clause ID is unknown or stale the whole call is
 * rejected, so a caller can never receive a silently partial context and treat
 * it as complete.
 */
export function getNegotiationContext(
  state: AppState,
  input: NegotiationContextInput,
  context: HandlerContext,
): HandlerOutcome<NegotiationContextPayload> {
  const requested = Array.isArray(input?.clauseIds) ? input.clauseIds : [];

  if (requested.length === 0 || !requested.every(isNonEmptyString)) {
    return reject(state, context, "get_negotiation_context", {
      code: "INVALID_INPUT",
      message: "clauseIds must be a non-empty array of clause ID strings.",
    });
  }

  if (!PARTY_ROLES.includes(input.partyRole)) {
    return reject(state, context, "get_negotiation_context", {
      code: "INVALID_INPUT",
      message: `partyRole must be one of: ${PARTY_ROLES.join(", ")}.`,
    });
  }

  if (!Array.isArray(input.priorityAreas)) {
    return reject(state, context, "get_negotiation_context", {
      code: "INVALID_INPUT",
      message: "priorityAreas must be an array of strings.",
    });
  }

  const validation = validateClauseIds(state, requested);
  if (validation.unknown.length > 0 || validation.stale.length > 0) {
    return reject(state, context, "get_negotiation_context", clauseIdError(state, validation));
  }

  // De-duplicate while preserving the caller's order.
  const clauseIds = requested.filter((id, index) => requested.indexOf(id) === index);

  const clauses: NegotiationContextClause[] = clauseIds.map((clauseId) => {
    const clause = findClause(state, clauseId);
    // Non-null: validateClauseIds already proved every ID resolves.
    const resolved = clause as NonNullable<typeof clause>;
    const currentText = effectiveClauseText(state, clauseId);

    return {
      clauseId,
      ordinal: resolved.ordinal,
      title: resolved.title,
      clauseType: resolved.clauseType,
      currentText,
      originalText: resolved.text,
      hasApprovedChange: currentText !== resolved.text,
      isSelected: isSelected(state, clauseId),
      isNonNegotiable: isNonNegotiable(state, clauseId),
      decisionStatus: clauseDecisionStatus(state, clauseId),
      stagedEditIds: editsForClause(state, clauseId).map((edit) => edit.editId),
    };
  });

  const requestedTypes = new Set(clauses.map((clause) => clause.clauseType));

  // Role filtering: a party sees its own posture plus neutral options. A neutral
  // role sees only neutral options, never one side's negotiating language.
  const fallbackOptions: NegotiationContextFallback[] = FALLBACK_LIBRARY.filter(
    (entry) =>
      requestedTypes.has(entry.clauseType) &&
      (input.partyRole === "neutral"
        ? entry.role === "neutral"
        : entry.role === input.partyRole || entry.role === "neutral"),
  ).map((entry) => ({
    fallbackId: entry.id,
    label: entry.label,
    clauseType: entry.clauseType,
    role: entry.role,
    text: entry.text,
    note: entry.note,
    source: entry.source,
    appliesToClauseIds: clauses
      .filter((clause) => clause.clauseType === entry.clauseType)
      .map((clause) => clause.clauseId),
  }));

  const priorityAreas = input.priorityAreas
    .filter(isNonEmptyString)
    .map((area) => area.trim());

  const payload: NegotiationContextPayload = {
    document: {
      documentId: state.revision.documentId,
      documentTitle: state.revision.documentTitle,
      revisionId: state.revision.revisionId,
      revisionNumber: state.revision.revisionNumber,
      source: state.revision.source,
      clauseCount: state.revision.clauses.length,
      segmentationConfidence: state.revision.segmentationConfidence,
      fictional: true,
    },
    partyRole: input.partyRole,
    priorityAreas,
    clauses,
    fallbackOptions,
    notice: NON_LEGAL_ADVICE_NOTICE,
  };

  // Focusing the first requested clause is what makes the tool call visible in
  // the shared document rather than happening invisibly.
  const focusedClauseId = clauseIds[0] ?? null;
  const nextState = withActivity(
    {
      ...state,
      focusedClauseId,
      focusPulse: focusedClauseId === null ? state.focusPulse : state.focusPulse + 1,
    },
    context.at,
    {
      source: context.source,
      kind: "tool-result",
      tool: "get_negotiation_context",
      summary: `Retrieved context for ${clauses.length} clause(s) as ${input.partyRole}`,
      detail: `${clauseIds.join(", ")} · ${fallbackOptions.length} fictional fallback option(s) · revision ${state.revision.revisionId}`,
    },
  );

  return { result: { ok: true, ...payload }, state: nextState };
}

// ------------------------------------------------- stage_redline_package

export interface RedlineEditInput {
  clauseId: string;
  replacementText: string;
  rationale: string;
  priorityTag: PriorityTag;
}

export interface StageRedlineInput {
  packageLabel: string;
  edits: readonly RedlineEditInput[];
}

export interface StagedEditSummary {
  editId: string;
  clauseId: string;
  clauseTitle: string;
  priorityTag: PriorityTag;
  wordsAdded: number;
  wordsRemoved: number;
}

export interface StageRedlinePayload {
  packageId: string;
  packageLabel: string;
  revisionId: string;
  staged: StagedEditSummary[];
  notice: string;
}

/**
 * Stages a group of clause-specific redlines for independent human approval.
 *
 * Staging is not acceptance: the source agreement in `revision.clauses` is never
 * touched, and every edit lands in `pending` until a human decides on it one at
 * a time.
 */
export function stageRedlinePackage(
  state: AppState,
  input: StageRedlineInput,
  context: HandlerContext,
): HandlerOutcome<StageRedlinePayload> {
  if (!isNonEmptyString(input?.packageLabel)) {
    return reject(state, context, "stage_redline_package", {
      code: "INVALID_INPUT",
      message: "packageLabel must be a non-empty string.",
    });
  }

  const edits = Array.isArray(input.edits) ? input.edits : [];
  if (edits.length === 0) {
    return reject(state, context, "stage_redline_package", {
      code: "EMPTY_PACKAGE",
      message: "edits must contain at least one redline.",
    });
  }

  // Duplicates first: two edits to one clause in a single package have no
  // defined resolution order, so the package is refused rather than guessed at.
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const edit of edits) {
    const clauseId = typeof edit?.clauseId === "string" ? edit.clauseId : "";
    if (seen.has(clauseId)) duplicates.add(clauseId);
    seen.add(clauseId);
  }
  if (duplicates.size > 0) {
    return reject(state, context, "stage_redline_package", {
      code: "DUPLICATE_CLAUSE_IDS",
      message: `A package may contain at most one edit per clause. Duplicated: ${[...duplicates].join(", ")}.`,
      duplicateClauseIds: [...duplicates],
    });
  }

  const validation = validateClauseIds(
    state,
    edits.map((edit) => (typeof edit?.clauseId === "string" ? edit.clauseId : "")),
  );
  if (validation.unknown.length > 0 || validation.stale.length > 0) {
    return reject(state, context, "stage_redline_package", clauseIdError(state, validation));
  }

  const invalidEdits: { index: number; clauseId: string | null; reason: string }[] = [];
  edits.forEach((edit, index) => {
    const clauseId = edit.clauseId;
    if (!isNonEmptyString(edit?.replacementText)) {
      invalidEdits.push({ index, clauseId, reason: "replacementText must be non-empty." });
      return;
    }
    if (!isNonEmptyString(edit?.rationale)) {
      invalidEdits.push({ index, clauseId, reason: "rationale must be non-empty." });
      return;
    }
    if (!PRIORITY_TAGS.includes(edit.priorityTag)) {
      invalidEdits.push({
        index,
        clauseId,
        reason: `priorityTag must be one of: ${PRIORITY_TAGS.join(", ")}.`,
      });
      return;
    }
    // A redline identical to the current text is a no-op that would clutter the
    // gutter with a change the human cannot meaningfully decide on.
    if (edit.replacementText.trim() === effectiveClauseText(state, clauseId).trim()) {
      invalidEdits.push({
        index,
        clauseId,
        reason: "replacementText is identical to the clause's current text.",
      });
    }
  });

  if (invalidEdits.length > 0) {
    return reject(state, context, "stage_redline_package", {
      code: "INVALID_EDITS",
      message: `Rejected ${invalidEdits.length} malformed edit(s); nothing was staged.`,
      invalidEdits,
    });
  }

  const seq = state.seq + 1;
  const pkgId = makePackageId(state.packages.length + 1);

  const stagedEdits: StagedEdit[] = edits.map((edit, index) => ({
    editId: makeEditId(pkgId, index),
    packageId: pkgId,
    clauseId: edit.clauseId,
    // Captured now, from the active revision, so the gutter diff stays anchored
    // to what the clause actually said when the package was proposed.
    originalText: effectiveClauseText(state, edit.clauseId),
    proposedText: edit.replacementText,
    humanText: null,
    rationale: edit.rationale,
    priorityTag: edit.priorityTag,
    status: "pending",
    note: null,
  }));

  const pkg: RedlinePackage = {
    packageId: pkgId,
    packageLabel: input.packageLabel,
    source: context.source,
    revisionId: state.revision.revisionId,
    seq,
    editIds: stagedEdits.map((edit) => edit.editId),
  };

  const staged: StagedEditSummary[] = stagedEdits.map((edit) => {
    const stats = diffStats(diffWords(edit.originalText, edit.proposedText));
    return {
      editId: edit.editId,
      clauseId: edit.clauseId,
      clauseTitle: findClause(state, edit.clauseId)?.title ?? edit.clauseId,
      priorityTag: edit.priorityTag,
      wordsAdded: stats.wordsAdded,
      wordsRemoved: stats.wordsRemoved,
    };
  });

  const focusedClauseId = stagedEdits[0]?.clauseId ?? null;
  const nextState = withActivity(
    {
      ...state,
      packages: [...state.packages, pkg],
      edits: [...state.edits, ...stagedEdits],
      focusedClauseId,
      focusPulse: focusedClauseId === null ? state.focusPulse : state.focusPulse + 1,
    },
    context.at,
    {
      source: context.source,
      kind: "tool-result",
      tool: "stage_redline_package",
      summary: `Staged “${input.packageLabel}” — ${stagedEdits.length} redline(s) awaiting decision`,
      detail: staged
        .map((item) => `${item.clauseId} [${item.priorityTag}] +${item.wordsAdded}/-${item.wordsRemoved}`)
        .join(" · "),
    },
  );

  return {
    result: {
      ok: true,
      packageId: pkgId,
      packageLabel: input.packageLabel,
      revisionId: state.revision.revisionId,
      staged,
      notice:
        "Staged for review only. The source agreement is unchanged and each redline requires a separate human decision. " +
        NON_LEGAL_ADVICE_NOTICE,
    },
    state: nextState,
  };
}

// ------------------------------------------------------------------ shared

/** Records the rejection in the audit trail without changing the document. */
function reject<T>(
  state: AppState,
  context: HandlerContext,
  tool: "get_negotiation_context" | "stage_redline_package",
  error: HandlerError,
): HandlerOutcome<T> {
  const nextState = withActivity(state, context.at, {
    source: context.source,
    kind: "tool-error",
    tool,
    summary: `${tool} rejected: ${error.code}`,
    detail: error.message,
  });

  return { result: { ok: false, error }, state: nextState };
}
