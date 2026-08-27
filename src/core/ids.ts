/**
 * Deterministic identifier construction.
 *
 * Clause IDs are namespaced under the revision that produced them
 * (`NSA-r1-03`). That is deliberate: re-segmenting a document produces a new
 * revision, every old ID is retired, and a tool call carrying an old ID can be
 * rejected as *stale* rather than silently resolving to different text.
 *
 * Nothing here uses randomness or the clock, so identical inputs always yield
 * identical IDs and the tests can assert on them directly.
 */

export function revisionId(documentId: string, revisionNumber: number): string {
  return `${documentId}-r${revisionNumber}`;
}

export function clauseId(revId: string, ordinal: number): string {
  return `${revId}-${String(ordinal).padStart(2, "0")}`;
}

export function packageId(seq: number): string {
  return `pkg-${String(seq).padStart(4, "0")}`;
}

export function editId(pkgId: string, index: number): string {
  return `${pkgId}-e${String(index + 1).padStart(2, "0")}`;
}

/**
 * Parses the revision namespace out of a clause ID. Returns null when the ID
 * does not have the ClauseBridge shape at all, which is what makes an
 * arbitrary string report as "unknown" rather than "stale".
 */
export function revisionIdFromClauseId(id: string): string | null {
  const match = /^(.+-r\d+)-\d{2,}$/.exec(id);
  return match?.[1] ?? null;
}
