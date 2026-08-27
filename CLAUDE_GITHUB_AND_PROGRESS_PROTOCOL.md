# Claude Code GitHub and Progress Protocol — ClauseBridge

## Authority and the one changed permission

Read this file together with `ClauseBridge_Claude_Code_Brief.md` and `PROGRESS.md` before doing any work.

- The project brief controls the product, rough-sketch scope, approval checkpoint, WebMCP contracts, tests, and stopping point.
- This protocol controls Git, GitHub pushes, progress tracking, failure recovery, and session handoffs.
- The user's new instruction overrides **only** the brief's earlier prohibition on creating/contacting an external repository: GitHub operations for the confirmed ClauseBridge repository are now allowed under this protocol.
- All other restrictions in the brief remain in force. In particular, GitHub permission does not authorize deployment, external APIs, cloud storage, authentication features, web research, legal sources, GitHub Actions/Pages, releases, or work outside this folder.
- Work only inside the current ClauseBridge folder and its descendants.

The goal is to commit and push coherent, verified milestones so another Claude session can recover without guessing.

## GitHub approval boundary

At the brief's initial approval checkpoint, confirm all of the following before any remote mutation:

1. The exact GitHub repository URL or the exact owner/repository name to create.
2. Whether it must be public or private. Never guess visibility.
3. Whether the user authorizes `gh repo create` if the repository does not already exist.
4. The target branch, defaulting to `main` only if the user agrees.

After that one confirmation, Claude may autonomously create or connect the confirmed repository and push verified milestone commits to it. Do not repeatedly ask for approval for ordinary pushes that follow this protocol.

Use only the user's existing authenticated Git or GitHub CLI configuration. Never ask the user to paste a token, never print credentials, and never put credentials in files or remotes. If authentication is unavailable, stop and ask the user to complete an interactive GitHub login; do not devise a workaround.

Before the first push, verify:

- the current folder is the ClauseBridge repository root;
- `origin` resolves to the exact repository the user approved;
- the selected branch is correct;
- the staged files contain no secrets, credentials, environment files, dependency folders, caches, logs, or build output.

## Non-negotiable Git safety rules

- Push only to the confirmed `origin` and approved branch.
- Never force-push or use `--force`/`--force-with-lease`.
- Never rewrite history through rebase, amend, filter operations, or destructive reset.
- Never use `git reset --hard`, `git clean`, forced checkout, forced branch deletion, or a restore/checkout command that discards user work.
- Never delete a branch, tag, remote, repository, release, issue, or pull request.
- Never replace an existing remote URL silently. If `origin` points elsewhere, stop and show the user both the observed and intended targets.
- Never open a pull request, publish a release/package, enable Actions or Pages, change repository settings, add collaborators, or deploy unless the user separately approves it.
- Never change global Git configuration.
- If a repository-local author identity is missing, ask for the name and email and configure them locally only. Do not invent an identity.
- Never commit or push known-broken code merely to create activity.
- Never use time-based commits. Commit and push at verified milestones.
- Never claim a test, build, preview, registration, commit, or push succeeded unless its command actually succeeded.

## Protected files and ignore rules

Create or safely extend `.gitignore` before installing or generating anything. At minimum protect:

```gitignore
node_modules/
dist/
build/
.next/
out/
coverage/
.cache/
.env
.env.*
!.env.example
*.log
.claude/
.tmp/
tmp/
.DS_Store
Thumbs.db
```

Do not ignore `PROGRESS.md`, the project brief, this protocol, source code, tests, or README. Inspect the staged file list before every commit and push.

## First-run workflow

Perform these steps only after the user approves the initial architecture/dependency/WebMCP/GitHub checkpoint.

1. Confirm the current working directory is the intended ClauseBridge folder.
2. Inspect existing files and determine whether Git is already initialized.
3. Initialize a repository with `main` only if needed and approved.
4. Verify or obtain a repository-local author identity without changing global configuration.
5. Create or safely extend `.gitignore`.
6. Update `PROGRESS.md` with the approved decisions and actual GitHub target.
7. Inspect every file to be staged; exclude secrets and generated content.
8. Create the baseline commit, normally `chore: initialize ClauseBridge workflow`.
9. Connect `origin` only to the exact approved repository. If repository creation was approved, use the GitHub CLI without adding unrelated settings.
10. For the first push, use the safe equivalent of `git push -u origin <approved-branch>`.
11. Verify the local HEAD SHA equals the remote branch SHA, then record the pushed SHA in `PROGRESS.md`.

If the folder already contains Git history or a remote, preserve it. Inspect first and ask if its identity conflicts with the approved target.

## Required `PROGRESS.md` behavior

`PROGRESS.md` is the authoritative recovery record. Keep it concise, factual, and current. Update it:

- after initial approval;
- before starting a substantial milestone;
- after completing and verifying a milestone;
- after every successful milestone push;
- whenever a blocker changes the plan;
- before intentionally ending a session;
- before the final review handoff.

Always maintain these GitHub facts in it:

- exact repository URL and visibility;
- remote name and target branch;
- whether upstream tracking exists;
- last successfully pushed commit SHA;
- whether local HEAD is equal to, ahead of, or behind the upstream branch.

Do not write fabricated timestamps, test results, commit SHAs, remote state, or preview URLs.

## Start-of-session recovery routine

At the beginning of every new or resumed session:

1. Read the project brief, this protocol, and `PROGRESS.md` completely.
2. Confirm the working directory and repository root.
3. Inspect `git status --short`, recent commits, staged and unstaged diffs, current branch, `git remote -v`, and upstream status.
4. Compare local HEAD with the remote branch without changing history.
5. Decide whether uncommitted work is valid continuation, ignored generated output, or a failed partial attempt requiring diagnosis.
6. Resume from `PROGRESS.md`'s **Next exact action**. Do not redo or discard completed work.
7. If history, remote state, and `PROGRESS.md` disagree, trust verified code and command evidence, then correct `PROGRESS.md`.

## ClauseBridge milestone sequence

Use coherent milestones; combine only inseparable tiny changes and never combine unrelated work into a giant commit.

1. **Workflow and GitHub baseline** — approval recorded, ignore rules, repository/remote verified, baseline committed and pushed.
2. **Approved application scaffold** — dependencies installed, app starts, first build passes.
3. **Application shell and fictional corpus** — three-part workspace, disclaimer, seeded agreement, fallback library, and controls render.
4. **Deterministic clause core** — segmentation, stable IDs, retrieval, validation, diff, decisions, undo, and exports are implemented and narrowly tested.
5. **WebMCP handlers** — exact two tools register when available; visibly labeled local controls call the same deterministic handlers.
6. **Integrated golden path** — the Customer Baseline redline flow, independent decisions, activity log, and previews work end to end.
7. **Verification** — required unit tests, malformed-input cases, type checking, lint, build, console check, and golden path pass.
8. **Rough-sketch handoff** — README, limitations, demo steps, progress record, preview instructions, final commit, and final push are complete.

Stop after the rough-sketch handoff and wait for visual/product feedback as required by the brief.

## Commit-and-push gate

Before every milestone commit:

1. Update `PROGRESS.md` with work completed, actual verification results, and the next action.
2. Review `git status --short` and the complete unstaged diff.
3. Run the narrow tests for the changed behavior and the broader relevant checks required by the brief.
4. Run a whitespace/error check on the diff.
5. Confirm there are no secrets, `.env` files, dependencies, generated builds, caches, or logs.
6. Stage only explicit intended files; do not blindly stage everything.
7. Review the staged file list and staged diff.
8. Commit only when the milestone is coherent and verification passes.
9. Push the approved branch to `origin` without force.
10. Verify the remote branch contains the exact new commit.
11. Record that SHA and the next action in `PROGRESS.md`; carry this update into the next verified milestone commit.

Suitable commit messages include:

- `chore: initialize ClauseBridge workflow`
- `chore: scaffold approved application stack`
- `feat(ui): build fictional agreement workspace`
- `feat(core): implement deterministic clause workflow`
- `feat(webmcp): register ClauseBridge browser tools`
- `test(core): cover redline state transitions`
- `docs: add rough sketch demo and limitations`

## Push-conflict and failure policy

Never rewrite remote history to solve a push rejection.

- If the remote contains commits not present locally, stop and inspect. Do not pull, merge, rebase, or force-push until the user approves how to reconcile unexpected history.
- If a network or authentication push fails, preserve the local commit, record the exact error and unpushed SHA in `PROGRESS.md`, and retry only after diagnosing the cause.
- For the same test, build, or push root cause, make at most three focused repair attempts. After each attempt, rerun the smallest command that proves the hypothesis.
- After three failed attempts, stop changing the affected area, preserve all files, update `PROGRESS.md` with the command/error/attempts/hypothesis/next diagnostic, and hand the blocker to the user.
- Do not make a normal milestone commit for known-broken code. A user-requested work-in-progress snapshot must be clearly labeled and must state which verification fails.

## Context or usage-limit recovery

Milestone commits, milestone pushes, and `PROGRESS.md` are the recovery mechanism. Do not depend on a timer, `/loop`, hidden background agent, or one enormous prompt.

If context is getting tight or the session must stop:

1. Finish the smallest safe unit if possible and run its narrow verification.
2. If it meets the commit-and-push gate, update progress, commit, push, and verify the remote SHA.
3. If it does not meet the gate, leave it uncommitted and document the exact working state and next action without pretending it is complete.
4. End with a handoff containing repository URL, branch, last pushed SHA, current local status, tests/build results, preview command/URL, blocker, and next action.

## Overnight/autonomous boundary

After the user approves the initial checkpoint, Claude may work autonomously through the rough-sketch milestones and push each verified milestone. The confirmed GitHub repository is the only newly authorized external destination.

- Do not use other agents, scheduled loops, APIs, deployments, hosted databases, analytics, or unrelated cloud services.
- Package installs are allowed only if they were listed and approved at the initial checkpoint.
- If any later decision changes a WebMCP contract, adds an external service, changes the GitHub target/visibility, or crosses the brief's rough-sketch boundary, stop and ask.
- If the local preview needs to remain running, report its command and URL; do not confuse a preview process with deployment.

## Definition of workflow completion

The workflow is complete only when:

- every rough-sketch definition-of-done item in the brief is satisfied;
- required tests, checks, build, and golden path actually pass;
- README and `PROGRESS.md` reflect the observed state;
- the final coherent commit is pushed to the approved branch;
- local HEAD and remote branch SHAs match;
- the working tree is clean except for intentionally documented state;
- Claude reports the exact local preview command and URL, repository URL, branch, final pushed SHA, verification results, known limitations, and 45–60 second demo walkthrough;
- Claude then stops for user review.
