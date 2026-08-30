"use client";

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
 * The guided demo strip.
 *
 * Each step's tick is *derived from real state* — a recorded tool result, a
 * staged package, a decision actually taken. Nothing here fakes progress or
 * drives the app on the user's behalf beyond the one setup shortcut, which
 * dispatches the same actions the left rail's own controls do.
 */
export function DemoGuide() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const steps = goldenPathSteps(state);
  const completed = steps.filter((step) => step.done).length;
  const current = steps.find((step) => !step.done) ?? null;

  return (
    <section
      aria-label="Guided demo checklist"
      className="border-b border-ink-200 bg-white px-4 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">
            Guided demo
          </h2>
          <span className="text-[10px] text-ink-400">
            {completed} of {steps.length} done
          </span>
        </div>

        <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {steps.map((step, index) => (
            <StepPill
              key={step.id}
              step={step}
              index={index + 1}
              isCurrent={current?.id === step.id}
            />
          ))}
        </ol>

        <ShortcutHint />

        <Button
          size="sm"
          variant={current?.id === "setup" ? "primary" : "default"}
          title="Sets role, priorities, the non-negotiable marker and the clause selection in one step"
          onClick={() =>
            store.dispatch({
              type: "apply-demo-setup",
              setup: goldenPathSetup(state),
              label: GOLDEN_PATH_SETUP_LABEL,
            })
          }
        >
          Set up golden path
        </Button>
      </div>
    </section>
  );
}

function StepPill({
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
      title={step.hint}
      // Status is carried by the mark and the word, not by colour alone.
      aria-current={isCurrent ? "step" : undefined}
      className={cx(
        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
        step.done
          ? "border-approved-100 bg-approved-100 text-approved-700"
          : isCurrent
            ? "border-bridge-600 bg-bridge-50 text-bridge-700"
            : "border-ink-200 bg-white text-ink-500",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
          step.done
            ? "bg-approved-500 text-white"
            : isCurrent
              ? "bg-bridge-600 text-white"
              : "bg-ink-100 text-ink-500",
        )}
      >
        {step.done ? "✓" : index}
      </span>
      <span>{step.label}</span>
      <span className="sr-only">
        {step.done ? " — done" : isCurrent ? " — current step" : " — not started"}
      </span>
    </li>
  );
}
