import type { ClauseType } from "@/core/types";

/**
 * Explicit relationships between clauses of the fictional Northstar agreement.
 *
 * Every edge here was authored by hand against the bundled sample text, and
 * every one names the exact basis it rests on — a defined term both clauses use,
 * or a sentence in one that points at the subject of the other. Nothing is
 * inferred from legal meaning, and no edge asserts a legal dependency. The
 * surface built from this is called a *document relationship map*, not an impact
 * analysis.
 *
 * Edges are keyed by clause type rather than clause ID because IDs are
 * revision-scoped: a re-segmentation retires every ID, and an edge that survived
 * on a stale ID would point at nothing.
 */

export type RelationshipKind =
  | "cross-reference"
  | "shared-term"
  | "same-objective";

export const RELATIONSHIP_KIND_LABELS: Readonly<Record<RelationshipKind, string>> = {
  "cross-reference": "Cross-reference",
  "shared-term": "Shared defined term",
  "same-objective": "Same objective area",
};

export interface SeedRelationship {
  from: ClauseType;
  to: ClauseType;
  kind: RelationshipKind;
  /** Exactly what makes this edge true in the bundled text. */
  basis: string;
}

export const NORTHSTAR_RELATIONSHIPS: readonly SeedRelationship[] = [
  {
    from: "definitions",
    to: "services",
    kind: "shared-term",
    basis: "Both use the defined terms “Services”, “Order Form” and “Authorized User”.",
  },
  {
    from: "definitions",
    to: "payment",
    kind: "shared-term",
    basis: "Fees are stated per “Order Form”, defined in the Definitions clause.",
  },
  {
    from: "definitions",
    to: "data_retention",
    kind: "shared-term",
    basis: "The retention clause governs “Customer Data”, defined in the Definitions clause.",
  },
  {
    from: "definitions",
    to: "intellectual_property",
    kind: "shared-term",
    basis: "The licence granted covers “Customer Data”, defined in the Definitions clause.",
  },
  {
    from: "services",
    to: "payment",
    kind: "cross-reference",
    basis: "The payment clause lets Northstar suspend the Services for an unpaid invoice.",
  },
  {
    from: "payment",
    to: "termination",
    kind: "cross-reference",
    basis: "The termination clause states that no termination entitles Customer to a refund of prepaid fees.",
  },
  {
    from: "security",
    to: "data_retention",
    kind: "shared-term",
    basis: "Both clauses govern the handling of “Customer Data”.",
  },
  {
    from: "security",
    to: "liability",
    kind: "cross-reference",
    basis: "The liability cap is stated to apply to claims arising from a security incident.",
  },
  {
    from: "confidentiality",
    to: "liability",
    kind: "cross-reference",
    basis: "The liability cap is stated to apply to claims for breach of confidentiality.",
  },
  {
    from: "data_retention",
    to: "termination",
    kind: "cross-reference",
    basis: "Retention and deletion are keyed to expiration or termination of the Subscription Term.",
  },
  {
    from: "intellectual_property",
    to: "data_retention",
    kind: "shared-term",
    basis: "Both set out what Northstar may do with “Customer Data” after the term.",
  },
  {
    from: "warranty",
    to: "liability",
    kind: "same-objective",
    basis: "Both allocate risk for the Services failing to perform.",
  },
  {
    from: "governing_law",
    to: "liability",
    kind: "same-objective",
    basis: "Both govern how a claim is brought and what it can recover.",
  },
];
