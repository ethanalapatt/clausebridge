/**
 * Word-level inline diff.
 *
 * Written here rather than pulled from a package so the exact behaviour the
 * redline gutter depends on is directly unit-testable, and so the rendered
 * difference is computed from the real clause strings rather than animated.
 *
 * Pure and deterministic: the same pair of strings always produces the same ops.
 */

export type DiffOpType = "equal" | "insert" | "delete";

export interface DiffOp {
  type: DiffOpType;
  text: string;
}

/**
 * Splits into words *and* the whitespace between them, so joining every op's
 * text in order reconstructs the original strings exactly.
 */
export function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((token) => token.length > 0);
}

export function diffWords(before: string, after: string): DiffOp[] {
  const a = tokenize(before);
  const b = tokenize(after);

  // Shared prefix and suffix are peeled off first. On a redline this is most of
  // the clause, which keeps the quadratic table small.
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const aMiddle = a.slice(prefix, a.length - suffix);
  const bMiddle = b.slice(prefix, b.length - suffix);

  const ops: DiffOp[] = [];
  if (prefix > 0) ops.push({ type: "equal", text: a.slice(0, prefix).join("") });
  ops.push(...diffMiddle(aMiddle, bMiddle));
  if (suffix > 0) ops.push({ type: "equal", text: a.slice(a.length - suffix).join("") });

  return mergeOps(ops);
}

function diffMiddle(a: readonly string[], b: readonly string[]): DiffOp[] {
  if (a.length === 0 && b.length === 0) return [];
  if (a.length === 0) return [{ type: "insert", text: b.join("") }];
  if (b.length === 0) return [{ type: "delete", text: a.join("") }];

  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const dp = new Int32Array((n + 1) * width);
  const at = (i: number, j: number): number => dp[i * width + j] ?? 0;

  // Longest common subsequence table, built bottom-up.
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", text: a[i] ?? "" });
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      ops.push({ type: "delete", text: a[i] ?? "" });
      i += 1;
    } else {
      ops.push({ type: "insert", text: b[j] ?? "" });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "delete", text: a[i] ?? "" });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "insert", text: b[j] ?? "" });
    j += 1;
  }

  return ops;
}

/** Collapses runs of same-type ops so the rendered diff is readable. */
function mergeOps(ops: readonly DiffOp[]): DiffOp[] {
  const merged: DiffOp[] = [];
  for (const op of ops) {
    if (op.text.length === 0) continue;
    const last = merged[merged.length - 1];
    if (last !== undefined && last.type === op.type) {
      last.text += op.text;
    } else {
      merged.push({ type: op.type, text: op.text });
    }
  }
  return merged;
}

export interface DiffStats {
  wordsAdded: number;
  wordsRemoved: number;
  wordsUnchanged: number;
  changed: boolean;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function diffStats(ops: readonly DiffOp[]): DiffStats {
  let wordsAdded = 0;
  let wordsRemoved = 0;
  let wordsUnchanged = 0;

  for (const op of ops) {
    const words = countWords(op.text);
    if (op.type === "insert") wordsAdded += words;
    else if (op.type === "delete") wordsRemoved += words;
    else wordsUnchanged += words;
  }

  return {
    wordsAdded,
    wordsRemoved,
    wordsUnchanged,
    changed: wordsAdded > 0 || wordsRemoved > 0,
  };
}

/** Reconstructs the "before" side. Used in tests to prove the diff is lossless. */
export function applyBefore(ops: readonly DiffOp[]): string {
  return ops
    .filter((op) => op.type !== "insert")
    .map((op) => op.text)
    .join("");
}

/** Reconstructs the "after" side. Used in tests to prove the diff is lossless. */
export function applyAfter(ops: readonly DiffOp[]): string {
  return ops
    .filter((op) => op.type !== "delete")
    .map((op) => op.text)
    .join("");
}
