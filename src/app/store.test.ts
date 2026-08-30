import { describe, expect, it, vi } from "vitest";

import { ClauseBridgeStore } from "@/app/store";
import { buildBaselinePackage, buildContextInput } from "@/core/demo";
import { exportFilename, renderNegotiationBrief } from "@/core/exports";
import { deserializeSession } from "@/core/persistence";
import { canUndo, createInitialState } from "@/core/state";

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

describe("ClauseBridgeStore exports and reset", () => {
  it("saves the brief under a safe filename and records the download", () => {
    const saved: { filename: string; contents: string }[] = [];
    const store = new ClauseBridgeStore(undefined, (filename, contents) =>
      saved.push({ filename, contents }),
    );

    const filename = store.downloadExport("brief");
    const state = store.getSnapshot().present;

    expect(filename).toBe(exportFilename(state, "brief"));
    expect(saved).toHaveLength(1);
    expect(saved[0]!.filename).toBe(filename);
    expect(saved[0]!.contents.startsWith("# Negotiation Brief —")).toBe(true);

    const entry = state.activity.at(-1)!;
    expect(entry.kind).toBe("export");
    expect(entry.detail).toBe(filename);
  });

  it("exports only what the current state actually holds", () => {
    const saved: string[] = [];
    const store = new ClauseBridgeStore(undefined, (_, contents) => saved.push(contents));

    store.stageRedlinePackage(
      buildBaselinePackage(store.getSnapshot().present)!,
      "local-handler-test",
    );
    const pending = store.getSnapshot().present.edits[0]!;
    store.dispatch({ type: "reject-edit", editId: pending.editId });
    store.downloadExport("brief");

    // A rejected proposal is still reported, and still marked as not applied.
    expect(saved[0]).toContain("Proposed replacement (rejected — not applied)");
  });

  it("renders exactly what the pure renderer produces for the state at save time", () => {
    const saved: string[] = [];
    const store = new ClauseBridgeStore(undefined, (_, contents) => saved.push(contents));
    store.getNegotiationContext(
      buildContextInput(store.getSnapshot().present),
      "local-handler-test",
    );

    // Captured before the save: the download is itself logged afterwards, so a
    // brief can never contain the log line for its own download.
    const atSaveTime = store.getSnapshot().present;
    store.downloadExport("brief");

    expect(saved[0]).toBe(renderNegotiationBrief(atSaveTime));
    expect(store.getSnapshot().present.activity.length).toBe(atSaveTime.activity.length + 1);
  });

  it("resets to the exact initial state and clears the undo stack", () => {
    const store = new ClauseBridgeStore();
    store.stageRedlinePackage(
      buildBaselinePackage(store.getSnapshot().present)!,
      "local-handler-test",
    );
    store.dispatch({ type: "set-role", role: "vendor" });
    expect(canUndo(store.getSnapshot())).toBe(true);

    store.resetDemo();
    const session = store.getSnapshot();

    expect(session.past).toEqual([]);
    expect(session.present).toEqual(createInitialState());
  });

  it("notifies subscribers when the demo is reset", () => {
    const store = new ClauseBridgeStore();
    const listener = vi.fn();
    store.dispatch({ type: "set-role", role: "vendor" });
    store.subscribe(listener);

    store.resetDemo();
    expect(listener).toHaveBeenCalled();
  });
});

describe("ClauseBridgeStore persistence", () => {
  function fakeStorage() {
    const cell: { value: string | null } = { value: null };
    return {
      cell,
      storage: {
        write: (payload: string) => {
          cell.value = payload;
        },
        clear: () => {
          cell.value = null;
        },
      },
    };
  }

  it("writes the session on every change", () => {
    const { cell, storage } = fakeStorage();
    const store = new ClauseBridgeStore(undefined, () => {}, storage);
    expect(cell.value).toBeNull();

    store.dispatch({ type: "set-role", role: "vendor" });
    expect(cell.value).not.toBeNull();
    expect(deserializeSession(cell.value)!.present.partyRole).toBe("vendor");
  });

  it("round-trips staged work through storage into a new store", () => {
    const { cell, storage } = fakeStorage();
    const store = new ClauseBridgeStore(undefined, () => {}, storage);
    store.stageRedlinePackage(
      buildBaselinePackage(store.getSnapshot().present)!,
      "local-handler-test",
    );
    store.dispatch({ type: "approve-edit", editId: store.getSnapshot().present.edits[0]!.editId });

    const revived = new ClauseBridgeStore(deserializeSession(cell.value)!, () => {}, storage);
    expect(revived.getSnapshot().present.edits).toEqual(store.getSnapshot().present.edits);
    expect(revived.getSnapshot().present.packages).toEqual(
      store.getSnapshot().present.packages,
    );
  });

  it("clears storage on reset so the reset survives a reload", () => {
    const { cell, storage } = fakeStorage();
    const store = new ClauseBridgeStore(undefined, () => {}, storage);
    store.stageRedlinePackage(
      buildBaselinePackage(store.getSnapshot().present)!,
      "local-handler-test",
    );
    expect(cell.value).not.toBeNull();

    store.resetDemo();
    // Reset clears the payload, then the reset session itself is written back.
    expect(deserializeSession(cell.value)!.present).toEqual(createInitialState());
  });

  it("keeps working when storage throws", () => {
    const exploding = {
      write: () => {
        throw new Error("QuotaExceededError");
      },
      clear: () => {
        throw new Error("SecurityError");
      },
    };
    const store = new ClauseBridgeStore(undefined, () => {}, exploding);

    expect(() => store.dispatch({ type: "set-role", role: "vendor" })).not.toThrow();
    expect(store.getSnapshot().present.partyRole).toBe("vendor");
    expect(() => store.resetDemo()).not.toThrow();
    expect(store.getSnapshot().present).toEqual(createInitialState());
  });

  it("persists nothing when no storage is supplied", () => {
    const store = new ClauseBridgeStore();
    expect(() => store.dispatch({ type: "set-role", role: "vendor" })).not.toThrow();
  });
});
