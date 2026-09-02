import { diffStats, diffWords } from "@/core/diff";
import type { DiffStats } from "@/core/diff";
import type {
  ActivityEntry,
  AppState,
  Checkpoint,
  ToolCallRecord,
} from "@/core/types";

/**
 * Reading the recorded timeline back.
 *
 * Replay is a *view of stored events*, not a simulation. Nothing here re-runs a
 * handler, re-derives a result, or invents a call that was not recorded: each
 * step points at an event that actually happened and at the preview revision
 * that was in force when it did.
 */

export interface ReplayStep {
  /** 0-based position in the recorded order. */
  index: number;
  event: ActivityEntry;
  /** The full provenance record, when this event reported a tool call. */
  toolCall: ToolCallRecord | null;
  /** The preview revision in force at this point, or null before the first. */
  checkpoint: Checkpoint | null;
  /** What the agreement read as at this point, by clause ID. */
  clauseTexts: Readonly<Record<string, string>>;
}

/** Source wording for every clause: what the agreement read as before any decision. */
export function sourceTextMap(state: AppState): Record<string, string> {
  const map: Record<string, string> = {};
  for (const clause of state.revision.clauses) map[clause.id] = clause.text;
  return map;
}

/** The last preview revision recorded at or before a sequence number. */
export function checkpointAt(state: AppState, seq: number): Checkpoint | null {
  let found: Checkpoint | null = null;
  for (const checkpoint of state.checkpoints) {
    if (checkpoint.seq > seq) break;
    found = checkpoint;
  }
  return found;
}

/** What the agreement read as at a point in the recorded timeline. */
export function documentAt(state: AppState, seq: number): Readonly<Record<string, string>> {
  return checkpointAt(state, seq)?.clauseTexts ?? sourceTextMap(state);
}

/**
 * The recorded timeline, one step per event, in the order they happened.
 *
 * The `tool-call` entries are dropped: each one is immediately followed by the
 * result or error entry that carries the full provenance record, so keeping both
 * would show every call twice.
 */
export function replaySteps(state: AppState): ReplayStep[] {
  const callsBySeq = new Map(state.toolCalls.map((call) => [call.seq, call]));

  return state.activity
    .filter((entry) => entry.kind !== "tool-call")
    .map((event, index) => ({
      index,
      event,
      toolCall: callsBySeq.get(event.seq) ?? null,
      checkpoint: checkpointAt(state, event.seq),
      clauseTexts: documentAt(state, event.seq),
    }));
}

// ------------------------------------------------------- revision inspector

export interface ClauseRevisionChange {
  clauseId: string;
  title: string;
  ordinal: number;
  beforeText: string;
  afterText: string;
  stats: DiffStats;
}

export interface RevisionComparison {
  /** `null` when comparing against the original agreement. */
  fromId: string | null;
  fromLabel: string;
  toId: string | null;
  toLabel: string;
  changes: readonly ClauseRevisionChange[];
  wordsAdded: number;
  wordsRemoved: number;
}

/**
 * What changed between two human-approved states.
 *
 * Either side may be `null`, meaning the original agreement, so the first
 * preview revision can still be compared against something. Only clauses whose
 * wording actually differs are returned.
 */
export function compareCheckpoints(
  state: AppState,
  fromId: string | null,
  toId: string | null,
): RevisionComparison | null {
  const from = resolve(state, fromId);
  const to = resolve(state, toId);
  if (from === undefined || to === undefined) return null;

  const changes: ClauseRevisionChange[] = [];
  for (const clause of state.revision.clauses) {
    const beforeText = from.texts[clause.id] ?? clause.text;
    const afterText = to.texts[clause.id] ?? clause.text;
    if (beforeText === afterText) continue;

    changes.push({
      clauseId: clause.id,
      title: clause.title,
      ordinal: clause.ordinal,
      beforeText,
      afterText,
      stats: diffStats(diffWords(beforeText, afterText)),
    });
  }

  return {
    fromId,
    fromLabel: from.label,
    toId,
    toLabel: to.label,
    changes,
    wordsAdded: changes.reduce((sum, change) => sum + change.stats.wordsAdded, 0),
    wordsRemoved: changes.reduce((sum, change) => sum + change.stats.wordsRemoved, 0),
  };
}

interface ResolvedSide {
  texts: Readonly<Record<string, string>>;
  label: string;
}

function resolve(state: AppState, id: string | null): ResolvedSide | undefined {
  if (id === null) {
    return { texts: sourceTextMap(state), label: "Original agreement" };
  }
  const checkpoint = state.checkpoints.find((item) => item.id === id);
  if (checkpoint === undefined) return undefined;
  return { texts: checkpoint.clauseTexts, label: `${checkpoint.id} — ${checkpoint.label}` };
}

/**
 * The two preview revisions an inspector should open on: the most recent, and
 * whatever came before it.
 */
export function latestComparison(state: AppState): RevisionComparison | null {
  const latest = state.checkpoints.at(-1);
  if (latest === undefined) return null;
  const previous = state.checkpoints.at(-2) ?? null;
  return compareCheckpoints(state, previous?.id ?? null, latest.id);
}
