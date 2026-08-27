"use client";

import { useMemo, useState } from "react";

import { useSession } from "@/app/useClauseBridge";
import { Button, cx } from "@/components/ui";
import { renderNegotiationBrief, renderRedlinedMarkdown } from "@/core/exports";

const VIEWS = ["Negotiation brief", "Redlined Markdown"] as const;
type View = (typeof VIEWS)[number];

/**
 * Deterministic export previews. Both are rendered from state by pure functions
 * and contain no wall-clock time, so the same decisions always produce the same
 * document.
 */
export function PreviewDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("Negotiation brief");
  const [copied, setCopied] = useState(false);
  const session = useSession();

  const markdown = useMemo(
    () =>
      view === "Negotiation brief"
        ? renderNegotiationBrief(session.present)
        : renderRedlinedMarkdown(session.present),
    [view, session],
  );

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-chrome-950/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">Preview &amp; export</h2>

          <div className="flex gap-1">
            {VIEWS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={cx(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  view === item
                    ? "bg-chrome-950 text-white"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy Markdown"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-ink-50 p-5">
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-ink-200 bg-white p-4 font-mono text-[11px] leading-relaxed text-ink-900">
            {markdown}
          </pre>
        </div>
      </div>
    </div>
  );
}
