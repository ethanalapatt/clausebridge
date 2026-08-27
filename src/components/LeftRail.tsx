"use client";

import { useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ImportDialog } from "@/components/ImportDialog";
import { Button, Chip, DecisionChip, Mono, Panel, cx } from "@/components/ui";
import { clauseDecisionStatus, isNonNegotiable, isSelected } from "@/core/state";
import { CLAUSE_TYPE_LABELS, PARTY_ROLES, PARTY_ROLE_LABELS } from "@/core/types";
import type { PartyRole } from "@/core/types";

const SUGGESTED_PRIORITIES = [
  "termination",
  "data retention",
  "liability",
  "security",
  "payment",
  "confidentiality",
];

/** Pane 1: document, role, priorities, selection and non-negotiable controls. */
export function LeftRail() {
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
    <div className="flex min-h-0 flex-col gap-3">
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
        <div className="flex gap-1.5">
          {PARTY_ROLES.map((role: PartyRole) => (
            <button
              key={role}
              type="button"
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
      </Panel>

      <Panel
        title="Clause outline"
        subtitle="Select clauses for the agent; mark what cannot move"
        className="min-h-0 flex-1"
        bodyClassName="overflow-y-auto p-2"
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
