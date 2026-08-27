import { getNegotiationContext, stageRedlinePackage } from "@/core/handlers";
import type {
  NegotiationContextInput,
  NegotiationContextPayload,
  StageRedlineInput,
  StageRedlinePayload,
} from "@/core/handlers";
import {
  applyAction,
  commit,
  createSession,
  undo,
  withActivity,
} from "@/core/state";
import type { Action, Session } from "@/core/state";
import type { HandlerResult, InvocationSource, WebMcpStatus } from "@/core/types";

/**
 * A tiny external store.
 *
 * The tool handlers must be callable from outside React — a native WebMCP agent
 * invokes them whenever it likes — and each call needs the *current* state
 * synchronously to build its result. An external store gives that without the
 * staleness traps of reading state through a closure or a render-time ref.
 */

function nowIso(): string {
  return new Date().toISOString();
}

export class ClauseBridgeStore {
  private session: Session;
  private readonly listeners = new Set<() => void>();

  constructor(session: Session = createSession()) {
    this.session = session;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): Session => this.session;

  private set(next: Session): void {
    if (next === this.session) return;
    this.session = next;
    for (const listener of this.listeners) listener();
  }

  readonly dispatch = (action: Action): void => {
    this.set(applyAction(this.session, action, nowIso()));
  };

  readonly undo = (): void => {
    this.set(undo(this.session, nowIso()));
  };

  readonly setWebMcpStatus = (status: WebMcpStatus): void => {
    this.dispatch({ type: "set-webmcp-status", status });
  };

  /** Records the inbound call before running it, so the timeline shows intent. */
  private logCall(source: InvocationSource, tool: "get_negotiation_context" | "stage_redline_package", detail: string): void {
    this.set({
      ...this.session,
      present: withActivity(this.session.present, nowIso(), {
        source,
        kind: "tool-call",
        tool,
        summary: `${tool} called by ${source === "native-webmcp" ? "native WebMCP" : "local handler test"}`,
        detail,
      }),
    });
  }

  readonly getNegotiationContext = (
    input: NegotiationContextInput,
    source: InvocationSource,
  ): HandlerResult<NegotiationContextPayload> => {
    this.logCall(source, "get_negotiation_context", safeSummary(input));

    const outcome = getNegotiationContext(this.session.present, input, { source, at: nowIso() });
    // Retrieval only focuses a clause; there is nothing a human would undo.
    this.set({ ...this.session, present: outcome.state });
    return outcome.result;
  };

  readonly stageRedlinePackage = (
    input: StageRedlineInput,
    source: InvocationSource,
  ): HandlerResult<StageRedlinePayload> => {
    this.logCall(source, "stage_redline_package", safeSummary(input));

    const outcome = stageRedlinePackage(this.session.present, input, { source, at: nowIso() });
    if (outcome.result.ok) {
      this.set(commit(this.session, outcome.state, `stage “${input.packageLabel}”`));
    } else {
      this.set({ ...this.session, present: outcome.state });
    }
    return outcome.result;
  };

  /**
   * The bridge handed to WebMCP registration. Input arrives untyped from an
   * external agent; the handlers validate it, so nothing is trusted here.
   */
  readonly asWebMcpBridge = () => ({
    getNegotiationContext: async (input: unknown) =>
      this.getNegotiationContext(input as NegotiationContextInput, "native-webmcp"),
    stageRedlinePackage: async (input: unknown) =>
      this.stageRedlinePackage(input as StageRedlineInput, "native-webmcp"),
  });
}

function safeSummary(input: unknown): string {
  try {
    const json = JSON.stringify(input);
    return json === undefined ? "(unserializable input)" : truncate(json, 400);
  } catch {
    return "(unserializable input)";
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
