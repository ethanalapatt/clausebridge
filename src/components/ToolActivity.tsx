"use client";

import { useState } from "react";

import { useSession } from "@/app/useClauseBridge";
import { useStore } from "@/app/useClauseBridge";
import { Chip, EmptyState, Mono, cx } from "@/components/ui";
import { INVOCATION_SOURCE_LABELS } from "@/core/types";
import type { ToolCallRecord, WebMcpStatus } from "@/core/types";

/**
 * WebMCP provenance.
 *
 * Every handler invocation is shown with what it received, what validation
 * concluded, what it returned and what it changed — plus a collapsible inspector
 * holding the exact serialized input and output. The execution source is stated
 * on every row: a call made through the labeled local control is never presented
 * as a native agent call.
 */
export function ToolActivity() {
  const session = useSession();
  const state = session.present;

  return (
    <div className="space-y-3">
      <WebMcpExplainer status={state.webmcpStatus} />

      {state.toolCalls.length === 0 ? (
        <EmptyState>
          No tool call yet. Every call — from a connected agent or from the labeled local control —
          is recorded here with its exact input, validation result and effect.
        </EmptyState>
      ) : (
        <ol className="space-y-2">
          {[...state.toolCalls].reverse().map((call) => (
            <ToolCallRow key={call.id} call={call} />
          ))}
        </ol>
      )}
    </div>
  );
}

function WebMcpExplainer({ status }: { status: WebMcpStatus }) {
  const native = status.kind === "registered";

  return (
    <div
      className={cx(
        "rounded-md border px-3 py-2.5 text-[11px] leading-relaxed",
        native
          ? "border-approved-500 bg-approved-100/50 text-ink-700"
          : "border-edited-500 bg-edited-100 text-edited-700",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <Chip tone={native ? "approved" : "warning"}>
          {status.kind === "registered"
            ? "Native WebMCP"
            : status.kind === "checking"
              ? "Checking…"
              : status.kind === "unavailable"
                ? "WebMCP unavailable"
                : "WebMCP registration failed"}
        </Chip>
      </div>

      <p>
        {status.kind === "registered"
          ? `An agent in this browser can call ${status.toolNames.join(" and ")} directly.`
          : status.kind === "checking"
            ? "Looking for document.modelContext.registerTool in this browser."
            : status.reason}
      </p>

      <p className="mt-1.5 text-[10px] leading-relaxed">
        The agent works from typed tools rather than the page: stable clause IDs it cannot
        mistype without being told, validation against the active revision, exact source text
        instead of scraped markup, wording drawn only from the bundled library, and proposals that
        are <strong>staged</strong> rather than applied. Nothing it does reaches the agreement
        without a separate decision from you.
      </p>
    </div>
  );
}

function ToolCallRow({ call }: { call: ToolCallRecord }) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const failed = call.outcome === "rejected";

  return (
    <li
      className={cx(
        "rounded-md border p-2.5",
        failed ? "border-rejected-500 bg-rejected-100/40" : "border-ink-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Mono>{call.tool}</Mono>
        <Chip tone={call.source === "native-webmcp" ? "brand" : "warning"}>
          {INVOCATION_SOURCE_LABELS[call.source]}
        </Chip>
        <Chip tone={failed ? "rejected" : "approved"}>
          <span aria-hidden>{failed ? "✕" : "✓"}</span>
          {failed ? "rejected" : "accepted"}
        </Chip>
        <Mono>{call.revisionId}</Mono>
        <span className="ml-auto font-mono text-[9px] text-ink-400">{call.id}</span>
      </div>

      <dl className="mt-1.5 space-y-1 text-[10px] leading-snug">
        <Field label="Asked for">{call.inputSummary}</Field>
        <Field label="Clauses">
          {call.clauseIds.length === 0 ? (
            "none named"
          ) : (
            <span className="flex flex-wrap gap-1">
              {call.clauseIds.map((clauseId) => (
                <button
                  key={clauseId}
                  type="button"
                  onClick={() => store.dispatch({ type: "focus-clause", clauseId })}
                  className="rounded bg-ink-100 px-1 font-mono text-[9px] text-ink-700 hover:bg-bridge-100 hover:text-bridge-700"
                >
                  {clauseId}
                </button>
              ))}
            </span>
          )}
        </Field>
        <Field label="Validation">{call.validation}</Field>
        <Field label="Result">{failed ? call.errorDetail : call.resultSummary}</Field>
        <Field label="Effect">{call.stateEffect}</Field>
        {failed && call.errorCode !== null && (
          <Field label="Error code">
            <Mono>{call.errorCode}</Mono>
          </Field>
        )}
      </dl>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="mt-1.5 text-[10px] text-ink-400 hover:text-bridge-600"
      >
        {open ? "Hide raw input and output" : "Inspect raw input and output"}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5">
          <RawBlock title="Input as received">{call.input}</RawBlock>
          <RawBlock title="Result returned">{call.output}</RawBlock>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="w-16 shrink-0 font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink-700">{children}</dd>
    </div>
  );
}

function RawBlock({ title, children }: { title: string; children: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400">
        {title}
      </p>
      <pre className="max-h-56 overflow-auto rounded border border-ink-200 bg-ink-50 p-2 font-mono text-[10px] leading-relaxed text-ink-900">
        {children}
      </pre>
    </div>
  );
}
