"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Button, cx } from "@/components/ui";
import { exportFilename, renderExport } from "@/core/exports";
import type { ExportKind } from "@/core/types";

const VIEWS: readonly { kind: ExportKind; label: string }[] = [
  { kind: "brief", label: "Negotiation brief" },
  { kind: "redline", label: "Redlined Markdown" },
];

/**
 * Deterministic export previews. Both are rendered from state by pure functions
 * and contain no wall-clock time, so the same decisions always produce the same
 * document.
 */
export function PreviewDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<ExportKind>("brief");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const store = useStore();
  const session = useSession();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const markdown = useMemo(() => renderExport(session.present, kind), [kind, session]);
  const filename = exportFilename(session.present, kind);

  /**
   * Modal focus management: Escape closes, focus starts inside, Tab is trapped,
   * and the trigger gets focus back on close.
   *
   * Without the trap, tabbing past the last control walks into the page behind
   * the overlay — which is inert to the mouse but not to the keyboard, so a
   * keyboard user ends up interacting with content they cannot see.
   */
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    function focusable(): HTMLElement[] {
      const root = dialogRef.current;
      if (root === null) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null || node === document.activeElement);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = focusable();
      if (nodes.length === 0) return;

      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has already escaped.
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Returning focus to the trigger keeps keyboard position from resetting
      // to the top of the document.
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the text is on screen and selectable.
      setCopied(false);
    }
  }

  function download() {
    setSaved(store.downloadExport(kind));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-chrome-950/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Preview and export"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Preview &amp; export</h2>

          <div role="tablist" aria-label="Export document" className="flex gap-1">
            {VIEWS.map((item) => (
              <button
                key={item.kind}
                type="button"
                role="tab"
                aria-selected={kind === item.kind}
                onClick={() => {
                  setKind(item.kind);
                  setSaved(null);
                }}
                className={cx(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  kind === item.kind
                    ? "bg-chrome-950 text-white"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={download} title={`Save ${filename}`}>
              Download .md
            </Button>
            <Button size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} ref={closeRef}>
              Close
            </Button>
          </div>
        </header>

        <p className="border-b border-ink-100 bg-ink-50 px-5 py-2 text-[10px] text-ink-500" role="status">
          {saved === null ? (
            <>
              Rendered from the current state by a pure function — no clock, no network. Saves as{" "}
              <span className="font-mono text-ink-700">{filename}</span>.
            </>
          ) : (
            <>
              Saved <span className="font-mono text-ink-700">{saved}</span> to your browser&apos;s
              downloads.
            </>
          )}
        </p>

        <div className="min-h-0 flex-1 overflow-auto bg-ink-50 p-5">
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-ink-200 bg-white p-4 font-mono text-[11px] leading-relaxed text-ink-900">
            {markdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
