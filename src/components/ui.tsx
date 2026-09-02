"use client";

import type { ReactNode, Ref } from "react";

import type { DecisionStatus, PriorityTag } from "@/core/types";

/** Small shared primitives so the three panes read as one product. */

export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cx(
        "flex min-h-0 flex-col rounded-lg border border-ink-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {title !== undefined && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink-900">{title}</h2>
            {subtitle !== undefined && (
              <p className="mt-0.5 text-[11px] leading-snug text-ink-500">{subtitle}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className={cx("min-h-0 flex-1", bodyClassName ?? "p-4")}>{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  title,
  type = "button",
  className,
  ref,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "approve" | "reject" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  "aria-label"?: string;
}) {
  const variants: Record<string, string> = {
    default: "border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-400",
    primary: "border-bridge-600 bg-bridge-600 text-white hover:bg-bridge-700 hover:border-bridge-700",
    approve:
      "border-approved-500 bg-approved-100 text-approved-700 hover:bg-approved-500 hover:text-white",
    reject:
      "border-rejected-500 bg-rejected-100 text-rejected-700 hover:bg-rejected-500 hover:text-white",
    ghost: "border-transparent bg-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900",
  };

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        variants[variant],
        disabled && "cursor-not-allowed opacity-45 hover:border-ink-200 hover:bg-white",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = "neutral",
  title,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "approved" | "rejected" | "edited" | "proposed" | "warning";
  title?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-ink-200 bg-ink-50 text-ink-700",
    brand: "border-bridge-100 bg-bridge-50 text-bridge-700",
    approved: "border-approved-100 bg-approved-100 text-approved-700",
    rejected: "border-rejected-100 bg-rejected-100 text-rejected-700",
    edited: "border-edited-100 bg-edited-100 text-edited-700",
    proposed: "border-proposed-100 bg-proposed-100 text-proposed-700",
    warning: "border-edited-500 bg-edited-100 text-edited-700",
  };

  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const DECISION_TONE: Record<DecisionStatus | "none", "neutral" | "approved" | "rejected" | "edited" | "proposed"> = {
  none: "neutral",
  pending: "proposed",
  approved: "approved",
  rejected: "rejected",
  edited: "edited",
};

const DECISION_SHORT: Record<DecisionStatus | "none", string> = {
  none: "No redline",
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
  edited: "Approved with edits",
};

export function DecisionChip({ status }: { status: DecisionStatus | "none" }) {
  return <Chip tone={DECISION_TONE[status]}>{DECISION_SHORT[status]}</Chip>;
}

const PRIORITY_TONE: Record<PriorityTag, "rejected" | "brand" | "neutral"> = {
  required: "rejected",
  preferred: "brand",
  optional: "neutral",
};

export function PriorityChip({ tag }: { tag: PriorityTag }) {
  return <Chip tone={PRIORITY_TONE[tag]}>{tag}</Chip>;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cx(
        "rounded bg-ink-100 px-1 py-px font-mono text-[10px] tracking-tight text-ink-700",
        className,
      )}
    >
      {children}
    </code>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-ink-200 px-3 py-6 text-center text-xs leading-relaxed text-ink-500">
      {children}
    </p>
  );
}
