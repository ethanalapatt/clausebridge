"use client";

import { useEffect, useMemo } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ConstraintStatusChip } from "@/components/ConstraintChips";
import { InlineDiff } from "@/components/InlineDiff";
import { Button, Chip, DecisionChip, EmptyState, Mono, PriorityChip, cx } from "@/components/ui";
import { constraintLabel } from "@/core/constraints";
import { goldenPathSteps } from "@/core/demo";
import { replaySteps } from "@/core/replay";
import { boardStatuses, clauseComparisons } from "@/core/review";
import type { ProposalView } from "@/core/review";
import { effectiveClauseText, findClause } from "@/core/state";
import { INVOCATION_SOURCE_LABELS } from "@/core/types";

/**
 * Presentation mode.
 *
 * A wide, low-density view of the *same* live state and the same handlers —
 * every control here dispatches the identical action the dense workspace does.
 * It is a different arrangement of the real product, not a scripted replica of
 * it, so anything shown has genuinely happened.
 */
export function PresentationMode({ onExit }: { onExit: () => void }) {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  const steps = goldenPathSteps(state);
  const completed = steps.filter((step) => step.done).length;
  const current = steps.find((step) => !step.done) ?? null;

  const statuses = boardStatuses(state);
  const rows = useMemo(() => clauseComparisons(state), [state]);

  // The clause in focus, falling back to whichever one still has a decision
  // waiting so the stage is never blank mid-demo.
  const activeClauseId =
    state.focusedClauseId ??
    rows.find((row) => row.proposals.some((proposal) => proposal.status === "pending"))?.clauseId ??
    rows[0]?.clauseId ??
    null;

  const activeRow = rows.find((row) => row.clauseId === activeClauseId) ?? null;
  const activeClause = activeClauseId === null ? null : findClause(state, activeClauseId);
  const lastCall = state.toolCalls.at(-1) ?? null;
  const recent = useMemo(() => replaySteps(state).slice(-6).reverse(), [state]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-chrome-950 text-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-chrome-800 px-6 py-3">
        <span className="text-base font-semibold tracking-tight">ClauseBridge</span>
        <Chip tone="warning" className="!border-edited-500 !bg-transparent !text-edited-500">
          Fictional demo · not legal advice
        </Chip>
        <span className="text-[12px] text-chrome-600">
          {state.revision.documentTitle} · {state.revision.revisionId}
        </span>

        <span className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-chrome-600">
            Step {Math.min(completed + 1, steps.length)} of {steps.length}
          </span>
          <Button
            size="sm"
            onClick={onExit}
            className="!border-chrome-700 !bg-chrome-800 !text-white hover:!bg-chrome-700"
          >
            Exit presentation (Esc)
          </Button>
        </span>
      </header>

      {current !== null && (
        <p className="border-b border-chrome-800 bg-chrome-900 px-6 py-2 text-[13px] text-chrome-600">
          <span className="font-semibold text-white">Next — {current.label}:</span> {current.hint}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 lg:grid-cols-[20rem_minmax(0,1fr)_22rem]">
        <section className="space-y-3">
          <Card title="What the human is holding to">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="brand">{state.partyRole}</Chip>
              {state.revision.clauses
                .filter((clause) => state.nonNegotiableClauseIds.includes(clause.id))
                .map((clause) => (
                  <Chip key={clause.id} tone="rejected">
                    {clause.title} locked
                  </Chip>
                ))}
            </div>

            {statuses.length === 0 ? (
              <p className="mt-2 text-[12px] text-chrome-600">
                No constraints set yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {statuses.map((status) => (
                  <li key={status.constraint.id} className="flex flex-wrap items-center gap-1.5">
                    {status.result === null ? (
                      <Chip>Not evaluated</Chip>
                    ) : (
                      <ConstraintStatusChip
                        status={status.result.status}
                        severity={status.constraint.severity}
                      />
                    )}
                    <span className="text-[12px] leading-snug text-white">
                      {constraintLabel(status.constraint)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {state.objectiveNote.length > 0 && (
              <p className="mt-2 border-l-2 border-bridge-500 pl-2 text-[12px] italic leading-relaxed text-chrome-600">
                {state.objectiveNote}
              </p>
            )}
          </Card>

          <Card title="Last tool call">
            {lastCall === null ? (
              <p className="text-[12px] text-chrome-600">No tool has been called yet.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Mono className="!bg-chrome-800 !text-white">{lastCall.tool}</Mono>
                  <Chip tone={lastCall.source === "native-webmcp" ? "brand" : "warning"}>
                    {INVOCATION_SOURCE_LABELS[lastCall.source]}
                  </Chip>
                  <Chip tone={lastCall.outcome === "ok" ? "approved" : "rejected"}>
                    <span aria-hidden>{lastCall.outcome === "ok" ? "✓" : "✕"}</span>
                    {lastCall.outcome === "ok" ? "accepted" : "rejected"}
                  </Chip>
                </div>
                <p className="mt-1.5 text-[12px] text-white">{lastCall.inputSummary}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-chrome-600">
                  {lastCall.validation}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-chrome-600">
                  {lastCall.stateEffect}
                </p>
              </>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <Card title="The clause under review">
            {activeClause === null ? (
              <p className="text-[12px] text-chrome-600">
                Nothing focused yet. Retrieve context or stage a package to begin.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="font-serif text-[17px] font-semibold text-white">
                    {activeClause.ordinal}. {activeClause.title}
                  </h2>
                  <Mono className="!bg-chrome-800 !text-white">{activeClause.id}</Mono>
                  {state.nonNegotiableClauseIds.includes(activeClause.id) && (
                    <Chip tone="rejected">Non-negotiable</Chip>
                  )}
                  {activeRow !== null && <DecisionChip status={activeRow.decisionStatus} />}
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-md bg-paper p-4 font-serif text-[14px] leading-[1.75] text-ink-900">
                  {activeRow === null || activeRow.currentText === activeRow.originalText ? (
                    <p className="whitespace-pre-wrap">{effectiveClauseText(state, activeClause.id)}</p>
                  ) : (
                    <InlineDiff before={activeRow.originalText} after={activeRow.currentText} />
                  )}
                </div>

                <p className="mt-2 text-[11px] text-chrome-600">
                  The source agreement is never overwritten. What you see is the wording produced by
                  the decisions taken so far.
                </p>
              </>
            )}
          </Card>

          <Card title="Recent record">
            {recent.length === 0 ? (
              <p className="text-[12px] text-chrome-600">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {recent.map((step) => (
                  <li key={step.event.id} className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[10px] text-chrome-600">{step.event.id}</span>
                    <Chip
                      tone={
                        step.event.source === "ui"
                          ? "neutral"
                          : step.event.source === "native-webmcp"
                            ? "brand"
                            : "warning"
                      }
                    >
                      {INVOCATION_SOURCE_LABELS[step.event.source]}
                    </Chip>
                    <span className="min-w-0 flex-1 text-[12px] leading-snug text-white">
                      {step.event.summary}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>

        <section className="space-y-3">
          <Card title="Alternatives on the table">
            {activeRow === null ? (
              <EmptyState>Stage a package and its alternatives appear here.</EmptyState>
            ) : (
              <div className="space-y-2">
                {activeRow.proposals.map((proposal) => (
                  <PresentedProposal key={proposal.editId} proposal={proposal} />
                ))}
              </div>
            )}
          </Card>

          {rows.length > 0 && (
            <Card title="Clauses with proposals">
              <div className="flex flex-wrap gap-1.5">
                {rows.map((row) => (
                  <button
                    key={row.clauseId}
                    type="button"
                    aria-pressed={row.clauseId === activeClauseId}
                    onClick={() =>
                      store.dispatch({ type: "focus-clause", clauseId: row.clauseId })
                    }
                    className={cx(
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                      row.clauseId === activeClauseId
                        ? "border-bridge-500 bg-bridge-600 text-white"
                        : "border-chrome-700 bg-chrome-800 text-chrome-600 hover:text-white",
                    )}
                  >
                    {row.title}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-chrome-700 bg-chrome-900 p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-chrome-600">
        {title}
      </h3>
      {children}
    </section>
  );
}

function PresentedProposal({ proposal }: { proposal: ProposalView }) {
  const store = useStore();
  const relevant = proposal.constraints.filter((result) => result.status !== "not_applicable");

  return (
    <article
      className={cx(
        "rounded-md border p-3",
        proposal.governing
          ? "border-approved-500 bg-approved-500/10"
          : proposal.status === "rejected"
            ? "border-chrome-700 bg-chrome-800/50 opacity-70"
            : "border-proposed-500 bg-chrome-800",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="proposed">{proposal.packageLabel}</Chip>
        <PriorityChip tag={proposal.priorityTag} />
        <DecisionChip status={proposal.status} />
        {proposal.governing && <Chip tone="approved">Chosen</Chip>}
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-chrome-600">{proposal.rationale}</p>

      {relevant.length > 0 && (
        <ul className="mt-2 space-y-1">
          {relevant.map((result) => (
            <li key={result.constraintId} className="flex flex-wrap items-center gap-1.5">
              <ConstraintStatusChip status={result.status} severity={result.severity} />
              <span className="text-[11px] leading-snug text-chrome-600">
                {result.explanation}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="approve"
          disabled={proposal.status === "approved"}
          onClick={() => store.dispatch({ type: "approve-edit", editId: proposal.editId })}
        >
          {proposal.governing ? "Chosen" : "Choose this"}
        </Button>
        <Button
          size="sm"
          variant="reject"
          disabled={proposal.status === "rejected"}
          onClick={() => store.dispatch({ type: "reject-edit", editId: proposal.editId })}
        >
          Reject
        </Button>
      </div>
    </article>
  );
}
