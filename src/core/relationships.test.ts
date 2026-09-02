import { describe, expect, it } from "vitest";

import { buildPackage } from "@/core/demo";
import { stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import { buildRelationshipMap, edgesFor, neighboursOf } from "@/core/relationships";
import { NORTHSTAR_RELATIONSHIPS } from "@/core/seed/relationships";
import { segmentPastedText } from "@/core/segmentation";
import { createInitialState, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

function clauseOf(state: AppState, clauseType: string): string {
  return state.revision.clauses.find((clause) => clause.clauseType === clauseType)!.id;
}

describe("seeded relationship metadata", () => {
  it("states a basis for every edge and never links a clause type to itself", () => {
    for (const relationship of NORTHSTAR_RELATIONSHIPS) {
      expect(relationship.basis.length).toBeGreaterThan(0);
      expect(relationship.from).not.toBe(relationship.to);
    }
  });

  it("records each clause-type pair at most once", () => {
    const pairs = NORTHSTAR_RELATIONSHIPS.map((relationship) =>
      [relationship.from, relationship.to].sort().join("~"),
    );
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe("buildRelationshipMap", () => {
  it("makes one node per clause in the active revision", () => {
    const state = createInitialState();
    const map = buildRelationshipMap(state);

    expect(map.nodes).toHaveLength(state.revision.clauses.length);
    expect(map.nodes.map((node) => node.clauseId)).toEqual(
      state.revision.clauses.map((clause) => clause.id),
    );
    expect(map.nodes.every((node) => node.decisionStatus === "none")).toBe(true);
  });

  it("resolves the bundled edges onto real clause IDs", () => {
    const state = createInitialState();
    const map = buildRelationshipMap(state);

    expect(map.edges).toHaveLength(NORTHSTAR_RELATIONSHIPS.length);
    for (const edge of map.edges) {
      expect(map.nodes.some((node) => node.clauseId === edge.fromClauseId)).toBe(true);
      expect(map.nodes.some((node) => node.clauseId === edge.toClauseId)).toBe(true);
      expect(edge.basis.length).toBeGreaterThan(0);
    }
  });

  it("links the liability clause to security, confidentiality, warranty and governing law", () => {
    const state = createInitialState();
    const map = buildRelationshipMap(state);
    const related = new Set(neighboursOf(map, clauseOf(state, "liability")));

    for (const clauseType of ["security", "confidentiality", "warranty", "governing_law"]) {
      expect(related.has(clauseOf(state, clauseType))).toBe(true);
    }
  });

  it("adds an edge when one package proposes changes to both clauses", () => {
    const base = createInitialState();
    const staged = stageRedlinePackage(base, buildPackage(base, "protective")!, CTX).state;
    const map = buildRelationshipMap(staged);

    const shared = map.edges.filter((edge) => edge.kind === "shared-proposal");
    // Three clauses touched by one package gives three pairs.
    expect(shared).toHaveLength(3);
    expect(shared[0]?.basis).toContain("Customer-Protective");
  });

  it("does not duplicate a proposal edge when two packages touch the same pair", () => {
    let state = createInitialState();
    state = stageRedlinePackage(state, buildPackage(state, "protective")!, CTX).state;
    state = stageRedlinePackage(state, buildPackage(state, "fast-close")!, CTX).state;

    const shared = buildRelationshipMap(state).edges.filter(
      (edge) => edge.kind === "shared-proposal",
    );
    expect(shared).toHaveLength(3);
  });

  it("reflects selection, locking and decisions on the nodes", () => {
    const base = createInitialState();
    const liability = clauseOf(base, "liability");
    let state = reduce(base, { type: "toggle-non-negotiable", clauseId: liability }, AT);
    state = reduce(state, { type: "toggle-selected", clauseId: liability }, AT);
    state = stageRedlinePackage(state, buildPackage(state, "protective")!, CTX).state;
    state = reduce(state, { type: "reject-edit", editId: "pkg-0001-e01" }, AT);

    const node = buildRelationshipMap(state).nodes.find((item) => item.clauseId === liability);
    expect(node?.locked).toBe(true);
    expect(node?.selected).toBe(true);
    expect(node?.proposalCount).toBe(1);
    expect(node?.decisionStatus).toBe("rejected");
  });

  it("drops bundled edges whose clause types the document does not have", () => {
    const revision = segmentPastedText(
      "1. Scope\n\nThe supplier will provide the described work.\n\n2. Payment\n\nInvoices are due in thirty (30) days.",
    );
    const map = buildRelationshipMap(createInitialState(revision));

    expect(map.nodes.length).toBeGreaterThan(0);
    // No liability, security or retention clause exists, so no edge survives.
    expect(map.edges).toEqual([]);
  });

  it("is deterministic and gives every edge a stable identifier", () => {
    const state = createInitialState();
    expect(buildRelationshipMap(state)).toEqual(buildRelationshipMap(state));

    const ids = buildRelationshipMap(state).edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("edgesFor", () => {
  it("returns the edges touching a clause, from either end", () => {
    const state = createInitialState();
    const map = buildRelationshipMap(state);
    const definitions = clauseOf(state, "definitions");

    const edges = edgesFor(map, definitions);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect([edge.fromClauseId, edge.toClauseId]).toContain(definitions);
    }
  });

  it("returns nothing for a clause with no recorded relationship", () => {
    const state = createInitialState();
    const map = buildRelationshipMap(state);
    const preamble = state.revision.clauses[0]!.id;
    expect(edgesFor(map, preamble)).toEqual([]);
  });
});
