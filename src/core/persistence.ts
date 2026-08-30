import { createInitialState, createSession } from "@/core/state";
import type { Session } from "@/core/state";
import type { AppState } from "@/core/types";

/**
 * Serialization for the browser-local demo session.
 *
 * The whole app state is plain JSON-safe data by construction, so persistence is
 * a version stamp plus a structural check on the way back in. Nothing here trusts
 * what it reads: `localStorage` is user-writable and survives across deploys, so
 * a payload from an older or hand-edited build must be rejected rather than
 * spread into live state.
 *
 * The undo stack is deliberately *not* persisted. Restoring a half-unwound
 * history across a reload invites a step-back into a state the user never saw in
 * this session; the decisions themselves and the audit log carry the meaning.
 */

export const PERSISTENCE_KEY = "clausebridge:session:v1";

/** Bumped whenever the shape of `AppState` changes incompatibly. */
export const PERSISTENCE_VERSION = 1;

export interface PersistedEnvelope {
  version: number;
  state: AppState;
}

export function serializeSession(session: Session): string {
  const envelope: PersistedEnvelope = {
    version: PERSISTENCE_VERSION,
    state: {
      ...session.present,
      // Whether this browser exposes WebMCP is detected fresh on every load; a
      // stored "registered" would be a claim about the wrong page load.
      webmcpStatus: { kind: "checking" },
    },
  };
  return JSON.stringify(envelope);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Structural check on a restored payload.
 *
 * This is intentionally shallow but load-bearing: it confirms the fields the
 * reducers and selectors index into actually exist with the right container
 * types, so a stale or tampered payload fails here instead of throwing somewhere
 * deep in a render.
 */
function looksLikeAppState(value: unknown): value is AppState {
  if (!isRecord(value)) return false;

  const revision = value.revision;
  if (!isRecord(revision)) return false;
  if (typeof revision.revisionId !== "string") return false;
  if (typeof revision.documentTitle !== "string") return false;
  if (!Array.isArray(revision.clauses)) return false;
  if (!isRecord(revision.retiredClauseIds)) return false;

  if (typeof value.partyRole !== "string") return false;
  if (typeof value.seq !== "number" || !Number.isFinite(value.seq)) return false;

  for (const key of [
    "selectedClauseIds",
    "nonNegotiableClauseIds",
    "priorityAreas",
    "packages",
    "edits",
    "activity",
  ]) {
    if (!Array.isArray(value[key])) return false;
  }

  return true;
}

/**
 * Rebuilds a session from stored text.
 *
 * Returns `null` for anything unusable — absent, unparseable, wrong version, or
 * structurally wrong — so the caller can fall back to a fresh seeded demo. A
 * corrupt payload must never surface as a broken app.
 */
export function deserializeSession(raw: string | null): Session | null {
  if (raw === null || raw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (parsed.version !== PERSISTENCE_VERSION) return null;
  if (!looksLikeAppState(parsed.state)) return null;

  return createSession({
    ...createInitialState(),
    ...parsed.state,
    // Always re-detected on mount, never restored.
    webmcpStatus: { kind: "checking" },
  });
}

/** True when a restored session holds work worth telling the user about. */
export function hasRestorableWork(session: Session): boolean {
  const state = session.present;
  return state.activity.length > 0 || state.packages.length > 0 || state.edits.length > 0;
}
