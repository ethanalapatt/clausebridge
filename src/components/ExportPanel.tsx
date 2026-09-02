"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Button, Mono, cx } from "@/components/ui";
import { exportFilename, renderExport } from "@/core/exports";
import { EXPORT_KINDS, EXPORT_KIND_FORMATS, EXPORT_KIND_LABELS } from "@/core/types";
import type { ExportKind } from "@/core/types";

const BLURBS: Readonly<Record<ExportKind, string>> = {
  brief: "What you decided, clause by clause, with the rationale each proposal arrived with.",
  redline: "The agreement with accepted changes marked inline. Rejected and undecided proposals are not applied.",
  "decision-log": "Machine-readable: the objective board with each constraint's evidence, every proposal, the preview revisions and the ordered event log.",
  "tool-activity": "Machine-readable: every handler invocation with its exact input, validation result and effect.",
};

/**
 * The export bundle: four deterministic local downloads.
 *
 * Each is a pure function of the current state with no wall-clock time, so the
 * same decisions always produce byte-identical files. Everything happens in the
 * tab — the files are built in memory and saved through the browser, and nothing
 * is transmitted.
 */
export function ExportPanel() {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const [kind, setKind] = useState<ExportKind>("brief");
  const [saved, setSaved] = useState<string | null>(null);

  const filename = exportFilename(state, kind);
  const contents = useMemo(() => renderExport(state, kind), [state, kind]);

  return (
    <div className="space-y-2">
      <p className="rounded-md border border-ink-200 bg-ink-50 px-2.5 py-2 text-[10px] leading-relaxed text-ink-700">
        Rendered from the current state by a pure function — no clock, no network. Each file
        reflects only what you have approved; rejected and undecided proposals stay out of the
        agreement. Every export carries the fictional-demo disclaimer and the observed revision.
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {EXPORT_KINDS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={kind === item}
            onClick={() => {
              setKind(item);
              setSaved(null);
            }}
            className={cx(
              "rounded-md border px-2 py-1.5 text-left transition-colors",
              kind === item
                ? "border-bridge-600 bg-bridge-50"
                : "border-ink-200 bg-white hover:border-ink-400",
            )}
          >
            <span
              className={cx(
                "block text-[11px] font-medium capitalize",
                kind === item ? "text-bridge-700" : "text-ink-900",
              )}
            >
              {EXPORT_KIND_LABELS[item]}
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase text-ink-400">
              .{EXPORT_KIND_FORMATS[item]}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-ink-500">{BLURBS[kind]}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          title={`Save ${filename}`}
          onClick={() => setSaved(store.downloadExport(kind))}
        >
          Download {EXPORT_KIND_FORMATS[kind] === "md" ? ".md" : ".json"}
        </Button>
        <span role="status" className="text-[10px] text-ink-500">
          {saved === null ? (
            <>
              Saves as <Mono>{filename}</Mono>
            </>
          ) : (
            <>
              Saved <Mono>{saved}</Mono> to your downloads.
            </>
          )}
        </span>
      </div>

      <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-ink-200 bg-ink-50 p-2.5 font-mono text-[10px] leading-relaxed text-ink-900">
        {contents}
      </pre>
    </div>
  );
}
