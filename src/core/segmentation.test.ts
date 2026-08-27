import { describe, expect, it } from "vitest";

import { revisionIdFromClauseId } from "@/core/ids";
import {
  buildSeedRevision,
  inferClauseType,
  mergeClauseWithPrevious,
  reviseDocument,
  segmentPastedText,
  splitClauseAtParagraph,
  toDraft,
} from "@/core/segmentation";

describe("seeded segmentation", () => {
  it("produces the fictional Northstar agreement with 8-12 clauses plus a preamble", () => {
    const revision = buildSeedRevision();

    expect(revision.documentTitle).toBe("Northstar SaaS Services Agreement — Fictional Demo");
    expect(revision.source).toBe("seed");
    expect(revision.fictional).toBe(true);
    expect(revision.revisionNumber).toBe(1);
    expect(revision.revisionId).toBe("NSA-r1");
    expect(revision.segmentationConfidence).toBe("high");

    // 11 substantive clauses plus the preamble.
    expect(revision.clauses).toHaveLength(12);
    const substantive = revision.clauses.filter((clause) => clause.title !== "Preamble");
    expect(substantive.length).toBeGreaterThanOrEqual(8);
    expect(substantive.length).toBeLessThanOrEqual(12);
  });

  it("covers every clause type the brief requires", () => {
    const types = new Set(buildSeedRevision().clauses.map((clause) => clause.clauseType));

    for (const required of [
      "termination",
      "data_retention",
      "liability",
      "confidentiality",
      "payment",
      "warranty",
      "security",
      "governing_law",
    ] as const) {
      expect(types).toContain(required);
    }
  });

  it("assigns stable, ordered, revision-namespaced clause IDs", () => {
    const first = buildSeedRevision();
    const second = buildSeedRevision();

    // Determinism: rebuilding the seed yields identical IDs.
    expect(first.clauses.map((clause) => clause.id)).toEqual(
      second.clauses.map((clause) => clause.id),
    );

    expect(first.clauses[0]?.id).toBe("NSA-r1-01");
    expect(first.clauses[11]?.id).toBe("NSA-r1-12");

    first.clauses.forEach((clause, index) => {
      expect(clause.ordinal).toBe(index + 1);
      expect(revisionIdFromClauseId(clause.id)).toBe("NSA-r1");
    });

    // IDs are unique within the revision.
    expect(new Set(first.clauses.map((c) => c.id)).size).toBe(first.clauses.length);
  });

  it("never leaves a seeded clause body empty", () => {
    for (const clause of buildSeedRevision().clauses) {
      expect(clause.text.trim().length).toBeGreaterThan(40);
      expect(clause.inferred).toBe(false);
    }
  });
});

describe("pasted-text segmentation", () => {
  const NUMBERED = `MUTUAL SAMPLE AGREEMENT

This fictional sample is used only to exercise the segmenter.

1. Definitions
"Services" means the fictional hosted platform described in the order form.
Capitalised terms have the meanings given in this section.

2. Fees and Payment
Customer shall pay all undisputed fees within thirty days of invoice.

3. Term and Termination
Either party may terminate for material breach after a cure period.`;

  it("segments on explicit numbered headings and keeps a preamble", () => {
    const revision = segmentPastedText(NUMBERED);

    expect(revision.source).toBe("pasted");
    expect(revision.segmentationConfidence).toBe("high");

    const titles = revision.clauses.map((clause) => clause.title);
    expect(titles).toEqual([
      "Mutual Sample Agreement",
      "Definitions",
      "Fees and Payment",
      "Term and Termination",
    ]);

    expect(revision.clauses[2]?.clauseType).toBe("payment");
    expect(revision.clauses[3]?.clauseType).toBe("termination");
    expect(revision.clauses[1]?.text).toContain("fictional hosted platform");
    // The heading line itself is not duplicated into the body.
    expect(revision.clauses[1]?.text.startsWith("1. Definitions")).toBe(false);
  });

  it("segments markdown headings", () => {
    const revision = segmentPastedText(
      "## Confidentiality\nEach party protects the other's information.\n\n## Governing Law\nDelaware law applies.",
    );

    expect(revision.clauses.map((c) => c.title)).toEqual(["Confidentiality", "Governing Law"]);
    expect(revision.clauses[0]?.clauseType).toBe("confidentiality");
    expect(revision.clauses[1]?.clauseType).toBe("governing_law");
  });

  it("does not treat numbered prose as a heading", () => {
    const revision = segmentPastedText(
      "1. The parties agree that the fictional services shall be provided. The vendor may adjust them.\n\n" +
        "2. The customer agrees to pay the fictional fees described above. Payment is due on receipt.",
    );

    // No real headings, so it must fall back to paragraphs rather than
    // inventing two clause titles from body text.
    expect(revision.segmentationConfidence).toBe("low");
    expect(revision.clauses.map((c) => c.title)).toEqual(["Paragraph 1", "Paragraph 2"]);
  });

  it("falls back to paragraph boundaries and flags every clause for review", () => {
    const revision = segmentPastedText(
      "First fictional paragraph of the sample.\n\nSecond fictional paragraph of the sample.\n\nThird one.",
    );

    expect(revision.segmentationConfidence).toBe("low");
    expect(revision.clauses).toHaveLength(3);
    for (const clause of revision.clauses) {
      expect(clause.inferred).toBe(true);
    }
  });

  it("is deterministic across repeated runs", () => {
    const a = segmentPastedText(NUMBERED);
    const b = segmentPastedText(NUMBERED);
    expect(a.clauses).toEqual(b.clauses);
  });

  it("handles empty and whitespace-only input without throwing", () => {
    for (const input of ["", "   ", "\n\n\t\n"]) {
      const revision = segmentPastedText(input);
      expect(revision.clauses).toHaveLength(0);
      expect(revision.segmentationConfidence).toBe("low");
    }
  });

  it("normalises CRLF line endings", () => {
    const revision = segmentPastedText(NUMBERED.replace(/\n/g, "\r\n"));
    expect(revision.clauses.map((c) => c.title)).toEqual([
      "Mutual Sample Agreement",
      "Definitions",
      "Fees and Payment",
      "Term and Termination",
    ]);
    for (const clause of revision.clauses) {
      expect(clause.text).not.toContain("\r");
    }
  });
});

describe("clause type inference", () => {
  it("prefers retention over the generic security match", () => {
    expect(inferClauseType("Data Retention and Deletion")).toBe("data_retention");
    expect(inferClauseType("Data Protection and Security")).toBe("security");
  });

  it("matches inflected forms, not just exact stems", () => {
    expect(inferClauseType("Confidentiality")).toBe("confidentiality");
    expect(inferClauseType("Definitions")).toBe("definitions");
    expect(inferClauseType("Liability")).toBe("liability");
    expect(inferClauseType("Warranties and Disclaimers")).toBe("warranty");
    expect(inferClauseType("Indemnification")).toBe("liability");
  });

  it("distinguishes payment terms from contract term", () => {
    expect(inferClauseType("Payment Terms")).toBe("payment");
    expect(inferClauseType("Term and Termination")).toBe("termination");
  });

  it("returns other rather than forcing an unjustified category", () => {
    expect(inferClauseType("Miscellaneous")).toBe("other");
    expect(inferClauseType("Exhibit B")).toBe("other");
  });
});

describe("manual correction", () => {
  it("retires every previous clause ID when the document is revised", () => {
    const first = buildSeedRevision();
    const second = reviseDocument(first, first.clauses.map(toDraft));

    expect(second.revisionNumber).toBe(2);
    expect(second.revisionId).toBe("NSA-r2");
    expect(second.clauses[0]?.id).toBe("NSA-r2-01");

    for (const clause of first.clauses) {
      expect(second.retiredClauseIds[clause.id]).toBe("NSA-r1");
    }
    // No ID is both live and retired.
    for (const clause of second.clauses) {
      expect(second.retiredClauseIds[clause.id]).toBeUndefined();
    }
  });

  it("accumulates retired IDs across successive revisions", () => {
    const r1 = buildSeedRevision();
    const r2 = reviseDocument(r1, r1.clauses.map(toDraft));
    const r3 = reviseDocument(r2, r2.clauses.map(toDraft));

    expect(r3.retiredClauseIds["NSA-r1-01"]).toBe("NSA-r1");
    expect(r3.retiredClauseIds["NSA-r2-01"]).toBe("NSA-r2");
  });

  it("merges a clause into the one above it", () => {
    const revision = buildSeedRevision();
    const target = revision.clauses[2];
    expect(target).toBeDefined();

    const drafts = mergeClauseWithPrevious(revision, target!.id);
    expect(drafts).not.toBeNull();
    expect(drafts).toHaveLength(revision.clauses.length - 1);

    const merged = reviseDocument(revision, drafts!);
    expect(merged.clauses[1]?.title).toBe(revision.clauses[1]?.title);
    expect(merged.clauses[1]?.text).toContain(target!.title);
    expect(merged.clauses[1]?.text).toContain(target!.text);
  });

  it("refuses to merge the first clause upward", () => {
    const revision = buildSeedRevision();
    expect(mergeClauseWithPrevious(revision, revision.clauses[0]!.id)).toBeNull();
    expect(mergeClauseWithPrevious(revision, "NSA-r1-99")).toBeNull();
  });

  it("splits a clause at a paragraph boundary", () => {
    const revision = segmentPastedText(
      "# Sample Clause\nFirst fictional paragraph.\n\nSecond fictional paragraph.\n\n# Other\nBody.",
    );

    const drafts = splitClauseAtParagraph(revision, revision.clauses[0]!.id, 1);
    expect(drafts).not.toBeNull();
    expect(drafts).toHaveLength(revision.clauses.length + 1);
    expect(drafts![0]?.text).toBe("First fictional paragraph.");
    expect(drafts![1]?.text).toBe("Second fictional paragraph.");
    expect(drafts![1]?.title).toBe("Sample Clause (continued)");
  });

  it("rejects an out-of-range split point", () => {
    const revision = segmentPastedText(
      "# Sample Clause\nOnly one fictional paragraph.\n\n# Other\nBody.",
    );
    const id = revision.clauses[0]!.id;

    expect(splitClauseAtParagraph(revision, id, 0)).toBeNull();
    expect(splitClauseAtParagraph(revision, id, 1)).toBeNull();
    expect(splitClauseAtParagraph(revision, "nope", 1)).toBeNull();
  });
});
