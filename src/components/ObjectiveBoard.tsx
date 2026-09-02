"use client";

import { useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ConstraintStatusChip, SeverityChip, TallyRow } from "@/components/ConstraintChips";
import { ImportDialog } from "@/components/ImportDialog";
import { Button, Chip, DecisionChip, EmptyState, Mono, Panel, cx } from "@/components/ui";
import {
  CONSTRAINT_RULES,
  CONSTRAINT_SEVERITIES,
  CONSTRAINT_SEVERITY_LABELS,
  constraintLabel,
  findRule,
} from "@/core/constraints";
import type { Constraint, ConstraintSeverity } from "@/core/constraints";
import { boardStatuses, boardTally } from "@/core/review";
import { clauseDecisionStatus, isNonNegotiable, isSelected } from "@/core/state";
import { CLAUSE_TYPE_LABELS, PARTY_ROLES, PARTY_ROLE_LABELS } from "@/core/types";
import type { AppState, PartyRole } from "@/core/types";

const SUGGESTED_PRIORITIES = [
  "termination",
  "data retention",
  "liability",
  "security",
  "payment",
  "confidentiality",
];

/**
 * Pane 1: the negotiation objective board.
 *
 * One surface for the whole human posture — who you are negotiating as, which
 * clauses the agent may touch, what cannot move, the conditions you are holding
 * to, and why. Everything the agent sees and everything a proposal is judged
 * against is set here, so there is one place to look rather than four scattered
 * controls.
 */
export function ObjectiveBoard() {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const revision = state.revision;
  const [importOpen, setImportOpen] = useState(false);

  function togglePriority(area: string) {
    const next = state.priorityAreas.includes(area)
      ? state.priorityAreas.filter((item) => item !== area)
      : [...state.priorityAreas, area];
    store.dispatch({ type: "set-priority-areas", areas: next });
  }

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}

      <Panel
        title="Document"
        subtitle={revision.source === "seed" ? "Bundled fictional sample" : "Pasted text"}
      >
        <h3 className="text-[13px] font-semibold leading-snug text-ink-900">
          {revision.documentTitle}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone="brand" title="Document revision. Clause IDs are namespaced under it.">
            {revision.revisionId}
          </Chip>
          <Chip>{revision.clauses.length} clauses</Chip>
          {revision.segmentationConfidence === "low" && (
            <Chip tone="warning">Low-confidence segmentation</Chip>
          )}
          <Chip tone="warning">Fictional</Chip>
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => store.dispatch({ type: "load-seed" })}>
            Load seeded demo
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            Paste / correct text
          </Button>
        </div>
      </Panel>

      <Panel title="Negotiating as" subtitle="Filters which fictional fallback wording is offered">
        <div className="flex gap-1.5" role="group" aria-label="Party role">
          {PARTY_ROLES.map((role: PartyRole) => (
            <button
              key={role}
              type="button"
              aria-pressed={state.partyRole === role}
              onClick={() => store.dispatch({ type: "set-role", role })}
              className={cx(
                "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                state.partyRole === role
                  ? "border-bridge-600 bg-bridge-50 text-bridge-700"
                  : "border-ink-200 bg-white text-ink-500 hover:border-ink-400 hover:text-ink-900",
              )}
            >
              {PARTY_ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold text-ink-700">Priority areas</p>
          <p className="mt-0.5 text-[10px] leading-snug text-ink-500">
            Passed to the agent verbatim as <Mono>priorityAreas</Mono>.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTED_PRIORITIES.map((area) => {
              const active = state.priorityAreas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePriority(area)}
                  className={cx(
                    "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    active
                      ? "border-bridge-600 bg-bridge-600 text-white"
                      : "border-ink-200 bg-white text-ink-500 hover:border-ink-400",
                  )}
                >
                  {area}
                </button>
              );
            })}
          </div>
        </div>

        <ObjectiveNote state={state} />
      </Panel>

      <ConstraintsPanel state={state} />

      <Panel
        title="Clause outline"
        subtitle="Select clauses for the agent; mark what cannot move"
        actions={
          state.selectedClauseIds.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => store.dispatch({ type: "clear-selection" })}
            >
              Clear ({state.selectedClauseIds.length})
            </Button>
          ) : undefined
        }
        bodyClassName="p-2"
      >
        <ul className="space-y-0.5">
          {revision.clauses.map((clause) => {
            const selected = isSelected(state, clause.id);
            const locked = isNonNegotiable(state, clause.id);
            const decision = clauseDecisionStatus(state, clause.id);
            const focused = state.focusedClauseId === clause.id;

            return (
              <li key={clause.id}>
                <div
                  className={cx(
                    "rounded-md border px-2 py-1.5 transition-colors",
                    focused
                      ? "border-bridge-500 bg-bridge-50"
                      : "border-transparent hover:bg-ink-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() =>
                        store.dispatch({ type: "toggle-selected", clauseId: clause.id })
                      }
                      aria-label={`Select ${clause.title}`}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--color-bridge-600)]"
                    />

                    <button
                      type="button"
                      onClick={() => store.dispatch({ type: "focus-clause", clauseId: clause.id })}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[12px] font-medium text-ink-900">
                        {clause.ordinal}. {clause.title}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-ink-400">
                        {CLAUSE_TYPE_LABELS[clause.clauseType]} · {clause.id}
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-pressed={locked}
                      title={
                        locked ? "Clear non-negotiable marker" : "Mark this clause non-negotiable"
                      }
                      onClick={() =>
                        store.dispatch({ type: "toggle-non-negotiable", clauseId: clause.id })
                      }
                      className={cx(
                        "mt-0.5 shrink-0 rounded border px-1 py-0.5 text-[10px] font-semibold transition-colors",
                        locked
                          ? "border-rejected-500 bg-rejected-100 text-rejected-700"
                          : "border-ink-200 text-ink-400 hover:border-rejected-500 hover:text-rejected-700",
                      )}
                    >
                      {locked ? "Locked" : "Lock"}
                    </button>
                  </div>

                  {(decision !== "none" || clause.inferred) && (
                    <div className="mt-1 flex flex-wrap gap-1 pl-[1.375rem]">
                      {decision !== "none" && <DecisionChip status={decision} />}
                      {clause.inferred && <Chip tone="warning">Boundary guessed</Chip>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}

/** Free text explaining intent. Never read by any rule. */
function ObjectiveNote({ state }: { state: AppState }) {
  const store = useStore();
  const [draft, setDraft] = useState(state.objectiveNote);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="mt-4">
        <p className="text-[11px] font-semibold text-ink-700">What you are trying to achieve</p>
        {state.objectiveNote.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              setDraft(state.objectiveNote);
              setEditing(true);
            }}
            className="mt-1 w-full rounded-md border border-dashed border-ink-200 px-2 py-2 text-left text-[11px] text-ink-400 hover:border-ink-400 hover:text-ink-700"
          >
            Add a note for your own record…
          </button>
        ) : (
          <div className="mt-1 rounded-md border-l-2 border-bridge-500 bg-bridge-50 px-2 py-1.5">
            <p className="text-[11px] leading-relaxed text-ink-700">{state.objectiveNote}</p>
            <button
              type="button"
              onClick={() => {
                setDraft(state.objectiveNote);
                setEditing(true);
              }}
              className="mt-1 text-[10px] text-ink-400 hover:text-bridge-600"
            >
              Edit note
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <label
        htmlFor="objective-note"
        className="text-[11px] font-semibold text-ink-700"
      >
        What you are trying to achieve
      </label>
      <textarea
        id="objective-note"
        value={draft}
        rows={3}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Context for you and anyone reading the exported record. No rule reads this."
        className="mt-1 w-full resize-y rounded border border-ink-200 p-2 text-[11px] leading-relaxed text-ink-900"
      />
      <div className="mt-1.5 flex gap-1.5">
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            store.dispatch({ type: "set-objective-note", note: draft });
            setEditing(false);
          }}
        >
          Save note
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The Must / Prefer / Avoid conditions, with where each one currently stands. */
function ConstraintsPanel({ state }: { state: AppState }) {
  const store = useStore();
  const [adding, setAdding] = useState(false);
  const statuses = boardStatuses(state);

  const unused = CONSTRAINT_RULES.filter(
    (rule) => !state.constraints.some((constraint) => constraint.ruleId === rule.id),
  );

  return (
    <Panel
      title="Constraints"
      subtitle="Deterministic conditions checked against exact clause text"
      actions={
        unused.length > 0 ? (
          <Button size="sm" onClick={() => setAdding((open) => !open)}>
            {adding ? "Close" : "Add"}
          </Button>
        ) : undefined
      }
    >
      <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
        Each rule reads one clause type with a narrow, published pattern. It reports what it found —
        never a legal opinion — and returns <strong>unresolved</strong> when the wording contains
        nothing it can read.
      </p>

      {adding && (
        <div className="mt-2 space-y-1.5 rounded-md border border-bridge-100 bg-bridge-50 p-2">
          {unused.map((rule) => (
            <button
              key={rule.id}
              type="button"
              onClick={() => {
                store.dispatch({
                  type: "add-constraint",
                  ruleId: rule.id,
                  severity: rule.defaultSeverity,
                  value: rule.defaultValue,
                });
                setAdding(false);
              }}
              className="block w-full rounded border border-ink-200 bg-white px-2 py-1.5 text-left hover:border-bridge-600"
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <SeverityChip severity={rule.defaultSeverity} />
                <span className="text-[11px] font-medium text-ink-900">
                  {rule.label(rule.defaultValue)}
                </span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-snug text-ink-500">
                Reads {CLAUSE_TYPE_LABELS[rule.clauseType]} · {rule.inspects}
              </span>
            </button>
          ))}
        </div>
      )}

      {state.constraints.length === 0 ? (
        <div className="mt-2">
          <EmptyState>
            No constraints yet. Add one and every staged proposal is checked against it.
          </EmptyState>
        </div>
      ) : (
        <>
          <TallyRow tally={boardTally(state)} className="mt-2.5" />
          <ul className="mt-2 space-y-1.5">
            {statuses.map((status) => (
              <ConstraintRow key={status.constraint.id} status={status} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function ConstraintRow({
  status,
}: {
  status: ReturnType<typeof boardStatuses>[number];
}) {
  const store = useStore();
  const { constraint, result, clauseId, clauseTitle } = status;
  const rule = findRule(constraint.ruleId);
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-md border border-ink-200 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <SeverityChip severity={constraint.severity} />
        {result === null ? (
          <Chip>No clause of this type</Chip>
        ) : (
          <ConstraintStatusChip status={result.status} />
        )}
        <Mono>{constraint.id}</Mono>
      </div>

      <p className="mt-1 text-[11px] font-medium leading-snug text-ink-900">
        {constraintLabel(constraint)}
      </p>

      {constraint.note !== null && (
        <p className="mt-0.5 text-[10px] italic leading-snug text-ink-500">{constraint.note}</p>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-[10px] text-ink-400 hover:text-bridge-600"
        >
          {open ? "Hide evidence" : "Why"}
        </button>
        {clauseId !== null && (
          <button
            type="button"
            onClick={() => store.dispatch({ type: "focus-clause", clauseId })}
            className="text-[10px] text-ink-400 hover:text-bridge-600"
          >
            {clauseTitle}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            store.dispatch({ type: "remove-constraint", constraintId: constraint.id })
          }
          className="ml-auto text-[10px] text-ink-400 hover:text-rejected-700"
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="mt-1.5 space-y-1.5 rounded border border-ink-100 bg-ink-50 p-2">
          <p className="text-[10px] leading-relaxed text-ink-700">
            {result?.explanation ??
              "This document has no clause of the type this rule reads, so nothing was evaluated."}
          </p>
          {result !== null && (
            <p className="text-[10px] leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">Text read: </span>
              {result.evidence}
            </p>
          )}
          {rule !== null && (
            <p className="text-[10px] leading-relaxed text-ink-400">
              <span className="font-semibold">Rule: </span>
              {rule.inspects}
            </p>
          )}
          <ConstraintControls constraint={constraint} />
        </div>
      )}
    </li>
  );
}

/** Severity and threshold, editable in place. */
function ConstraintControls({ constraint }: { constraint: Constraint }) {
  const store = useStore();
  const rule = findRule(constraint.ruleId);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-1.5">
      <div className="flex gap-1" role="group" aria-label="Severity">
        {CONSTRAINT_SEVERITIES.map((severity: ConstraintSeverity) => (
          <button
            key={severity}
            type="button"
            aria-pressed={constraint.severity === severity}
            onClick={() =>
              store.dispatch({
                type: "update-constraint",
                constraintId: constraint.id,
                severity,
              })
            }
            className={cx(
              "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              constraint.severity === severity
                ? "border-bridge-600 bg-bridge-600 text-white"
                : "border-ink-200 bg-white text-ink-500 hover:border-ink-400",
            )}
          >
            {CONSTRAINT_SEVERITY_LABELS[severity]}
          </button>
        ))}
      </div>

      {rule !== null && rule.defaultValue !== null && (
        <label className="flex items-center gap-1 text-[10px] text-ink-500">
          <span>{rule.unit === "months" ? "Months" : "Days"}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={constraint.value ?? 0}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (!Number.isInteger(next) || next < 0) return;
              store.dispatch({
                type: "update-constraint",
                constraintId: constraint.id,
                value: next,
              });
            }}
            aria-label={`${rule.label(constraint.value)} threshold`}
            className="w-14 rounded border border-ink-200 px-1 py-0.5 text-[10px] text-ink-900"
          />
        </label>
      )}
    </div>
  );
}

/**
 * The compact posture summary, shown beside the proposals so the conditions a
 * reviewer set stay visible while they decide.
 */
export function ObjectiveSummary() {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const statuses = boardStatuses(state);

  const locked = state.revision.clauses.filter((clause) => isNonNegotiable(state, clause.id));

  return (
    <div className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Your objectives
        </span>
        <Chip tone="brand">{PARTY_ROLE_LABELS[state.partyRole]}</Chip>
        {locked.map((clause) => (
          <button key={clause.id} type="button" onClick={() => store.dispatch({ type: "focus-clause", clauseId: clause.id })}>
            <Chip tone="rejected">{clause.title} locked</Chip>
          </button>
        ))}
        {state.priorityAreas.map((area) => (
          <Chip key={area}>{area}</Chip>
        ))}
      </div>

      {statuses.length === 0 ? (
        <p className="mt-1.5 text-[10px] text-ink-400">
          No constraints set. Add them on the objective board to have proposals checked.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {statuses.map((status) => (
            <li key={status.constraint.id} className="flex flex-wrap items-center gap-1.5">
              {status.result === null ? (
                <Chip>Not evaluated</Chip>
              ) : (
                <ConstraintStatusChip status={status.result.status} severity={status.constraint.severity} />
              )}
              <span className="text-[10px] leading-snug text-ink-700">
                {constraintLabel(status.constraint)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
