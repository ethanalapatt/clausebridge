"use client";

import { useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Button, Chip, EmptyState, Mono, cx } from "@/components/ui";
import { buildBaselinePackage, buildContextInput } from "@/core/demo";
import type { NegotiationContextInput, StageRedlineInput } from "@/core/handlers";

/**
 * The local handler-test console.
 *
 * This is NOT WebMCP and is labeled as such everywhere it appears. It exists so
 * the deterministic handlers can be exercised in a browser with no agent
 * attached — it calls exactly the same functions a native tool call would, and
 * every entry it produces is tagged `local handler test` in the timeline.
 */
export function ToolConsole() {
  const store = useStore();
  const session = useSession();
  const state = session.present;

  const [contextJson, setContextJson] = useState(() =>
    JSON.stringify(buildContextInput(state), null, 2),
  );
  const [packageJson, setPackageJson] = useState(() => {
    const built = buildBaselinePackage(state);
    return built === null ? "" : JSON.stringify(built, null, 2);
  });
  const [output, setOutput] = useState<string | null>(null);
  const [outputOk, setOutputOk] = useState(true);

  function show(result: unknown, ok: boolean) {
    setOutput(JSON.stringify(result, null, 2));
    setOutputOk(ok);
  }

  function runContext() {
    let parsed: NegotiationContextInput;
    try {
      parsed = JSON.parse(contextJson) as NegotiationContextInput;
    } catch (error) {
      show({ error: `Invalid JSON: ${String(error)}` }, false);
      return;
    }
    const result = store.getNegotiationContext(parsed, "local-handler-test");
    show(result, result.ok);
  }

  function runStage() {
    let parsed: StageRedlineInput;
    try {
      parsed = JSON.parse(packageJson) as StageRedlineInput;
    } catch (error) {
      show({ error: `Invalid JSON: ${String(error)}` }, false);
      return;
    }
    const result = store.stageRedlinePackage(parsed, "local-handler-test");
    show(result, result.ok);
  }

  const nativeConnected = state.webmcpStatus.kind === "registered";

  return (
    <div className="space-y-3">
      <div
        className={cx(
          "rounded-md border px-3 py-2.5 text-[11px] leading-relaxed",
          nativeConnected
            ? "border-ink-200 bg-ink-50 text-ink-700"
            : "border-edited-500 bg-edited-100 text-edited-700",
        )}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <Chip tone="warning">Local handler test — not WebMCP</Chip>
        </div>
        {nativeConnected
          ? "Native WebMCP is connected, so an agent can call these tools directly. This console runs the same handler functions locally for testing."
          : "No native WebMCP API was detected in this browser. This console calls the same deterministic handlers directly so the flow can still be demonstrated. Entries it produces are tagged “local handler test”, never “native WebMCP”."}
      </div>

      <ToolBlock
        name="get_negotiation_context"
        description="Retrieves exact clause text, fictional fallbacks, and decision status. Changes nothing."
        value={contextJson}
        onChange={setContextJson}
        onReset={() => setContextJson(JSON.stringify(buildContextInput(state), null, 2))}
        onRun={runContext}
        rows={9}
      />

      <ToolBlock
        name="stage_redline_package"
        description="Stages clause-specific redlines for independent approval. Does not finalize anything."
        value={packageJson}
        onChange={setPackageJson}
        onReset={() => {
          const built = buildBaselinePackage(state);
          setPackageJson(built === null ? "" : JSON.stringify(built, null, 2));
        }}
        onRun={runStage}
        rows={12}
        resetLabel="Load Customer Baseline"
      />

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Last result
        </p>
        {output === null ? (
          <EmptyState>Run a handler to see its exact serialized result.</EmptyState>
        ) : (
          <pre
            className={cx(
              "max-h-72 overflow-auto rounded-md border p-2.5 font-mono text-[10px] leading-relaxed",
              outputOk
                ? "border-approved-100 bg-approved-100/40 text-ink-900"
                : "border-rejected-500 bg-rejected-100 text-rejected-700",
            )}
          >
            {output}
          </pre>
        )}
      </div>
    </div>
  );
}

function ToolBlock({
  name,
  description,
  value,
  onChange,
  onReset,
  onRun,
  rows,
  resetLabel = "Reset input",
}: {
  name: string;
  description: string;
  value: string;
  onChange: (next: string) => void;
  onReset: () => void;
  onRun: () => void;
  rows: number;
  resetLabel?: string;
}) {
  return (
    <div className="rounded-md border border-ink-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <Mono className="!text-[11px]">{name}</Mono>
        <Button size="sm" variant="ghost" onClick={onReset}>
          {resetLabel}
        </Button>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-ink-500">{description}</p>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        spellCheck={false}
        className="mt-2 w-full resize-y rounded border border-ink-200 p-2 font-mono text-[10px] leading-relaxed text-ink-900"
      />
      <Button size="sm" variant="primary" onClick={onRun} className="mt-1.5">
        Run handler locally
      </Button>
    </div>
  );
}
