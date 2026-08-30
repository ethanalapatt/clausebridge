import { diffStats, diffWords, isBlockReplacement } from "@/core/diff";
import {
  acceptedTextOf,
  effectiveClauseText,
  findClause,
  governingEdit,
  isEditStale,
  isNonNegotiable,
  isSelected,
} from "@/core/state";
import type { AppState, ExportKind, StagedEdit } from "@/core/types";
import { DECISION_STATUS_LABELS, INVOCATION_SOURCE_LABELS } from "@/core/types";

/**
 * Deterministic Markdown exports.
 *
 * Both renderers are pure functions of state and contain no wall-clock time, so
 * the same decisions always produce byte-identical output. Ordering comes from
 * the recorded sequence counters, never from `Date`.
 */

const DISCLAIMER =
  "> **Not legal advice.** ClauseBridge is a document-operations prototype. This agreement, " +
  "the alternative wording, and every rationale below are fictional material authored for a " +
  "demonstration. Nothing here asserts that any wording is legally correct, safer, or preferable.";

function decisionLine(edit: StagedEdit): string {
  const label = DECISION_STATUS_LABELS[edit.status];
  return edit.note === null ? label : `${label} — note: ${edit.note}`;
}

function priorityLabel(edit: StagedEdit): string {
  return edit.priorityTag.charAt(0).toUpperCase() + edit.priorityTag.slice(1);
}

/**
 * The negotiation brief: what the human decided, clause by clause, with the
 * rationale that accompanied each proposal.
 */
export function renderNegotiationBrief(state: AppState): string {
  const lines: string[] = [];
  const revision = state.revision;

  lines.push(`# Negotiation Brief — ${revision.documentTitle}`);
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push("");
  lines.push(`- **Document:** ${revision.documentTitle}`);
  lines.push(`- **Revision:** ${revision.revisionId} (revision ${revision.revisionNumber})`);
  lines.push(`- **Source:** ${revision.source === "seed" ? "bundled fictional sample" : "pasted text"}`);
  lines.push(`- **Reviewing as:** ${state.partyRole}`);
  lines.push(
    `- **Priority areas:** ${state.priorityAreas.length > 0 ? state.priorityAreas.join(", ") : "none recorded"}`,
  );

  const nonNegotiable = revision.clauses.filter((clause) => isNonNegotiable(state, clause.id));
  lines.push(
    `- **Non-negotiable clauses:** ${
      nonNegotiable.length > 0
        ? nonNegotiable.map((clause) => `${clause.title} (${clause.id})`).join("; ")
        : "none marked"
    }`,
  );

  const selected = revision.clauses.filter((clause) => isSelected(state, clause.id));
  lines.push(
    `- **Selected for review:** ${
      selected.length > 0 ? selected.map((clause) => clause.id).join(", ") : "none"
    }`,
  );
  lines.push("");

  if (state.packages.length === 0) {
    lines.push("## Redline packages");
    lines.push("");
    lines.push("_No redline package has been staged._");
    lines.push("");
  }

  for (const pkg of state.packages) {
    lines.push(`## Package: ${pkg.packageLabel}`);
    lines.push("");
    lines.push(
      `Staged by **${INVOCATION_SOURCE_LABELS[pkg.source]}** against revision ${pkg.revisionId}.`,
    );
    lines.push("");

    const edits = state.edits.filter((edit) => edit.packageId === pkg.packageId);
    for (const edit of edits) {
      const clause = findClause(state, edit.clauseId);
      const heading =
        clause === null
          ? `### ${edit.clauseId} — clause retired by a later revision`
          : `### ${clause.ordinal}. ${clause.title} (${clause.id})`;

      lines.push(heading);
      lines.push("");
      lines.push(`- **Priority:** ${priorityLabel(edit)}`);
      lines.push(`- **Decision:** ${decisionLine(edit)}`);
      lines.push(`- **Rationale given:** ${edit.rationale}`);

      if (clause === null) {
        lines.push(
          "- **Status:** excluded from the redlined export because its clause ID is stale.",
        );
        lines.push("");
        continue;
      }

      const stats = diffStats(diffWords(edit.originalText, acceptedTextOf(edit)));
      lines.push(`- **Change size:** +${stats.wordsAdded} / -${stats.wordsRemoved} words`);
      lines.push("");
      lines.push("**Original text**");
      lines.push("");
      lines.push(`> ${edit.originalText.replace(/\n+/g, "\n> ")}`);
      lines.push("");

      if (edit.status === "rejected") {
        lines.push("**Proposed replacement (rejected — not applied)**");
      } else if (edit.status === "edited") {
        lines.push("**Human-edited replacement (applied)**");
      } else if (edit.status === "approved") {
        lines.push("**Approved replacement (applied)**");
      } else {
        lines.push("**Proposed replacement (awaiting decision — not applied)**");
      }
      lines.push("");
      lines.push(`> ${acceptedTextOf(edit).replace(/\n+/g, "\n> ")}`);
      lines.push("");

      if (edit.status === "edited") {
        lines.push(`_Agent's original proposal:_ ${edit.proposedText}`);
        lines.push("");
      }
    }
  }

  lines.push("## Decision log");
  lines.push("");
  if (state.activity.length === 0) {
    lines.push("_No activity recorded._");
  } else {
    lines.push("| # | Source | Event |");
    lines.push("| --- | --- | --- |");
    for (const entry of state.activity) {
      const summary = entry.summary.replace(/\|/g, "\\|");
      lines.push(`| ${entry.seq} | ${INVOCATION_SOURCE_LABELS[entry.source]} | ${summary} |`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * The agreement with accepted changes shown inline: deletions struck through,
 * insertions bolded. Rejected and pending proposals are not applied.
 */
export function renderRedlinedMarkdown(state: AppState): string {
  const lines: string[] = [];
  const revision = state.revision;

  lines.push(`# ${revision.documentTitle}`);
  lines.push("");
  lines.push(DISCLAIMER);
  lines.push("");
  lines.push(
    `Revision ${revision.revisionId}. Struck-through text was removed and **bold** text was added ` +
      "by an approved redline. Rejected and undecided proposals are not applied.",
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const clause of revision.clauses) {
    lines.push(`## ${clause.ordinal}. ${clause.title}`);
    lines.push("");

    const governing = governingEdit(state, clause.id);
    if (governing === null) {
      lines.push(clause.text);
      lines.push("");
      continue;
    }

    const accepted = effectiveClauseText(state, clause.id);
    const ops = diffWords(clause.text, accepted);

    // A near-total rewrite reads as noise word by word, so show it whole.
    const rendered = isBlockReplacement(diffStats(ops))
      ? `~~${clause.text}~~\n\n**${accepted}**`
      : ops
          .map((op) => {
            if (op.type === "equal") return op.text;
            // Whitespace-only runs are emitted plainly; wrapping them in markers
            // would produce empty `~~~~` and `****` artifacts.
            if (op.text.trim().length === 0) return op.text;
            const [, lead = "", body = "", trail = ""] =
              /^(\s*)([\s\S]*?)(\s*)$/.exec(op.text) ?? [];
            return op.type === "delete"
              ? `${lead}~~${body}~~${trail}`
              : `${lead}**${body}**${trail}`;
          })
          .join("");

    lines.push(rendered);
    lines.push("");
    lines.push(
      `_${DECISION_STATUS_LABELS[governing.status]} · ${priorityLabel(governing)} · ${governing.rationale}_`,
    );
    lines.push("");
  }

  const staleEdits = state.edits.filter((edit) => isEditStale(state, edit));
  if (staleEdits.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Excluded stale redlines");
    lines.push("");
    lines.push(
      "These staged edits reference clause IDs retired by a later revision and were not applied:",
    );
    lines.push("");
    for (const edit of staleEdits) {
      lines.push(`- \`${edit.clauseId}\` (${edit.editId}) — ${edit.rationale}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ----------------------------------------------------------------- filenames

/**
 * Reduces arbitrary text to a filename-safe slug.
 *
 * A document title is user-supplied — pasted agreements can be titled anything —
 * so this is deliberately strict rather than clever: ASCII alphanumerics and
 * single hyphens only. That rules out path separators, leading dots, Windows
 * reserved characters, and trailing dots or spaces in one pass.
 */
export function safeSlug(value: string, fallback = "document"): string {
  const slug = value
    .normalize("NFKD")
    // Strip combining marks so "Résumé" slugs to "resume", not "rsum".
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

/**
 * Deterministic download filename. It carries the revision rather than a
 * timestamp, so re-exporting the same decisions overwrites rather than piling up
 * near-identical files, and the name still says which revision it describes.
 */
export function exportFilename(state: AppState, kind: ExportKind): string {
  const title = safeSlug(state.revision.documentTitle, "agreement");
  const revision = safeSlug(state.revision.revisionId, "r1");
  const suffix = kind === "brief" ? "negotiation-brief" : "redlined";
  return `${title}-${revision}-${suffix}.md`;
}

/** Renders whichever export `kind` names. */
export function renderExport(state: AppState, kind: ExportKind): string {
  return kind === "brief" ? renderNegotiationBrief(state) : renderRedlinedMarkdown(state);
}
