"use client";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Button, Chip, cx } from "@/components/ui";
import { canUndo, undoLabel } from "@/core/state";
import type { WebMcpStatus } from "@/core/types";

/**
 * The status pill is the honesty surface of this prototype: it must never say
 * "WebMCP" unless the native API was actually detected and registration
 * succeeded. Everything else routes through the separately labeled local test
 * console.
 */
function statusPresentation(status: WebMcpStatus): {
  label: string;
  detail: string;
  dot: string;
  tone: string;
} {
  switch (status.kind) {
    case "checking":
      return {
        label: "Checking for WebMCP…",
        detail: "Looking for document.modelContext.registerTool in this browser.",
        dot: "bg-ink-400",
        tone: "border-ink-200 bg-ink-50 text-ink-700",
      };
    case "registered":
      return {
        label: "Native WebMCP connected",
        detail: `Registered: ${status.toolNames.join(", ")}`,
        dot: "bg-approved-500",
        tone: "border-approved-100 bg-approved-100 text-approved-700",
      };
    case "unavailable":
      return {
        label: "WebMCP unavailable",
        detail: status.reason,
        dot: "bg-edited-500",
        tone: "border-edited-100 bg-edited-100 text-edited-700",
      };
    case "error":
      return {
        label: "WebMCP registration failed",
        detail: status.reason,
        dot: "bg-rejected-500",
        tone: "border-rejected-100 bg-rejected-100 text-rejected-700",
      };
  }
}

export function WebMcpStatusPill({ status }: { status: WebMcpStatus }) {
  const presentation = statusPresentation(status);

  return (
    <div
      title={presentation.detail}
      className={cx(
        "flex max-w-sm items-center gap-2 rounded-full border px-3 py-1.5",
        presentation.tone,
      )}
    >
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", presentation.dot)} />
      <span className="text-[11px] font-semibold">{presentation.label}</span>
    </div>
  );
}

export function Header({ onOpenPreview }: { onOpenPreview: () => void }) {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const pendingUndo = undoLabel(session);

  return (
    <header className="border-b border-chrome-700 bg-chrome-950 text-white">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-semibold tracking-tight">ClauseBridge</span>
          <span className="hidden text-[11px] text-chrome-600 sm:inline">
            A structured redlining room where your browser agent works from exact clause IDs, not
            pixels.
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={store.undo}
            disabled={!canUndo(session)}
            title={pendingUndo === null ? "Nothing to undo" : `Undo: ${pendingUndo}`}
            className="!text-chrome-600 hover:!bg-chrome-800 hover:!text-white"
          >
            ↶ Undo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenPreview}
            className="!text-chrome-600 hover:!bg-chrome-800 hover:!text-white"
          >
            Preview &amp; export
          </Button>
          <WebMcpStatusPill status={state.webmcpStatus} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-chrome-800 bg-chrome-900 px-5 py-2 text-[11px] leading-snug text-chrome-600">
        <Chip tone="warning" className="!border-edited-500 !bg-transparent !text-edited-500">
          Not legal advice
        </Chip>
        <span>
          ClauseBridge is a document-operations prototype. The agreement, the alternative wording,
          and every rationale are <strong className="font-semibold text-white">fictional</strong>{" "}
          material authored for a demo. Nothing here asserts that any wording is legally correct,
          safer, or preferable.
        </span>
      </div>
    </header>
  );
}
