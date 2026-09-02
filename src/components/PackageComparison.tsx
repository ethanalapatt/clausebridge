"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ConstraintStatusChip, TallyRow } from "@/components/ConstraintChips";
import { InlineDiff } from "@/components/InlineDiff";
import { ObjectiveSummary } from "@/components/ObjectiveBoard";
import {
  Button,
  Chip,
  DecisionChip,
  EmptyState,
  Mono,
  PriorityChip,
  cx,
} from "@/components/ui";
import { constraintLabel } from "@/core/constraints";
import { PACKAGE_PRESETS, buildPackage } from "@/core/demo";
import { clauseComparisons, packageViews } from "@/core/review";
import type { ClauseComparison, ProposalView } from "@/core/review";
import { CLAUSE_TYPE_LABELS, INVOCATION_SOURCE_LABELS } from "@/core/types";

/**
 * The alternative-package comparison surface.
 *
 * Competing proposals for a clause are shown together against the wording the
 * clause currently has, each with its own evidence: the exact diff, the
 * rationale it arrived with, which bundled library entry it came from, and where
 * it lands on every constraint the human set. Choosing one is a per-clause
 * decision, not a per-package one — accepting a proposal returns its rival to
 * awaiting decision rather than rejecting it, so the alternative stays available
 * for comparison.
 */
export function PackageComparison() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const packages = useMemo(() => packageViews(state), [state]);
  const rows = useMemo(() => clauseComparisons(state), [state]);
  const [focusPackage, setFocusPackage] = useState<string | null>(null);

  const staged = new Set(state.packages.map((pkg) => pkg.packageLabel));
  const remaining = PACKAGE_PRESETS.filter(
    (preset) => !staged.has(preset.label) && buildPackage(state, preset.posture) !== null,
  );

  return (
    <div className="space-y-3">
      <ObjectiveSummary />

      {packages.length === 0 ? (
        <EmptyState>
          Nothing to compare yet. Stage two contrasting packages from the Agent tab — or let a
          connected agent call <Mono>stage_redline_package</Mono> twice — and their proposals will
          line up here, clause by clause.
        </EmptyState>
      ) : (
        <>
          <div className="space-y-2">
            {packages.map((view) => (
              <section
                key={view.packageId}
                className={cx(
                  "rounded-md border p-2.5 transition-colors",
                  focusPackage === view.packageId
                    ? "border-bridge-600 bg-bridge-50"
                    : "border-ink-200 bg-white",
                )}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={focusPackage === view.packageId}
                    onClick={() =>
                      setFocusPackage((current) =>
                        current === view.packageId ? null : view.packageId,
                      )
                    }
                    className="text-[12px] font-semibold text-ink-900 hover:text-bridge-600"
                    title="Show only this package below"
                  >
                    {view.packageLabel}
                  </button>
                  <Mono>{view.packageId}</Mono>
                  {view.counts.lockedClauses > 0 && (
                    <Chip tone="rejected">
                      touches {view.counts.lockedClauses} locked clause
                      {view.counts.lockedClauses === 1 ? "" : "s"}
                    </Chip>
                  )}
                </div>

                <p className="mt-0.5 text-[10px] text-ink-400">
                  Staged via {INVOCATION_SOURCE_LABELS[view.package.source]} against{" "}
                  {view.package.revisionId} · {view.counts.proposed} proposed ·{" "}
                  {view.counts.approved + view.counts.edited} accepted · {view.counts.rejected}{" "}
                  rejected · {view.counts.pending} awaiting
                </p>

                <TallyRow tally={view.tally} className="mt-1.5" />

                {view.counts.pending > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="approve"
                      title={`Approve the ${view.counts.pending} proposal(s) still awaiting a decision`}
                      onClick={() =>
                        store.dispatch({
                          type: "decide-package",
                          packageId: view.packageId,
                          decision: "approved",
                        })
                      }
                    >
                      Accept remaining {view.counts.pending}
                    </Button>
                    <Button
                      size="sm"
                      variant="reject"
                      onClick={() =>
                        store.dispatch({
                          type: "decide-package",
                          packageId: view.packageId,
                          decision: "rejected",
                        })
                      }
                    >
                      Reject remaining {view.counts.pending}
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>

          {focusPackage !== null && (
            <p role="status" className="text-[10px] text-bridge-700">
              Showing one package. <button type="button" className="underline" onClick={() => setFocusPackage(null)}>Show all alternatives</button>
            </p>
          )}

          {rows.map((row) => (
            <ClauseRow key={row.clauseId} row={row} focusPackage={focusPackage} />
          ))}
        </>
      )}

      {remaining.length > 0 && (
        <div className="rounded-md border border-dashed border-ink-200 p-2.5">
          <p className="text-[10px] leading-relaxed text-ink-500">
            {packages.length === 0
              ? "Stage an alternative to begin."
              : "Another contrasting alternative is available to stage:"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {remaining.map((preset) => (
              <Button
                key={preset.posture}
                size="sm"
                title={preset.blurb}
                onClick={() => {
                  const input = buildPackage(state, preset.posture);
                  if (input !== null) store.stageRedlinePackage(input, "local-handler-test");
                }}
              >
                Stage “{preset.label}”
              </Button>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-ink-400">
            Staged through the same <Mono>stage_redline_package</Mono> handler a connected agent
            calls, and tagged “local handler test” in the record.
          </p>
        </div>
      )}
    </div>
  );
}

function ClauseRow({
  row,
  focusPackage,
}: {
  row: ClauseComparison;
  focusPackage: string | null;
}) {
  const store = useStore();
  const shown = focusPackage === null
    ? row.proposals
    : row.proposals.filter((proposal) => proposal.packageId === focusPackage);

  if (shown.length === 0) return null;

  return (
    <section className="rounded-md border border-ink-200">
      <header className="border-b border-ink-100 bg-ink-50 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => store.dispatch({ type: "focus-clause", clauseId: row.clauseId })}
            className="text-[12px] font-semibold text-ink-900 hover:text-bridge-600"
          >
            {row.ordinal}. {row.title}
          </button>
          <Mono>{row.clauseId}</Mono>
          <Chip>{CLAUSE_TYPE_LABELS[row.clauseType]}</Chip>
          {row.nonNegotiable && <Chip tone="rejected">Non-negotiable</Chip>}
          <DecisionChip status={row.decisionStatus} />
        </div>

        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          As it stands
        </p>
        {row.baselineConstraints.filter((result) => result.status !== "not_applicable").length ===
        0 ? (
          <p className="text-[10px] text-ink-400">No constraint reads this clause type.</p>
        ) : (
          <ul className="mt-0.5 space-y-0.5">
            {row.baselineConstraints
              .filter((result) => result.status !== "not_applicable")
              .map((result) => (
                <li key={result.constraintId} className="flex flex-wrap items-center gap-1.5">
                  <ConstraintStatusChip status={result.status} severity={result.severity} />
                  <span className="text-[10px] text-ink-500">{result.explanation}</span>
                </li>
              ))}
          </ul>
        )}

        {row.nonNegotiable && (
          <p className="mt-1.5 rounded border border-rejected-500 bg-rejected-100 px-2 py-1 text-[10px] leading-snug text-rejected-700">
            You marked this clause non-negotiable. Proposals are still shown, and still require your
            decision — nothing about the marker prevents you from accepting one, and nothing about a
            proposal overrides the marker.
          </p>
        )}
      </header>

      <div className="space-y-2 p-2">
        {shown.map((proposal) => (
          <ProposalCard key={proposal.editId} proposal={proposal} />
        ))}
      </div>
    </section>
  );
}

/** One alternative, with everything a reviewer needs to choose or refuse it. */
function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const store = useStore();
  const session = useSession();
  // Labels come from the constraint on the board, which holds the threshold the
  // reader set; the result holds only the verdict.
  const labelFor = (constraintId: string) => {
    const constraint = session.present.constraints.find((item) => item.id === constraintId);
    return constraint === undefined ? constraintId : constraintLabel(constraint);
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.acceptedText);
  const [noting, setNoting] = useState(false);
  const [noteDraft, setNoteDraft] = useState(proposal.note ?? "");

  const relevant = proposal.constraints.filter((result) => result.status !== "not_applicable");

  return (
    <article
      className={cx(
        "rounded-md border p-2.5",
        proposal.governing
          ? "border-approved-500 bg-approved-100/40"
          : proposal.status === "rejected"
            ? "border-ink-200 bg-ink-50 opacity-75"
            : "border-proposed-500 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="proposed">{proposal.packageLabel}</Chip>
        <PriorityChip tag={proposal.priorityTag} />
        <DecisionChip status={proposal.status} />
        {proposal.governing && <Chip tone="approved">Governs this clause</Chip>}
        {proposal.stale && <Chip tone="warning">Stale — clause ID retired</Chip>}
        <span className="ml-auto font-mono text-[10px] text-ink-400">
          +{proposal.diff.wordsAdded} / −{proposal.diff.wordsRemoved}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-700">
        <span className="font-semibold text-ink-900">Rationale: </span>
        {proposal.rationale}
      </p>

      <p className="mt-1 text-[10px] leading-snug text-ink-400">
        {proposal.fallback === null ? (
          <>Wording is not from the bundled library.</>
        ) : (
          <>
            Source: <Mono>{proposal.fallback.fallbackId}</Mono> — {proposal.fallback.source}
            {proposal.fallback.verbatim ? " (verbatim)" : " (you rewrote it)"}
          </>
        )}
        {" · "}
        <Mono>{proposal.editId}</Mono>
      </p>

      <div className="mt-2 rounded border border-ink-100 bg-ink-50 p-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Exact change against the clause as it stands
        </p>
        <InlineDiff before={proposal.currentText} after={proposal.acceptedText} />
      </div>

      {relevant.length > 0 && (
        <ul className="mt-2 space-y-1">
          {relevant.map((result) => (
            <li key={result.constraintId} className="rounded border border-ink-100 px-2 py-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <ConstraintStatusChip status={result.status} severity={result.severity} />
                <span className="text-[10px] font-medium text-ink-900">
                  {labelFor(result.constraintId)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{result.explanation}</p>
              {result.evidence !== "Not evaluated." && (
                <p className="mt-0.5 text-[10px] italic leading-snug text-ink-400">
                  {result.evidence}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {proposal.humanEdited && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-ink-400 hover:text-ink-700">
            View the agent&apos;s original proposal
          </summary>
          <p className="mt-1 whitespace-pre-wrap rounded border border-ink-100 bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-500">
            {proposal.proposedText}
          </p>
        </details>
      )}

      {editing && (
        <div className="mt-2">
          <textarea
            value={draft}
            rows={5}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={`Rewrite the proposal for ${proposal.clauseTitle}`}
            className="w-full resize-y rounded border border-ink-200 p-2 text-[12px] leading-relaxed text-ink-900"
          />
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              disabled={draft.trim().length === 0}
              onClick={() => {
                store.dispatch({
                  type: "edit-replacement",
                  editId: proposal.editId,
                  text: draft,
                });
                setEditing(false);
              }}
            >
              Save my wording and accept
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {noting && (
        <div className="mt-2">
          <textarea
            value={noteDraft}
            rows={2}
            placeholder="Why this decision?"
            onChange={(event) => setNoteDraft(event.target.value)}
            aria-label={`Note on the proposal for ${proposal.clauseTitle}`}
            className="w-full resize-y rounded border border-ink-200 p-2 text-[11px] text-ink-900"
          />
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                store.dispatch({
                  type: "set-note",
                  editId: proposal.editId,
                  note: noteDraft.trim().length === 0 ? null : noteDraft,
                });
                setNoting(false);
              }}
            >
              Save note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNoting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {proposal.note !== null && !noting && (
        <p className="mt-2 rounded border-l-2 border-edited-500 bg-edited-100 px-2 py-1.5 text-[11px] text-edited-700">
          <span className="font-semibold">Note:</span> {proposal.note}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="approve"
          disabled={proposal.status === "approved"}
          title="Make this the wording that governs the clause"
          onClick={() => store.dispatch({ type: "approve-edit", editId: proposal.editId })}
        >
          {proposal.governing ? "Chosen" : "Choose this"}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setDraft(proposal.acceptedText);
            setEditing((open) => !open);
          }}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="reject"
          disabled={proposal.status === "rejected"}
          onClick={() => store.dispatch({ type: "reject-edit", editId: proposal.editId })}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNoting((open) => !open)}>
          {proposal.note === null ? "Add note" : "Edit note"}
        </Button>
        {proposal.status !== "pending" && (
          <Button
            size="sm"
            variant="ghost"
            title="Return this proposal to awaiting decision"
            onClick={() => store.dispatch({ type: "reset-edit", editId: proposal.editId })}
          >
            Reset
          </Button>
        )}
      </div>
    </article>
  );
}
