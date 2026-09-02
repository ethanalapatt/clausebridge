"use client";

import { useEffect } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";

/**
 * Keyboard shortcuts for the review loop.
 *
 * Reviewing a package means the same handful of keystrokes over and over, so the
 * common moves get single keys: decide the first still-undecided proposal, walk
 * the document, jump to whatever still needs a call.
 *
 * Deliberately inert while the user is typing. Without the editable-target
 * guard, writing the letter "a" into a note or a replacement textarea would
 * approve a proposal behind the dialog.
 */
export function KeyboardShortcuts() {
  const store = useStore();
  const session = useSession();

  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      // Never shadow a browser or OS shortcut.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditable(event.target)) return;

      const state = store.getSnapshot().present;
      const next = state.edits.find((edit) => edit.status === "pending");
      const clauses = state.revision.clauses;

      /** Moves the document focus by one clause, wrapping at each end. */
      function step(delta: number) {
        if (clauses.length === 0) return;
        const current = clauses.findIndex((clause) => clause.id === state.focusedClauseId);
        const from = current === -1 ? (delta > 0 ? -1 : 0) : current;
        const index = (from + delta + clauses.length) % clauses.length;
        const clause = clauses[index];
        if (clause !== undefined) {
          store.dispatch({ type: "focus-clause", clauseId: clause.id });
        }
      }

      switch (event.key.toLowerCase()) {
        case "a":
          if (next === undefined) return;
          event.preventDefault();
          store.dispatch({ type: "approve-edit", editId: next.editId });
          store.dispatch({ type: "focus-clause", clauseId: next.clauseId });
          return;
        case "r":
          if (next === undefined) return;
          event.preventDefault();
          store.dispatch({ type: "reject-edit", editId: next.editId });
          store.dispatch({ type: "focus-clause", clauseId: next.clauseId });
          return;
        case "u":
          event.preventDefault();
          store.undo();
          return;
        case "j":
          event.preventDefault();
          step(1);
          return;
        case "k":
          event.preventDefault();
          step(-1);
          return;
        case "g":
          // Jump to whatever still needs a decision, wherever it is.
          if (next === undefined) return;
          event.preventDefault();
          store.dispatch({ type: "focus-clause", clauseId: next.clauseId });
          return;
        default:
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, session]);

  return null;
}

/** Rendered in the demo strip so the shortcuts are discoverable, not hidden. */
export function ShortcutHint() {
  return (
    <span className="hidden items-center gap-1 text-[10px] text-ink-400 2xl:inline-flex">
      <Key>A</Key> accept · <Key>R</Key> reject · <Key>U</Key> undo · <Key>J</Key>
      <Key>K</Key> clause · <Key>G</Key> next undecided
    </span>
  );
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-ink-200 bg-white px-1 font-mono text-[9px] text-ink-700">
      {children}
    </kbd>
  );
}
