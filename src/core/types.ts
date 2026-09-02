/**
 * Core domain types for ClauseBridge.
 *
 * Everything here describes a *fictional* agreement authored for a demo. None
 * of it is legal advice and none of it asserts that any wording is legally
 * correct or preferable.
 */

import type { Constraint, ConstraintDraft } from "@/core/constraints";

export type PartyRole = "customer" | "vendor" | "neutral";

export const PARTY_ROLES: readonly PartyRole[] = ["customer", "vendor", "neutral"];

export const PARTY_ROLE_LABELS: Readonly<Record<PartyRole, string>> = {
  customer: "Customer",
  vendor: "Vendor",
  neutral: "Neutral",
};

export type PriorityTag = "required" | "preferred" | "optional";

export const PRIORITY_TAGS: readonly PriorityTag[] = ["required", "preferred", "optional"];

/**
 * Clause taxonomy. `other` exists so pasted text never has to be forced into a
 * category the segmenter cannot actually justify from the heading.
 */
export type ClauseType =
  | "definitions"
  | "services"
  | "payment"
  | "confidentiality"
  | "security"
  | "data_retention"
  | "warranty"
  | "liability"
  | "termination"
  | "intellectual_property"
  | "governing_law"
  | "other";

export const CLAUSE_TYPES: readonly ClauseType[] = [
  "definitions",
  "services",
  "payment",
  "confidentiality",
  "security",
  "data_retention",
  "warranty",
  "liability",
  "termination",
  "intellectual_property",
  "governing_law",
  "other",
];

export const CLAUSE_TYPE_LABELS: Readonly<Record<ClauseType, string>> = {
  definitions: "Definitions",
  services: "Services",
  payment: "Payment",
  confidentiality: "Confidentiality",
  security: "Security",
  data_retention: "Data retention",
  warranty: "Warranty",
  liability: "Liability",
  termination: "Termination",
  intellectual_property: "Intellectual property",
  governing_law: "Governing law",
  other: "Other",
};

export interface Clause {
  /** Stable within a revision. Encodes the revision so stale IDs are detectable. */
  id: string;
  /** 1-based position used for display numbering. */
  ordinal: number;
  title: string;
  clauseType: ClauseType;
  /** Exact clause body. Never mutated by staging a redline. */
  text: string;
  /**
   * True when the segmenter inferred the title or the clause type instead of
   * reading it from an explicit heading. Drives the "needs review" prompt.
   */
  inferred: boolean;
}

export type DocumentSource = "seed" | "pasted";

export type SegmentationConfidence = "high" | "low";

export interface DocumentRevision {
  documentId: string;
  documentTitle: string;
  source: DocumentSource;
  /** 1-based; increments whenever the clause set changes. */
  revisionNumber: number;
  /** e.g. "NSA-r1". Clause IDs are namespaced under this. */
  revisionId: string;
  clauses: readonly Clause[];
  /**
   * Clause IDs that existed in an earlier revision of this document, mapped to
   * the revision that retired them. Lets the handlers distinguish a *stale* ID
   * from one that never existed.
   */
  retiredClauseIds: Readonly<Record<string, string>>;
  segmentationConfidence: SegmentationConfidence;
  /** Always true. This prototype only ever holds invented agreements. */
  fictional: true;
}

/**
 * Which negotiating stance a library entry was written for. Used to assemble
 * contrasting packages; it says nothing about which wording is better.
 */
export type FallbackPosture = "protective" | "balanced" | "fast-close";

export const FALLBACK_POSTURES: readonly FallbackPosture[] = [
  "protective",
  "balanced",
  "fast-close",
];

export interface FallbackEntry {
  id: string;
  clauseType: ClauseType;
  /** Which party's negotiating posture this alternative was written for. */
  role: PartyRole;
  /** How hard this alternative pushes. Drives the alternative packages. */
  posture: FallbackPosture;
  label: string;
  text: string;
  /**
   * Why the demo library offers this option. Never a claim that it is legally
   * correct, safer, or preferable.
   */
  note: string;
  source: string;
}

/**
 * A one-click reviewer configuration: who you are negotiating as, which clauses
 * the agent may work on, and what cannot move. Built by `src/core/demo.ts` from
 * the active revision so the reducer needs no knowledge of the demo script.
 */
export interface DemoSetup {
  partyRole: PartyRole;
  selectedClauseIds: readonly string[];
  nonNegotiableClauseIds: readonly string[];
  priorityAreas: readonly string[];
  /** Constraints to place on the board. IDs are assigned by the reducer. */
  constraints: readonly ConstraintDraft[];
  objectiveNote: string;
}

/** Which deterministic document an export produced. */
export type ExportKind = "brief" | "redline" | "decision-log" | "tool-activity";

export const EXPORT_KINDS: readonly ExportKind[] = [
  "brief",
  "redline",
  "decision-log",
  "tool-activity",
];

export const EXPORT_KIND_LABELS: Readonly<Record<ExportKind, string>> = {
  brief: "negotiation brief",
  redline: "redlined agreement",
  "decision-log": "decision log",
  "tool-activity": "tool activity log",
};

export const EXPORT_KIND_FORMATS: Readonly<Record<ExportKind, "md" | "json">> = {
  brief: "md",
  redline: "md",
  "decision-log": "json",
  "tool-activity": "json",
};

export type DecisionStatus = "pending" | "approved" | "rejected" | "edited";

export const DECISION_STATUS_LABELS: Readonly<Record<DecisionStatus, string>> = {
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
  edited: "Approved with edits",
};

/**
 * Where a handler invocation came from. The local test path must never be
 * reported as native WebMCP.
 */
export type InvocationSource = "native-webmcp" | "local-handler-test" | "ui";

export const INVOCATION_SOURCE_LABELS: Readonly<Record<InvocationSource, string>> = {
  "native-webmcp": "native WebMCP",
  "local-handler-test": "local handler test",
  ui: "human",
};

export interface StagedEdit {
  editId: string;
  packageId: string;
  clauseId: string;
  /** Exact clause text captured at staging time, from the active revision. */
  originalText: string;
  /** Replacement proposed by the tool call. Never edited in place. */
  proposedText: string;
  /** Human-authored replacement, present only once the human edits the proposal. */
  humanText: string | null;
  rationale: string;
  priorityTag: PriorityTag;
  status: DecisionStatus;
  note: string | null;
}

export interface RedlinePackage {
  packageId: string;
  packageLabel: string;
  source: InvocationSource;
  revisionId: string;
  /** Deterministic ordering counter. Not a wall clock. */
  seq: number;
  editIds: readonly string[];
}

export type ActivityKind =
  | "tool-call"
  | "tool-result"
  | "tool-error"
  | "decision"
  | "document"
  | "settings"
  | "export"
  | "view"
  | "webmcp";

/**
 * Review surfaces whose opening is worth recording.
 *
 * Navigation is a real human action, and the guided demo derives two of its
 * steps from it. Recording it keeps those steps honest — they tick because the
 * human actually opened the surface, not because a script said so.
 */
export type ReviewSurface = "compare" | "preview" | "timeline" | "replay";

export const REVIEW_SURFACE_LABELS: Readonly<Record<ReviewSurface, string>> = {
  compare: "package comparison",
  preview: "preview revision",
  timeline: "revision timeline",
  replay: "replay",
};

export type ToolName = "get_negotiation_context" | "stage_redline_package";

export interface ActivityEntry {
  /** Stable local ID, e.g. `ev-0007`. Survives serialization; never reused. */
  id: string;
  /** Deterministic ordering counter, assigned by the reducer. */
  seq: number;
  /** ISO timestamp supplied by the caller so the core stays pure. */
  at: string;
  source: InvocationSource;
  kind: ActivityKind;
  tool: ToolName | null;
  summary: string;
  detail: string | null;
  /** Clauses this event affected, so the timeline can focus them. */
  clauseIds: readonly string[];
  /** Packages this event affected. */
  packageIds: readonly string[];
  /** Deterministic summary of the prior value, where one exists. */
  before: string | null;
  /** Deterministic summary of the new value, where one exists. */
  after: string | null;
  /** Document revision observed when the event was recorded. */
  revisionId: string;
}

/**
 * The full provenance of one handler invocation.
 *
 * The activity entry says what happened in a sentence; this says exactly what
 * crossed the boundary. Input and output are stored pre-serialized so the
 * inspector shows what the handler actually received, not a re-rendering of it.
 */
export interface ToolCallRecord {
  /** Stable local ID, e.g. `call-0003`. */
  id: string;
  /** Sequence of the activity entry recording the outcome. */
  seq: number;
  at: string;
  tool: ToolName;
  source: InvocationSource;
  /** Active document revision at call time. */
  revisionId: string;
  /** Serialized input exactly as the handler received it. */
  input: string;
  /** One-line human-readable rendering of the input. */
  inputSummary: string;
  /** Clause IDs the call named or touched. */
  clauseIds: readonly string[];
  outcome: "ok" | "rejected";
  /** What validation concluded, in one line. */
  validation: string;
  /** Structured result, in one line. */
  resultSummary: string;
  /** What the call changed in the workspace. */
  stateEffect: string;
  errorCode: HandlerErrorCode | null;
  errorDetail: string | null;
  /** Serialized result envelope. */
  output: string;
}

/** One redline's decision, captured inside a checkpoint. */
export interface CheckpointDecision {
  editId: string;
  status: DecisionStatus;
  humanText: string | null;
}

/**
 * A preview revision: the state of the agreement after a human decision changed
 * what it reads as.
 *
 * Checkpoints record both the resulting text *and* the decisions that produced
 * it, so restoring one is an exact replay of those decisions rather than an
 * overwrite of clause text. The source agreement is never stored here because it
 * never changes.
 */
export interface Checkpoint {
  /** Stable local ID, e.g. `rev-0002`. */
  id: string;
  seq: number;
  at: string;
  label: string;
  revisionId: string;
  /** Effective clause text at this point, keyed by clause ID. */
  clauseTexts: Readonly<Record<string, string>>;
  decisions: readonly CheckpointDecision[];
}

/**
 * Note: there is deliberately no `approvedText` field. Approved wording is
 * *derived* from the staged edits (see `effectiveClauseText`), so the source
 * agreement in `revision.clauses` can never be overwritten by staging, and
 * approve/reject/undo can never leave a clause holding text no live decision
 * still supports.
 */
export interface AppState {
  revision: DocumentRevision;
  partyRole: PartyRole;
  /** Clause IDs the human has selected for the agent to work on. */
  selectedClauseIds: readonly string[];
  /** Clause IDs the human marked non-negotiable. */
  nonNegotiableClauseIds: readonly string[];
  /** Free-form priority areas, e.g. "termination", "data retention". */
  priorityAreas: readonly string[];
  /** Clause currently focused in the editor, typically by a tool call. */
  focusedClauseId: string | null;
  /** Monotonic counter used to retrigger the focus animation on repeat calls. */
  focusPulse: number;
  /** Structured Must / Prefer / Avoid conditions the human stated. */
  constraints: readonly Constraint[];
  /** Monotonic counter for constraint IDs. Never reused, even after removal. */
  constraintSeq: number;
  /** Free-text explanation of what the human is trying to achieve. */
  objectiveNote: string;
  packages: readonly RedlinePackage[];
  edits: readonly StagedEdit[];
  activity: readonly ActivityEntry[];
  /** Full provenance for every handler invocation, newest last. */
  toolCalls: readonly ToolCallRecord[];
  /** Preview revisions produced by human decisions, oldest first. */
  checkpoints: readonly Checkpoint[];
  seq: number;
  webmcpStatus: WebMcpStatus;
}

export type WebMcpStatus =
  | { kind: "checking" }
  | { kind: "registered"; toolNames: readonly ToolName[] }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; reason: string };

/** Result envelope returned by both tool handlers. Always serializable. */
export type HandlerResult<T> =
  | ({ ok: true } & T)
  | { ok: false; error: HandlerError };

export interface HandlerError {
  code: HandlerErrorCode;
  message: string;
  unknownClauseIds?: readonly string[];
  staleClauseIds?: readonly string[];
  duplicateClauseIds?: readonly string[];
  invalidEdits?: readonly { index: number; clauseId: string | null; reason: string }[];
}

export type HandlerErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CLAUSE_IDS"
  | "DUPLICATE_CLAUSE_IDS"
  | "INVALID_EDITS"
  | "EMPTY_PACKAGE";
