import { clauseId, revisionId } from "@/core/ids";
import {
  NORTHSTAR_CLAUSES,
  NORTHSTAR_DOCUMENT_ID,
  NORTHSTAR_PREAMBLE,
  NORTHSTAR_TITLE,
} from "@/core/seed/northstar";
import type {
  Clause,
  ClauseType,
  DocumentRevision,
  DocumentSource,
  SegmentationConfidence,
} from "@/core/types";

/**
 * Deterministic clause segmentation.
 *
 * The seeded agreement is already structured, so it segments exactly. Pasted
 * text is segmented conservatively: explicit headings first, blank-line
 * paragraph boundaries only as a fallback, and anything the segmenter had to
 * guess is flagged `inferred` so the human is asked to correct it before the
 * agent is allowed to work on it.
 *
 * No randomness and no clock: the same input always yields the same clauses and
 * the same IDs.
 */

export interface ClauseDraft {
  title: string;
  clauseType: ClauseType;
  text: string;
  inferred: boolean;
}

const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/;
const NUMBERED_HEADING =
  /^\s*(?:(?:section|article|clause)\s+)?(\d+(?:\.\d+)*)\s*[.)\-–—:]?\s+(\S.*?)\s*$/i;
const ALL_CAPS_HEADING = /^\s*([A-Z][A-Z0-9 ,'()&/-]{2,79})\s*$/;

/**
 * A numbered line only counts as a heading if what follows the number actually
 * reads like a title. Without this, ordinary numbered body text ("1. The
 * parties agree that ...") would shred a document into false clauses.
 */
function looksLikeTitle(candidate: string): boolean {
  const trimmed = candidate.trim().replace(/[.;:,]+$/, "");
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  // A period inside the remainder means we are looking at prose, not a heading.
  if (trimmed.includes(".")) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 10) return false;
  const first = trimmed[0];
  return first !== undefined && first === first.toUpperCase();
}

function detectHeading(line: string): string | null {
  const md = MARKDOWN_HEADING.exec(line);
  if (md?.[1] !== undefined) {
    const title = md[1].replace(/[.;:,]+$/, "").trim();
    return title.length > 0 ? title : null;
  }

  const numbered = NUMBERED_HEADING.exec(line);
  if (numbered?.[2] !== undefined && looksLikeTitle(numbered[2])) {
    return numbered[2].replace(/[.;:,]+$/, "").trim();
  }

  const caps = ALL_CAPS_HEADING.exec(line);
  if (caps?.[1] !== undefined && /[A-Z]/.test(caps[1])) {
    const title = caps[1].replace(/[.;:,]+$/, "").trim();
    // Guard against a single stray capitalised word being read as a heading.
    if (title.split(/\s+/).length <= 10) return toTitleCase(title);
  }

  return null;
}

function toTitleCase(value: string): string {
  const minor = new Set(["and", "or", "of", "the", "to", "for", "in", "a", "an", "by", "with"]);
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && minor.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/**
 * Ordered because several titles legitimately match more than one pattern:
 * "Data Retention and Deletion" must resolve to retention, while "Data
 * Protection and Security" must resolve to security.
 */
const TYPE_PATTERNS: readonly (readonly [ClauseType, RegExp])[] = [
  ["data_retention", /\b(retention|deletion|deletes?d?|purge|return of data)\b/i],
  ["security", /\b(security|safeguards?|data protection|privacy|breach)\b/i],
  ["confidentiality", /\b(confidential\w*|non-?disclosure|nda)\b/i],
  ["liability", /\b(liabilit\w*|indemnif\w*|damages|limitation)\b/i],
  // `\bterm\b` deliberately does not match "Terms", so "Payment Terms" still
  // resolves to payment while "Term and Termination" resolves to termination.
  ["termination", /\b(terminat\w*|renewal|non-?renewal|expiration|term)\b/i],
  ["payment", /\b(payments?|fees?|invoic\w*|billing|pricing|charges)\b/i],
  ["warranty", /\b(warrant\w*|disclaimers?|representations?)\b/i],
  ["governing_law", /\b(governing law|jurisdiction|disputes?|arbitration|venue|choice of law)\b/i],
  ["intellectual_property", /\b(intellectual property|ownership|proprietary rights)\b/i],
  ["definitions", /\b(definitions?|interpretation)\b/i],
  ["services", /\b(services?|access|subscription|support|availability)\b/i],
];

export function inferClauseType(title: string): ClauseType {
  for (const pattern of TYPE_PATTERNS) {
    if (pattern[1].test(title)) return pattern[0];
  }
  return "other";
}

function normaliseBody(lines: readonly string[]): string {
  return lines
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Assembles a revision from drafts, assigning stable IDs in document order. */
export function buildRevision(options: {
  documentId: string;
  documentTitle: string;
  source: DocumentSource;
  revisionNumber: number;
  drafts: readonly ClauseDraft[];
  retiredClauseIds?: Readonly<Record<string, string>>;
  segmentationConfidence: SegmentationConfidence;
}): DocumentRevision {
  const revId = revisionId(options.documentId, options.revisionNumber);
  const clauses: Clause[] = options.drafts.map((draft, index) => ({
    id: clauseId(revId, index + 1),
    ordinal: index + 1,
    title: draft.title,
    clauseType: draft.clauseType,
    text: draft.text,
    inferred: draft.inferred,
  }));

  return {
    documentId: options.documentId,
    documentTitle: options.documentTitle,
    source: options.source,
    revisionNumber: options.revisionNumber,
    revisionId: revId,
    clauses,
    retiredClauseIds: options.retiredClauseIds ?? {},
    segmentationConfidence: options.segmentationConfidence,
    fictional: true,
  };
}

/** The bundled fictional agreement, always revision 1. */
export function buildSeedRevision(): DocumentRevision {
  const drafts: ClauseDraft[] = [
    {
      title: "Preamble",
      clauseType: "other",
      text: NORTHSTAR_PREAMBLE,
      inferred: false,
    },
    ...NORTHSTAR_CLAUSES.map((clause) => ({
      title: clause.title,
      clauseType: clause.clauseType,
      text: clause.text,
      inferred: false,
    })),
  ];

  return buildRevision({
    documentId: NORTHSTAR_DOCUMENT_ID,
    documentTitle: NORTHSTAR_TITLE,
    source: "seed",
    revisionNumber: 1,
    drafts,
    segmentationConfidence: "high",
  });
}

export interface SegmentationOptions {
  documentId?: string;
  documentTitle?: string;
  revisionNumber?: number;
  retiredClauseIds?: Readonly<Record<string, string>>;
}

/**
 * Conservative segmenter for pasted plain text.
 *
 * Strategy A: explicit headings (markdown, numbered, or all-caps). Used only
 * when at least two headings are found, so a document with a single stray
 * capitalised line is not mis-split.
 *
 * Strategy B: blank-line paragraph boundaries. Always reported as low
 * confidence with every clause flagged `inferred`, because the segmenter is
 * guessing at structure the source never declared.
 */
export function segmentPastedText(
  raw: string,
  options: SegmentationOptions = {},
): DocumentRevision {
  const documentId = options.documentId ?? "PASTE";
  const documentTitle = options.documentTitle ?? "Pasted Agreement — Unverified Segmentation";
  const revisionNumber = options.revisionNumber ?? 1;

  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const headingIndices: number[] = [];
  const headingTitles = new Map<number, string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const title = detectHeading(line);
    if (title !== null) {
      headingIndices.push(i);
      headingTitles.set(i, title);
    }
  }

  const drafts: ClauseDraft[] =
    headingIndices.length >= 2
      ? segmentByHeadings(lines, headingIndices, headingTitles)
      : segmentByParagraphs(lines);

  const confidence: SegmentationConfidence = headingIndices.length >= 2 ? "high" : "low";

  return buildRevision({
    documentId,
    documentTitle,
    source: "pasted",
    revisionNumber,
    drafts,
    retiredClauseIds: options.retiredClauseIds,
    segmentationConfidence: confidence,
  });
}

function segmentByHeadings(
  lines: readonly string[],
  headingIndices: readonly number[],
  headingTitles: ReadonlyMap<number, string>,
): ClauseDraft[] {
  const drafts: ClauseDraft[] = [];

  const firstHeading = headingIndices[0];
  if (firstHeading !== undefined && firstHeading > 0) {
    const preamble = normaliseBody(lines.slice(0, firstHeading));
    if (preamble.length > 0) {
      drafts.push({
        title: "Preamble",
        clauseType: "other",
        text: preamble,
        // The source never labelled this; the human should confirm it.
        inferred: true,
      });
    }
  }

  for (let h = 0; h < headingIndices.length; h += 1) {
    const start = headingIndices[h];
    if (start === undefined) continue;
    const nextStart = headingIndices[h + 1] ?? lines.length;
    const title = headingTitles.get(start) ?? "Untitled Clause";
    const body = normaliseBody(lines.slice(start + 1, nextStart));
    drafts.push({
      title,
      clauseType: inferClauseType(title),
      text: body,
      inferred: false,
    });
  }

  return drafts.filter((draft) => draft.text.length > 0 || draft.title.length > 0);
}

function segmentByParagraphs(lines: readonly string[]): ClauseDraft[] {
  const blocks = normaliseBody(lines)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks.map((block, index) => ({
    title: `Paragraph ${index + 1}`,
    clauseType: inferClauseType(block.slice(0, 120)),
    text: block,
    // Nothing about this boundary was declared by the source.
    inferred: true,
  }));
}

export function toDraft(clause: Clause): ClauseDraft {
  return {
    title: clause.title,
    clauseType: clause.clauseType,
    text: clause.text,
    inferred: clause.inferred,
  };
}

/**
 * Produces the next revision of a document after a human correction.
 *
 * Every clause ID from the previous revision is retired, which is what lets a
 * tool call carrying an old ID be rejected as *stale* instead of silently
 * resolving to different text.
 */
export function reviseDocument(
  previous: DocumentRevision,
  drafts: readonly ClauseDraft[],
): DocumentRevision {
  const retired: Record<string, string> = { ...previous.retiredClauseIds };
  for (const clause of previous.clauses) {
    retired[clause.id] = previous.revisionId;
  }

  return buildRevision({
    documentId: previous.documentId,
    documentTitle: previous.documentTitle,
    source: previous.source,
    revisionNumber: previous.revisionNumber + 1,
    drafts,
    retiredClauseIds: retired,
    // A human has now reviewed the boundaries.
    segmentationConfidence: "high",
  });
}

/** Boundary correction: fold a clause into the one above it. */
export function mergeClauseWithPrevious(
  revision: DocumentRevision,
  targetClauseId: string,
): ClauseDraft[] | null {
  const index = revision.clauses.findIndex((clause) => clause.id === targetClauseId);
  if (index <= 0) return null;

  const previous = revision.clauses[index - 1];
  const target = revision.clauses[index];
  if (previous === undefined || target === undefined) return null;

  const merged: ClauseDraft = {
    title: previous.title,
    clauseType: previous.clauseType,
    text: [previous.text, target.title, target.text]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join("\n\n"),
    inferred: true,
  };

  const drafts = revision.clauses.map(toDraft);
  return [...drafts.slice(0, index - 1), merged, ...drafts.slice(index + 1)];
}

/**
 * Boundary correction: split a clause at one of its blank-line paragraph
 * boundaries. `paragraphIndex` is the index of the paragraph that begins the
 * new second clause.
 */
export function splitClauseAtParagraph(
  revision: DocumentRevision,
  targetClauseId: string,
  paragraphIndex: number,
): ClauseDraft[] | null {
  const index = revision.clauses.findIndex((clause) => clause.id === targetClauseId);
  if (index < 0) return null;

  const target = revision.clauses[index];
  if (target === undefined) return null;

  const paragraphs = target.text.split(/\n\s*\n/).map((part) => part.trim());
  if (paragraphIndex <= 0 || paragraphIndex >= paragraphs.length) return null;

  const head = paragraphs.slice(0, paragraphIndex).join("\n\n").trim();
  const tail = paragraphs.slice(paragraphIndex).join("\n\n").trim();
  if (head.length === 0 || tail.length === 0) return null;

  const drafts = revision.clauses.map(toDraft);
  return [
    ...drafts.slice(0, index),
    { title: target.title, clauseType: target.clauseType, text: head, inferred: target.inferred },
    {
      title: `${target.title} (continued)`,
      clauseType: target.clauseType,
      text: tail,
      inferred: true,
    },
    ...drafts.slice(index + 1),
  ];
}
