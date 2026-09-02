"use client";

import { useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { ShortcutHint } from "@/components/KeyboardShortcuts";
import { Button, cx } from "@/components/ui";
import {
  GOLDEN_PATH_SETUP_LABEL,
  goldenPathSetup,
  goldenPathSteps,
} from "@/core/demo";
import type { DemoStep } from "@/core/demo";

/**
 * The demo director.
 *
 * It reports; it does not drive. Every tick is derived from real state — a tool
 * call actually recorded, a package actually staged, a decision actually taken,
 * a surface actually opened — so a step cannot show as done unless the
 * underlying operation really ran, and freeform use is never blocked. The one
 * shortcut it offers dispatches exactly the actions the objective board's own
 * controls dispatch.
 */
export function DemoGuide({
  presenting,
  onTogglePresentation,
}: {
  presenting: boolean;
  onTogglePresentation: () => void;
}) {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const [expanded, setExpanded] = useState(false);

  const steps = goldenPathSteps(state);
  const completed = steps.filter((step) => step.done).length;
  const current = steps.find((step) => !step.done) ?? null;
  const currentIndex = current === null ? steps.length : steps.indexOf(current);

  return (
    <section
      aria-label="Guided demo"
      className="border-b border-ink-200 bg-white px-4 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          className="flex items-baseline gap-2 text-left"
          title="Show every step"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">
            Guided demo
          </span>
          <span className="text-[10px] text-ink-400">
            {completed} of {steps.length}
          </span>
        </button>

        <ol className="flex shrink-0 items-center gap-[3px]" aria-hidden>
          {steps.map((step, index) => (
            <li
              key={step.id}
              title={step.label}
              className={cx(
                "h-1.5 w-4 rounded-full transition-colors",
                step.done
                  ? "bg-approved-500"
                  : index === currentIndex
                    ? "bg-bridge-600"
                    : "bg-ink-200",
              )}
            />
          ))}
        </ol>

        <p className="min-w-0 flex-1 text-[11px] leading-snug" role="status">
          {current === null ? (
            <span className="font-medium text-approved-700">
              Every step of the walkthrough is done. Keep going freeform, or reset the demo.
            </span>
          ) : (
            <>
              <span className="font-semibold text-ink-900">
                Next — {current.label}:
              </span>{" "}
              <span className="text-ink-500">{current.hint}</span>
            </>
          )}
        </p>

        <ShortcutHint />

        <Button
          size="sm"
          variant={
            current !== null && (current.id === "lock" || current.id === "constraints")
              ? "primary"
              : "default"
          }
          title="Sets the role, the non-negotiable marker, the priority areas and the constraint board in one step"
          onClick={() =>
            store.dispatch({
              type: "apply-demo-setup",
              setup: goldenPathSetup(state),
              label: GOLDEN_PATH_SETUP_LABEL,
            })
          }
        >
          Set up the board
        </Button>

        <Button
          size="sm"
          aria-pressed={presenting}
          title="A wide, low-density view of the same live state — for showing the flow to a room"
          onClick={onTogglePresentation}
        >
          {presenting ? "Exit presentation" : "Presentation"}
        </Button>
      </div>

      {expanded && (
        <ol className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              index={index + 1}
              isCurrent={index === currentIndex}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function StepRow({
  step,
  index,
  isCurrent,
}: {
  step: DemoStep;
  index: number;
  isCurrent: boolean;
}) {
  return (
    <li
      // Status is carried by the mark and the words, not by colour alone.
      aria-current={isCurrent ? "step" : undefined}
      className={cx(
        "flex items-start gap-2 rounded-md border px-2 py-1.5 text-[10px] leading-snug",
        step.done
          ? "border-approved-100 bg-approved-100/60 text-approved-700"
          : isCurrent
            ? "border-bridge-600 bg-bridge-50 text-bridge-700"
            : "border-ink-200 bg-white text-ink-500",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
          step.done
            ? "bg-approved-500 text-white"
            : isCurrent
              ? "bg-bridge-600 text-white"
              : "bg-ink-100 text-ink-500",
        )}
      >
        {step.done ? "✓" : index}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{step.label}</span>
        <span className="block text-ink-400">{step.hint}</span>
        <span className="sr-only">
          {step.done ? "done" : isCurrent ? "current step" : "not started"}
        </span>
      </span>
    </li>
  );
}
