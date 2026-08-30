import { describe, expect, it } from "vitest";

import {
  PERSISTENCE_VERSION,
  deserializeSession,
  hasRestorableWork,
  serializeSession,
} from "@/core/persistence";
import { buildBaselinePackage, goldenPathSetup } from "@/core/demo";
import { stageRedlinePackage } from "@/core/handlers";
import { applyAction, commit, createSession } from "@/core/state";

const AT = "2026-01-01T00:00:00.000Z";

/** A session with a staged package and one approved decision. */
function workedSession() {
  let session = createSession();
  session = applyAction(
    session,
    { type: "apply-demo-setup", setup: goldenPathSetup(session.present), label: "setup" },
    AT,
  );
  const staged = stageRedlinePackage(
    session.present,
    buildBaselinePackage(session.present)!,
    { source: "local-handler-test", at: AT },
  );
  session = commit(session, staged.state, "stage");
  session = applyAction(
    session,
    { type: "approve-edit", editId: session.present.edits[0]!.editId },
    AT,
  );
  return session;
}

describe("round trip", () => {
  it("restores decisions, packages, selection and the audit log", () => {
    const original = workedSession();
    const restored = deserializeSession(serializeSession(original))!;

    expect(restored).not.toBeNull();
    expect(restored.present.edits).toEqual(original.present.edits);
    expect(restored.present.packages).toEqual(original.present.packages);
    expect(restored.present.activity).toEqual(original.present.activity);
    expect(restored.present.selectedClauseIds).toEqual(original.present.selectedClauseIds);
    expect(restored.present.nonNegotiableClauseIds).toEqual(
      original.present.nonNegotiableClauseIds,
    );
    expect(restored.present.priorityAreas).toEqual(original.present.priorityAreas);
    expect(restored.present.seq).toBe(original.present.seq);
    expect(restored.present.revision).toEqual(original.present.revision);
  });

  it("drops the undo stack rather than restoring a half-unwound history", () => {
    const original = workedSession();
    expect(original.past.length).toBeGreaterThan(0);

    expect(deserializeSession(serializeSession(original))!.past).toEqual([]);
  });

  it("never restores a WebMCP status — it is re-detected on every load", () => {
    let session = createSession();
    session = applyAction(
      session,
      {
        type: "set-webmcp-status",
        status: { kind: "registered", toolNames: ["get_negotiation_context"] },
      },
      AT,
    );

    expect(JSON.parse(serializeSession(session)).state.webmcpStatus).toEqual({
      kind: "checking",
    });
    expect(deserializeSession(serializeSession(session))!.present.webmcpStatus).toEqual({
      kind: "checking",
    });
  });

  it("stamps the current version", () => {
    expect(JSON.parse(serializeSession(createSession())).version).toBe(PERSISTENCE_VERSION);
  });
});

describe("rejecting unusable payloads", () => {
  it("returns null for absent or empty storage", () => {
    expect(deserializeSession(null)).toBeNull();
    expect(deserializeSession("")).toBeNull();
  });

  it("returns null rather than throwing on malformed JSON", () => {
    expect(deserializeSession("{not json")).toBeNull();
    expect(deserializeSession("[1,2,3]")).toBeNull();
    expect(deserializeSession('"a string"')).toBeNull();
    expect(deserializeSession("null")).toBeNull();
  });

  it("refuses a payload written by a different version", () => {
    const envelope = JSON.parse(serializeSession(workedSession()));
    envelope.version = PERSISTENCE_VERSION + 1;
    expect(deserializeSession(JSON.stringify(envelope))).toBeNull();

    envelope.version = "1";
    expect(deserializeSession(JSON.stringify(envelope))).toBeNull();
  });

  it("refuses a structurally wrong state instead of spreading it into the app", () => {
    const base = JSON.parse(serializeSession(workedSession()));

    type Loose = { state: Record<string, unknown> };
    const revisionOf = (e: Loose) => e.state.revision as Record<string, unknown>;

    for (const mutate of [
      (e: Loose) => delete e.state.revision,
      (e: Loose) => (e.state.edits = "nope"),
      (e: Loose) => (e.state.activity = {}),
      (e: Loose) => (e.state.seq = "3"),
      (e: Loose) => (e.state.partyRole = 7),
      (e: Loose) => (revisionOf(e).clauses = null),
      (e: Loose) => delete revisionOf(e).retiredClauseIds,
    ]) {
      const envelope = JSON.parse(JSON.stringify(base)) as Loose;
      mutate(envelope);
      expect(deserializeSession(JSON.stringify(envelope))).toBeNull();
    }
  });

  it("survives a hand-edited payload with an unexpected extra field", () => {
    const envelope = JSON.parse(serializeSession(workedSession()));
    envelope.state.somethingNobodyWrote = { deeply: ["nested"] };

    // Extra keys are harmless; the app reads only the fields it knows.
    expect(deserializeSession(JSON.stringify(envelope))).not.toBeNull();
  });
});

describe("hasRestorableWork", () => {
  it("is false for a pristine session and true once work exists", () => {
    expect(hasRestorableWork(createSession())).toBe(false);
    expect(hasRestorableWork(workedSession())).toBe(true);
  });
});
