"use client";

import { useEffect } from "react";

import { useSession, useStore } from "@/app/useClauseBridge";

/**
 * Keyboard shortcuts for the review loop.
 *
 * Reviewing a package means the same three keystrokes over and over, so the
 * common decisions get single keys aimed at the *first still-undecided* redline
 * — the one a reviewer is actually looking at.
 *
 * Deliberately inert while the user is typing. Without the editable-target
 * guard, writing the letter "a" into a note or a replacement textarea would
 * approve a redline behind the dialog.
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
    <span className="hidden items-center gap-1 text-[10px] text-ink-400 xl:inline-flex">
      <Key>A</Key> approve · <Key>R</Key> reject · <Key>U</Key> undo
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
