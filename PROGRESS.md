# ClauseBridge Progress

## Status

- Current phase: Rough Sketch Checkpoint
- Current milestone: 2 — approved application scaffold
- Overall state: baseline pushed; dependencies installed; scaffold starts, typechecks, lints, and builds
- Last updated: after milestone 2 verification, before the milestone 2 commit

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
- Last pushed commit: `77b27d53ea12f86cb318a4800c81cb1c02c962ce` (`chore: initialize ClauseBridge workflow`)
- Local/remote sync: verified equal at milestone 1; local HEAD SHA matched `git ls-remote origin refs/heads/main`
- Authentication: existing `gh` CLI login as `ethanalapatt` (scopes `gist, read:org, repo`), verified via `gh auth status`. No credentials requested, printed, stored, or committed.

## Completed and verified

- [x] Initial architecture, dependency, WebMCP, and fallback plan approved by the user.
- [x] Exact GitHub repository target and visibility approved by the user: `ethanalapatt/clausebridge`, public, branch `main`.
- [x] Local repository initialized on `main` with a repo-local author identity; global config untouched.
- [x] `.gitignore` created with the protocol's required entries plus Next.js build output.
- [x] Baseline committed (`77b27d5`) and pushed to `origin/main`; remote SHA verified equal to local HEAD.
- [x] Dependencies installed with a single `npm install`; scaffold typechecks, lints, builds, and serves HTTP 200 on the dev server.

## Current working state

- Uncommitted files: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `eslint.config.mjs`, `src/app/{layout.tsx,page.tsx,globals.css}`.
- What those changes are intended to do: stand up the approved Next.js stack with design tokens, and prove the toolchain works before any product code is written.
- Are tests/build currently passing: typecheck, lint, and production build pass. No unit tests exist yet — the deterministic core lands in milestone 4.
- Preview command: `npm run dev`.
- Last known local preview URL: http://localhost:3000 (observed HTTP 200; server then stopped).

## Test and build status

- Unit tests: none written yet (`vitest` installed and configured, `src/**/*.test.ts`).
- Type checking: `npm run typecheck` — passed, exit 0.
- Lint: `npm run lint` — passed, no findings.
- Production build: `npm run build` — passed; 4 static pages generated, ~103 kB shared first-load JS.
- Golden-path verification: not run; the workspace does not exist yet.

## Known non-blocking issues

- `npm audit` reports 2 advisories (1 high, 1 moderate) in `postcss`, reached transitively through `next@15.5.24`'s build toolchain. The only offered fix is `next@16`, a breaking upgrade outside the approved stack. It is a build-time dependency that never processes untrusted CSS in this local-only prototype, so the approved stack was left intact and this is recorded as a documented limitation rather than silently upgraded.

## Blockers and failed attempts

- Blocker: none.
- Exact failing command: none.
- Concise error: none.
- Attempts already made: none.
- Current hypothesis: not applicable.

## Next exact action

1. Commit and push milestone 2 as `chore: scaffold approved application stack`.
2. Build milestone 3: the three-part workspace shell, the fictional Northstar agreement, the fallback library, and the role/priority/selection controls.
3. Then milestone 4: the deterministic clause core (segmentation, stable IDs, retrieval, validation, word-level diff, decisions, undo, exports) with its unit tests.

## Remaining rough-sketch requirements

- [ ] Polished three-part ClauseBridge workspace with a persistent non-legal-advice disclaimer.
- [ ] Bundled **Northstar SaaS Services Agreement — Fictional Demo** containing 8–12 clauses.
- [ ] Role, priority, selection, non-negotiable, focus, revision, and decision controls.
- [ ] Deterministic seeded and pasted-text clause segmentation with stable IDs and a manual correction path.
- [ ] Fictional local fallback library keyed by clause type and party role.
- [ ] Exact context retrieval with stale/unknown ID rejection and no generated legal language.
- [ ] Staged three-clause redline package with exact inline diff and original/staged/approved state separation.
- [ ] Independent approve, reject, edit, note, and undo actions plus a deterministic decision log.
- [ ] Deterministic negotiation-brief and redlined-Markdown previews/exports.
- [ ] Exact WebMCP tools: `get_negotiation_context` and `stage_redline_package`.
- [ ] Visibly labeled local handler-test fallback calling the same handlers as WebMCP.
- [ ] Visible WebMCP status and chronological tool/audit timeline.
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
