import { describe, expect, it, vi } from "vitest";

import {
  CLAUSEBRIDGE_TOOL_NAMES,
  detectWebMcp,
  findModelContext,
  registerClauseBridgeTools,
} from "@/webmcp/register";
import type { WebMcpBridge, WebMcpToolDefinition } from "@/webmcp/register";
import {
  GET_NEGOTIATION_CONTEXT_DESCRIPTION,
  GET_NEGOTIATION_CONTEXT_SCHEMA,
  STAGE_REDLINE_PACKAGE_DESCRIPTION,
  STAGE_REDLINE_PACKAGE_SCHEMA,
} from "@/webmcp/schemas";

const bridge: WebMcpBridge = {
  getNegotiationContext: async (input) => ({ tool: "context", input }),
  stageRedlinePackage: async (input) => ({ tool: "stage", input }),
};

/** A fake browser root; the real API is not available under Node. */
function rootWith(modelContext: unknown): unknown {
  return { document: { modelContext } };
}

describe("detection", () => {
  it("reports unavailable with no document", () => {
    expect(detectWebMcp({})).toMatchObject({ available: false });
    expect(detectWebMcp({}).reason).toMatch(/no document/i);
  });

  it("reports unavailable when modelContext is missing", () => {
    const detection = detectWebMcp({ document: {} });
    expect(detection.available).toBe(false);
    expect(detection.reason).toMatch(/does not expose document\.modelContext/);
    expect(detection.reason).toMatch(/registered no tools/);
  });

  it("reports unavailable when modelContext lacks registerTool", () => {
    const detection = detectWebMcp(rootWith({ somethingElse: true }));
    expect(detection.available).toBe(false);
    expect(detection.reason).toMatch(/does not expose registerTool/);
  });

  it("reports available when registerTool exists", () => {
    expect(detectWebMcp(rootWith({ registerTool: () => undefined })).available).toBe(true);
  });

  it("does not treat a non-object modelContext as usable", () => {
    expect(findModelContext(rootWith("nope"))).toBeNull();
    expect(findModelContext(rootWith(null))).toBeNull();
    expect(findModelContext(undefined)).toBeNull();
  });
});

describe("registration", () => {
  it("registers nothing and never fabricates a modelContext when unsupported", () => {
    const root = { document: {} };
    const outcome = registerClauseBridgeTools(bridge, root);

    expect(outcome.status).toBe("unavailable");
    // No shim was installed as a side effect.
    expect((root.document as { modelContext?: unknown }).modelContext).toBeUndefined();
  });

  it("registers exactly the two baseline tools with the exact contracts", () => {
    const registered: WebMcpToolDefinition[] = [];
    const outcome = registerClauseBridgeTools(
      bridge,
      rootWith({
        registerTool: (tool: WebMcpToolDefinition) => {
          registered.push(tool);
        },
      }),
    );

    expect(outcome.status).toBe("registered");
    if (outcome.status !== "registered") return;

    expect(outcome.toolNames).toEqual(["get_negotiation_context", "stage_redline_package"]);
    expect(outcome.toolNames).toEqual([...CLAUSEBRIDGE_TOOL_NAMES]);
    expect(registered).toHaveLength(2);

    expect(registered[0]).toMatchObject({
      name: "get_negotiation_context",
      description: GET_NEGOTIATION_CONTEXT_DESCRIPTION,
      inputSchema: GET_NEGOTIATION_CONTEXT_SCHEMA,
    });
    expect(registered[1]).toMatchObject({
      name: "stage_redline_package",
      description: STAGE_REDLINE_PACKAGE_DESCRIPTION,
      inputSchema: STAGE_REDLINE_PACKAGE_SCHEMA,
    });
  });

  it("routes execute straight through to the shared handlers", async () => {
    const registered: WebMcpToolDefinition[] = [];
    registerClauseBridgeTools(
      bridge,
      rootWith({
        registerTool: (tool: WebMcpToolDefinition) => {
          registered.push(tool);
        },
      }),
    );

    await expect(registered[0]?.execute({ clauseIds: ["NSA-r1-09"] })).resolves.toEqual({
      tool: "context",
      input: { clauseIds: ["NSA-r1-09"] },
    });
    await expect(registered[1]?.execute({ packageLabel: "P" })).resolves.toEqual({
      tool: "stage",
      input: { packageLabel: "P" },
    });
  });

  it("uses a cleanup function returned by registerTool", () => {
    const cleanup = vi.fn();
    const outcome = registerClauseBridgeTools(bridge, rootWith({ registerTool: () => cleanup }));

    expect(outcome.status).toBe("registered");
    if (outcome.status !== "registered") return;
    outcome.unregister();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("falls back to unregisterTool by name when registerTool returns nothing", () => {
    const unregisterTool = vi.fn();
    const outcome = registerClauseBridgeTools(
      bridge,
      rootWith({ registerTool: () => undefined, unregisterTool }),
    );

    expect(outcome.status).toBe("registered");
    if (outcome.status !== "registered") return;
    outcome.unregister();
    expect(unregisterTool.mock.calls.map((call) => call[0])).toEqual([
      "get_negotiation_context",
      "stage_redline_package",
    ]);
  });

  it("tolerates a browser that offers no way to unregister", () => {
    const outcome = registerClauseBridgeTools(bridge, rootWith({ registerTool: () => undefined }));
    expect(outcome.status).toBe("registered");
    if (outcome.status !== "registered") return;
    expect(() => outcome.unregister()).not.toThrow();
  });

  it("reports a contract mismatch instead of improvising a shim", () => {
    const outcome = registerClauseBridgeTools(
      bridge,
      rootWith({
        registerTool: () => {
          throw new Error("inputSchema: additionalProperties is not supported");
        },
      }),
    );

    expect(outcome.status).toBe("error");
    if (outcome.status !== "error") return;
    expect(outcome.reason).toContain("get_negotiation_context");
    expect(outcome.reason).toContain("additionalProperties is not supported");
  });

  it("rolls back a partial registration when the second tool fails", () => {
    const cleanup = vi.fn();
    let calls = 0;
    const outcome = registerClauseBridgeTools(
      bridge,
      rootWith({
        registerTool: () => {
          calls += 1;
          if (calls === 2) throw new Error("duplicate tool name");
          return cleanup;
        },
      }),
    );

    expect(outcome.status).toBe("error");
    // The first tool must not be left registered on its own.
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not throw when a cleanup itself fails", () => {
    const outcome = registerClauseBridgeTools(
      bridge,
      rootWith({
        registerTool: () => () => {
          throw new Error("already gone");
        },
      }),
    );

    expect(outcome.status).toBe("registered");
    if (outcome.status !== "registered") return;
    expect(() => outcome.unregister()).not.toThrow();
  });
});
