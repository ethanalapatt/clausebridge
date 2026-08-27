# Claude Code Build Brief: ClauseBridge

## Copy-paste kickoff message

```text
Read ClauseBridge_Claude_Code_Brief.md in full and treat it as the authoritative product and engineering brief. Work only inside the current ClauseBridge folder.

Before writing code, show me one concise approval checkpoint containing:
1. the proposed local stack and every package/install command you want to run;
2. the exact WebMCP registration and local fallback strategy;
3. confirmation that the rough sketch uses no external API, authentication, cloud service, deployment, or filesystem access outside this folder.

Wait for my approval. After I approve, build the entire Rough Sketch Checkpoint autonomously, test it, start a local preview I can open, and then stop for my review. Do not proceed into the later MVP, deploy, add integrations, or expand the legal-analysis scope until I explicitly approve.
```

## Operating rules

This file is self-contained. Do not browse the web to reinterpret the product or retrieve legal language.

- Read and write only inside the current folder and its descendants. Do not inspect parent folders, home directories, unrelated repositories, global configuration, or credentials.
- Ask before anything that communicates with or changes something outside this folder. This includes package downloads, APIs, OAuth, databases, cloud services, browser extensions, deployments, analytics, external repositories, and external file paths.
- Package installation writes to caches and uses the network, so list the exact install command in the initial approval checkpoint. Run it only after approval.
- Any material WebMCP choice requires approval: changing tool names or schemas, adding tools, exposing more document state, choosing a compatibility shim, or changing staging/approval behavior.
- The two tool contracts in this brief are the intended baseline. If the native browser API behaves differently, do not silently improvise. Explain the mismatch and ask.
- This is a collaboration and document-operations prototype, not legal advice. Do not claim legal correctness or recommend a negotiating position as objectively correct.
- Use only fictional bundled agreements and a clearly labeled fictional fallback-language library. Do not retrieve legal language from the web.
- Every redline must be staged, independently reviewable, reversible, and accompanied by its source clause and rationale.
- Keep a visible agent/tool activity timeline. Tool calls should visibly focus clauses or stage redlines in the shared UI.
- Do not continue past the Rough Sketch Checkpoint until the user reviews it.

## Challenge context

This project is for the WebMCP Challenge. WebMCP is an emerging open standard through which a website exposes structured browser tools using `document.modelContext.registerTool`. An external agent can use those tools directly in the active browser page.

The product should demonstrate synchronous human-agent collaboration that would be unreliable through generic scraping or brittle click automation. The agent should receive stable clause IDs, exact current text, human priorities, and approved fallback text—not infer document structure from pixels.

Judging emphasizes:

1. **WebMCP leverage:** The experience genuinely benefits from typed native browser tools.
2. **Execution:** It feels like a complete product flow, not a disconnected proof of concept.
3. **Potential impact:** It solves a credible and valuable problem.
4. **Creativity and ambition:** The human-agent interaction feels newly enabled by WebMCP.

Submission constraints supplied with the challenge:

- The final submission needs a working hosted project, a clear project description, a public repository with an open-source license, and a demo video under three minutes with audio.
- Judges may visit the live URL and may judge from the project description and repository, so the guest demo and instructions must be obvious.
- Existing projects are eligible only if meaningfully extended with WebMCP after August 25.
- The deadline is September 3 at 1:00 PM Pacific Time. The submitted site, repository, and Devpost entry must not be edited during judging.
- Those are later submission requirements. Do not create a repository, license, deployment, video, or Devpost material during this checkpoint unless separately approved.

## Shared product pattern

The intended experience follows six principles:

1. A structured context tool retrieves authoritative clause and fallback state.
2. A structured mutation tool stages visible, reversible redlines.
3. The page animates agent focus and proposed edits.
4. The human controls priorities and independently approves, rejects, or edits each redline.
5. Fictional guest documents enable a repeatable golden-path demonstration.
6. The core interaction should be understandable in 45–60 seconds inside a final three-minute video.

## Product definition

### Name and hook

**ClauseBridge** is a structured contract-redlining room where a human defines non-negotiables while their browser agent retrieves exact clause context and stages independently approvable edits in the live document.

### Why WebMCP is essential

A generic agent scraping rendered contract text cannot reliably identify stable clauses, the current revision, priority settings, existing decisions, or which fallback language is authorized. ClauseBridge exposes those exact structures through typed browser tools. Agent redlines appear in the same document the human is reviewing, but each change remains inspectable and independently controlled.

### Human-agent co-experience

1. The user opens a fictional SaaS agreement and chooses the customer role.
2. The user marks liability as non-negotiable and selects termination and data-retention clauses.
3. The agent calls `get_negotiation_context` to retrieve only the selected exact text, fictional approved fallbacks, priorities, and current decision state.
4. The agent calls `stage_redline_package`. Clause-specific redlines appear in the document gutter with rationales and priority tags.
5. The user accepts one change, edits another, rejects a third, and adds a note.
6. The user views a clean negotiation brief and redlined Markdown export.

### Adversarial scope audit

The dangerous version attempts OCR, PDF and DOCX layout preservation, broad legal analysis, automatic risk scoring, e-signature, version control, and counterparty collaboration. That cannot be reliable in the challenge window and creates legal-risk concerns.

The repaired scope is:

- Structured fictional sample agreements plus pasted plain text.
- Deterministic clause segmentation with stable IDs and manual correction.
- A small fictional fallback-language library authored solely for the demo.
- User-defined priorities and selected clauses.
- Exact inline differences, independent decisions, and a negotiation brief.
- Explicit non-legal-advice framing.
- No PDF/DOCX/OCR, legal research, external contract sources, or claims of legal correctness.

## Authoritative WebMCP tool contracts

Treat these names, intent, and schemas as the baseline. Before implementation, show the exact registration wrapper and fallback behavior in the approval checkpoint.

### Tool 1: `get_negotiation_context`

Purpose: retrieve exact text, approved fallback language, and current decision status for selected clause IDs without changing the agreement.

```js
document.modelContext.registerTool({
  name: "get_negotiation_context",
  description:
    "Retrieve exact text, approved fallback language, and current decision status for selected clause IDs without changing the agreement.",
  inputSchema: {
    type: "object",
    properties: {
      clauseIds: {
        type: "array",
        items: { type: "string" }
      },
      partyRole: {
        type: "string",
        enum: ["customer", "vendor", "neutral"]
      },
      priorityAreas: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["clauseIds", "partyRole", "priorityAreas"],
    additionalProperties: false
  },
  execute: async (input) => app.getNegotiationContext(input)
});
```

Expected deterministic behavior:

- Validate all clause IDs against the active document revision.
- Return exact clause text without paraphrasing.
- Return only fictional fallback entries already present in the local library and label their source.
- Include user priority, role, selected/non-negotiable state, and current decision status.
- Focus and animate the requested clauses in the editor.
- Never generate new legal language inside this deterministic handler.

### Tool 2: `stage_redline_package`

Purpose: render a group of clause-specific redlines with rationales for independent human approval; it does not finalize the contract.

```js
document.modelContext.registerTool({
  name: "stage_redline_package",
  description:
    "Render a group of clause-specific redlines with rationales for independent human approval; does not finalize the contract.",
  inputSchema: {
    type: "object",
    properties: {
      packageLabel: { type: "string" },
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            clauseId: { type: "string" },
            replacementText: { type: "string" },
            rationale: { type: "string" },
            priorityTag: {
              type: "string",
              enum: ["required", "preferred", "optional"]
            }
          },
          required: [
            "clauseId",
            "replacementText",
            "rationale",
            "priorityTag"
          ],
          additionalProperties: false
        }
      }
    },
    required: ["packageLabel", "edits"],
    additionalProperties: false
  },
  execute: async (input) => app.stageRedlinePackage(input)
});
```

Expected deterministic behavior:

- Validate clause IDs against the active document revision.
- Require non-empty replacement text and rationale.
- Reject duplicate edits to the same clause within one package.
- Render exact original-versus-replacement inline differences.
- Keep proposed, approved, edited, and rejected states separate.
- Never replace the underlying source merely because a package was staged.
- Preserve a decision log containing the package, clause, timestamps, and human action.

## Full challenge MVP context

The eventual challenge MVP is:

- Structured fictional sample agreements.
- Pasted-text import and deterministic clause segmentation.
- Stable clause IDs and a document outline.
- Role and priority settings.
- Non-negotiable and selected-clause controls.
- Fictional fallback-language library.
- Inline redline diff and clause gutter.
- Independent approval, rejection, editing, notes, and undo.
- Decision log.
- Negotiation-brief and redlined-Markdown export.
- Visible WebMCP status and tool-call history.
- Prominent non-legal-advice disclaimer.

Explicit cut list:

1. PDF/DOCX layout preservation, OCR, and e-signature.
2. Counterparty messaging, multiplayer editing, and enterprise version control.
3. Legal research, claims of legal correctness, and unrestricted legal-language generation.
4. Authentication, external document storage, APIs, and deployment.
5. An LLM backend. The browser's external agent is the agent.

Original sponsor-oriented direction: a Next.js-style frontend deployable later on Vercel, a structured rich-text editor such as Tiptap if approved, local state, and optional blob storage only for an explicit later share/export phase. No storage or Vercel integration belongs in the rough sketch.

Judging edge:

- **WebMCP leverage:** the agent receives authoritative clause structures instead of scraping visual document text.
- **Execution:** the user reaches an independently approved redline package and concrete export.
- **Potential impact:** startups and procurement teams can reduce repetitive contract-review coordination.
- **Creativity and ambition:** it demonstrates controlled delegation where every consequential textual mutation remains inspectable.

## Rough Sketch Checkpoint to build now

Build a working, local-first vertical slice, not a static mockup.

### Required UI

- A polished application shell with the ClauseBridge name, one-sentence value proposition, and persistent non-legal-advice disclaimer.
- A three-part workspace:
  - document outline, role, priorities, and selected/non-negotiable controls;
  - central readable agreement editor/viewer with stable clause anchors;
  - fallback context, staged redlines, decisions, and tool activity.
- At least one high-quality fictional **SaaS Services Agreement** with 8–12 distinct clauses.
- At least termination, data retention, liability, confidentiality, payment, warranty, security, and governing-law sections.
- A fictional fallback library with alternative text for several clauses and customer/vendor/neutral labels.
- Clause selection and focus, priority tags, non-negotiable markers, and current decision status.
- A staged redline gutter with exact inline diff, rationale, package name, and required/preferred/optional tag.
- Independent approve/reject/edit/note controls, undo, document revision display, and decision log.
- Negotiation brief and redlined Markdown previews.
- Visible WebMCP status and chronological tool-call/audit timeline.

### Required deterministic core

- Represent agreements as a document revision containing stable clause objects.
- Segment the seeded agreement deterministically and provide a conservative pasted-text segmenter based on headings and paragraph boundaries.
- Let the human correct clause titles or boundaries before tool use if pasted segmentation is uncertain.
- Maintain an exact local fallback library keyed by clause type and party role.
- Retrieve exact clause text, fallback options, user priorities, and decision status.
- Compute a word-level or token-level inline diff without changing original source.
- Validate redline packages and separate staged state from approved state.
- Maintain independent decisions, notes, edited replacements, undo, and an audit trail.
- Produce deterministic Markdown exports from approved state.
- Never fabricate a legal risk score or claim the local fallback is legally preferred.

### Required WebMCP behavior

- Register exactly the two baseline tools when the supported API exists.
- Provide an explicitly labeled local developer control that invokes the same handler functions when WebMCP is unavailable.
- The fallback must not masquerade as WebMCP. The status and activity log must distinguish `native WebMCP` from `local handler test`.
- Tool handlers must use the same deterministic document and redline functions as the UI.
- Tool results must be serializable, concise, and grounded in stable clause IDs and document revisions.

### Tests

At minimum, test:

- seeded and pasted-text clause segmentation;
- stable clause IDs within a document revision;
- unknown and stale clause ID rejection;
- exact context retrieval and fallback filtering by role;
- duplicate and malformed redline rejection;
- staged state remaining separate from approved source;
- inline diff correctness for representative changes;
- independent approve/reject/edit transitions and undo;
- deterministic Markdown export;
- the handlers' most important state transitions.

### Golden-path demo

Seed the app so this flow is immediately available:

1. Load **Northstar SaaS Services Agreement — Fictional Demo**.
2. Select the customer role.
3. Mark liability as non-negotiable and prioritize termination and data retention.
4. Retrieve context for liability, termination, and data retention.
5. Stage a three-clause **Customer Baseline** redline package using local fictional fallback text.
6. Watch the exact redlines appear in the document gutter.
7. Accept termination, edit data retention, and reject liability to demonstrate independent control.
8. View the decision log, negotiation brief, and redlined Markdown.

## Definition of done for this checkpoint

Do not declare the checkpoint complete unless:

- The app starts locally with one documented command after approved setup.
- The golden path works without network access or credentials.
- Clause retrieval, diffing, staging, and decisions are real deterministic operations; no fake animation substitutes for them.
- Both handlers work through UI test controls and are registered when native WebMCP is available.
- Core tests pass.
- Original, staged, and approved document states remain correctly separated.
- The console has no material runtime errors during the golden path.
- A short README explains setup, architecture, tool contracts, demo flow, legal/scope limitations, fictional data, and what remains.

When finished:

1. Keep the local preview running if the environment allows it.
2. Tell the user the exact local URL.
3. Summarize the files created, tests run, and results.
4. Give a 45–60 second demo walkthrough.
5. List known limitations without overstating legal functionality.
6. Stop and wait for visual/product feedback. Do not start the later MVP.
