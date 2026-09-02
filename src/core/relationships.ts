import { NORTHSTAR_RELATIONSHIPS, RELATIONSHIP_KIND_LABELS } from "@/core/seed/relationships";
import type { RelationshipKind } from "@/core/seed/relationships";
import {
  clauseDecisionStatus,
  editsForClause,
  isNonNegotiable,
  isSelected,
} from "@/core/state";
import type { AppState, ClauseType, DecisionStatus } from "@/core/types";

/**
 * The document relationship map.
 *
 * Nodes are clauses in the active revision; edges come from the bundled
 * relationship metadata plus one derived kind — a package that proposes changes
 * to both ends. Every edge carries the basis it rests on, so the map can always
 * say why a line is there. It claims no legal dependency and infers nothing from
 * legal meaning.
 */

export type MapEdgeKind = RelationshipKind | "shared-proposal";

export const MAP_EDGE_LABELS: Readonly<Record<MapEdgeKind, string>> = {
  ...RELATIONSHIP_KIND_LABELS,
  "shared-proposal": "Proposal touches both",
};

export interface MapNode {
  clauseId: string;
  title: string;
  ordinal: number;
  clauseType: ClauseType;
  decisionStatus: DecisionStatus | "none";
  selected: boolean;
  locked: boolean;
  focused: boolean;
  proposalCount: number;
}

export interface MapEdge {
  id: string;
  fromClauseId: string;
  toClauseId: string;
  kind: MapEdgeKind;
  basis: string;
}

export interface RelationshipMap {
  nodes: readonly MapNode[];
  edges: readonly MapEdge[];
}

/**
 * Builds the map for the active revision.
 *
 * Bundled edges are resolved through clause *type*, so they attach to whatever
 * clause of that type the current revision holds and simply disappear for a
 * pasted document that has none. Only the first clause of a type is used: with
 * two, there is no stated basis for choosing which one an authored edge meant.
 */
export function buildRelationshipMap(state: AppState): RelationshipMap {
  const byType = new Map<ClauseType, string>();
  for (const clause of state.revision.clauses) {
    if (!byType.has(clause.clauseType)) byType.set(clause.clauseType, clause.id);
  }

  const nodes: MapNode[] = state.revision.clauses.map((clause) => ({
    clauseId: clause.id,
    title: clause.title,
    ordinal: clause.ordinal,
    clauseType: clause.clauseType,
    decisionStatus: clauseDecisionStatus(state, clause.id),
    selected: isSelected(state, clause.id),
    locked: isNonNegotiable(state, clause.id),
    focused: state.focusedClauseId === clause.id,
    proposalCount: editsForClause(state, clause.id).length,
  }));

  const seen = new Set<string>();
  const edges: MapEdge[] = [];

  const push = (a: string, b: string, kind: MapEdgeKind, basis: string) => {
    // One edge per pair per kind, with a stable orientation so the same pair
    // always produces the same identifier.
    const [from, to] = a < b ? [a, b] : [b, a];
    const id = `${from}~${to}~${kind}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, fromClauseId: from, toClauseId: to, kind, basis });
  };

  for (const relationship of NORTHSTAR_RELATIONSHIPS) {
    const from = byType.get(relationship.from);
    const to = byType.get(relationship.to);
    if (from === undefined || to === undefined || from === to) continue;
    push(from, to, relationship.kind, relationship.basis);
  }

  for (const pkg of state.packages) {
    const touched = [
      ...new Set(
        state.edits
          .filter((edit) => edit.packageId === pkg.packageId)
          .map((edit) => edit.clauseId),
      ),
    ].filter((clauseId) => nodes.some((node) => node.clauseId === clauseId));

    for (let i = 0; i < touched.length; i += 1) {
      for (let j = i + 1; j < touched.length; j += 1) {
        const a = touched[i];
        const b = touched[j];
        if (a === undefined || b === undefined) continue;
        push(a, b, "shared-proposal", `“${pkg.packageLabel}” proposes a change to both clauses.`);
      }
    }
  }

  return { nodes, edges };
}

/** Edges touching a clause, for focusing one node's neighbourhood. */
export function edgesFor(map: RelationshipMap, clauseId: string): MapEdge[] {
  return map.edges.filter(
    (edge) => edge.fromClauseId === clauseId || edge.toClauseId === clauseId,
  );
}

/** Clause IDs directly related to one clause. */
export function neighboursOf(map: RelationshipMap, clauseId: string): string[] {
  return [
    ...new Set(
      edgesFor(map, clauseId).map((edge) =>
        edge.fromClauseId === clauseId ? edge.toClauseId : edge.fromClauseId,
      ),
    ),
  ];
}
