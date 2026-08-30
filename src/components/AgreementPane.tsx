"use client";

import { useEffect, useRef } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { InlineDiff } from "@/components/InlineDiff";
import { RedlineCard } from "@/components/RedlineCard";
import { Chip, DecisionChip, Mono, cx } from "@/components/ui";
import {
  clauseDecisionStatus,
  editsForClause,
  effectiveClauseText,
  governingEdit,
  isNonNegotiable,
  isSelected,
} from "@/core/state";
import { CLAUSE_TYPE_LABELS } from "@/core/types";
import type { AppState, Clause } from "@/core/types";

const PULSE_CLASS = "clause-focus-pulse";

/**
 * Pane 2: the readable agreement.
 *
 * Every clause is a stable anchor. When a tool call focuses a clause the pane
 * scrolls to it and pulses once — driven by the real `focusPulse` counter in
 * state, not by a decorative timer.
 */
export function AgreementPane() {
  const session = useSession();
  const state = session.present;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clauseId = state.focusedClauseId;
    const container = containerRef.current;
    if (clauseId === null || container === null) return;

    const node = container.querySelector<HTMLElement>(
      `[data-clause-id="${CSS.escape(clauseId)}"]`,
    );
    if (node === null) return;

    // Centre the clause in the scrollport. Computed from rects rather than
    // offsetTop so it does not depend on which ancestor happens to be the
    // offsetParent.
    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const centred =
      container.scrollTop +
      (nodeRect.top - containerRect.top) -
      (container.clientHeight - nodeRect.height) / 2;
    const target = Math.max(0, Math.min(centred, container.scrollHeight - container.clientHeight));

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    container.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });

    // Some embedded and automated browsers accept `behavior: "smooth"` and then
    // silently do nothing. Landing on the clause matters more than the easing,
    // so verify and snap if the smooth scroll never happened.
    const settle = window.setTimeout(() => {
      if (Math.abs(container.scrollTop - target) > 4) container.scrollTop = target;
    }, 450);

    // Restart the pulse without remounting the clause: drop the class, force a
    // reflow so the browser registers the removal, then re-apply it. Re-keying
    // the element instead would tear down every clause on each tool call.
    node.classList.remove(PULSE_CLASS);
    void node.offsetWidth;
    node.classList.add(PULSE_CLASS);

    return () => window.clearTimeout(settle);
  }, [state.focusedClauseId, state.focusPulse]);

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-paper-edge bg-paper"
    >
      <div className="mx-auto max-w-[46rem] px-8 py-8">
        <h1 className="font-serif text-xl leading-snug text-ink-900">
          {state.revision.documentTitle}
        </h1>
        <p className="mt-1.5 text-[11px] text-ink-500">
          Revision <Mono>{state.revision.revisionId}</Mono> · {state.revision.clauses.length} clauses
          · fictional sample, not a real contract
        </p>

        <div className="mt-7 space-y-7">
          {state.revision.clauses.length === 0 ? (
            <p className="rounded-md border border-dashed border-paper-edge px-4 py-10 text-center text-xs text-ink-500">
              No clauses. Load the seeded demo or paste agreement text.
            </p>
          ) : (
            state.revision.clauses.map((clause) => (
              <ClauseBlock key={clause.id} clause={clause} state={state} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ClauseBlock({ clause, state }: { clause: Clause; state: AppState }) {
  const store = useStore();
  const focused = state.focusedClauseId === clause.id;
  const edits = editsForClause(state, clause.id);
  const decision = clauseDecisionStatus(state, clause.id);
  const governing = governingEdit(state, clause.id);
  const current = effectiveClauseText(state, clause.id);
  const locked = isNonNegotiable(state, clause.id);
  const selected = isSelected(state, clause.id);

  return (
    <article
      data-clause-id={clause.id}
      className={cx(
        "scroll-mt-6 rounded-md border px-4 py-3 transition-colors",
        focused ? "border-bridge-500 bg-bridge-50/60" : "border-transparent",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-[15px] font-semibold text-ink-900">
          {clause.ordinal}. {clause.title}
        </h2>
        <Mono>{clause.id}</Mono>
        <Chip>{CLAUSE_TYPE_LABELS[clause.clauseType]}</Chip>
        {locked && <Chip tone="rejected">Non-negotiable</Chip>}
        {selected && <Chip tone="brand">Selected</Chip>}
        {decision !== "none" && <DecisionChip status={decision} />}
      </header>

      <div className="mt-2.5 font-serif text-[13.5px] leading-[1.75] text-ink-900">
        {governing === null ? (
          <p className="whitespace-pre-wrap">{clause.text}</p>
        ) : (
          <InlineDiff before={clause.text} after={current} />
        )}
      </div>

      {governing !== null && (
        <p className="mt-2 text-[11px] text-ink-500">
          Showing the accepted redline. The source clause is unchanged and is restored if you undo
          or reject.
        </p>
      )}

      {edits.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-proposed-500 pl-3">
          {edits.map((edit) => (
            <RedlineCard key={edit.editId} edit={edit} state={state} />
          ))}
        </div>
      )}

      {edits.length === 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => store.dispatch({ type: "focus-clause", clauseId: clause.id })}
            className="text-[10px] text-ink-400 hover:text-bridge-600"
          >
            Focus this clause
          </button>
        </div>
      )}
    </article>
  );
}
