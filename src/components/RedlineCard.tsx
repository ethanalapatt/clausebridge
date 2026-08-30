"use client";

import { useState } from "react";

import { useStore } from "@/app/useClauseBridge";
import { DiffSummary, InlineDiff } from "@/components/InlineDiff";
import { Button, Chip, DecisionChip, Mono, PriorityChip } from "@/components/ui";
import { acceptedTextOf, findClause } from "@/core/state";
import { INVOCATION_SOURCE_LABELS } from "@/core/types";
import type { AppState, StagedEdit } from "@/core/types";

/** One staged redline: source text, proposal, rationale, and the human's call. */
export function RedlineCard({ edit, state }: { edit: StagedEdit; state: AppState }) {
  const store = useStore();
  const clause = findClause(state, edit.clauseId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => acceptedTextOf(edit));
  const [noting, setNoting] = useState(false);
  const [noteDraft, setNoteDraft] = useState(edit.note ?? "");

  const pkg = state.packages.find((item) => item.packageId === edit.packageId);

  return (
    <div className="rounded-md border border-ink-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="proposed">{pkg?.packageLabel ?? edit.packageId}</Chip>
        <PriorityChip tag={edit.priorityTag} />
        <DecisionChip status={edit.status} />
        <Mono>{edit.editId}</Mono>
        {pkg !== undefined && (
          <span className="text-[10px] text-ink-400">
            via {INVOCATION_SOURCE_LABELS[pkg.source]}
          </span>
        )}
        <span className="ml-auto">
          <DiffSummary before={edit.originalText} after={acceptedTextOf(edit)} />
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-700">
        <span className="font-semibold text-ink-900">Rationale:</span> {edit.rationale}
      </p>

      <div className="mt-2 rounded border border-ink-100 bg-ink-50 p-2.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Proposed change to {clause === null ? edit.clauseId : clause.id}
        </p>
        <InlineDiff before={edit.originalText} after={acceptedTextOf(edit)} />
      </div>

      {edit.status === "edited" && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] text-ink-400 hover:text-ink-700">
            View the agent&apos;s original proposal
          </summary>
          <p className="mt-1 whitespace-pre-wrap rounded border border-ink-100 bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-500">
            {edit.proposedText}
          </p>
        </details>
      )}

      {editing && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
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
                  editId: edit.editId,
                  text: draft,
                });
                setEditing(false);
              }}
            >
              Save my wording
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
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={2}
            placeholder="Why this decision?"
            className="w-full resize-y rounded border border-ink-200 p-2 text-[11px] text-ink-900"
          />
          <div className="mt-1.5 flex gap-1.5">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                store.dispatch({
                  type: "set-note",
                  editId: edit.editId,
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

      {edit.note !== null && !noting && (
        <p className="mt-2 rounded border-l-2 border-edited-500 bg-edited-100 px-2 py-1.5 text-[11px] text-edited-700">
          <span className="font-semibold">Note:</span> {edit.note}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="approve"
          disabled={edit.status === "approved"}
          onClick={() => store.dispatch({ type: "approve-edit", editId: edit.editId })}
        >
          Approve
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setDraft(acceptedTextOf(edit));
            setEditing((open) => !open);
          }}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="reject"
          disabled={edit.status === "rejected"}
          onClick={() => store.dispatch({ type: "reject-edit", editId: edit.editId })}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNoting((open) => !open)}>
          {edit.note === null ? "Add note" : "Edit note"}
        </Button>
        {edit.status !== "pending" && (
          <Button
            size="sm"
            variant="ghost"
            title="Return this redline to awaiting decision"
            onClick={() => store.dispatch({ type: "reset-edit", editId: edit.editId })}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
