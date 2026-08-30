import { beforeEach, describe, expect, it } from "vitest";

import {
  exportFilename,
  renderExport,
  renderNegotiationBrief,
  renderRedlinedMarkdown,
  safeSlug,
} from "@/core/exports";
import { stageRedlinePackage } from "@/core/handlers";
import type { HandlerContext } from "@/core/handlers";
import { toDraft } from "@/core/segmentation";
import { createInitialState, findClause, reduce } from "@/core/state";
import type { AppState } from "@/core/types";

const AT = "2026-01-01T00:00:00.000Z";
const CTX: HandlerContext = { source: "local-handler-test", at: AT };

function typeId(state: AppState, clauseType: string): string {
  const clause = state.revision.clauses.find((c) => c.clauseType === clauseType);
  if (clause === undefined) throw new Error(`missing ${clauseType}`);
  return clause.id;
}

/** The golden path: approve termination, edit retention, reject liability. */
function decidedState(): { state: AppState; ids: Record<string, string> } {
  const base = createInitialState();
  const ids = {
    termination: typeId(base, "termination"),
    retention: typeId(base, "data_retention"),
    liability: typeId(base, "liability"),
  };

  let state = reduce(base, { type: "toggle-non-negotiable", clauseId: ids.liability }, AT);
  state = reduce(state, { type: "set-priority-areas", areas: ["termination", "data retention"] }, AT);

  const staged = stageRedlinePackage(
    state,
    {
      packageLabel: "Customer Baseline",
      edits: [
        {
          clauseId: ids.termination,
          replacementText: "Either party may terminate for convenience upon sixty days notice.",
          rationale: "Mirror the vendor's convenience right.",
          priorityTag: "preferred",
        },
        {
          clauseId: ids.retention,
          replacementText: "Northstar shall delete Customer Data within thirty days.",
          rationale: "Bound the retention window.",
          priorityTag: "required",
        },
        {
          clauseId: ids.liability,
          replacementText: "Liability is capped at twelve months of fees.",
          rationale: "Raise the cap.",
          priorityTag: "required",
        },
      ],
    },
    CTX,
  );

  state = reduce(staged.state, { type: "approve-edit", editId: "pkg-0001-e01" }, AT);
  state = reduce(
    state,
    {
      type: "edit-replacement",
      editId: "pkg-0001-e02",
      text: "Northstar shall delete Customer Data within forty-five days and certify deletion.",
    },
    AT,
  );
  state = reduce(state, { type: "reject-edit", editId: "pkg-0001-e03" }, AT);
  state = reduce(state, { type: "set-note", editId: "pkg-0001-e03", note: "Non-negotiable." }, AT);

  return { state, ids };
}

describe("renderNegotiationBrief", () => {
  let decided: ReturnType<typeof decidedState>;

  beforeEach(() => {
    decided = decidedState();
  });

  it("is deterministic", () => {
    expect(renderNegotiationBrief(decided.state)).toBe(renderNegotiationBrief(decidedState().state));
  });

  it("contains no wall-clock timestamp", () => {
    // An ISO date anywhere in the output would make the export non-reproducible.
    expect(renderNegotiationBrief(decided.state)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("leads with the non-legal-advice disclaimer", () => {
    expect(renderNegotiationBrief(decided.state)).toContain("**Not legal advice.**");
  });

  it("records role, revision, priorities and non-negotiables", () => {
    const brief = renderNegotiationBrief(decided.state);
    expect(brief).toContain("**Revision:** NSA-r1 (revision 1)");
    expect(brief).toContain("**Reviewing as:** customer");
    expect(brief).toContain("**Priority areas:** termination, data retention");
    expect(brief).toContain(decided.ids.liability!);
  });

  it("states each decision and keeps the rationale", () => {
    const brief = renderNegotiationBrief(decided.state);
    expect(brief).toContain("**Decision:** Approved");
    expect(brief).toContain("**Decision:** Approved with edits");
    expect(brief).toContain("**Decision:** Rejected — note: Non-negotiable.");
    expect(brief).toContain("Mirror the vendor's convenience right.");
  });

  it("keeps the agent's original proposal visible after a human edit", () => {
    const brief = renderNegotiationBrief(decided.state);
    expect(brief).toContain("_Agent's original proposal:_");
    expect(brief).toContain("Northstar shall delete Customer Data within thirty days.");
    expect(brief).toContain("certify deletion");
  });

  it("marks rejected and pending proposals as not applied", () => {
    expect(renderNegotiationBrief(decided.state)).toContain("(rejected — not applied)");
  });

  it("handles a state with no packages", () => {
    const brief = renderNegotiationBrief(createInitialState());
    expect(brief).toContain("_No redline package has been staged._");
    expect(brief).toContain("_No activity recorded._");
  });

  it("includes the full decision log", () => {
    const brief = renderNegotiationBrief(decided.state);
    expect(brief).toContain("## Decision log");
    for (const entry of decided.state.activity) {
      expect(brief).toContain(entry.summary);
    }
  });
});

describe("renderRedlinedMarkdown", () => {
  let decided: ReturnType<typeof decidedState>;

  beforeEach(() => {
    decided = decidedState();
  });

  it("is deterministic", () => {
    expect(renderRedlinedMarkdown(decided.state)).toBe(
      renderRedlinedMarkdown(decidedState().state),
    );
  });

  it("applies approved and edited wording but not rejected wording", () => {
    const md = renderRedlinedMarkdown(decided.state);

    expect(md).toContain("Either party may terminate for convenience upon sixty days notice.");
    expect(md).toContain("certify deletion");
    // The rejected liability proposal must not appear in the document body.
    expect(md).not.toContain("Liability is capped at twelve months of fees.");
  });

  it("collapses a near-total rewrite into a whole-clause replacement", () => {
    const md = renderRedlinedMarkdown(decided.state);
    const source = findClause(decided.state, decided.ids.termination!)?.text ?? "";

    // Both sides appear intact rather than shredded into interleaved fragments.
    expect(md).toContain(`~~${source}~~`);
    expect(md).toContain("**Either party may terminate for convenience upon sixty days notice.**");
  });

  it("leaves an untouched clause byte-identical to the source", () => {
    const md = renderRedlinedMarkdown(decided.state);
    const confidentiality = findClause(decided.state, typeId(decided.state, "confidentiality"));
    expect(md).toContain(confidentiality?.text ?? "@@missing@@");
  });

  it("renders deletions struck through and insertions bold", () => {
    const md = renderRedlinedMarkdown(decided.state);
    expect(md).toMatch(/~~[^~]+~~/);
    expect(md).toMatch(/\*\*[^*]+\*\*/);
    // No empty markers left behind by whitespace-only diff runs.
    expect(md).not.toContain("~~~~");
    expect(md).not.toContain("****");
  });

  it("annotates changed clauses with the decision and rationale", () => {
    const md = renderRedlinedMarkdown(decided.state);
    expect(md).toContain("Approved · Preferred · Mirror the vendor's convenience right.");
    expect(md).toContain("Approved with edits · Required · Bound the retention window.");
  });

  it("includes every clause in document order", () => {
    const md = renderRedlinedMarkdown(decided.state);
    let cursor = -1;
    for (const clause of decided.state.revision.clauses) {
      const index = md.indexOf(`## ${clause.ordinal}. ${clause.title}`);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("excludes stale edits and lists them separately", () => {
    const revised = reduce(
      decided.state,
      {
        type: "revise-document",
        drafts: decided.state.revision.clauses.map(toDraft),
        label: "Corrected boundaries",
      },
      AT,
    );

    const md = renderRedlinedMarkdown(revised);
    expect(md).toContain("## Excluded stale redlines");
    expect(md).toContain(decided.ids.termination!);
    // Nothing was applied, so no redline markers appear in the body.
    expect(md).not.toMatch(/~~[^~]+~~/);
  });

  it("contains no wall-clock timestamp", () => {
    expect(renderRedlinedMarkdown(decided.state)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("safeSlug", () => {
  it("reduces a title to lowercase ASCII words joined by single hyphens", () => {
    expect(safeSlug("Northstar SaaS Services Agreement — Fictional Demo")).toBe(
      "northstar-saas-services-agreement-fictional-demo",
    );
  });

  it("strips characters that would escape the filename or the directory", () => {
    expect(safeSlug("../../etc/passwd")).toBe("etc-passwd");
    expect(safeSlug("a/b\\c:d*e?f\"g<h>i|j")).toBe("a-b-c-d-e-f-g-h-i-j");
    expect(safeSlug(".hidden.")).toBe("hidden");
    expect(safeSlug("CON")).toBe("con");
  });

  it("folds accents instead of deleting the letters underneath", () => {
    expect(safeSlug("Résumé Clause")).toBe("resume-clause");
  });

  it("falls back rather than returning an empty name", () => {
    expect(safeSlug("!!!", "agreement")).toBe("agreement");
    expect(safeSlug("   ")).toBe("document");
  });

  it("caps the length and never leaves a trailing hyphen", () => {
    const slug = safeSlug("word ".repeat(50));
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("exportFilename", () => {
  it("names both exports from the document title and revision", () => {
    const { state } = decidedState();
    expect(exportFilename(state, "brief")).toBe(
      "northstar-saas-services-agreement-fictional-demo-nsa-r1-negotiation-brief.md",
    );
    expect(exportFilename(state, "redline")).toBe(
      "northstar-saas-services-agreement-fictional-demo-nsa-r1-redlined.md",
    );
  });

  it("is deterministic — no clock, no counter", () => {
    const { state } = decidedState();
    expect(exportFilename(state, "brief")).toBe(exportFilename(state, "brief"));
  });

  it("stays safe for a hostile pasted title", () => {
    const base = createInitialState();
    const hostile: AppState = {
      ...base,
      revision: { ...base.revision, documentTitle: "../../../etc/passwd" },
    };
    const name = exportFilename(hostile, "brief");
    expect(name).toBe("etc-passwd-nsa-r1-negotiation-brief.md");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });
});

describe("renderExport", () => {
  it("dispatches to the matching renderer", () => {
    const { state } = decidedState();
    expect(renderExport(state, "brief")).toBe(renderNegotiationBrief(state));
    expect(renderExport(state, "redline")).toBe(renderRedlinedMarkdown(state));
  });
});
