"use client";

import { useEffect, useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { InlineDiff } from "@/components/InlineDiff";
import { Button, Chip, EmptyState, Mono, cx } from "@/components/ui";
import { compareCheckpoints, replaySteps } from "@/core/replay";
import type { ReplayStep } from "@/core/replay";
import { INVOCATION_SOURCE_LABELS } from "@/core/types";
import type { ActivityEntry, ActivityKind } from "@/core/types";

/**
 * The revision timeline: what happened, what changed between two approved
 * states, and a replay that steps through the record.
 *
 * Replay reads stored events. It calls no handler and fabricates no result — a
 * step shows an event that actually happened and the wording the agreement had
 * at that moment.
 */
export function Timeline() {
  const session = useSession();
  const state = session.present;
  const steps = useMemo(() => replaySteps(state), [state]);
  const [mode, setMode] = useState<"log" | "replay" | "revisions">("log");
  const store = useStore();

  useEffect(() => {
    if (mode === "replay") store.dispatch({ type: "record-view", surface: "replay" });
    if (mode === "revisions") store.dispatch({ type: "record-view", surface: "preview" });
  }, [mode, store]);

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Timeline view" className="flex gap-1">
        {(
          [
            ["log", "Event log"],
            ["replay", "Replay"],
            ["revisions", "Revisions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => setMode(id)}
            className={cx(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              mode === id
                ? "border-bridge-600 bg-bridge-50 text-bridge-700"
                : "border-ink-200 bg-white text-ink-500 hover:border-ink-400",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "log" && <EventLog steps={steps} />}
      {mode === "replay" && <Replay steps={steps} />}
      {mode === "revisions" && <RevisionInspector />}
    </div>
  );
}

const KIND_TONE: Partial<Record<ActivityKind, "brand" | "approved" | "rejected" | "edited" | "neutral" | "proposed">> = {
  "tool-result": "brand",
  "tool-error": "rejected",
  decision: "approved",
  document: "edited",
  settings: "neutral",
  export: "proposed",
  view: "neutral",
};

const KIND_LABEL: Partial<Record<ActivityKind, string>> = {
  "tool-result": "tool call",
  "tool-error": "tool rejected",
  decision: "decision",
  document: "document",
  settings: "objective",
  export: "export",
  view: "navigation",
  webmcp: "webmcp",
};

function EventLog({ steps }: { steps: readonly ReplayStep[] }) {
  if (steps.length === 0) {
    return <EmptyState>Nothing recorded yet. Every human action and tool call lands here.</EmptyState>;
  }

  return (
    <ol className="space-y-1.5">
      {[...steps].reverse().map((step) => (
        <EventRow key={step.event.id} event={step.event} />
      ))}
    </ol>
  );
}

function EventRow({ event, highlight }: { event: ActivityEntry; highlight?: boolean }) {
  const store = useStore();

  return (
    <li
      className={cx(
        "rounded-md border px-2.5 py-2",
        highlight ? "border-bridge-600 bg-bridge-50" : "border-ink-200",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[9px] text-ink-400">{event.id}</span>
        <Chip tone={event.source === "ui" ? "neutral" : event.source === "native-webmcp" ? "brand" : "warning"}>
          {INVOCATION_SOURCE_LABELS[event.source]}
        </Chip>
        <Chip tone={KIND_TONE[event.kind] ?? "neutral"}>{KIND_LABEL[event.kind] ?? event.kind}</Chip>
        {event.tool !== null && <Mono>{event.tool}</Mono>}
      </div>

      <p className="mt-1 text-[11px] leading-snug text-ink-900">{event.summary}</p>

      {event.detail !== null && (
        <p className="mt-0.5 break-words text-[10px] leading-snug text-ink-500">{event.detail}</p>
      )}

      {(event.before !== null || event.after !== null) && (
        <dl className="mt-1 space-y-0.5 text-[10px] leading-snug">
          {event.before !== null && (
            <div className="flex gap-1.5">
              <dt className="w-10 shrink-0 text-ink-400">before</dt>
              <dd className="min-w-0 flex-1 text-[color:var(--color-diff-del-fg)]">{event.before}</dd>
            </div>
          )}
          {event.after !== null && (
            <div className="flex gap-1.5">
              <dt className="w-10 shrink-0 text-ink-400">after</dt>
              <dd className="min-w-0 flex-1 text-[color:var(--color-diff-ins-fg)]">{event.after}</dd>
            </div>
          )}
        </dl>
      )}

      {event.clauseIds.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-[9px] uppercase tracking-wide text-ink-400">Focus</span>
          {event.clauseIds.map((clauseId) => (
            <button
              key={clauseId}
              type="button"
              onClick={() => store.dispatch({ type: "focus-clause", clauseId })}
              className="rounded bg-ink-100 px-1 font-mono text-[9px] text-ink-700 hover:bg-bridge-100 hover:text-bridge-700"
            >
              {clauseId}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1 font-mono text-[9px] text-ink-400">
        {event.at} · {event.revisionId}
      </p>
    </li>
  );
}

/** Steps through the record. Reads only; it never re-runs a tool. */
function Replay({ steps }: { steps: readonly ReplayStep[] }) {
  const store = useStore();
  const [index, setIndex] = useState(0);
  const clamped = Math.min(index, Math.max(steps.length - 1, 0));
  const step = steps[clamped];

  // Keyed on the event ID, not the step object. Focusing a clause bumps
  // `focusPulse`, which produces a new state and therefore a new step object on
  // every render — depending on the object itself would re-fire the effect
  // forever. The ID only changes when the human actually steps.
  const focusId = step?.event.clauseIds[0] ?? null;
  const eventId = step?.event.id ?? null;

  useEffect(() => {
    if (eventId === null || focusId === null) return;
    store.dispatch({ type: "focus-clause", clauseId: focusId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focusId is derived from eventId
  }, [eventId, store]);

  if (steps.length === 0 || step === undefined) {
    return <EmptyState>Nothing to replay yet. Run the demo and the record fills in.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
        <strong className="font-semibold">A view of what was recorded.</strong> Stepping through
        calls no tool and produces no new events — it replays the stored log and shows the wording
        the agreement had at each point.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" disabled={clamped === 0} onClick={() => setIndex(0)} aria-label="First event">
          ⏮
        </Button>
        <Button
          size="sm"
          disabled={clamped === 0}
          onClick={() => setIndex(clamped - 1)}
          aria-label="Previous event"
        >
          ◀ Back
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={clamped >= steps.length - 1}
          onClick={() => setIndex(clamped + 1)}
          aria-label="Next event"
        >
          Next ▶
        </Button>
        <span className="text-[10px] text-ink-500" role="status">
          Step {clamped + 1} of {steps.length}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={steps.length - 1}
        value={clamped}
        aria-label="Replay position"
        onChange={(event) => setIndex(Number.parseInt(event.target.value, 10))}
        className="w-full accent-[color:var(--color-bridge-600)]"
      />

      <ol className="space-y-1.5">
        <EventRow event={step.event} highlight />
      </ol>

      {step.toolCall !== null && (
        <div className="rounded-md border border-bridge-100 bg-bridge-50 px-2.5 py-2 text-[10px] leading-snug text-ink-700">
          <p className="font-semibold text-bridge-700">Recorded tool call {step.toolCall.id}</p>
          <p className="mt-0.5">{step.toolCall.inputSummary}</p>
          <p className="mt-0.5 text-ink-500">{step.toolCall.stateEffect}</p>
        </div>
      )}

      <p className="text-[10px] text-ink-400">
        {step.checkpoint === null
          ? "The agreement still read as the original at this point."
          : `Preview revision in force: ${step.checkpoint.id} — ${step.checkpoint.label}.`}
      </p>
    </div>
  );
}

/** What changed between two human-approved states. */
function RevisionInspector() {
  const session = useSession();
  const store = useStore();
  const state = session.present;

  const options = useMemo(
    () => [
      { id: "", label: "Original agreement" },
      ...state.checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        label: `${checkpoint.id} — ${checkpoint.label}`,
      })),
    ],
    [state.checkpoints],
  );

  const latest = state.checkpoints.at(-1)?.id ?? "";
  const previous = state.checkpoints.at(-2)?.id ?? "";
  const [from, setFrom] = useState(previous);
  const [to, setTo] = useState(latest);

  const comparison = useMemo(
    () => compareCheckpoints(state, from === "" ? null : from, to === "" ? null : to),
    [state, from, to],
  );

  if (state.checkpoints.length === 0) {
    return (
      <EmptyState>
        No preview revision yet. Accept a proposal and the agreement it produces is captured here,
        with the decisions that made it.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
        Each preview revision is the agreement as your decisions left it. The source document is
        never overwritten — restoring a revision replays the decisions that produced it.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[10px] text-ink-500">
          From
          <select
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded border border-ink-200 bg-white px-1.5 py-1 text-[11px] text-ink-900"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] text-ink-500">
          To
          <select
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded border border-ink-200 bg-white px-1.5 py-1 text-[11px] text-ink-900"
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {to !== "" && (
          <Button
            size="sm"
            title="Replay the decisions that produced this revision"
            onClick={() => store.dispatch({ type: "restore-checkpoint", checkpointId: to })}
          >
            Restore “{to}”
          </Button>
        )}
      </div>

      {comparison === null ? (
        <EmptyState>That pair of revisions is no longer available.</EmptyState>
      ) : comparison.changes.length === 0 ? (
        <EmptyState>
          No clause reads differently between {comparison.fromLabel} and {comparison.toLabel}.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="edited">{comparison.changes.length} clause(s) changed</Chip>
            <span className="text-[10px] text-ink-500">
              +{comparison.wordsAdded} / −{comparison.wordsRemoved} words
            </span>
          </div>

          {comparison.changes.map((change) => (
            <div key={change.clauseId} className="rounded-md border border-ink-200 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    store.dispatch({ type: "focus-clause", clauseId: change.clauseId })
                  }
                  className="text-[11px] font-semibold text-ink-900 hover:text-bridge-600"
                >
                  {change.ordinal}. {change.title}
                </button>
                <Mono>{change.clauseId}</Mono>
              </div>
              <div className="mt-1.5 rounded border border-ink-100 bg-ink-50 p-2">
                <InlineDiff before={change.beforeText} after={change.afterText} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
