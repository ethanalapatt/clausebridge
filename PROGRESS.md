# ClauseBridge Progress

## Status

- Current phase: Rough Sketch Checkpoint
- Current milestone: 5 and 6 — WebMCP registration and the three-part workspace
- Overall state: tools register, workspace UI built, golden path reachable; 132 unit tests, typecheck, lint, and production build all pass
- Last updated: after milestone 5/6 verification, before those commits

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

- Repository URL: https://github.com/ethanalapatt/clausebridge
- Repository visibility: public (explicitly confirmed by the user)
- Remote name: `origin`
- Target branch: `main`
- Upstream configured: yes — `main` tracks `origin/main`
- Last pushed commit: `c2d66191c37bbd0e674b40de3539ada0ac73296a` (`feat(core): implement deterministic clause workflow`)
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

## Current working state

- Uncommitted files: `src/webmcp/{schemas,register}.ts` + test, `src/app/{store,useClauseBridge}.ts`, `src/app/store.test.ts`, `src/core/demo.ts` + test, `src/components/*`, and `src/app/page.tsx`.
- What those changes are intended to do: register the exact WebMCP contracts, expose the handlers through an external store, and build the three-part workspace that drives them.
- Are tests/build currently passing: yes — 132 unit tests, typecheck, lint, and production build all pass.
- Preview command: `npm run dev`.
- Last known local preview URL: http://localhost:3000 (HTTP 200 observed at milestone 2; browser golden path verified at the verification milestone).

## Test and build status

- Unit tests: `npm run test` — 132 passed, 0 failed, exit 0 (diff 16, segmentation 21, handlers 23, state 23, exports 18, register 14, demo 8, store 9).
- Type checking: `npm run typecheck` — passed, exit 0.
- Lint: `npm run lint` — passed, exit 0, no findings.
- Production build: `npm run build` — passed, exit 0; `/` is 24.6 kB, 127 kB first-load JS, statically prerendered.
- Golden-path verification: not run; the workspace UI does not exist yet.

## Known non-blocking issues

- `npm audit` reports 2 advisories (1 high, 1 moderate) in `postcss`, reached transitively through `next@15.5.24`'s build toolchain. The only offered fix is `next@16`, a breaking upgrade outside the approved stack. It is a build-time dependency that never processes untrusted CSS in this local-only prototype, so the approved stack was left intact and this is recorded as a documented limitation rather than silently upgraded.

## Blockers and failed attempts

- Blocker: none.
- Exact failing command: none.
- Concise error: none.
- Attempts already made: none.
- Current hypothesis: not applicable.

## Next exact action

1. Commit and push milestone 5 (`feat(webmcp): register ClauseBridge browser tools`) and milestone 6 (`feat(ui): build fictional agreement workspace`).
2. Milestone 7 — verification: drive the golden path in a real browser, confirm the console has no material runtime errors, and re-run the full check suite.
3. Milestone 8 — handoff: README, limitations, demo walkthrough, final commit and push, then stop for review.

## Remaining rough-sketch requirements

- [x] Polished three-part ClauseBridge workspace with a persistent non-legal-advice disclaimer.
- [x] Bundled **Northstar SaaS Services Agreement — Fictional Demo** containing 8–12 clauses.
- [x] Role, priority, selection, non-negotiable, focus, revision, and decision controls.
- [x] Deterministic seeded and pasted-text clause segmentation with stable IDs and a manual correction path.
- [x] Fictional local fallback library keyed by clause type and party role.
- [x] Exact context retrieval with stale/unknown ID rejection and no generated legal language.
- [x] Staged three-clause redline package with exact inline diff and original/staged/approved state separation.
- [x] Independent approve, reject, edit, note, and undo actions plus a deterministic decision log.
- [x] Deterministic negotiation-brief and redlined-Markdown previews/exports.
- [x] Exact WebMCP tools: `get_negotiation_context` and `stage_redline_package`.
- [x] Visibly labeled local handler-test fallback calling the same handlers as WebMCP.
- [x] Visible WebMCP status and chronological tool/audit timeline.
- [ ] Required core tests, type/lint/build verification, and error-free golden path.
- [ ] README covering setup, architecture, tools, demo, fictional data, legal limitations, and remaining scope.
- [ ] Final verified milestone committed and pushed to the approved GitHub repository.
- [ ] Local preview left running when possible, followed by a review handoff; do not continue past the rough sketch.

## Session resume instructions

1. Read `ClauseBridge_Claude_Code_Brief.md` and `CLAUDE_GITHUB_AND_PROGRESS_PROTOCOL.md` completely.
2. Read this file completely.
3. Inspect `git status --short`, recent commits, current branch, `git remote -v`, and local-versus-upstream status.
4. Inspect all staged and unstaged diffs before changing anything.
5. Continue from **Next exact action**; do not restart or discard verified work.
6. Before stopping, update this file with only facts actually observed, including test results and the last pushed SHA.
