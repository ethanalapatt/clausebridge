"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Button, Chip, Mono, cx } from "@/components/ui";
import {
  mergeClauseWithPrevious,
  segmentPastedText,
  splitClauseAtParagraph,
  toDraft,
} from "@/core/segmentation";
import type { ClauseDraft } from "@/core/segmentation";
import { CLAUSE_TYPES, CLAUSE_TYPE_LABELS } from "@/core/types";

/**
 * Paste import plus the manual correction path.
 *
 * The brief requires that a human be able to fix titles and boundaries *before*
 * the agent works on pasted text, so low-confidence segmentation is called out
 * explicitly and the correction controls sit right next to it.
 */
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const session = useSession();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [step, setStep] = useState<"paste" | "review">("paste");

  const preview = useMemo(
    () =>
      text.trim().length === 0
        ? null
        : segmentPastedText(text, { documentTitle: title.trim().length > 0 ? title.trim() : undefined }),
    [text, title],
  );

  const isPasted = session.present.revision.source === "pasted";
  const activeRevision = session.present.revision;

  function applyDrafts(drafts: ClauseDraft[], label: string) {
    store.dispatch({ type: "revise-document", drafts, label });
  }

  function renameClause(index: number, newTitle: string) {
    const drafts = activeRevision.clauses.map(toDraft);
    const target = drafts[index];
    if (target === undefined) return;
    drafts[index] = { ...target, title: newTitle, inferred: false };
    applyDrafts(drafts, "Renamed a clause");
  }

  function retypeClause(index: number, clauseType: ClauseDraft["clauseType"]) {
    const drafts = activeRevision.clauses.map(toDraft);
    const target = drafts[index];
    if (target === undefined) return;
    drafts[index] = { ...target, clauseType, inferred: false };
    applyDrafts(drafts, "Changed a clause type");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-chrome-950/60 p-4">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Import agreement text</h2>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Plain text only. No PDF, DOCX, OCR, or external retrieval.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "paste" ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-semibold text-ink-700">
                  Document title (optional)
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Pasted Agreement — Unverified Segmentation"
                  className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-xs text-ink-900 placeholder:text-ink-400"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold text-ink-700">Agreement text</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={12}
                  placeholder={"1. Definitions\nThe terms below apply…\n\n2. Fees and Payment\nCustomer shall pay…"}
                  className="mt-1 w-full resize-y rounded-md border border-ink-200 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-900 placeholder:text-ink-400"
                />
              </label>

              {preview !== null && (
                <div
                  className={cx(
                    "rounded-md border px-3 py-2.5 text-[11px] leading-relaxed",
                    preview.segmentationConfidence === "low"
                      ? "border-edited-500 bg-edited-100 text-edited-700"
                      : "border-ink-200 bg-ink-50 text-ink-700",
                  )}
                >
                  <strong className="font-semibold">
                    {preview.clauses.length} clause(s) detected ·{" "}
                    {preview.segmentationConfidence === "low"
                      ? "low confidence"
                      : "segmented on explicit headings"}
                  </strong>
                  <p className="mt-1">
                    {preview.segmentationConfidence === "low"
                      ? "No explicit headings were found, so boundaries were guessed at paragraph breaks. Correct the titles and boundaries before letting the agent work on this document."
                      : "Headings were read from the source. You can still correct titles and boundaries after importing."}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={preview === null || preview.clauses.length === 0}
                  onClick={() => {
                    store.dispatch({
                      type: "load-pasted",
                      text,
                      title: title.trim().length > 0 ? title.trim() : undefined,
                    });
                    setStep("review");
                  }}
                >
                  Segment and load
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2.5 text-[11px] leading-relaxed text-ink-700">
                Loaded as revision <Mono>{activeRevision.revisionId}</Mono>. Every correction below
                mints a new revision and retires the previous clause IDs, so a stale ID in a later
                tool call is rejected rather than silently resolving to different text.
              </div>

              {!isPasted && (
                <div className="rounded-md border border-edited-500 bg-edited-100 px-3 py-2.5 text-[11px] text-edited-700">
                  The seeded demo agreement is currently loaded, not your pasted text.
                </div>
              )}

              <ul className="space-y-2">
                {activeRevision.clauses.map((clause, index) => (
                  <li key={clause.id} className="rounded-md border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mono>{clause.id}</Mono>
                      {clause.inferred && <Chip tone="warning">Guessed — please review</Chip>}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        defaultValue={clause.title}
                        onBlur={(event) => {
                          const next = event.target.value.trim();
                          if (next.length > 0 && next !== clause.title) renameClause(index, next);
                        }}
                        className="min-w-[12rem] flex-1 rounded border border-ink-200 px-2 py-1 text-xs text-ink-900"
                      />
                      <select
                        value={clause.clauseType}
                        onChange={(event) =>
                          retypeClause(index, event.target.value as ClauseDraft["clauseType"])
                        }
                        className="rounded border border-ink-200 bg-white px-2 py-1 text-[11px] text-ink-700"
                      >
                        {CLAUSE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {CLAUSE_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={index === 0}
                        title="Merge this clause into the one above"
                        onClick={() => {
                          const drafts = mergeClauseWithPrevious(activeRevision, clause.id);
                          if (drafts !== null) applyDrafts(drafts, "Merged clauses");
                        }}
                      >
                        Merge up
                      </Button>
                      <Button
                        size="sm"
                        disabled={clause.text.split(/\n\s*\n/).length < 2}
                        title="Split at the first paragraph break"
                        onClick={() => {
                          const drafts = splitClauseAtParagraph(activeRevision, clause.id, 1);
                          if (drafts !== null) applyDrafts(drafts, "Split a clause");
                        }}
                      >
                        Split
                      </Button>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                      {clause.text.slice(0, 220)}
                      {clause.text.length > 220 ? "…" : ""}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="flex justify-end">
                <Button variant="primary" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
