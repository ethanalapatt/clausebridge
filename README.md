# ClauseBridge

A structured contract-redlining room where a human sets non-negotiables and their browser agent
retrieves exact clause context and stages independently approvable redlines — through typed
[WebMCP](https://github.com/webmachinelearning/webmcp) browser tools rather than by scraping the
rendered page.

> **Not legal advice.** ClauseBridge is a document-operations prototype. The bundled agreement, the
> alternative wording, and every rationale in this repository are **fictional** material authored for
> a demonstration. Nothing here asserts that any wording is legally correct, safer, or preferable, and
> nothing was retrieved from a real contract, a legal database, or the web.

**Status: Local MVP.** The complete two-tool collaboration loop runs locally — retrieval, staging,
independent decisions, undo, audit log, and real Markdown downloads. It is deliberately not a general
legal platform; see [What remains](#what-remains).

---

## Setup

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**. No network access, credentials, API keys, or accounts are
needed — the golden path works entirely offline. There is no backend, no database, and no telemetry;
all state lives in the tab and is gone when you close it.

To bind the preview to loopback only, pass the host and port explicitly:

```bash
npx next dev --hostname 127.0.0.1 --port 3100
```

> Do not run `npm run build` while `npm run dev` is live — both write to `.next`, and the production
> build will break the running dev server. If that happens, stop the server, delete `.next`, and
> start it again.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local preview at http://localhost:3000 |
| `npm run test` | Vitest unit suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run verify` | All four of the above, in order |

## The 60-second demo

The app seeds itself, so this flow is available the moment the page loads. The **Guided demo** strip
under the header tracks all six steps and ticks each one only when the underlying operation has
actually run — nothing there is scripted.

1. **Northstar SaaS Services Agreement — Fictional Demo** loads automatically: a preamble plus 11
   invented clauses, drafted vendor-favorable so there is something real to push back on.
2. Press **Set up golden path** in the demo strip. That sets the **Customer** role, prioritises
   *termination* and *data retention*, locks *9. Limitation of Liability* as non-negotiable, and
   selects clauses 7, 9 and 10. Each of those controls also works by hand in the left rail.
3. In the right rail's **Tools** tab, press **Run handler locally** under `get_negotiation_context`.
   The agreement pane scrolls to the liability clause and pulses. The agent now holds exact clause
   text, the fictional fallback options for the customer posture, and the current decision state.
4. Press **Run handler locally** under `stage_redline_package` (pre-filled with the three-clause
   **Customer Baseline**). Three redlines appear in the gutter beneath their own clauses, each with
   its source text, an exact diff, a rationale, and a required/preferred/optional tag.
5. Exercise independent control: **Approve** on *Term and Termination*, **Edit** on *Data Retention*
   (change the wording and save), **Reject** on *Limitation of Liability*, and add a note. The same
   controls are in the right rail's **Redlines** and **Decisions** tabs.
6. Open the **Export** tab, or **Preview & export** in the header, and press **Download .md** for the
   negotiation brief and the redlined agreement. The **Activity** tab shows the whole chronological
   audit trail.

`↶ Undo` in the header steps back one decision at a time. **Reset demo** restores the exact seeded
starting state and clears the log and the undo stack.

On screens narrower than `lg`, the three panes become **Controls / Agreement / Agent** tabs, so every
control stays reachable on a phone.

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

- **162 unit and integration tests pass** across segmentation, stable/stale IDs, diff, handler
  validation, decision transitions, undo, reset, exports and export filenames, registration, the demo
  builder and checklist, the store, and the full golden path end to end.
- **Typecheck**, **lint**, and **production build** pass with no findings.
- `src/app/goldenPath.test.ts` drives the brief's ten-step walkthrough through the same store the UI
  and WebMCP both call, asserting that the source agreement stays byte-identical throughout, that a
  rejected redline leaves no diff marks, and that repeating the same decisions produces byte-identical
  exports with no wall-clock time in them.
- The golden path was previously driven in Chrome with an **empty console** — no errors and no
  hydration warnings. That interactive pass predates the current UI changes and has not been repeated
  since; the server-rendered page returns HTTP 200 with no render errors.
- The native path was verified by injecting a `document.modelContext`: both tools registered with the
  exact schemas, `execute` routed into the same handlers, an unknown clause ID was rejected without
  changing the agreement, and every resulting entry was tagged `native WebMCP`.

Known non-blocking issue: `npm audit` reports advisories in `postcss`, reached transitively through
`next@15`'s build toolchain. The only offered fix is a breaking upgrade to `next@16`. It is a
build-time dependency that never processes untrusted CSS here, so the approved stack was left intact.

## What remains

Deliberately out of scope for this prototype: PDF/DOCX/OCR, e-signature, accounts, real contract
uploads, cloud storage, legal research or risk scoring, counterparty messaging, multiplayer editing,
and any LLM backend. ClauseBridge is a document-operations surface for an agent, not a legal platform.

Not yet done, and not attempted in this local build:

- Hosting and the Devpost submission materials. (The source is published at
  https://github.com/ethanalapatt/clausebridge; it is not deployed anywhere.)
- A re-run of the interactive Chrome pass against the current UI, including a narrow-screen visual
  check. There is no DOM test environment installed, so component rendering is covered only through
  the production build and server-rendered output.
- Richer pasted-text segmentation (numbered sub-clauses, definition lists, schedules).
- Multiple bundled sample agreements and a broader fallback library.
- Package-level bulk actions and redline comparison across revisions.
- Migrating staged edits across a revision instead of marking them stale.
- Persistence: state lives in memory only, so a page reload starts the demo over.

## License

[MIT](LICENSE) © 2026 Ethan Alapatt. The bundled agreement and fallback wording are fictional
demonstration material, not legal content.
