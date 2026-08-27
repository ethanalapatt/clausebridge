# ClauseBridge

A structured contract-redlining room where a human sets non-negotiables and their browser agent
retrieves exact clause context and stages independently approvable redlines — through typed
[WebMCP](https://github.com/webmachinelearning/webmcp) browser tools rather than by scraping the
rendered page.

> **Not legal advice.** ClauseBridge is a document-operations prototype. The bundled agreement, the
> alternative wording, and every rationale in this repository are **fictional** material authored for
> a demonstration. Nothing here asserts that any wording is legally correct, safer, or preferable, and
> nothing was retrieved from a real contract, a legal database, or the web.

**Status: Rough Sketch Checkpoint.** A working local-first vertical slice, not a mockup and not the
full MVP. See [What remains](#what-remains).

---

## Setup

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**. No network access, credentials, API keys, or accounts are
needed — the golden path works entirely offline.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local preview at http://localhost:3000 |
| `npm run test` | Vitest unit suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run verify` | All four of the above, in order |

## The 60-second demo

The app seeds itself, so this flow is available the moment the page loads.

1. **Northstar SaaS Services Agreement — Fictional Demo** loads automatically: a preamble plus 11
   invented clauses, drafted vendor-favorable so there is something real to push back on.
2. In the left rail, keep the **Customer** role and click the **termination** and **data retention**
   priority chips. In the outline, click **Lock** on *9. Limitation of Liability* to mark it
   non-negotiable, and tick the boxes for clauses 7, 9, and 10.
3. In the right rail's **Tools** tab, press **Run handler locally** under `get_negotiation_context`.
   The agreement pane scrolls to the liability clause and pulses. The agent now holds exact clause
   text, the fictional fallback options for the customer posture, and the current decision state.
4. Press **Run handler locally** under `stage_redline_package` (pre-filled with the three-clause
   **Customer Baseline**). Three redlines appear in the gutter beneath their own clauses, each with
   its source text, an exact diff, a rationale, and a required/preferred/optional tag.
5. Exercise independent control: **Approve** on *Term and Termination*, **Edit** on *Data Retention*
   (change the wording and save), **Reject** on *Limitation of Liability*, and add a note.
6. Open **Preview & export** in the header for the negotiation brief and the redlined Markdown. The
   **Activity** tab shows the whole chronological audit trail.

`↶ Undo` in the header steps back one decision at a time.

## Why WebMCP is essential here

An agent scraping rendered contract text cannot reliably tell which clause it is looking at, which
revision is current, what the human marked non-negotiable, what has already been decided, or which
alternative wording it is actually authorized to propose. Guessing any of those on a contract is the
kind of mistake that is invisible until it matters.

ClauseBridge exposes those structures directly. The agent receives stable clause IDs, exact current
text, the human's priorities and locks, and a bounded library of approved fallback language — and its
proposals land in the same document the human is reading, where each one remains separately
inspectable and reversible.

## Tool contracts

Both tools are registered exactly as specified, with `additionalProperties: false`.

### `get_negotiation_context`

> Retrieve exact text, approved fallback language, and current decision status for selected clause
> IDs without changing the agreement.

```jsonc
{
  "clauseIds":     ["NSA-r1-09", "NSA-r1-10", "NSA-r1-07"],
  "partyRole":     "customer",          // customer | vendor | neutral
  "priorityAreas": ["termination", "data retention"]
}
```

Returns the document revision, exact `currentText` and `originalText` per clause, selection /
non-negotiable / decision state, and the fictional fallback entries matching each clause type and the
requested role. It focuses the first requested clause in the shared document and changes nothing
else. It never generates legal language.

### `stage_redline_package`

> Render a group of clause-specific redlines with rationales for independent human approval; does not
> finalize the contract.

```jsonc
{
  "packageLabel": "Customer Baseline",
  "edits": [{
    "clauseId":        "NSA-r1-09",
    "replacementText": "…",
    "rationale":       "…",
    "priorityTag":     "required"       // required | preferred | optional
  }]
}
```

Validation is **strict and atomic** — one bad edit rejects the whole package and nothing is staged:

- unknown clause IDs are rejected, and reported separately from **stale** IDs retired by a later
  revision;
- two edits to the same clause in one package are refused rather than resolved by guess;
- empty replacement text or rationale, and unknown priority tags, are rejected;
- a replacement identical to the clause's current text is rejected as a no-op.

## Architecture

```
src/core/         deterministic, framework-free, fully unit-tested
  types.ts          document / clause / edit / activity model
  ids.ts            revision-namespaced ID construction
  segmentation.ts   seeded + pasted-text segmentation, manual correction
  diff.ts           word-level LCS diff
  state.ts          reducer, selectors, undo stack
  handlers.ts       the two tool handlers
  exports.ts        negotiation brief + redlined Markdown
  demo.ts           golden-path inputs, built from library text only
  seed/             the fictional agreement and fallback library
src/webmcp/       registration and the frozen tool schemas
src/app/          the external store and the Next.js entry point
src/components/   the three-part workspace
```

Four decisions shape everything else:

**One implementation, two entry points.** Native WebMCP `execute` callbacks and the labeled local
test console call the *same* functions in `core/handlers.ts`. There is no demo-only code path that
could behave differently from the real tool surface.

**Approved text is derived, never stored.** There is no `approvedText` field. The wording a clause
currently reads as is computed from the staged edits, so staging can never overwrite the source
agreement, and reject/undo can never strand a clause holding text no live decision supports.

**Clause IDs are namespaced under their revision** (`NSA-r1-09`). Correcting a clause boundary mints
a new revision and retires every prior ID, which is what lets a tool call carrying an old ID be
rejected as *stale* rather than silently resolving to different text.

**The core is pure.** Timestamps are passed in rather than read from the clock, so the tests assert on
exact output and the Markdown exports are byte-reproducible.

### WebMCP status and the local fallback

ClauseBridge feature-detects `document.modelContext.registerTool`.

- **Present** → it registers exactly the two tools above and the header reads **Native WebMCP
  connected**.
- **Absent** → it registers **nothing**. No shim, no polyfill, no fabricated `document.modelContext`.
  The header reads **WebMCP unavailable** and the right rail offers a **"Local handler test — not
  WebMCP"** console that calls the identical handlers so the flow is still demonstrable.

Every entry in the activity timeline is tagged with its true source — `native WebMCP`, `local handler
test`, or `human`. The fallback can never present itself as WebMCP.

If the native API is present but rejects one of the contracts, registration rolls back any partial
registration and surfaces the mismatch instead of improvising a compatibility layer.

## Fictional data

- **Northstar Systems, Inc.** is not a real company and the agreement is not a real contract. It is
  written deliberately vendor-favorable so the customer-side demo has substance.
- The **fallback library** (`src/core/seed/fallbackLibrary.ts`) holds 14 invented alternatives keyed
  by clause type and party role. Each carries its own `source: "ClauseBridge fictional demo library"`
  label, and each note explains what the alternative *does* — never that it is correct or safer.
- A **neutral** reviewer is shown only neutral options, never one side's negotiating language.

## Scope and legal limitations

ClauseBridge performs document operations: segmentation, retrieval, diffing, staging, decision
tracking, and export. It does not perform legal analysis.

Deliberately **not** built, and not planned for this checkpoint:

- No legal advice, risk scoring, or claim that any wording is correct or preferable.
- No legal research and no retrieval of clause language from the web or any external source.
- No unrestricted legal-language generation. The agent proposes from a bounded fictional library; the
  handlers never author legal text.
- No PDF, DOCX, OCR, layout preservation, or e-signature.
- No authentication, external storage, APIs, deployment, analytics, or LLM backend. The browser's
  agent *is* the agent.
- No counterparty messaging, multiplayer editing, or enterprise version control.

## Verification

`npm run verify` runs all of it. As of the current commit:

- **132 unit tests pass** across segmentation, stable/stale IDs, diff, handler validation, decision
  transitions, undo, exports, registration, the demo builder, and the store.
- **Typecheck**, **lint**, and **production build** pass with no findings.
- The golden path was driven in Chrome with an **empty console** — no errors and no hydration
  warnings.
- The native path was verified by injecting a `document.modelContext`: both tools registered with the
  exact schemas, `execute` routed into the same handlers, an unknown clause ID was rejected without
  changing the agreement, and every resulting entry was tagged `native WebMCP`.

Known non-blocking issue: `npm audit` reports advisories in `postcss`, reached transitively through
`next@15`'s build toolchain. The only offered fix is a breaking upgrade to `next@16`. It is a
build-time dependency that never processes untrusted CSS here, so the approved stack was left intact.

## What remains

Beyond this checkpoint, toward the full challenge MVP:

- Hosting, an open-source license, and the Devpost submission materials.
- Richer pasted-text segmentation (numbered sub-clauses, definition lists, schedules).
- Multiple bundled sample agreements and a broader fallback library.
- Package-level bulk actions and redline comparison across revisions.
- Migrating staged edits across a revision instead of marking them stale.
- Accessibility and responsive passes; the three-pane workspace currently requires a desktop width.
