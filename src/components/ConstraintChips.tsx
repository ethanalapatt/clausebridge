"use client";

import { Chip, cx } from "@/components/ui";
import {
  CONSTRAINT_SEVERITY_LABELS,
  CONSTRAINT_STATUS_LABELS,
} from "@/core/constraints";
import type {
  ConstraintSeverity,
  ConstraintStatus,
  ConstraintTally,
} from "@/core/constraints";

/**
 * Shared constraint indicators.
 *
 * Status is carried by a word and a glyph as well as by colour, so the four
 * outcomes stay distinguishable without colour vision. There is deliberately no
 * aggregate score anywhere in here: a weighted number would imply a judgement
 * about which wording is better, which this product does not make.
 */

const STATUS_TONE: Record<
  ConstraintStatus,
  "approved" | "rejected" | "warning" | "neutral"
> = {
  satisfied: "approved",
  violated: "rejected",
  unresolved: "warning",
  not_applicable: "neutral",
};

const STATUS_GLYPH: Record<ConstraintStatus, string> = {
  satisfied: "✓",
  violated: "✕",
  unresolved: "?",
  not_applicable: "–",
};

export function ConstraintStatusChip({
  status,
  severity,
}: {
  status: ConstraintStatus;
  severity?: ConstraintSeverity;
}) {
  return (
    <Chip tone={STATUS_TONE[status]}>
      <span aria-hidden>{STATUS_GLYPH[status]}</span>
      {severity !== undefined && `${CONSTRAINT_SEVERITY_LABELS[severity]} · `}
      {CONSTRAINT_STATUS_LABELS[status]}
    </Chip>
  );
}

const SEVERITY_TONE: Record<ConstraintSeverity, "rejected" | "brand" | "edited"> = {
  must: "rejected",
  prefer: "brand",
  avoid: "edited",
};

export function SeverityChip({ severity }: { severity: ConstraintSeverity }) {
  return <Chip tone={SEVERITY_TONE[severity]}>{CONSTRAINT_SEVERITY_LABELS[severity]}</Chip>;
}

/**
 * Factual counts for a package or the board. Rows with nothing in them are
 * omitted rather than shown as zeroes, so the reader sees only what applies.
 */
export function TallyRow({
  tally,
  className,
}: {
  tally: ConstraintTally;
  className?: string;
}) {
  type Tone = Parameters<typeof Chip>[0]["tone"];
  const cells: { key: string; label: string; count: number; tone: Tone }[] = ([
    { key: "ms", label: "Must met", count: tally.mustSatisfied, tone: "approved" },
    { key: "mv", label: "Must unmet", count: tally.mustViolated, tone: "rejected" },
    { key: "mu", label: "Must unresolved", count: tally.mustUnresolved, tone: "warning" },
    { key: "ps", label: "Prefer met", count: tally.preferSatisfied, tone: "approved" },
    { key: "pv", label: "Prefer unmet", count: tally.preferViolated, tone: "rejected" },
    { key: "pu", label: "Prefer unresolved", count: tally.preferUnresolved, tone: "warning" },
    { key: "as", label: "Avoided", count: tally.avoidSatisfied, tone: "approved" },
    { key: "av", label: "Present anyway", count: tally.avoidViolated, tone: "rejected" },
    { key: "au", label: "Avoid unresolved", count: tally.avoidUnresolved, tone: "warning" },
    { key: "mr", label: "Manual review", count: tally.manualReview, tone: "neutral" },
  ] satisfies { key: string; label: string; count: number; tone: Tone }[]).filter(
    (cell) => cell.count > 0,
  );

  if (cells.length === 0) {
    return (
      <p className={cx("text-[10px] text-ink-400", className)}>
        No constraint on the board reads these clauses.
      </p>
    );
  }

  return (
    <div className={cx("flex flex-wrap gap-1", className)}>
      {cells.map((cell) => (
        <Chip key={cell.key} tone={cell.tone}>
          {cell.count} {cell.label}
        </Chip>
      ))}
    </div>
  );
}
