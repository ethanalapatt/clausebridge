import { beforeEach, describe, expect, it } from "vitest";

import { getNegotiationContext, stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext, StageRedlineInput } from "@/core/handlers";
import { reviseDocument, toDraft } from "@/core/segmentation";
import { createInitialState, effectiveClauseText, findClause, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

/** Clause IDs in the seeded revision, resolved by type rather than hard-coded. */
function idOfType(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((c) => c.clauseType === clauseType);
  if (clause === undefined) throw new Error(`no seeded clause of type ${clauseType}`);
  return clause.id;
}

let base: AppState;
let liability: string;
let termination: string;
let retention: string;

beforeEach(() => {
  base = createInitialState();
  liability = idOfType(base, "liability");
  termination = idOfType(base, "termination");
  retention = idOfType(base, "data_retention");
});

describe("get_negotiation_context", () => {
  it("returns exact clause text without paraphrasing", () => {
    const { result } = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "customer", priorityAreas: ["liability"] },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const clause = findClause(base, liability);
    expect(result.clauses[0]?.currentText).toBe(clause?.text);
    expect(result.clauses[0]?.originalText).toBe(clause?.text);
    expect(result.clauses[0]?.hasApprovedChange).toBe(false);
    expect(result.document.revisionId).toBe("NSA-r1");
    expect(result.document.fictional).toBe(true);
    expect(result.notice).toMatch(/not legal advice/i);
  });

  it("reports role, priorities, selection, non-negotiable state and decision status", () => {
    let state = reduce(base, { type: "toggle-selected", clauseId: termination }, AT);
    state = reduce(state, { type: "toggle-non-negotiable", clauseId: liability }, AT);

    const { result } = getNegotiationContext(
      state,
      {
        clauseIds: [liability, termination],
        partyRole: "customer",
        priorityAreas: ["termination", "data retention"],
      },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.partyRole).toBe("customer");
    expect(result.priorityAreas).toEqual(["termination", "data retention"]);
    expect(result.clauses[0]).toMatchObject({
      clauseId: liability,
      isNonNegotiable: true,
      isSelected: false,
      decisionStatus: "none",
    });
    expect(result.clauses[1]).toMatchObject({ clauseId: termination, isSelected: true });
  });

  it("does not change the agreement", () => {
    const { state } = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(state.revision).toBe(base.revision);
    expect(state.edits).toEqual([]);
    expect(state.packages).toEqual([]);
  });

  it("focuses the first requested clause so the call is visible in the document", () => {
    const { state } = getNegotiationContext(
      base,
      { clauseIds: [termination, liability], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(state.focusedClauseId).toBe(termination);
    expect(state.focusPulse).toBe(base.focusPulse + 1);
  });

  it("filters fallbacks by role and returns only fictional library entries", () => {
    const asCustomer = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "customer", priorityAreas: [] },
      CTX,
    ).result;
    expect(asCustomer.ok).toBe(true);
    if (!asCustomer.ok) return;

    expect(asCustomer.fallbackOptions.length).toBeGreaterThan(0);
    for (const option of asCustomer.fallbackOptions) {
      expect(["customer", "neutral"]).toContain(option.role);
      expect(option.clauseType).toBe("liability");
      expect(option.source).toBe("ClauseBridge fictional demo library");
      expect(option.appliesToClauseIds).toContain(liability);
    }

    const asVendor = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "vendor", priorityAreas: [] },
      CTX,
    ).result;
    expect(asVendor.ok).toBe(true);
    if (!asVendor.ok) return;
    for (const option of asVendor.fallbackOptions) {
      expect(["vendor", "neutral"]).toContain(option.role);
    }

    // A neutral reviewer must not be handed one side's negotiating language.
    const asNeutral = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "neutral", priorityAreas: [] },
      CTX,
    ).result;
    expect(asNeutral.ok).toBe(true);
    if (!asNeutral.ok) return;
    for (const option of asNeutral.fallbackOptions) {
      expect(option.role).toBe("neutral");
    }
  });

  it("returns no fallbacks for a clause type the library does not cover", () => {
    const definitions = idOfType(base, "definitions");
    const { result } = getNegotiationContext(
      base,
      { clauseIds: [definitions], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fallbackOptions).toEqual([]);
  });

  it("rejects unknown clause IDs", () => {
    const { result, state } = getNegotiationContext(
      base,
      { clauseIds: [liability, "not-a-clause"], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CLAUSE_IDS");
    expect(result.error.unknownClauseIds).toEqual(["not-a-clause"]);
    expect(result.error.staleClauseIds).toEqual([]);
    // The rejection is audited but the document is untouched.
    expect(state.revision).toBe(base.revision);
    expect(state.activity.at(-1)?.kind).toBe("tool-error");
  });

  it("rejects stale clause IDs distinctly from unknown ones", () => {
    const revised: AppState = {
      ...base,
      revision: reviseDocument(base.revision, base.revision.clauses.map(toDraft)),
    };

    const { result } = getNegotiationContext(
      revised,
      { clauseIds: [liability], partyRole: "customer", priorityAreas: [] },
      CTX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CLAUSE_IDS");
    expect(result.error.staleClauseIds).toEqual([liability]);
    expect(result.error.unknownClauseIds).toEqual([]);
    expect(result.error.message).toContain("NSA-r2");
  });

  it("rejects malformed input rather than coercing it", () => {
    const cases: unknown[] = [
      { clauseIds: [], partyRole: "customer", priorityAreas: [] },
      { clauseIds: [""], partyRole: "customer", priorityAreas: [] },
      { clauseIds: [liability], partyRole: "attorney", priorityAreas: [] },
      { clauseIds: [liability], partyRole: "customer", priorityAreas: "termination" },
      { clauseIds: "NSA-r1-08", partyRole: "customer", priorityAreas: [] },
    ];

    for (const input of cases) {
      const { result } = getNegotiationContext(
        base,
        input as Parameters<typeof getNegotiationContext>[1],
        CTX,
      );
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("de-duplicates repeated clause IDs while preserving order", () => {
    const { result } = getNegotiationContext(
      base,
      {
        clauseIds: [termination, liability, termination],
        partyRole: "customer",
        priorityAreas: [],
      },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.clauses.map((c) => c.clauseId)).toEqual([termination, liability]);
  });

  it("returns a serializable payload", () => {
    const { result } = getNegotiationContext(
      base,
      { clauseIds: [liability], partyRole: "customer", priorityAreas: [] },
      CTX,
    );
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });
});

describe("stage_redline_package", () => {
  const validPackage = (clauseId: string, text = "Replacement wording for the demo."): StageRedlineInput => ({
    packageLabel: "Customer Baseline",
    edits: [
      {
        clauseId,
        replacementText: text,
        rationale: "Fictional customer-side alternative from the demo library.",
        priorityTag: "required",
      },
    ],
  });

  it("stages edits as pending without touching the source agreement", () => {
    const original = findClause(base, liability)?.text;
    const { result, state } = stageRedlinePackage(base, validPackage(liability), CTX);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.packageId).toBe("pkg-0001");
    expect(result.staged).toHaveLength(1);
    expect(result.staged[0]?.editId).toBe("pkg-0001-e01");
    expect(result.notice).toMatch(/source agreement is unchanged/i);

    // The clause itself is byte-identical, and reads unchanged.
    expect(findClause(state, liability)?.text).toBe(original);
    expect(effectiveClauseText(state, liability)).toBe(original);
    expect(state.edits[0]?.status).toBe("pending");
    expect(state.edits[0]?.humanText).toBeNull();
  });

  it("captures the clause text as it stood at staging time", () => {
    const { state } = stageRedlinePackage(base, validPackage(liability), CTX);
    expect(state.edits[0]?.originalText).toBe(findClause(base, liability)?.text);
  });

  it("reports word-level change size per edit", () => {
    const { result } = stageRedlinePackage(base, validPackage(liability, "Short replacement."), CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.staged[0]?.wordsAdded).toBe(2);
    expect(result.staged[0]?.wordsRemoved).toBeGreaterThan(50);
  });

  it("stages a three-clause package and focuses the first clause", () => {
    const { result, state } = stageRedlinePackage(
      base,
      {
        packageLabel: "Customer Baseline",
        edits: [
          { clauseId: termination, replacementText: "A.", rationale: "r", priorityTag: "preferred" },
          { clauseId: retention, replacementText: "B.", rationale: "r", priorityTag: "required" },
          { clauseId: liability, replacementText: "C.", rationale: "r", priorityTag: "optional" },
        ],
      },
      CTX,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.staged.map((s) => s.clauseId)).toEqual([termination, retention, liability]);
    expect(state.focusedClauseId).toBe(termination);
    expect(state.edits.map((e) => e.editId)).toEqual([
      "pkg-0001-e01",
      "pkg-0001-e02",
      "pkg-0001-e03",
    ]);
  });

  it("rejects duplicate edits to the same clause in one package", () => {
    const { result, state } = stageRedlinePackage(
      base,
      {
        packageLabel: "Dupes",
        edits: [
          { clauseId: liability, replacementText: "A.", rationale: "r", priorityTag: "required" },
          { clauseId: liability, replacementText: "B.", rationale: "r", priorityTag: "required" },
        ],
      },
      CTX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("DUPLICATE_CLAUSE_IDS");
    expect(result.error.duplicateClauseIds).toEqual([liability]);
    expect(state.edits).toEqual([]);
    expect(state.packages).toEqual([]);
  });

  it("rejects unknown and stale clause IDs", () => {
    const unknown = stageRedlinePackage(base, validPackage("bogus-id"), CTX).result;
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.unknownClauseIds).toEqual(["bogus-id"]);

    const revised: AppState = {
      ...base,
      revision: reviseDocument(base.revision, base.revision.clauses.map(toDraft)),
    };
    const stale = stageRedlinePackage(revised, validPackage(liability), CTX).result;
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.error.staleClauseIds).toEqual([liability]);
  });

  it("rejects malformed edits atomically — nothing is staged", () => {
    const { result, state } = stageRedlinePackage(
      base,
      {
        packageLabel: "Mixed",
        edits: [
          { clauseId: termination, replacementText: "Fine.", rationale: "r", priorityTag: "required" },
          { clauseId: liability, replacementText: "   ", rationale: "r", priorityTag: "required" },
        ],
      },
      CTX,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EDITS");
    expect(result.error.invalidEdits?.[0]).toMatchObject({ index: 1, clauseId: liability });
    // The valid edit in the same package is not staged either.
    expect(state.edits).toEqual([]);
  });

  it("rejects empty rationale, bad priority tags, empty packages and blank labels", () => {
    const cases: [StageRedlineInput, string][] = [
      [
        {
          packageLabel: "P",
          edits: [{ clauseId: liability, replacementText: "X.", rationale: " ", priorityTag: "required" }],
        },
        "INVALID_EDITS",
      ],
      [
        {
          packageLabel: "P",
          edits: [
            {
              clauseId: liability,
              replacementText: "X.",
              rationale: "r",
              priorityTag: "urgent" as never,
            },
          ],
        },
        "INVALID_EDITS",
      ],
      [{ packageLabel: "P", edits: [] }, "EMPTY_PACKAGE"],
      [{ packageLabel: "   ", edits: [] }, "INVALID_INPUT"],
    ];

    for (const [input, code] of cases) {
      const { result } = stageRedlinePackage(base, input, CTX);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
  });

  it("rejects a no-op redline identical to the current text", () => {
    const current = findClause(base, liability)?.text ?? "";
    const { result } = stageRedlinePackage(base, validPackage(liability, current), CTX);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EDITS");
    expect(result.error.invalidEdits?.[0]?.reason).toMatch(/identical/i);
  });

  it("numbers successive packages deterministically", () => {
    const first = stageRedlinePackage(base, validPackage(liability), CTX);
    const second = stageRedlinePackage(first.state, validPackage(termination), CTX);

    expect(first.result.ok && first.result.packageId).toBe("pkg-0001");
    expect(second.result.ok && second.result.packageId).toBe("pkg-0002");
    expect(second.state.packages).toHaveLength(2);
  });

  it("records the invocation source without disguising the local test path", () => {
    const local = stageRedlinePackage(base, validPackage(liability), {
      source: "local-handler-test",
      at: AT,
    });
    expect(local.state.packages[0]?.source).toBe("local-handler-test");
    expect(local.state.activity.at(-1)?.source).toBe("local-handler-test");

    const native = stageRedlinePackage(base, validPackage(liability), {
      source: "native-webmcp",
      at: AT,
    });
    expect(native.state.packages[0]?.source).toBe("native-webmcp");
    expect(native.state.activity.at(-1)?.source).toBe("native-webmcp");
  });

  it("returns a serializable payload", () => {
    const { result } = stageRedlinePackage(base, validPackage(liability), CTX);
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });
});
