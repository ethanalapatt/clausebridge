# ClauseBridge Progress

## Status

- Current phase: **Product elevation** (per `ClauseBridge_Product_Elevation_Claude_Brief.md`, the latest and highest-priority instruction).
- Current milestone: **H — complete.** All Priority 0 and Priority 1 work is done and verified.
- Overall state: the MVP described in the historical record is preserved and elevated into an agent-native negotiation workspace — objective board with deterministic constraints, three contrasting packages compared per clause, preview revisions, a replayable timeline, full WebMCP provenance, a document relationship map, presentation mode, and a four-file export bundle. `npm run verify` exits 0 with **328 tests**.
- Last updated: at the end of the elevation run, awaiting the user's visual review.

## Authority for this run

`ClauseBridge_Product_Elevation_Claude_Brief.md` supersedes the older briefs. It raises the product
target from a functional MVP to a polished, judge-ready local product, and it **re-authorizes
GitHub milestone pushes** to the existing approved `origin` — overriding the older file that
prohibited them. Every other external restriction stays in force: no deployment, no APIs, no package
downloads, no web browsing, no filesystem access outside this folder.

The two WebMCP tool contracts (`get_negotiation_context`, `stage_redline_package`) and their input
schemas are frozen and unchanged. No third tool was added.

## Elevation audit — factual baseline observed at the start of this run

- Git: branch `main`, HEAD `a3a35ee`, upstream `origin/main`, remote `https://github.com/ethanalapatt/clausebridge.git` — matches the repository already approved by the user. Working tree clean apart from two untracked briefs.
- Baseline `npm run verify` — **exit 0**: `tsc --noEmit` passed, `eslint .` passed with no findings, **204 tests across 12 files** passed, production build compiled.
- Existing code read in full: 9,666 lines across `src/core`, `src/webmcp`, `src/app`, `src/components`.

### What already worked and was preserved, not rebuilt

Document/revision model with revision-namespaced clause IDs and stale-vs-unknown rejection;
conservative segmentation; lossless word-level LCS diff; both deterministic handlers with strict
atomic validation; the approve/reject/edit/note/reset/undo state machine with derived effective
text; deterministic Markdown exports; WebMCP registration with no shim; the external store; session
persistence; redline migration across revisions; whole-document comparison; keyboard shortcuts.

### Gap list against the elevation brief

| # | Brief ref | Gap in the MVP |
| --- | --- | --- |
| 1 | 6.1 | No objective board. Role, priorities, selection and non-negotiables were scattered controls, and there were no structured Must/Prefer/Avoid constraints or human intent notes. |
| 2 | 6.2 | Only one seeded package (`Customer Baseline`). No contrasting alternatives, no comparison surface, no per-clause choice between competing proposals, no package summary counts, no fallback provenance on a staged edit. |
| 3 | 6.3 | No constraint evaluator at all. |
| 4 | 6.4 | No way to restore a prior approved state; no checkpoints. |
| 5 | 6.5 | The activity log was a flat list of prose summaries: no stable event ID, no affected clause/package IDs, no before/after, no click-to-focus, no revision inspector, no replay. |
| 6 | 6.6 | The guided demo had six coarse steps, not the brief's thirteen, and no presentation mode. |
| 7 | 6.7 | Tool calls were logged as a summary string. No structured record of input, validation result, result summary, state effect, or failure detail; no developer inspector. |
| 8 | 7.1 / 7.3 | No relationship map. Exports covered Markdown only — no decision-log or tool-activity JSON. |

## Milestone ledger — elevation run

Every row passed `npm run verify` (typecheck → lint → tests → production build) before it was
committed, and every pushed SHA was verified against `git ls-remote origin refs/heads/main`.

| # | Milestone | Verification | Commit | Pushed |
| --- | --- | --- | --- | --- |
| A | Deterministic constraint engine (`src/core/constraints.ts`) | 32 new tests; verify exit 0 (236 tests) | `e2310c0` | `e2310c0` — verified |
| B | State hardening: objective board, structured timeline events, tool-call provenance, preview-revision checkpoints, one-accepted-proposal-per-clause | 28 new tests; verify exit 0 (264 tests) | `c5daf6a` | `c5daf6a` — verified |
| C | Three contrasting packages + the review layer (`src/core/review.ts`) | 25 new tests; verify exit 0 (289 tests) | `d336517` | `d336517` — verified |
| D | Replay and revision inspector, 13-step director, JSON export bundle | 25 new tests + rewritten integration test; verify exit 0 (316 tests) | `d4a7a13` | `d4a7a13` — verified |
| E+F | Objective board, comparison surface, provenance panel, timeline/replay, export bundle UI | verify exit 0 (316 tests); loopback SSR HTTP 200, 61,176 bytes, no dev-server errors | `51d6217` | `51d6217` — verified |
| G | 13-step demo director, presentation mode, live region, document relationship map | 12 new tests; verify exit 0 (328 tests) | `78e9966` | `78e9966` — verified |
| H | Import review hardening, clause-navigation shortcuts, README, this record | verify exit 0 (328 tests) | `2490da6` | `2490da6` — verified |
| I | **Interactive Chrome pass** and the objective-board layout bug it found | verify exit 0 (328 tests); thirteen-step walkthrough driven in Chrome, console clean | `c320c33` | `c320c33` — verified |

## Current state

- Branch `main`, upstream `origin/main`, remote `https://github.com/ethanalapatt/clausebridge.git`.
- Local `HEAD` matches the verified remote `origin/main`. Working tree clean apart from the two untracked brief files (`ClauseBridge_Product_Elevation_Claude_Brief.md`, `do this one.md`), deliberately left untracked.
- `npm run verify` — **exit 0**: `tsc --noEmit` clean, `eslint .` no findings, **328 tests across 17 files**, production build compiled, `/` statically prerendered, 103 kB shared first-load JS.
- Local preview: `npx next dev --hostname 127.0.0.1 --port 3100` → **http://127.0.0.1:3100**, verified listening on IPv4 loopback only via `lsof -nP -iTCP:3100 -sTCP:LISTEN`.

## Priority 0 — complete

| § | Requirement | State |
| --- | --- | --- |
| 6.1 | Negotiation objective board: role, priorities, clause selection, non-negotiables, Must/Prefer/Avoid constraints, human note, compact summary visible while reviewing | Done. `ObjectiveBoard.tsx`; `ObjectiveSummary` is rendered above the comparison. |
| 6.2 | Alternative package comparison: multiple packages coexist, three seeded alternatives, per-clause/per-package evidence, per-clause choice, edit before approval, independent rejection, alternatives preserved, resulting revision visible, factual counts only | Done. `PackageComparison.tsx` over `core/review.ts`. Accepting one proposal returns its rival to *awaiting decision*, never rejects it. |
| 6.3 | Deterministic constraint evaluation with ID, status, exact evidence, explanation, manual-review flag; recomputed on staging, edit, decision and board change; `unresolved` for ambiguity | Done. `core/constraints.ts` (pure) + `core/review.ts` (derived, never cached). |
| 6.4 | Review state machine: original / staged / edited / approved / rejected / preview separated; approve, reject, edit-then-approve, note, undo, restore a prior revision, full reset | Done. `core/state.ts`; checkpoints restore by replaying decisions, never by overwriting clause text. |
| 6.5 | Revision timeline and replay: stable event IDs, source attribution, affected IDs, before/after, click-to-focus, revision inspector, replay without rerunning tools | Done. `core/replay.ts` + `Timeline.tsx`. |
| 6.6 | Guided golden path: the brief's 13 steps, progress strip, one-sentence next action, never blocking, derived from real state, reset and presentation controls | Done. `core/demo.ts` + `DemoGuide.tsx` + `PresentationMode.tsx`. |
| 6.7 | WebMCP activity and provenance: tool, source, input summary, revision, clause IDs, validation, result, state effect, failure detail, developer inspector | Done. `ToolCallRecord` in state, rendered by `ToolActivity.tsx`. |
| 6.8 | State integrity, tests, visual polish | Done. 328 tests; persistence bumped to v2 so a v1 payload is rejected rather than hydrated. |

## Priority 1 — complete

| § | Requirement | State |
| --- | --- | --- |
| 7.1 | Agreement relationship map from explicit bundled metadata, focus/state aware, click to focus, no graph dependency, secondary to the document | Done. `core/relationships.ts` + inline SVG, collapsed by default. |
| 7.2 | Import and segmentation review: plain text only, conservative segmentation, structural confidence, review before tool use, title/type correction, merge and split, revision regeneration, clear rejection, never transmitted | Done. `ImportDialog.tsx` plus a standing notice on any guessed boundary. |
| 7.3 | Export bundle: brief, redlined agreement, decision log JSON, tool activity JSON, each with the disclaimer and observed revision | Done. `core/exports.ts` + `ExportPanel.tsx`. |
| 7.4 | Accessibility and keyboard flow | Done: semantic controls, `aria-pressed`/`aria-selected`/`aria-expanded`, visible focus ring, non-colour status glyphs, reduced-motion honoured, a polite live region announcing the newest recorded event, and A/R/U/J/K/G shortcuts inert while typing. |
| 7.5 | Presentation mode using the same state and handlers | Done. `PresentationMode.tsx`. |

## Verification evidence

Exact commands and results, this run:

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | pass, no output |
| `npm run lint` (`eslint .`) | pass, no findings |
| `npm run test` (`vitest run`) | **328 passed**, 17 files, 0 failed |
| `npm run build` (`next build`) | pass; `/` prerendered static, 103 kB shared first-load JS |
| `npm run verify` | **exit 0** |
| `curl http://127.0.0.1:3100/` | **HTTP 200**, 61,176 bytes, workspace markup present, dev-server log clean |
| `lsof -nP -iTCP:3100 -sTCP:LISTEN` | `127.0.0.1:3100` only — loopback, not LAN-facing |
| `git ls-remote origin refs/heads/main` | matches local `HEAD` after every milestone push |

### Interactive Chrome pass — RAN, on the user's prompt, after the extension was connected

Driven against http://127.0.0.1:3100 at a 1278x879 viewport. The full thirteen-step walkthrough was
executed through the real UI:

| Step | Observed |
| --- | --- |
| Setup | Demo strip advanced 2/13 → 4/13; role, lock, priorities and five constraints applied. |
| Board honesty | Against the untouched agreement: **1 Must met, 2 Must unresolved, 1 Prefer unmet, 1 present anyway, 2 manual review** — the seeded retention clause reported `Unresolved`, not guessed. |
| `get_negotiation_context` | Agreement scrolled to the liability clause and pulsed; provenance recorded with `Read-only` effect. |
| Two packages | Customer-Protective and Fast Close staged through the same handler; agreement untouched; 6/13. |
| Comparison | Customer-Protective **2 Must met, 1 unresolved, 1 Prefer met**; Fast Close **1 Must met, 1 Must unmet, 1 unresolved, 1 Prefer unmet**. Both flagged “touches 1 locked clause”. 7/13. |
| Per-clause choice | Chose the protective Termination proposal → “Governs this clause”; the Fast Close rival stayed **Awaiting decision**, not rejected. 8/13. |
| Human edit | Rewrote the Fast Close retention proposal to fifteen days → the verdict moved **Must · Not met → Must · Satisfied**. 9/13. |
| Rejection | Both liability proposals rejected; clause header still reads `Non-negotiable` + `Rejected`. 10/13. |
| Revisions | Inspector listed `rev-0001 — approve Term and Termination` and `rev-0002 — edit Data Retention and Deletion`, selectable against the original agreement. |
| Replay | Stepped the record (11 steps); `toolCalls` count unchanged — no handler was called. 12/13. |
| Exports | All four previews render. Redline contains the human's wording; the rejected liability clause carries **no diff marks**. Decision log: 2 packages, 5 constraints, 2 preview revisions, 14 events. Tool log: 3 calls, all `local-handler-test`, WebMCP `unavailable`. |
| Reload | Session restored from `localStorage` with the banner and 12/13 intact. |
| Relationship map | 12 nodes, 16 edges (13 authored + 3 derived); focusing Liability highlighted its neighbourhood and listed each basis. |
| Presentation mode | Opened on the same live state, reported **Step 13 of 13**, Escape exited. |
| Keyboard | `J` walked the document focus between clauses. |
| Console | **Clean.** Only React DevTools info and Fast Refresh logs. No errors, no warnings, no hydration mismatch. |

**One real bug was found and fixed by this pass:** every panel in the objective board was being
flex-compressed and given its own scrollbar — the Document panel rendered 32px of a 135px body —
because the board became a flex column scroller while `Panel` still defaulted its body to
`overflow-y-auto`. The rail is now the single scroller and the panels keep their natural height
(measured after the fix: 198 / 298 / 288 / 696 px, nothing clipped, board `scrollHeight` 1516 over a
701px viewport).

**Step 13 was deliberately not clicked.** Downloading writes four files into the user's Downloads
folder, which they had not asked for; the previews were verified instead and the download path is
covered by `store.test.ts` and `goldenPath.test.ts`.

### Checks that still did NOT run — recorded as unavailable, not as passes

- **Narrow-screen visual check.** `resize_window` had no effect on this browser: the viewport stayed
  pinned at 1278x879 through resizes to 1680x1020, 1250x1000 and 820x900, so the below-`lg` pane-tab
  layout could not be triggered. It is present in the markup and in the production build, but it was
  not seen rendered. Next diagnostic: resize the Chrome window by hand below 1024px and confirm the
  **Objectives / Agreement / Agent** tabs appear.
- **Component/DOM tests.** No `jsdom`, `happy-dom` or `@testing-library` is present in
  `node_modules`, and installing one is prohibited this run.
- **Native WebMCP in this session.** Chrome did not expose `document.modelContext`, so the app
  correctly reported `WebMCP unavailable` and every call was tagged `local handler test` — never
  native. The native path is covered by `src/webmcp/register.test.ts` and was driven by injection in
  an earlier session.

## Architecture and dependencies

Unchanged stack: Next.js 15 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`),
Tailwind CSS v4, Vitest (node environment), ESLint. **No package was installed, updated or
downloaded this run.** No framework change, no new dependency, no `npx` that fetches anything.

Deterministic domain logic stays out of the components: `constraints`, `review`, `replay`,
`relationships`, `state`, `handlers`, `exports`, `diff`, `segmentation`, `migration`, `persistence`
are all framework-free and unit-tested. The UI reads through selectors and dispatches actions; it
holds no business logic of its own and no second copy of a verdict.

## Product-safety invariants held

- Exactly two WebMCP tools, names, descriptions and input schemas unchanged and frozen.
- Both tools call the same deterministic handlers the labeled local console calls. No demo-only path.
- No native registration is claimed unless `document.modelContext.registerTool` was actually found.
- No risk score anywhere; package summaries are factual counts.
- No wording is generated: a proposal can only carry text from the bundled fictional library, and the
  comparison names which entry it came from and whether the human has since rewritten it.
- The source agreement is never mutated. Accepted wording is derived from live decisions.
- Constraint verdicts return `unresolved` rather than guessing; the seeded data-retention clause does
  exactly that, on purpose.

## Blockers

- **Narrow-screen rendering** — `resize_window` does not change this browser's viewport, so the
  below-`lg` layout could not be triggered. Three sizes attempted; not retried further, because the
  fix is outside this sandbox. Non-fatal and visual only.
- No repair loop reached the three-attempt limit this run.

## Next exact action

1. **Stop and wait for the user's visual and product review** of http://127.0.0.1:3100.
2. Resize the Chrome window by hand below 1024px to confirm the pane tabs — the only check the
   automated pass could not perform.
3. Nothing else is queued. Deployment, demo video and Devpost remain unstarted and unauthorized.

## External work

**Performed, authorized by `ClauseBridge_Product_Elevation_Claude_Brief.md` §2:**

- Nine `git push origin main` fast-forwards to the existing approved remote, each after its
  milestone passed `npm run verify`, each verified with `git ls-remote`.
- Read-only `git remote -v`, `git status`, `git log`, `git ls-remote`.
- No force push, no history rewriting, no branch/remote change, no PR, issue, release, Actions,
  Pages, collaborator or repository-setting change. No `git pull` or `git fetch`.

**NOT performed, and not authorized without new explicit instruction:**

- Vercel or any other hosting, tunnel, public preview or LAN-facing server.
- Demo video production and Devpost submission.
- Any external API, LLM backend, package install, registry access, or web browsing.
- Any read or write outside this folder.

---

# Historical record — earlier runs (preserved)

## Approved decisions

- Product: ClauseBridge, a fictional contract-redlining collaboration prototype; never present it as legal advice.
- Product scope and WebMCP contracts: controlled by `ClauseBridge_Claude_Code_Brief.md`.
- Git/GitHub workflow: controlled by `CLAUDE_GITHUB_AND_PROGRESS_PROTOCOL.md`.
- Stack (approved): Next.js 15 App Router + React 19 + TypeScript strict, fully client-side with no server routes or data fetching; Tailwind CSS v4; Vitest (node environment) for deterministic core tests; ESLint (`eslint-config-next`) plus `tsc --noEmit` and `next build` as the verification gate.
- Package manager (approved): npm. Exactly one network install command: `npm install`, covering `next react react-dom typescript @types/node @types/react @types/react-dom tailwindcss @tailwindcss/postcss postcss vitest eslint eslint-config-next`.
- Deliberately declined (approved): no Tiptap — the agreement viewer renders clause objects straight from the revision model so there is one source of truth; no diff library — a word-level LCS diff is written in-repo so the inline diff is directly unit-testable and dependency-free. No state-management library; a React reducer over a plain document-revision model.
- WebMCP registration strategy (approved): feature-detect `document.modelContext.registerTool`. When present, register exactly the two baseline tools with names, descriptions, and `inputSchema` copied verbatim from the brief, with `execute` delegating to the shared handlers in `src/core/handlers.ts`. When absent, register nothing — no shim, no polyfill, no fabricated `document.modelContext`.
- Local fallback strategy (approved): a visibly labeled "Local handler test — not WebMCP" control invokes the same handler functions as native WebMCP. The status indicator and activity timeline always distinguish `native WebMCP` from `local handler test`. If the native API signature differs from the brief, stop and ask rather than improvise.
- Git author identity (approved): repo-local only — `Ethan Alapatt <ethanalapatt@gmail.com>` as commit author, with `Co-Authored-By: Jisa Gigi Alapatt <jisagigi@gmail.com>` on every commit so both people are attributed. Global Git configuration was not modified and remains empty.
- File housekeeping (approved): `ClauseBridge_Claude_Code_Brief.md` copied into this folder from `~/Downloads`; `CLAUDE_GITHUB_AND_PROGRESS_PROTOCOL(1).md` and `PROGRESS(1).md` renamed to drop the `(1)` suffix.
- Approved external actions: use the existing `gh` CLI authentication to create and push to the confirmed ClauseBridge repository. Nothing else external.
- Still prohibited: unapproved APIs, cloud services, deployment, analytics, authentication, external legal sources, LLM backends, force-pushes, destructive Git, releases, pull requests, GitHub Pages/Actions, or changes outside this folder.

## GitHub state

> **Authority note.** `do this one.md` prohibited all remote access, and the local MVP was built and
> verified entirely under that restriction. The user then instructed "publish to github" directly in
> chat, which supersedes the file for that action. Everything before the push in this run was done
> with no network contact; the push and the checks immediately around it are the only remote calls.

- Repository URL: https://github.com/ethanalapatt/clausebridge
- Repository visibility: public (explicitly confirmed by the user)
- Remote name: `origin`
- Target branch: `main`
- Upstream configured: yes — `main` tracks `origin/main`
- Last pushed commit: `1800cbc168f1cf20a6d9bb809ea4920e0533889a` (`feat(ui): build fictional agreement workspace`)
- Local/remote sync: verified equal after each push; local HEAD SHA matched `git ls-remote origin refs/heads/main`
- Authentication: existing `gh` CLI login as `ethanalapatt` (scopes `gist, read:org, repo`), verified via `gh auth status`. No credentials requested, printed, stored, or committed.

## Completed and verified

- [x] Initial architecture, dependency, WebMCP, and fallback plan approved by the user.
- [x] Exact GitHub repository target and visibility approved by the user: `ethanalapatt/clausebridge`, public, branch `main`.
- [x] Local repository initialized on `main` with a repo-local author identity; global config untouched.
- [x] `.gitignore` created with the protocol's required entries plus Next.js build output.
- [x] Baseline committed (`77b27d5`) and pushed to `origin/main`; remote SHA verified equal to local HEAD.
- [x] Dependencies installed with a single `npm install`; scaffold typechecks, lints, builds, and serves HTTP 200 on the dev server.
- [x] Document/revision model with revision-namespaced stable clause IDs and retired-ID tracking for stale-versus-unknown rejection.
- [x] Fictional Northstar SaaS Services Agreement: preamble plus 11 clauses covering all eight required sections.
- [x] Fictional fallback library: 14 entries keyed by clause type and party role, each labeled with its demo-library source.
- [x] Conservative pasted-text segmentation (headings, then paragraph fallback) with manual merge/split/retitle correction producing a new revision.
- [x] Lossless word-level LCS diff with stats, verified to reconstruct both sides exactly.
- [x] Both WebMCP handlers implemented deterministically with strict validation: unknown-vs-stale clause IDs, duplicate edits, malformed edits, no-op redlines, atomic rejection.
- [x] Decision state machine: independent approve/reject/edit/note/reset, derived effective text so the source agreement is never overwritten, and a labeled undo stack.
- [x] Deterministic negotiation-brief and redlined-Markdown exports containing no wall-clock time.
- [x] WebMCP registration: exactly the two baseline tools with verbatim names, descriptions, and schemas; no shim or polyfill when the API is absent; partial registration rolled back and contract mismatches reported rather than worked around.
- [x] External store so a native agent can invoke handlers outside React and still read current state synchronously.
- [x] Three-part workspace: outline/role/priority/selection rail, paper agreement pane with clause anchors and real focus pulses, and a fallback/redline/activity rail.
- [x] Visibly labeled local handler-test console calling the identical handlers, with golden-path prefills built from library text only.
- [x] Golden path driven end to end in Chrome: context retrieval, three-clause staging, approve/edit/reject/note, undo, and both export previews. Console empty — no errors, no hydration warnings.
- [x] Native WebMCP path verified by injecting a `document.modelContext`: both tools registered with the exact schemas and `additionalProperties: false`, `execute` routed into the same handlers, an unknown clause ID was rejected without changing the agreement, and every entry was tagged `native WebMCP`.
- [x] README covering setup, demo, WebMCP rationale, tool contracts, architecture, fictional data, legal limitations, verification, and remaining scope.

## Current working state

- Uncommitted files at handoff: `README.md`, `PROGRESS.md`, and `src/app/goldenPath.test.ts` (committed in the final milestone commit below).
- Preview command used: `npx next dev --hostname 127.0.0.1 --port 3100`.
- Local preview URL: **http://127.0.0.1:3100** — verified listening on IPv4 loopback only via `lsof -nP -iTCP:3100 -sTCP:LISTEN`.

## Milestones 2–7 — what was built this run

Against the eight-item gap list above, all closed:

1. **Real downloads.** `exportFilename` / `safeSlug` / `renderExport` in `src/core/exports.ts` build deterministic, path-safe names (accent folding, `..` and separator stripping, length cap, non-empty fallback). `src/app/download.ts` saves via a Blob and an object URL — entirely in-tab, no network. Wired into both the header dialog and a new right-rail **Export** tab.
2. **Reset.** `resetSession` in `src/core/state.ts` returns the exact `createInitialState()` and clears the undo stack, carrying over only `webmcpStatus` (a browser fact, not demo state). Surfaced as a **Try the demo** / **Reset demo** control with an inline two-step confirmation — deliberately not `window.confirm`, which blocks the page and any agent driving it.
3. **Golden-path seeding.** `goldenPathSetup` in `src/core/demo.ts` plus a new `apply-demo-setup` action that validates every clause ID against the active revision, so a setup built for the seeded agreement cannot attach itself to pasted text.
4. **Guided demo strip.** `src/components/DemoGuide.tsx`, driven by `goldenPathSteps`. Each tick is derived from real state — a recorded tool *result*, a staged package, a decision actually taken. A rejected tool call does not tick its step.
5. **Narrow screens.** The three panes become Controls / Agreement / Agent tabs below `lg` instead of being hidden behind a "use a wider screen" notice.
6. **Decision log.** New right-rail **Decisions** tab: per-redline status, counts, undo, and the chronological list of decision entries, distinct from the raw Activity timeline.
7. **Decision controls in the review rail.** `RedlineCard` extracted from `AgreementPane` into `src/components/RedlineCard.tsx` and reused, so approve / reject / edit / note / reset appear in both the document and the rail without duplicated logic.
8. **Export preview in the rail.** The new Export tab previews and downloads both documents.

Also: a dedicated `export` activity kind so the checklist derives from structured state rather than matching log prose; `Button` now forwards refs and takes `aria-label`; the export dialog got `role="dialog"`, Escape-to-close, backdrop dismissal, and initial focus; both tab strips got `role="tablist"` / `aria-selected`.

## Test and build status — observed this run

Final `npm run verify` — **exit 0**:

- Unit and integration tests: **162 passed, 0 failed**, 9 files (diff 16, segmentation 21, handlers 23, state 30, exports 27, register 14, demo 14, store 14, goldenPath 3).
- Type checking: `tsc --noEmit` passed.
- Lint: `eslint .` passed, no findings.
- Production build: passed, `/` statically prerendered, 103 kB shared first-load JS.

New coverage added this run: export filename safety including a hostile `../../../etc/passwd` title; `apply-demo-setup` validation and undo; `record-export` being logged but non-undoable; reset restoring the exact initial state after a full golden path; store-level download naming and content; and `src/app/goldenPath.test.ts`, which drives the brief's ten-step walkthrough through the store and asserts the source agreement stays byte-identical, a rejected redline leaves no diff marks, and repeated identical decisions produce byte-identical exports containing no wall-clock time.

### Checks that did NOT run — recorded as unavailable, not as passes

- **Interactive Chrome golden path and narrow-screen visual check.** The Claude-in-Chrome extension reported `Browser extension is not connected`, so no browser was driven this run. The earlier Chrome pass recorded further down predates the current UI and was not repeated.
- **Component/DOM tests.** No `jsdom`, `happy-dom`, or `@testing-library` is present in `node_modules`, and installing one is prohibited by this run's sandbox. Component rendering is therefore covered only by the production build and by server-rendered output.
- **Server-rendered smoke test (this one did run).** `curl http://127.0.0.1:3100/` returns **HTTP 200**, 60,092 bytes, containing the app shell, the persistent "Not legal advice" banner, the guided demo strip, the Try-the-demo control, the seeded Northstar agreement, and the labeled local handler test panel, with no error markers. The dev server log shows zero errors.

## Incident during verification — resolved

Running `npm run verify` while `next dev` was live broke the running dev server: the production build overwrites `.next`, which the dev server was serving from, producing `Could not find the module ... segment-explorer-node.js` and `__webpack_modules__[moduleId] is not a function`, and `GET / 500`. Fixed on the first attempt by stopping the server, deleting `.next` (untracked build output — confirmed against `.gitignore` and `git ls-files`), and restarting. The preview then returned HTTP 200 with zero errors in the log. A warning about this ordering was added to the README.

## Pre-existing LAN-facing server — needs the user's decision

`lsof` shows a second, **stale `next-server` (PID 5419, started Thu Aug 27 15:12:56 2026)** still listening on `*:3000` — that is all interfaces, i.e. LAN-facing. It was started by the earlier session, not by this run. This run did not open it and will not kill a process the user started. Because it made port 3000 ambiguous, this run's preview was moved to loopback-only port 3100. **Recommended: the user stops PID 5419** (`kill 5419`) since it is both LAN-exposed and serving stale code.

## Backlog pass — completed after the MVP handoff

The user asked for more commits and chose real backlog work over padding the count. Each item below
is a self-contained commit that typechecks, lints, and passes tests.

| Commit | Work |
| --- | --- |
| `587c926` | MIT license — the repo was public with no license, leaving reuse terms undefined. |
| `2923e74` | Versioned session serialization. `localStorage` is user-writable and outlives deploys, so a payload that is absent, unparseable, version-mismatched, or structurally wrong is rejected rather than spread into live state. The undo stack is deliberately not persisted. |
| `9829496` | Store persistence, best-effort by contract: quota exhaustion or blocked site data degrades to an unsaved session instead of breaking mid-decision. |
| `d02f71d` | Restore-on-reload, hydrating post-mount so the first client paint still matches the server markup, with an explicit "Keep working / Start fresh" banner. |
| `465f30e` | Redline migration across revisions. Conservative by design: only an exact text match moves automatically, one target per edit, and migrating resets the decision to pending. |
| `40299e7` | Migration UI — proposals shown with their evidence; the human confirms. |
| `2c0ae50` | Package-level bulk approve/reject that only moves still-pending proposals, so it can never overwrite a decision already made. |
| `b5ed46a` | Bulk-action controls in the package header. |
| `5654f66` | Focus trap in the export dialog — tabbing past the last control previously walked into the page behind the overlay. |
| `66c902f` | Keyboard shortcuts (A/R/U), inert while typing so a letter in a textarea cannot approve a redline. |
| `40db9ca` | Whole-document comparison against the original, counting approved changes only. |
| `11487b7` | Changes tab surfacing that comparison. |

Test count went 162 → **204**. New suites: `persistence.test.ts` (10), `migration.test.ts` (10),
`revisionDiff.test.ts` (8), plus additions to `state.test.ts` and `store.test.ts`.

One defect was caught and fixed mid-pass: the mutator typing in `persistence.test.ts` passed under
vitest, which does not typecheck, but failed `tsc`. Fixed in `9829496`. Running `tsc` alongside
vitest between commits, not just at the end, would have caught it sooner.

## Known non-blocking issues

- `npm audit` reports 2 advisories (1 high, 1 moderate) in `postcss`, reached transitively through `next@15.5.24`'s build toolchain. The only offered fix is `next@16`, a breaking upgrade outside the approved stack. It is a build-time dependency that never processes untrusted CSS in this local-only prototype, so the approved stack was left intact and this is recorded as a documented limitation rather than silently upgraded.

## Bugs found and fixed during the earlier browser verification (previous run)

Both were in `src/components/AgreementPane.tsx` and were only observable in a real browser:

1. A `key` on the `<article>` element changed with every focus pulse, which forced React to unmount
   and remount every clause on each tool call. It did not restart the animation as intended and it
   cancelled the scroll that had just started. Replaced with a class remove/reflow/re-add on the
   focused node only.
2. `scrollIntoView({ behavior: "smooth" })` was accepted and then silently ignored in the automated
   Chrome context (`behavior: "auto"` scrolled correctly; `smooth` left `scrollTop` at 0). Replaced
   with a rect-based target and `container.scrollTo`, plus a 450 ms check that snaps to the target if
   the smooth scroll never happened. Reduced-motion preference is honoured.

## Blockers and failed attempts

- **Blocker (non-fatal, one item):** the interactive Chrome verification could not run.
  - Exact failing call: `mcp__claude-in-chrome__tabs_context_mcp`.
  - Concise error: `Browser extension is not connected.`
  - Attempts made: one. Not retried, because the fix is outside this sandbox — the user must connect the Claude-in-Chrome extension — and retrying the same call would not change the result.
  - Next diagnostic: with the extension connected, load http://127.0.0.1:3100, run the six-step guided demo, and inspect the console; then narrow the window to check the pane tabs.
  - Why this did not stop the run: every other milestone was independently completable, and the golden path's behaviour is covered by `src/app/goldenPath.test.ts` through the same store the UI uses. What remains unverified is **visual** and **console** behaviour only.
- Secondary, resolved on the first attempt: the `npm run verify` / `next dev` `.next` collision described above.
- No repair loop hit the three-attempt limit in this run.

## Next exact action

1. **Stop and wait for the user's visual and product review** of http://127.0.0.1:3100.
2. Decide with the user what to do about the stale LAN-facing `next-server` on PID 5419.
3. If the user wants the interactive Chrome pass, reconnect the browser extension and re-run the golden path against the current UI.
4. The local MVP is published to `origin/main`. Hosting, the demo video, and Devpost remain unstarted and unauthorized.

## Remaining local MVP requirements

- [x] Polished three-part workspace with a persistent non-legal-advice disclaimer.
- [x] Usable narrow-screen behavior (pane tabs below `lg`).
- [x] Obvious Try the Demo / Reset Demo control restoring the exact seeded state.
- [x] In-product guided demo checklist derived from real state.
- [x] Bundled Northstar agreement with 8–12 clauses and a fictional fallback library.
- [x] Role, priority, selection, non-negotiable, focus, revision, and decision controls.
- [x] Deterministic seeded and pasted-text segmentation with stable IDs and a correction path.
- [x] Exact context retrieval with stale/unknown ID rejection.
- [x] Staged redlines with exact inline diffs and original/staged/edited/approved/rejected separation.
- [x] Independent approve, reject, edit, note, and undo, plus a decision log — in both the document and the review rail.
- [x] Deterministic negotiation-brief and redlined-Markdown previews **and real local downloads with safe filenames**.
- [x] Exactly two WebMCP tools, registered when the API exists, with a clearly labeled local handler test calling the same handlers.
- [x] Required tests, typecheck, lint, and production build passing.
- [x] README and PROGRESS.md describing the observed state.
- [ ] Interactive browser golden-path and narrow-screen visual confirmation — **blocked**, browser extension not connected.
- [ ] User's visual/product review — awaiting the user.

## External work

**Performed, on the user's explicit chat instruction ("publish to github"):**

- `git push origin main` — fast-forward of two commits onto the existing public repository. Verified beforehand: no divergence from `origin/main`, no secrets or credentials in tracked files, and no build output, dependency, cache, log, or `.env` file tracked.
- Read-only `gh auth status` and `gh repo view` to confirm the account and that the repository is public.
- No force push, no history rewriting, no PR, issue, release, or repository-setting change.

**Still NOT performed, and not authorized without new explicit instruction:**

- Vercel or any other hosting, tunnel, or public URL.
- Demo video production and Devpost submission.
- Any external API, LLM backend, package install, or web browsing.

## Session resume instructions

1. Read `ClauseBridge_Claude_Code_Brief.md` and `CLAUDE_GITHUB_AND_PROGRESS_PROTOCOL.md` completely.
2. Read this file completely.
3. Inspect `git status --short`, recent commits, current branch, `git remote -v`, and local-versus-upstream status.
4. Inspect all staged and unstaged diffs before changing anything.
5. Continue from **Next exact action**; do not restart or discard verified work.
6. Before stopping, update this file with only facts actually observed, including test results and the last pushed SHA.
