# ClauseBridge Progress

## Status

- Current phase: **Complete Local MVP** (per `do this one.md`, the latest and highest-priority instruction)
- Current milestone: 8 — local review handoff. Milestones 1–7 complete.
- Overall state: every gap in the milestone-1 list below is closed and verified. `npm run verify` exits 0 with 162 tests. The loopback preview is running and awaiting the user's visual review.
- Last updated: at the local review handoff

## Authority for this run

`do this one.md` supersedes the older briefs for the current run. It upgrades the target from a rough
sketch to a complete, polished, locally running MVP, and it **revokes all external access**: no
GitHub, no push/pull/fetch, no Vercel, no APIs, no registries, no web browsing, no filesystem access
outside this folder. The older instruction files are preserved unchanged, as required. The "GitHub
state" section below is retained as a factual record of what happened in an earlier run; **no remote
was contacted in this run and none will be.**

## Milestone 1 audit — factual baseline observed this run

- Git: branch `main`, HEAD `db49ba3`, working tree clean apart from the untracked brief `do this one.md`. No remote contacted.
- Toolchain present locally: `next` 15.5.24, `react` 19, `typescript` 5.9, `vitest` 3.2, `eslint` 9 + `eslint-config-next`, `tailwindcss` 4. `node_modules` already installed. No install command was run and none will be.
- Baseline `npm run verify` — **exit 0**: typecheck passed, lint passed with no findings, 132 tests passed across 8 files, production build compiled successfully.
- Existing code inspected in full: 6,623 lines across `src/core`, `src/webmcp`, `src/app`, `src/components`. The deterministic core (types, segmentation, diff, handlers, state, exports) and the WebMCP registration are complete and well tested; they are preserved, not rebuilt.

### Gap list — what the local MVP still requires

| # | Brief ref | Gap found in the existing sketch |
| --- | --- | --- |
| 1 | §7 export engine, §15 | No real browser download. Export dialog could only copy Markdown. |
| 2 | §5, §9, §10 | No reset control. `load-seed` deliberately kept prior activity/seq, so it did not restore the exact initial state, and it never cleared the undo stack. |
| 3 | §5 demo guidance | No way to seed the golden-path configuration in one click. |
| 4 | §5 demo guidance | No in-product checklist or guided demo strip. |
| 5 | §5 app shell | Narrow screens were not usable: both rails were hidden and replaced with a "use a wider screen" message. |
| 6 | §5 right panel | Right panel had no decision log distinct from the raw activity timeline. |
| 7 | §5 right panel | Right panel had no approve / reject / edit / note / undo controls; they existed only in the centre pane. |
| 8 | §5 right panel | Right panel had no negotiation-brief or redlined-Markdown preview/export entry point. |

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

## GitHub state — historical record only, NOT touched in this run

> This section records what an earlier run did. `do this one.md` revokes external access, so this run
> contacted no remote: no push, pull, fetch, `gh` call, or `git ls-remote`. The commits this run
> created exist **only on this machine** and are ahead of whatever the remote holds.

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

## Later external work — NOT AUTHORIZED IN THIS RUN

None of the following was performed, and none may be without new explicit user instruction. No remote
was contacted at any point in this run.

- GitHub: no push, pull, fetch, PR, issue, release, or repository-setting change. The local commits below exist only on this machine.
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
