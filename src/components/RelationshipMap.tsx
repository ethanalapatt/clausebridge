"use client";

import { useMemo, useState } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";
import { Chip, cx } from "@/components/ui";
import { MAP_EDGE_LABELS, buildRelationshipMap, edgesFor } from "@/core/relationships";
import type { MapEdge, MapEdgeKind, MapNode } from "@/core/relationships";

/**
 * The document relationship map.
 *
 * Drawn with plain SVG — no graph dependency is installed and none is added for
 * this. Every line comes from bundled, hand-authored metadata or from a package
 * that proposes changes to both ends, and hovering or focusing a node states the
 * exact basis. It shows how the *document* is wired together; it asserts no
 * legal dependency and infers nothing from legal meaning.
 */

const EDGE_STYLE: Record<MapEdgeKind, { stroke: string; dash: string }> = {
  "cross-reference": { stroke: "var(--color-ink-400)", dash: "0" },
  "shared-term": { stroke: "var(--color-bridge-500)", dash: "4 3" },
  "same-objective": { stroke: "var(--color-ink-200)", dash: "1 4" },
  "shared-proposal": { stroke: "var(--color-proposed-500)", dash: "6 3" },
};

const SIZE = 320;
const RADIUS = 118;
const CENTER = SIZE / 2;

export function RelationshipMap() {
  const store = useStore();
  const session = useSession();
  const state = session.present;
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const map = useMemo(() => buildRelationshipMap(state), [state]);

  const positions = useMemo(() => {
    const placed = new Map<string, { x: number; y: number }>();
    const count = map.nodes.length;
    map.nodes.forEach((node, index) => {
      // Start at the top and go clockwise so document order reads clockwise.
      const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      placed.set(node.clauseId, {
        x: CENTER + Math.cos(angle) * RADIUS,
        y: CENTER + Math.sin(angle) * RADIUS,
      });
    });
    return placed;
  }, [map.nodes]);

  const active = hovered ?? state.focusedClauseId;
  const activeEdges = active === null ? [] : edgesFor(map, active);
  const activeIds = new Set(
    activeEdges.flatMap((edge) => [edge.fromClauseId, edge.toClauseId]),
  );

  if (map.nodes.length === 0) return null;

  return (
    <section className="rounded-lg border border-paper-edge bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-700">
          Document relationship map
        </span>
        <span className="text-[10px] text-ink-400">
          {map.nodes.length} clauses · {map.edges.length} recorded relationships
        </span>
        <span aria-hidden className="ml-auto text-[11px] text-ink-400">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-paper-edge p-4">
          <p className="mb-3 text-[10px] leading-relaxed text-ink-500">
            Every line comes from relationship metadata bundled with this fictional sample, or from
            a staged package that touches both clauses. It describes how the document refers to
            itself — <strong>not</strong> a legal dependency, and nothing here is inferred from
            legal meaning.
          </p>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(EDGE_STYLE) as MapEdgeKind[]).map((kind) => (
              <span key={kind} className="flex items-center gap-1.5 text-[10px] text-ink-500">
                <svg width="18" height="6" aria-hidden>
                  <line
                    x1="0"
                    y1="3"
                    x2="18"
                    y2="3"
                    stroke={EDGE_STYLE[kind].stroke}
                    strokeWidth="1.5"
                    strokeDasharray={EDGE_STYLE[kind].dash}
                  />
                </svg>
                {MAP_EDGE_LABELS[kind]}
              </span>
            ))}
          </div>

          <div className="mt-2 overflow-x-auto">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label={`Relationship map of ${map.nodes.length} clauses with ${map.edges.length} recorded relationships`}
              className="mx-auto block h-auto w-full max-w-[22rem]"
            >
              <g>
                {map.edges.map((edge) => {
                  const from = positions.get(edge.fromClauseId);
                  const to = positions.get(edge.toClauseId);
                  if (from === undefined || to === undefined) return null;
                  const dimmed = active !== null && !activeEdges.includes(edge);

                  return (
                    <line
                      key={edge.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={EDGE_STYLE[edge.kind].stroke}
                      strokeWidth={dimmed ? 1 : 1.75}
                      strokeDasharray={EDGE_STYLE[edge.kind].dash}
                      opacity={dimmed ? 0.18 : 0.85}
                    />
                  );
                })}
              </g>

              <g>
                {map.nodes.map((node) => {
                  const position = positions.get(node.clauseId);
                  if (position === undefined) return null;
                  return (
                    <MapNodeMark
                      key={node.clauseId}
                      node={node}
                      x={position.x}
                      y={position.y}
                      dimmed={active !== null && node.clauseId !== active && !activeIds.has(node.clauseId)}
                      onFocus={() => setHovered(node.clauseId)}
                      onBlur={() => setHovered(null)}
                      onSelect={() =>
                        store.dispatch({ type: "focus-clause", clauseId: node.clauseId })
                      }
                    />
                  );
                })}
              </g>
            </svg>
          </div>

          {active !== null && (
            <RelatedList clauseId={active} edges={activeEdges} nodes={map.nodes} />
          )}
        </div>
      )}
    </section>
  );
}

function MapNodeMark({
  node,
  x,
  y,
  dimmed,
  onFocus,
  onBlur,
  onSelect,
}: {
  node: MapNode;
  x: number;
  y: number;
  dimmed: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onSelect: () => void;
}) {
  // State is carried by shape and label as well as by fill: locked clauses get a
  // heavy ring, clauses with proposals get an outer ring, and the decision shows
  // as a glyph rather than only as colour.
  const fill = node.focused
    ? "var(--color-bridge-600)"
    : node.decisionStatus === "approved" || node.decisionStatus === "edited"
      ? "var(--color-approved-500)"
      : node.decisionStatus === "rejected"
        ? "var(--color-rejected-500)"
        : node.decisionStatus === "pending"
          ? "var(--color-proposed-500)"
          : "var(--color-ink-200)";

  const glyph =
    node.decisionStatus === "approved" || node.decisionStatus === "edited"
      ? "✓"
      : node.decisionStatus === "rejected"
        ? "✕"
        : node.decisionStatus === "pending"
          ? "•"
          : "";

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${node.ordinal}. ${node.title}${node.locked ? ", non-negotiable" : ""}${
        node.proposalCount > 0 ? `, ${node.proposalCount} proposal(s)` : ""
      }`}
      onMouseEnter={onFocus}
      onMouseLeave={onBlur}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      opacity={dimmed ? 0.3 : 1}
      className="cursor-pointer"
    >
      {node.proposalCount > 0 && (
        <circle cx={x} cy={y} r={13} fill="none" stroke={fill} strokeWidth="1" opacity="0.5" />
      )}
      <circle
        cx={x}
        cy={y}
        r={9}
        fill={fill}
        stroke={node.locked ? "var(--color-rejected-700)" : "white"}
        strokeWidth={node.locked ? 2.5 : 1.5}
      />
      <text
        x={x}
        y={y + 3}
        textAnchor="middle"
        fontSize="8"
        fill="white"
        aria-hidden
        style={{ pointerEvents: "none" }}
      >
        {glyph.length > 0 ? glyph : node.ordinal}
      </text>
      <text
        x={x}
        y={y < CENTER ? y - 15 : y + 21}
        textAnchor="middle"
        fontSize="7.5"
        fill="var(--color-ink-500)"
        aria-hidden
        style={{ pointerEvents: "none" }}
      >
        {node.title.length > 20 ? `${node.title.slice(0, 19)}…` : node.title}
      </text>
    </g>
  );
}

function RelatedList({
  clauseId,
  edges,
  nodes,
}: {
  clauseId: string;
  edges: readonly MapEdge[];
  nodes: readonly MapNode[];
}) {
  const store = useStore();
  const self = nodes.find((node) => node.clauseId === clauseId);

  return (
    <div className="mt-3 rounded-md border border-ink-200 bg-ink-50 p-2.5">
      <p className="text-[11px] font-semibold text-ink-900">
        {self === undefined ? clauseId : `${self.ordinal}. ${self.title}`}
      </p>

      {edges.length === 0 ? (
        <p className="mt-1 text-[10px] text-ink-500">
          No relationship to another clause is recorded for this one.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {edges.map((edge) => {
            const otherId =
              edge.fromClauseId === clauseId ? edge.toClauseId : edge.fromClauseId;
            const other = nodes.find((node) => node.clauseId === otherId);

            return (
              <li key={edge.id}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip
                    tone={
                      edge.kind === "shared-proposal"
                        ? "proposed"
                        : edge.kind === "shared-term"
                          ? "brand"
                          : "neutral"
                    }
                  >
                    {MAP_EDGE_LABELS[edge.kind]}
                  </Chip>
                  <button
                    type="button"
                    onClick={() =>
                      store.dispatch({ type: "focus-clause", clauseId: otherId })
                    }
                    className={cx(
                      "text-[11px] font-medium text-ink-900 hover:text-bridge-600",
                      other === undefined && "text-ink-400",
                    )}
                  >
                    {other === undefined ? otherId : `${other.ordinal}. ${other.title}`}
                  </button>
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{edge.basis}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
