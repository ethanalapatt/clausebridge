"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ToolConsole } from "@/components/ToolConsole";
import {
  Button,
  Chip,
  DecisionChip,
  EmptyState,
  Mono,
  Panel,
  PriorityChip,
  cx,
} from "@/components/ui";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { findClause, isEditStale } from "@/core/state";
import { CLAUSE_TYPE_LABELS, INVOCATION_SOURCE_LABELS } from "@/core/types";

const TABS = ["Tools", "Fallbacks", "Redlines", "Activity"] as const;
type Tab = (typeof TABS)[number];

/** Pane 3: fallback context, staged redlines, decisions, and tool activity. */
export function RightRail() {
  const [tab, setTab] = useState<Tab>("Tools");
  const session = useSession();
  const state = session.present;

  const pendingCount = state.edits.filter((edit) => edit.status === "pending").length;

  return (
    <Panel className="min-h-0" bodyClassName="min-h-0 overflow-y-auto p-3">
      <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 border-b border-ink-100 bg-white px-3 pb-2 pt-3">
        <div className="flex gap-1">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cx(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                tab === item
                  ? "bg-chrome-950 text-white"
                  : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {item}
              {item === "Redlines" && pendingCount > 0 && (
                <span className="rounded-full bg-proposed-500 px-1.5 text-[9px] text-white">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "Tools" && <ToolConsole />}
      {tab === "Fallbacks" && <FallbacksTab />}
      {tab === "Redlines" && <RedlinesTab />}
      {tab === "Activity" && <ActivityTab />}
    </Panel>
  );
}

function FallbacksTab() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const relevantTypes = useMemo(() => {
    const ids = state.selectedClauseIds.length > 0 ? state.selectedClauseIds : null;
    if (ids === null) return null;
    return new Set(
      ids
        .map((id) => findClause(state, id)?.clauseType)
        .filter((type): type is NonNullable<typeof type> => type !== undefined),
    );
  }, [state]);

  const entries = FALLBACK_LIBRARY.filter((entry) => {
    const roleMatch =
      state.partyRole === "neutral"
        ? entry.role === "neutral"
        : entry.role === state.partyRole || entry.role === "neutral";
    const typeMatch = relevantTypes === null || relevantTypes.has(entry.clauseType);
    return roleMatch && typeMatch;
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[11px] leading-relaxed text-ink-700">
        <strong className="font-semibold">Fictional demo library.</strong> Every entry was invented
        for this prototype. Nothing was retrieved from a real contract or the web, and no entry is
        offered as legally correct or preferable. Filtered to the{" "}
        <strong>{state.partyRole}</strong> posture
        {relevantTypes === null ? " across all clause types." : " for your selected clauses."}
      </div>

      {entries.length === 0 ? (
        <EmptyState>
          No fictional fallback wording exists for this combination of clause type and party role.
        </EmptyState>
      ) : (
        entries.map((entry) => {
          const targets = state.revision.clauses.filter(
            (clause) => clause.clauseType === entry.clauseType,
          );

          return (
            <div key={entry.id} className="rounded-md border border-ink-200 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="brand">{CLAUSE_TYPE_LABELS[entry.clauseType]}</Chip>
                <Chip>{entry.role}</Chip>
                <Mono>{entry.id}</Mono>
              </div>
              <h4 className="mt-1.5 text-[12px] font-semibold text-ink-900">{entry.label}</h4>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{entry.note}</p>
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-ink-100 bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-700">
                {entry.text}
              </p>
              {targets.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-ink-400">Applies to:</span>
                  {targets.map((clause) => (
                    <Button
                      key={clause.id}
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        store.dispatch({ type: "focus-clause", clauseId: clause.id })
                      }
                    >
                      {clause.id}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function RedlinesTab() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  if (state.packages.length === 0) {
    return (
      <EmptyState>
        No redline package has been staged. Run <Mono>stage_redline_package</Mono> from the Tools
        tab, or let a connected agent call it.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {state.packages.map((pkg) => {
        const edits = state.edits.filter((edit) => edit.packageId === pkg.packageId);
        return (
          <div key={pkg.packageId} className="rounded-md border border-ink-200">
            <header className="border-b border-ink-100 px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-ink-900">{pkg.packageLabel}</span>
                <Mono>{pkg.packageId}</Mono>
              </div>
              <p className="mt-0.5 text-[10px] text-ink-400">
                Staged via {INVOCATION_SOURCE_LABELS[pkg.source]} against {pkg.revisionId} ·{" "}
                {edits.length} redline(s)
              </p>
            </header>

            <ul className="divide-y divide-ink-100">
              {edits.map((edit) => {
                const clause = findClause(state, edit.clauseId);
                const stale = isEditStale(state, edit);

                return (
                  <li key={edit.editId} className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityChip tag={edit.priorityTag} />
                      <DecisionChip status={edit.status} />
                      {stale && <Chip tone="warning">Stale — clause ID retired</Chip>}
                    </div>
                    <button
                      type="button"
                      disabled={clause === null}
                      onClick={() =>
                        store.dispatch({ type: "focus-clause", clauseId: edit.clauseId })
                      }
                      className="mt-1 block text-left text-[11px] font-medium text-ink-900 hover:text-bridge-600 disabled:hover:text-ink-900"
                    >
                      {clause === null
                        ? `${edit.clauseId} (no longer in this revision)`
                        : `${clause.ordinal}. ${clause.title}`}
                    </button>
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{edit.rationale}</p>
                    {edit.note !== null && (
                      <p className="mt-1 text-[10px] text-edited-700">Note: {edit.note}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ActivityTab() {
  const session = useSession();
  const entries = [...session.present.activity].reverse();

  if (entries.length === 0) {
    return <EmptyState>No tool calls or decisions recorded yet.</EmptyState>;
  }

  const sourceTone: Record<string, "brand" | "warning" | "neutral"> = {
    "native-webmcp": "brand",
    "local-handler-test": "warning",
    ui: "neutral",
  };

  return (
    <ol className="space-y-1.5">
      {entries.map((entry) => (
        <li key={entry.seq} className="rounded-md border border-ink-200 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-ink-400">#{entry.seq}</span>
            <Chip tone={sourceTone[entry.source] ?? "neutral"}>
              {INVOCATION_SOURCE_LABELS[entry.source]}
            </Chip>
            {entry.tool !== null && <Mono>{entry.tool}</Mono>}
            {entry.kind === "tool-error" && <Chip tone="rejected">rejected</Chip>}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-900">{entry.summary}</p>
          {entry.detail !== null && (
            <p className="mt-0.5 break-words font-mono text-[10px] leading-snug text-ink-500">
              {entry.detail}
            </p>
          )}
          <p className="mt-1 font-mono text-[9px] text-ink-400">{entry.at}</p>
        </li>
      ))}
    </ol>
  );
}
