# ClauseBridge

An agent-native contract negotiation workspace. The human sets objectives, constraints and
non-negotiables; a browser agent retrieves exact clause context and stages *alternative* redline
packages through typed [WebMCP](https://github.com/webmachinelearning/webmcp) tools rather than by
scraping the rendered page. Every proposal is grounded in bundled text, explainable against the
human's stated conditions, reversible, comparable side by side, and replayable.

> **Not legal advice.** ClauseBridge is a document-operations prototype. The bundled agreement, the
> alternative wording, and every rationale in this repository are **fictional** material authored for
> a demonstration. Nothing here asserts that any wording is legally correct, safer, or preferable, and
> nothing was retrieved from a real contract, a legal database, or the web.

**Status: complete local product.** The two-tool collaboration loop runs end to end — objective
board with deterministic constraints, exact retrieval, multiple contrasting packages staged and
compared, per-clause choice, human edits, preview revisions, a replayable timeline, and a four-file
export bundle. It is deliberately not a general legal platform; see [What remains](#what-remains).

**What it is built to show**

1. The agent sees authoritative contract state through typed tools, not through the page.
2. The human defines the goals, the constraints and the non-negotiables.
3. The agent may retrieve context and stage alternatives — it cannot finalize anything.
4. Every proposal is grounded, explainable, reversible, comparable and replayable.

---

## Setup

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**. No network access, credentials, API keys, or accounts are
needed — the golden path works entirely offline. There is no backend, no database, and no telemetry.
Your session is saved to this browser's `localStorage` so a reload picks up where you left off;
**Reset demo** clears it. Nothing leaves the tab.

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
under the header tracks all thirteen steps and ticks each one only when the underlying operation has
actually run — a tool call really recorded with those clause IDs, a package really staged, a
decision really taken, a surface really opened. Nothing there is scripted.

1. **Northstar SaaS Services Agreement — Fictional Demo** loads automatically: a preamble plus 11
   invented clauses, drafted vendor-favorable so there is something real to push back on.
2. Press **Set up the board** in the demo strip. That sets the **Customer** role, locks
   *9. Limitation of Liability*, prioritises *termination* and *data retention*, and puts five
   constraints on the objective board — two **Must**, one **Prefer**, one **Avoid**, and liability
   marked for manual review. Every one of those controls also works by hand.
3. Read the board. Against the agreement as it stands it reports, honestly: termination notice
   **satisfied**, non-renewal notice **not met** (the clause says ninety days), automatic renewal
   **present anyway**, and data deletion **unresolved** — the seeded clause lets Northstar delete
   "at its discretion", which contains no deadline any rule can read.
4. In the right rail's **Agent** tab, open the local handler console and run
   `get_negotiation_context`. The agreement scrolls to the liability clause and pulses; the call
   appears above with its input, what validation concluded, and the note that it changed nothing.
5. Load **Customer-Protective** and run `stage_redline_package`. Then load **Fast Close** and run it
   again. Two contrasting packages now coexist. The agreement is untouched.
6. Open **Compare**. Each clause shows both alternatives against how it currently reads, with the
   exact diff, the rationale, the library entry the wording came from, and where each lands on your
   constraints. Customer-Protective meets both Musts; Fast Close misses the deletion deadline by
   thirty days, and says so with the sentence it read.
7. Choose per clause, not per package. **Choose this** on the protective *Term and Termination*
   proposal — its rival returns to *awaiting decision* rather than being rejected for you, and stays
   available. **Edit** the Fast Close *Data Retention* proposal to fifteen days and save: the unmet
   Must turns satisfied. **Reject** both liability proposals and leave the clause locked.
8. Open **Timeline**. **Revisions** shows what changed between two approved states, and can restore
   one by replaying its decisions. **Replay** steps through the record — it calls no handler and
   invents no result.
9. Open **Export** and download all four: the negotiation brief, the redlined Markdown, the decision
   log JSON and the tool activity JSON.

`↶ Undo` in the header steps back one decision at a time. **Reset demo** restores the exact seeded
starting state and clears the log and the undo stack. **Presentation** opens a wide, low-density
view of the same live state, driven by the same handlers.

Keyboard: <kbd>A</kbd> accepts and <kbd>R</kbd> rejects the first proposal still awaiting a
decision, <kbd>U</kbd> undoes, <kbd>J</kbd>/<kbd>K</kbd> walk the document, and <kbd>G</kbd> jumps
to whatever still needs a call. All are inert while you are typing in a field.

On screens narrower than `lg`, the three panes become **Objectives / Agreement / Agent** tabs, so
every control stays reachable on a phone.

## Constraints, and what they are not

A constraint is a *product* rule about the fictional agreement — "data deleted within 30 days", "no
automatic renewal". It is never a legal judgement, and the product never claims one.

Each of the six rules reads exactly one clause type with one narrow, published pattern, and returns:

| Status | Meaning |
| --- | --- |
| **Satisfied** | The rule found wording that meets the condition, and shows the sentence. |
| **Not met** | The rule found wording that does not, and shows the sentence. |
| **Unresolved** | The clause contains nothing the rule knows how to read. Never a guess. |
| **Not applicable** | The rule does not read this clause type. |

Every verdict carries the exact text it was based on and a plain description of the evaluation.
There is deliberately **no risk score anywhere in the product** — a weighted number would imply a
judgement about which wording is better, which this product does not make. Package summaries are
factual counts only.

## Why WebMCP is essential here

An agent scraping rendered contract text cannot reliably tell which clause it is looking at, which
revision is current, what the human marked non-negotiable, what has already been decided, or which
alternative wording it is actually authorized to propose. Guessing any of those on a contract is the
kind of mistake that is invisible until it matters.

ClauseBridge exposes those structures directly. The agent receives stable clause IDs, exact current
text, the human's priorities and locks, and a bounded library of approved fallback language — and its
proposals land in the same document the human is reading, where each one remains separately
inspectable and reversible.

Concretely, the typed surface buys six things a scraper cannot have:

- **Stable IDs** that name a clause rather than a screen position.
- **Revision validation** — an ID from a retired revision is rejected as *stale*, not silently
  resolved to different text.
- **Exact source text**, never a rendering of it.
- **Bounded wording**: a proposal can only carry text from the bundled library, and the comparison
  surface names which entry each one came from.
- **Staged, not applied** — nothing a tool does reaches the agreement.
- **Independent human approval**, one clause at a time, with the alternative preserved.

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
src/core/            deterministic, framework-free, fully unit-tested
  types.ts             document / clause / proposal / event / revision model
  ids.ts               revision-namespaced ID construction
  segmentation.ts      seeded + pasted-text segmentation, manual correction
  diff.ts              word-level LCS diff
  constraints.ts       the six deterministic rules and their evaluator
  state.ts             reducer, selectors, checkpoints, undo stack
  review.ts            proposals, packages and comparisons, derived from state
  replay.ts            timeline stepping and the revision inspector
  relationships.ts     the document relationship map
  migration.ts         carrying proposals across a revision
  persistence.ts       versioned browser-local session storage
  handlers.ts          the two tool handlers
  exports.ts           brief, redline, decision log, tool activity
  demo.ts              package presets and the 13-step director, from library text only
  seed/                the fictional agreement, fallback library and relationships
src/webmcp/          registration and the frozen tool schemas
src/app/             the external store and the Next.js entry point
src/components/      the three-part workspace and presentation mode
```

Six decisions shape everything else:

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
exact output and every export is byte-reproducible.

**Constraint verdicts are derived, never cached.** `review.ts` recomputes them from the wording on
screen, so they cannot go stale after an edit, an approval, a rejection, or a change to the
objective board. There is no second copy that could disagree with the text.

**One accepted proposal per clause.** Accepting one returns any rival on the same clause to
*awaiting decision* — two accepted proposals had no defined precedence. The alternative stays
staged and comparable; it is never rejected on the human's behalf.

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
- The **fallback library** (`src/core/seed/fallbackLibrary.ts`) holds 17 invented alternatives keyed
  by clause type, party role and posture. Each carries its own
  `source: "ClauseBridge fictional demo library"` label, and each note explains what the alternative
  *does* — never that it is correct or safer.
- The three **packages** — Customer-Protective, Balanced Compromise, Fast Close — are assembled from
  those entries and nothing else. They are deliberately unranked: the constraint evaluator reports
  where each stands against the human's conditions, and the human chooses.
- A **neutral** reviewer is shown only neutral options, never one side's negotiating language.
- The **relationship map** (`src/core/seed/relationships.ts`) holds 13 hand-authored edges, each
  naming the exact basis it rests on. It is labelled a *document relationship map*: it asserts no
  legal dependency and infers nothing from legal meaning.

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

`npm run verify` runs typecheck, lint, tests and the production build in order. As of the current
commit:

- **328 unit and integration tests pass** across 17 files: segmentation, stable-versus-stale IDs,
  diff, the six constraint rules and their evidence, handler validation, decision transitions,
  one-accepted-proposal-per-clause, undo, reset, bulk package decisions, tool-call provenance,
  preview-revision checkpoints and restoration, the review layer and its recomputation after edits
  and board changes, replay and the revision inspector, the relationship map, persistence and its
  rejection of corrupt payloads, proposal migration across revisions, all four exports, WebMCP
  registration, the package presets and the 13-step director, the store, and the full walkthrough
  end to end.
- **Typecheck**, **lint** and **production build** pass with no findings.
- `src/app/goldenPath.test.ts` drives the thirteen-step walkthrough through the same store the UI
  and WebMCP both call: two contrasting packages staged through the same handler, a per-clause
  choice that leaves the rival staged, a human edit turning an unmet Must into a satisfied one, the
  preview revision the decisions produced, a replay that runs no tool, and all four exports. It
  asserts that the source agreement stays byte-identical throughout, that a rejected proposal leaves
  no diff marks, and that repeating the same decisions produces byte-identical exports with no
  wall-clock time in them.
- The loopback dev server returns **HTTP 200** with the workspace rendered and no errors in its log.
- The native WebMCP path was verified in an earlier session by injecting a `document.modelContext`:
  both tools registered with the exact schemas, `execute` routed into the same handlers, an unknown
  clause ID was rejected without changing the agreement, and every resulting entry was tagged
  `native WebMCP`. `src/webmcp/register.test.ts` covers the same contract without a browser.

**Not run, and not claimed as passing:** the interactive Chrome pass — driving the golden path in a
real browser, checking the console, and eyeballing the narrow-screen layout. The Claude-in-Chrome
extension reported `Browser extension is not connected` in this session. Component rendering is
therefore covered by the production build and by server-rendered output, not by a DOM test
environment; none is installed and installing one was out of scope.

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
- The interactive Chrome pass against the current UI, including a narrow-screen visual check — the
  browser extension was not connected in the session that built this.
- Richer pasted-text segmentation (numbered sub-clauses, definition lists, schedules).
- Multiple bundled sample agreements and a broader fallback library.
- More constraint rules. The six shipped here are narrow on purpose; each new one needs a pattern
  narrow enough to defend and an `unresolved` path it is willing to take.

## License

[MIT](LICENSE) © 2026 Ethan Alapatt. The bundled agreement and fallback wording are fictional
demonstration material, not legal content.
