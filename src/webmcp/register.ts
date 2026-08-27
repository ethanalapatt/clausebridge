import type { ToolName } from "@/core/types";
import {
  GET_NEGOTIATION_CONTEXT_DESCRIPTION,
  GET_NEGOTIATION_CONTEXT_NAME,
  GET_NEGOTIATION_CONTEXT_SCHEMA,
  STAGE_REDLINE_PACKAGE_DESCRIPTION,
  STAGE_REDLINE_PACKAGE_NAME,
  STAGE_REDLINE_PACKAGE_SCHEMA,
} from "@/webmcp/schemas";

/**
 * WebMCP registration.
 *
 * There is deliberately no polyfill and no shim. If `document.modelContext
 * .registerTool` is not present, this module registers nothing and reports
 * `unavailable`; the app then offers a separately labeled local handler-test
 * control. The local path must never be able to present itself as WebMCP.
 *
 * If the native API is present but behaves differently from the contract in the
 * brief, registration reports `error` with the exact message rather than
 * improvising a compatibility layer.
 */

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  execute: (input: unknown) => Promise<unknown>;
}

export interface ModelContextLike {
  registerTool?: (tool: WebMcpToolDefinition) => unknown;
  unregisterTool?: (name: string) => unknown;
}

/** Both calls run the same deterministic handlers the UI uses. */
export interface WebMcpBridge {
  getNegotiationContext: (input: unknown) => Promise<unknown>;
  stageRedlinePackage: (input: unknown) => Promise<unknown>;
}

export type RegistrationOutcome =
  | { status: "registered"; toolNames: ToolName[]; unregister: () => void }
  | { status: "unavailable"; reason: string }
  | { status: "error"; reason: string };

interface RootLike {
  document?: { modelContext?: unknown };
}

/**
 * Locates the native model context. Takes the root explicitly so the detection
 * logic is testable without a DOM.
 */
export function findModelContext(root: unknown = globalThis): ModelContextLike | null {
  const candidate = (root as RootLike | null | undefined)?.document?.modelContext;
  if (candidate === null || typeof candidate !== "object") return null;
  return candidate as ModelContextLike;
}

export interface Detection {
  available: boolean;
  reason: string;
}

export function detectWebMcp(root: unknown = globalThis): Detection {
  const documentLike = (root as RootLike | null | undefined)?.document;
  if (documentLike === undefined || documentLike === null) {
    return { available: false, reason: "No document is available in this environment." };
  }

  const modelContext = findModelContext(root);
  if (modelContext === null) {
    return {
      available: false,
      reason:
        "This browser does not expose document.modelContext. ClauseBridge registered no tools.",
    };
  }

  if (typeof modelContext.registerTool !== "function") {
    return {
      available: false,
      reason:
        "document.modelContext exists but does not expose registerTool(). ClauseBridge registered no tools.",
    };
  }

  return { available: true, reason: "document.modelContext.registerTool is available." };
}

export const CLAUSEBRIDGE_TOOL_NAMES: readonly ToolName[] = [
  GET_NEGOTIATION_CONTEXT_NAME,
  STAGE_REDLINE_PACKAGE_NAME,
];

/**
 * Registers exactly the two baseline tools when the native API exists.
 *
 * Returns an `unregister` that reverses whatever the browser actually gave us:
 * a cleanup function returned by `registerTool`, or `unregisterTool` if the
 * implementation offers it. When neither exists, cleanup is a no-op and that is
 * reported honestly rather than faked.
 */
export function registerClauseBridgeTools(
  bridge: WebMcpBridge,
  root: unknown = globalThis,
): RegistrationOutcome {
  const detection = detectWebMcp(root);
  if (!detection.available) {
    return { status: "unavailable", reason: detection.reason };
  }

  const modelContext = findModelContext(root);
  const registerTool = modelContext?.registerTool;
  if (modelContext === null || typeof registerTool !== "function") {
    return { status: "unavailable", reason: detection.reason };
  }

  const definitions: WebMcpToolDefinition[] = [
    {
      name: GET_NEGOTIATION_CONTEXT_NAME,
      description: GET_NEGOTIATION_CONTEXT_DESCRIPTION,
      inputSchema: GET_NEGOTIATION_CONTEXT_SCHEMA,
      execute: async (input: unknown) => bridge.getNegotiationContext(input),
    },
    {
      name: STAGE_REDLINE_PACKAGE_NAME,
      description: STAGE_REDLINE_PACKAGE_DESCRIPTION,
      inputSchema: STAGE_REDLINE_PACKAGE_SCHEMA,
      execute: async (input: unknown) => bridge.stageRedlinePackage(input),
    },
  ];

  const cleanups: (() => void)[] = [];
  const registered: ToolName[] = [];

  for (const definition of definitions) {
    try {
      const returned = registerTool.call(modelContext, definition);
      if (typeof returned === "function") {
        cleanups.push(returned as () => void);
      } else if (typeof modelContext.unregisterTool === "function") {
        const unregisterTool = modelContext.unregisterTool;
        cleanups.push(() => {
          unregisterTool.call(modelContext, definition.name);
        });
      }
      registered.push(definition.name as ToolName);
    } catch (error) {
      // Undo any partial registration so the page never advertises half a
      // toolset, then report the mismatch instead of working around it.
      runCleanups(cleanups);
      return {
        status: "error",
        reason: `Registering ${definition.name} failed: ${describeError(error)}`,
      };
    }
  }

  return {
    status: "registered",
    toolNames: registered,
    unregister: () => runCleanups(cleanups),
  };
}

function runCleanups(cleanups: readonly (() => void)[]): void {
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch {
      // A browser that cannot unregister is not a reason to crash the page.
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown error";
}
