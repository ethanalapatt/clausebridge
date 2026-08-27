import { describe, expect, it, vi } from "vitest";

import { ClauseBridgeStore } from "@/app/store";
import { buildBaselinePackage, buildContextInput } from "@/core/demo";
import { canUndo } from "@/core/state";

/**
 * The store is what a native WebMCP agent actually touches, so these cover the
 * wiring rather than the handler logic itself.
 */

describe("ClauseBridgeStore", () => {
  it("notifies subscribers when state changes and stops after unsubscribe", () => {
    const store = new ClauseBridgeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: "set-role", role: "vendor" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.dispatch({ type: "set-role", role: "neutral" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns a stable snapshot object between changes", () => {
    const store = new ClauseBridgeStore();
    const first = store.getSnapshot();
    expect(store.getSnapshot()).toBe(first);

    store.dispatch({ type: "set-role", role: "vendor" });
    expect(store.getSnapshot()).not.toBe(first);
  });

  it("does not notify for an action that changes nothing", () => {
    const store = new ClauseBridgeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: "approve-edit", editId: "does-not-exist" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("logs the inbound call before the result, tagged with its source", () => {
    const store = new ClauseBridgeStore();
    const input = buildContextInput(store.getSnapshot().present);
    store.getNegotiationContext(input, "native-webmcp");

    const activity = store.getSnapshot().present.activity;
    expect(activity).toHaveLength(2);
    expect(activity[0]).toMatchObject({ kind: "tool-call", source: "native-webmcp" });
    expect(activity[1]).toMatchObject({ kind: "tool-result", source: "native-webmcp" });
  });

  it("never labels a local handler test as native WebMCP", () => {
    const store = new ClauseBridgeStore();
    store.getNegotiationContext(buildContextInput(store.getSnapshot().present), "local-handler-test");

    for (const entry of store.getSnapshot().present.activity) {
      expect(entry.source).toBe("local-handler-test");
      expect(entry.summary).not.toContain("native WebMCP");
    }
  });

  it("makes a successful staging undoable but leaves retrieval alone", () => {
    const store = new ClauseBridgeStore();
    const state = store.getSnapshot().present;

    store.getNegotiationContext(buildContextInput(state), "local-handler-test");
    expect(canUndo(store.getSnapshot())).toBe(false);

    store.stageRedlinePackage(buildBaselinePackage(state)!, "local-handler-test");
    expect(canUndo(store.getSnapshot())).toBe(true);

    store.undo();
    expect(store.getSnapshot().present.edits).toEqual([]);
  });

  it("does not make a rejected staging undoable", () => {
    const store = new ClauseBridgeStore();
    const result = store.stageRedlinePackage(
      { packageLabel: "Bad", edits: [] },
      "local-handler-test",
    );

    expect(result.ok).toBe(false);
    expect(canUndo(store.getSnapshot())).toBe(false);
    expect(store.getSnapshot().present.activity.at(-1)?.kind).toBe("tool-error");
  });

  it("exposes an async bridge that validates untrusted agent input", async () => {
    const store = new ClauseBridgeStore();
    const bridge = store.asWebMcpBridge();

    await expect(bridge.getNegotiationContext({ nonsense: true })).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    await expect(bridge.stageRedlinePackage(null)).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("survives an input that cannot be serialized for the log", () => {
    const store = new ClauseBridgeStore();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      store.stageRedlinePackage(circular as never, "local-handler-test"),
    ).not.toThrow();
    expect(store.getSnapshot().present.activity[0]?.detail).toBe("(unserializable input)");
  });
});
