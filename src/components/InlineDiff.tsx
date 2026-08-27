"use client";

import { useMemo } from "react";

import { diffStats, diffWords, isBlockReplacement } from "@/core/diff";

/**
 * Renders the real word-level difference between two clause strings.
 *
 * Nothing here is decorative — every mark corresponds to a diff op computed from
 * the actual text. When almost nothing survives a rewrite the diff is shown as a
 * whole-clause replacement, because interleaved marks over coincidental shared
 * words ("the", "days") read as noise rather than as a change.
 */
export function InlineDiff({ before, after }: { before: string; after: string }) {
  const { ops, block, stats } = useMemo(() => {
    const computed = diffWords(before, after);
    const computedStats = diffStats(computed);
    return { ops: computed, block: isBlockReplacement(computedStats), stats: computedStats };
  }, [before, after]);

  if (!stats.changed) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-500 italic">
        No textual difference from the current clause.
      </p>
    );
  }

  if (block) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-diff-del-fg)]">
          <span className="bg-[color:var(--color-diff-del-bg)] line-through decoration-[color:var(--color-diff-del-fg)]/50">
            {before}
          </span>
        </p>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[color:var(--color-diff-ins-fg)]">
          <span className="bg-[color:var(--color-diff-ins-bg)]">{after}</span>
        </p>
      </div>
    );
  }

  return (
    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700">
      {ops.map((op, index) => {
        if (op.type === "equal") return <span key={index}>{op.text}</span>;
        if (op.text.trim().length === 0) return <span key={index}>{op.text}</span>;

        return op.type === "delete" ? (
          <del
            key={index}
            className="bg-[color:var(--color-diff-del-bg)] text-[color:var(--color-diff-del-fg)] decoration-[color:var(--color-diff-del-fg)]/50"
          >
            {op.text}
          </del>
        ) : (
          <ins
            key={index}
            className="bg-[color:var(--color-diff-ins-bg)] text-[color:var(--color-diff-ins-fg)] no-underline"
          >
            {op.text}
          </ins>
        );
      })}
    </p>
  );
}

export function DiffSummary({ before, after }: { before: string; after: string }) {
  const stats = useMemo(() => diffStats(diffWords(before, after)), [before, after]);

  return (
    <span className="font-mono text-[10px] text-ink-500">
      <span className="text-[color:var(--color-diff-ins-fg)]">+{stats.wordsAdded}</span>
      {" / "}
      <span className="text-[color:var(--color-diff-del-fg)]">−{stats.wordsRemoved}</span>
      <span className="text-ink-400"> words</span>
    </span>
  );
}
