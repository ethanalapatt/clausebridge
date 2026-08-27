import { describe, expect, it } from "vitest";

import {
  applyAfter,
  applyBefore,
  diffStats,
  diffWords,
  isBlockReplacement,
  tokenize,
} from "@/core/diff";

const rendered = (before: string, after: string) =>
  diffWords(before, after).map((op) => `${op.type}:${op.text}`);

describe("tokenize", () => {
  it("preserves whitespace so the diff is lossless", () => {
    expect(tokenize("a  b\nc")).toEqual(["a", "  ", "b", "\n", "c"]);
    expect(tokenize("")).toEqual([]);
  });
});

describe("diffWords", () => {
  it("returns a single equal op for identical text", () => {
    const ops = diffWords("the fictional clause", "the fictional clause");
    expect(ops).toEqual([{ type: "equal", text: "the fictional clause" }]);
    expect(diffStats(ops).changed).toBe(false);
  });

  it("isolates a single replaced word", () => {
    expect(rendered("cap of ten thousand dollars", "cap of twelve thousand dollars")).toEqual([
      "equal:cap of ",
      "delete:ten",
      "insert:twelve",
      "equal: thousand dollars",
    ]);
  });

  it("detects a pure insertion", () => {
    const ops = diffWords("notice within thirty days", "notice within thirty business days");
    expect(diffStats(ops)).toMatchObject({ wordsAdded: 1, wordsRemoved: 0 });
    expect(ops.some((op) => op.type === "insert" && op.text.includes("business"))).toBe(true);
  });

  it("detects a pure deletion", () => {
    const ops = diffWords("sole and absolute discretion", "sole discretion");
    expect(diffStats(ops)).toMatchObject({ wordsAdded: 0, wordsRemoved: 2 });
  });

  it("handles an empty side in each direction", () => {
    expect(diffWords("", "new text")).toEqual([{ type: "insert", text: "new text" }]);
    expect(diffWords("old text", "")).toEqual([{ type: "delete", text: "old text" }]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("is lossless: the ops rebuild both sides exactly", () => {
    const before =
      "Northstar may retain Customer Data for as long as Northstar deems necessary for its\n" +
      "business purposes, including product improvement and analytics.";
    const after =
      "Northstar shall retain Customer Data only for so long as necessary to provide the\n" +
      "Services to Customer, and shall not use Customer Data for analytics.";

    const ops = diffWords(before, after);
    expect(applyBefore(ops)).toBe(before);
    expect(applyAfter(ops)).toBe(after);
  });

  it("is lossless across whitespace-only and punctuation-only changes", () => {
    const cases: [string, string][] = [
      ["a b", "a  b"],
      ["ninety (90) days", "thirty (30) days"],
      ["one\ntwo", "one\n\ntwo"],
      ["trailing ", "trailing"],
    ];

    for (const [before, after] of cases) {
      const ops = diffWords(before, after);
      expect(applyBefore(ops)).toBe(before);
      expect(applyAfter(ops)).toBe(after);
    }
  });

  it("merges adjacent ops of the same type", () => {
    for (const op of diffWords("alpha beta gamma delta", "alpha zulu yankee delta")) {
      expect(op.text.length).toBeGreaterThan(0);
    }
    const types = diffWords("alpha beta gamma delta", "alpha zulu yankee delta").map((o) => o.type);
    // No two neighbouring ops share a type.
    for (let i = 1; i < types.length; i += 1) {
      expect(types[i]).not.toBe(types[i - 1]);
    }
  });

  it("is deterministic", () => {
    const before = "Customer shall pay all fees within fifteen (15) days of the invoice date.";
    const after = "Customer shall pay all undisputed fees within forty-five (45) days of receipt.";
    expect(diffWords(before, after)).toEqual(diffWords(before, after));
  });

  it("keeps a long unchanged tail as a single equal op", () => {
    const tail = " ".concat(Array.from({ length: 60 }, (_, i) => `word${i}`).join(" "));
    const ops = diffWords(`alpha${tail}`, `beta${tail}`);
    expect(ops).toEqual([
      { type: "delete", text: "alpha" },
      { type: "insert", text: "beta" },
      { type: "equal", text: tail },
    ]);
  });
});

describe("isBlockReplacement", () => {
  it("is false when nothing changed", () => {
    expect(isBlockReplacement(diffStats(diffWords("same text", "same text")))).toBe(false);
  });

  it("is false for a small targeted edit inside a long clause", () => {
    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const stats = diffStats(diffWords(`${body} ninety days`, `${body} thirty days`));
    expect(isBlockReplacement(stats)).toBe(false);
  });

  it("is true when almost nothing survives the rewrite", () => {
    const stats = diffStats(
      diffWords(
        "Northstar may retain Customer Data for as long as Northstar deems necessary.",
        "Customer Data is deleted within thirty days of termination.",
      ),
    );
    expect(isBlockReplacement(stats)).toBe(true);
  });

  it("is true for a replacement with no shared words at all", () => {
    expect(isBlockReplacement(diffStats(diffWords("alpha bravo", "charlie delta")))).toBe(true);
  });
});

describe("diffStats", () => {
  it("counts words rather than tokens", () => {
    const stats = diffStats(diffWords("one two three", "one four five six"));
    expect(stats.wordsRemoved).toBe(2);
    expect(stats.wordsAdded).toBe(3);
    expect(stats.wordsUnchanged).toBe(1);
    expect(stats.changed).toBe(true);
  });
});
