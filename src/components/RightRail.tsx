"use client";

import { useEffect, useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ExportPanel } from "@/components/ExportPanel";
import { PackageComparison } from "@/components/PackageComparison";
import { RedlineCard } from "@/components/RedlineCard";
import { Timeline } from "@/components/Timeline";
import { ToolActivity } from "@/components/ToolActivity";
import { ToolConsole } from "@/components/ToolConsole";
import {
  Button,
  Chip,
  DecisionChip,
  EmptyState,
  Mono,
  Panel,
  cx,
} from "@/components/ui";
import { planMigration } from "@/core/migration";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { canUndo, findClause, isEditStale, undoLabel } from "@/core/state";
import { CLAUSE_TYPE_LABELS } from "@/core/types";

const TABS = ["Agent", "Compare", "Review", "Timeline", "Export"] as const;
type Tab = (typeof TABS)[number];

/** Pane 3: the agent surface, the comparison, the review loop and the record. */
export function RightRail() {
  const [tab, setTab] = useState<Tab>("Compare");
  const session = useSession();
  const store = useStore();
  const state = session.present;

  const pendingCount = state.edits.filter((edit) => edit.status === "pending").length;

  // Opening the comparison is a real human action and two guided-demo steps
  // depend on it, so it is recorded like any other.
  useEffect(() => {
    if (tab === "Compare" && state.packages.length > 0) {
      store.dispatch({ type: "record-view", surface: "compare" });
    }
  }, [tab, state.packages.length, store]);

  return (
    <Panel className="min-h-0" bodyClassName="min-h-0 overflow-y-auto p-3">
      <div className="sticky -top-3 z-10 -mx-3 -mt-3 mb-3 border-b border-ink-100 bg-white px-3 pb-2 pt-3">
        <div role="tablist" aria-label="Agent and review surface" className="flex flex-wrap gap-1">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`rail-tab-${item}`}
              aria-selected={tab === item}
              aria-controls="rail-panel"
              onClick={() => setTab(item)}
              className={cx(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                tab === item
                  ? "bg-chrome-950 text-white"
                  : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              {item}
              {item === "Review" && pendingCount > 0 && (
                <span
                  aria-label={`${pendingCount} awaiting decision`}
                  className="rounded-full bg-proposed-500 px-1.5 text-[9px] text-white"
                >
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" id="rail-panel" aria-labelledby={`rail-tab-${tab}`}>
        {tab === "Agent" && <AgentTab />}
        {tab === "Compare" && <PackageComparison />}
        {tab === "Review" && <ReviewTab />}
        {tab === "Timeline" && <Timeline />}
        {tab === "Export" && <ExportPanel />}
      </div>
    </Panel>
  );
}

/** Provenance first, then the labeled local control, then the bundled library. */
function AgentTab() {
  return (
    <div className="space-y-3">
      <ToolActivity />

      <details className="rounded-md border border-ink-200">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-ink-700">
          Local handler test console
        </summary>
        <div className="border-t border-ink-100 p-2.5">
          <ToolConsole />
        </div>
      </details>

      <details className="rounded-md border border-ink-200">
        <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-ink-700">
          Bundled fallback library
        </summary>
        <div className="border-t border-ink-100 p-2.5">
          <FallbackLibrary />
        </div>
      </details>
    </div>
  );
}

function FallbackLibrary() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const relevantTypes = useMemo(() => {
    if (state.selectedClauseIds.length === 0) return null;
    return new Set(
      state.selectedClauseIds
        .map((id) => findClause(state, id)?.clauseType)
        .filter((type): type is NonNullable<typeof type> => type !== undefined),
    );
  }, [state]);

  const entries = FALLBACK_LIBRARY.filter((entry) => {
    const roleMatch =
      state.partyRole === "neutral"
        ? entry.role === "neutral"
        : entry.role === state.partyRole || entry.role === "neutral";
    return roleMatch && (relevantTypes === null || relevantTypes.has(entry.clauseType));
  });

  return (
    <div className="space-y-2">
      <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
        <strong className="font-semibold">Fictional demo library.</strong> Every entry was invented
        for this prototype. Nothing was retrieved from a real contract or the web, and no entry is
        offered as legally correct or preferable. This is the only wording a proposal can carry —
        the agent chooses among these, it does not draft.
      </p>

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
            <div key={entry.id} className="rounded-md border border-ink-200 p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip tone="brand">{CLAUSE_TYPE_LABELS[entry.clauseType]}</Chip>
                <Chip>{entry.role}</Chip>
                <Chip tone="proposed">{entry.posture}</Chip>
                <Mono>{entry.id}</Mono>
              </div>
              <h4 className="mt-1.5 text-[12px] font-semibold text-ink-900">{entry.label}</h4>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-500">{entry.note}</p>
              <p className="mt-1.5 max-h-32 overflow-y-auto whitespace-pre-wrap rounded border border-ink-100 bg-ink-50 p-2 text-[10px] leading-relaxed text-ink-700">
                {entry.text}
              </p>
              {targets.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[9px] text-ink-400">Applies to:</span>
                  {targets.map((clause) => (
                    <button
                      key={clause.id}
                      type="button"
                      onClick={() => store.dispatch({ type: "focus-clause", clauseId: clause.id })}
                      className="rounded bg-ink-100 px-1 font-mono text-[9px] text-ink-700 hover:bg-bridge-100 hover:text-bridge-700"
                    >
                      {clause.id}
                    </button>
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

/**
 * The review loop: where every proposal stands and how it got there. Distinct
 * from Compare, which is organised by clause so alternatives sit together; this
 * is organised by package and carries the decision history.
 */
function ReviewTab() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const counts = {
    pending: state.edits.filter((edit) => edit.status === "pending").length,
    approved: state.edits.filter((edit) => edit.status === "approved").length,
    edited: state.edits.filter((edit) => edit.status === "edited").length,
    rejected: state.edits.filter((edit) => edit.status === "rejected").length,
  };
  const pendingUndo = undoLabel(session);
  const decisions = state.activity.filter((entry) => entry.kind === "decision");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <DecisionChip status="pending" />
        <span className="text-[11px] font-semibold text-ink-900">{counts.pending}</span>
        <DecisionChip status="approved" />
        <span className="text-[11px] font-semibold text-ink-900">{counts.approved}</span>
        <DecisionChip status="edited" />
        <span className="text-[11px] font-semibold text-ink-900">{counts.edited}</span>
        <DecisionChip status="rejected" />
        <span className="text-[11px] font-semibold text-ink-900">{counts.rejected}</span>

        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={!canUndo(session)}
          title={pendingUndo === null ? "Nothing to undo" : `Undo: ${pendingUndo}`}
          onClick={store.undo}
        >
          ↶ Undo
        </Button>
      </div>

      <StaleRedlineNotice />

      {state.packages.length === 0 ? (
        <EmptyState>
          Nothing to review yet. Stage a package from the Compare tab, or let a connected agent call{" "}
          <Mono>stage_redline_package</Mono>.
        </EmptyState>
      ) : (
        <>
          <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
            Staging changes nothing on its own. Every proposal is decided on its own — accept it,
            rewrite it in your own words, or reject it — and the agreement only reflects what you
            accept.
          </p>

          {state.packages.map((pkg) => {
            const edits = state.edits.filter((edit) => edit.packageId === pkg.packageId);

            return (
              <section key={pkg.packageId} className="rounded-md border border-ink-200">
                <header className="border-b border-ink-100 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-ink-900">
                      {pkg.packageLabel}
                    </span>
                    <Mono>{pkg.packageId}</Mono>
                  </div>
                </header>

                <div className="space-y-2 p-2">
                  {edits.map((edit) => (
                    <div key={edit.editId}>
                      {isEditStale(state, edit) && (
                        <p className="mb-1">
                          <Chip tone="warning">Stale — clause ID retired by a later revision</Chip>
                        </p>
                      )}
                      <RedlineCard edit={edit} state={state} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      <div>
        <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Decisions taken
        </h3>
        {decisions.length === 0 ? (
          <EmptyState>No decision has been recorded yet.</EmptyState>
        ) : (
          <ol className="space-y-1">
            {[...decisions].reverse().map((entry) => (
              <li
                key={entry.id}
                className="rounded border border-ink-100 bg-ink-50 px-2 py-1 text-[10px] leading-snug text-ink-700"
              >
                <span className="font-mono text-ink-400">{entry.id}</span> {entry.summary}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/**
 * Offers to carry redlines stranded by a revision into the active one.
 *
 * Nothing migrates on its own: the proposals are shown with their evidence and
 * the human confirms, because a wrong match would point a proposal at wording it
 * was never drafted against.
 */
function StaleRedlineNotice() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const plan = useMemo(() => planMigration(state), [state]);
  const staleCount = state.edits.filter((edit) => isEditStale(state, edit)).length;

  if (staleCount === 0) return null;

  return (
    <div className="rounded-md border border-edited-500 bg-edited-100 p-3 text-[11px] leading-relaxed text-edited-700">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Chip tone="warning">
          {staleCount} redline{staleCount === 1 ? "" : "s"} stranded by a revision
        </Chip>
      </div>

      {plan.candidates.length === 0 ? (
        <p>
          None of them matches a clause in {state.revision.revisionId} closely enough to move
          automatically. They stay stale and are excluded from the redlined export.
        </p>
      ) : (
        <>
          <p>
            {plan.candidates.length} can be carried into {state.revision.revisionId}. Each one
            returns to <strong>awaiting decision</strong> and is re-diffed against the clause&apos;s
            current text.
          </p>
          <ul className="mt-1.5 space-y-1">
            {plan.candidates.map((candidate) => (
              <li key={candidate.editId} className="flex flex-wrap items-center gap-1.5">
                <Mono>{candidate.fromClauseId}</Mono>
                <span aria-hidden>→</span>
                <span className="sr-only">moves to</span>
                <Mono>{candidate.toClauseId}</Mono>
                <span className="text-ink-700">{candidate.toClauseTitle}</span>
                <Chip tone={candidate.confidence === "exact-text" ? "approved" : "warning"}>
                  {candidate.confidence === "exact-text"
                    ? "identical text"
                    : "title match — text differs"}
                </Chip>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => store.dispatch({ type: "migrate-edits", candidates: plan.candidates })}
          >
            Carry {plan.candidates.length} redline{plan.candidates.length === 1 ? "" : "s"} over
          </Button>
        </>
      )}

      {plan.unmatchedEditIds.length > 0 && plan.candidates.length > 0 && (
        <p className="mt-1.5">
          {plan.unmatchedEditIds.length} has no confident match and stays stale.
        </p>
      )}
    </div>
  );
}
