/**
 * Core domain types for ClauseBridge.
 *
 * Everything here describes a *fictional* agreement authored for a demo. None
 * of it is legal advice and none of it asserts that any wording is legally
 * correct or preferable.
 */

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

export interface FallbackEntry {
  id: string;
  clauseType: ClauseType;
  /** Which party's negotiating posture this alternative was written for. */
  role: PartyRole;
  label: string;
  text: string;
  /**
   * Why the demo library offers this option. Never a claim that it is legally
   * correct, safer, or preferable.
   */
  note: string;
  source: string;
}

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
  | "webmcp";

export type ToolName = "get_negotiation_context" | "stage_redline_package";

export interface ActivityEntry {
  /** Deterministic ordering counter, assigned by the reducer. */
  seq: number;
  /** ISO timestamp supplied by the caller so the core stays pure. */
  at: string;
  source: InvocationSource;
  kind: ActivityKind;
  tool: ToolName | null;
  summary: string;
  detail: string | null;
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
  packages: readonly RedlinePackage[];
  edits: readonly StagedEdit[];
  activity: readonly ActivityEntry[];
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
