"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { RedlineCard } from "@/components/RedlineCard";
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
import { exportFilename, renderExport } from "@/core/exports";
import { planMigration } from "@/core/migration";
import { FALLBACK_LIBRARY } from "@/core/seed/fallbackLibrary";
import { canUndo, findClause, isEditStale, undoLabel } from "@/core/state";
import { CLAUSE_TYPE_LABELS, INVOCATION_SOURCE_LABELS } from "@/core/types";
import type { ExportKind } from "@/core/types";

const TABS = ["Tools", "Fallbacks", "Redlines", "Decisions", "Export", "Activity"] as const;
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
              {item === "Redlines" && pendingCount > 0 && (
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
        {tab === "Tools" && <ToolConsole />}
        {tab === "Fallbacks" && <FallbacksTab />}
        {tab === "Redlines" && <RedlinesTab />}
        {tab === "Decisions" && <DecisionsTab />}
        {tab === "Export" && <ExportTab />}
        {tab === "Activity" && <ActivityTab />}
      </div>
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
      <StaleRedlineNotice />

      <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-700">
        Staging changes nothing on its own. Every redline below is decided on its own — approve it,
        rewrite it in your own words, or reject it — and the approved agreement only reflects what
        you accept.
      </p>

      {state.packages.map((pkg) => {
        const edits = state.edits.filter((edit) => edit.packageId === pkg.packageId);
        return (
          <section key={pkg.packageId} className="rounded-md border border-ink-200">
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

/**
 * The decision log: where each clause currently stands and how it got there.
 * Distinct from the Activity timeline, which is the raw chronological record —
 * this is the settled position, newest decision per redline.
 */
function DecisionsTab() {
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

      {state.edits.length === 0 ? (
        <EmptyState>
          Nothing to decide yet. Stage a redline package and each proposal will appear here with its
          own approve, edit, reject and note controls.
        </EmptyState>
      ) : (
        <ul className="space-y-1.5">
          {state.edits.map((edit) => {
            const clause = findClause(state, edit.clauseId);
            return (
              <li key={edit.editId} className="rounded-md border border-ink-200 px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <DecisionChip status={edit.status} />
                  <PriorityChip tag={edit.priorityTag} />
                  <Mono>{edit.clauseId}</Mono>
                </div>
                <button
                  type="button"
                  disabled={clause === null}
                  onClick={() => store.dispatch({ type: "focus-clause", clauseId: edit.clauseId })}
                  className="mt-1 block text-left text-[11px] font-medium text-ink-900 hover:text-bridge-600 disabled:hover:text-ink-900"
                >
                  {clause === null
                    ? `${edit.clauseId} (no longer in this revision)`
                    : `${clause.ordinal}. ${clause.title}`}
                </button>
                {edit.note !== null && (
                  <p className="mt-1 text-[10px] leading-snug text-edited-700">
                    Note: {edit.note}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                    variant="reject"
                    disabled={edit.status === "rejected"}
                    onClick={() => store.dispatch({ type: "reject-edit", editId: edit.editId })}
                  >
                    Reject
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
                <p className="mt-1 text-[10px] text-ink-400">
                  Rewrite the wording or add a note from the full card in the Redlines tab or beside
                  the clause.
                </p>
              </li>
            );
          })}
        </ul>
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
                key={entry.seq}
                className="rounded border border-ink-100 bg-ink-50 px-2 py-1 text-[10px] leading-snug text-ink-700"
              >
                <span className="font-mono text-ink-400">#{entry.seq}</span> {entry.summary}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** Deterministic export previews and real local downloads, in the review rail. */
function ExportTab() {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const [kind, setKind] = useState<ExportKind>("brief");
  const [saved, setSaved] = useState<string | null>(null);

  const filename = exportFilename(state, kind);
  const markdown = useMemo(() => renderExport(state, kind), [state, kind]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["brief", "redline"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={kind === item}
            onClick={() => {
              setKind(item);
              setSaved(null);
            }}
            className={cx(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              kind === item
                ? "border-bridge-600 bg-bridge-50 text-bridge-700"
                : "border-ink-200 bg-white text-ink-500 hover:border-ink-400",
            )}
          >
            {item === "brief" ? "Negotiation brief" : "Redlined Markdown"}
          </button>
        ))}
        <Button
          size="sm"
          variant="primary"
          className="ml-auto"
          title={`Save ${filename}`}
          onClick={() => setSaved(store.downloadExport(kind))}
        >
          Download .md
        </Button>
      </div>

      <p role="status" className="text-[10px] leading-snug text-ink-500">
        {saved === null ? (
          <>
            Rendered from the current state by a pure function — no clock, no network. Reflects only
            what you have approved; rejected and undecided proposals stay out of the agreement.
            Saves as <span className="font-mono text-ink-700">{filename}</span>.
          </>
        ) : (
          <>
            Saved <span className="font-mono text-ink-700">{saved}</span> to your browser&apos;s
            downloads.
          </>
        )}
      </p>

      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-ink-200 bg-ink-50 p-2.5 font-mono text-[10px] leading-relaxed text-ink-900">
        {markdown}
      </pre>
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
