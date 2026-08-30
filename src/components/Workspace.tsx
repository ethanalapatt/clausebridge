"use client";

import { useEffect, useMemo, useState } from "react";

import { browserSessionStorage, loadPersistedSession } from "@/app/sessionStorage";
import { ClauseBridgeStore } from "@/app/store";
import { StoreContext } from "@/app/useClauseBridge";
import { AgreementPane } from "@/components/AgreementPane";
import { DemoGuide } from "@/components/DemoGuide";
import { Header } from "@/components/Header";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { LeftRail } from "@/components/LeftRail";
import { PreviewDialog } from "@/components/PreviewDialog";
import { RightRail } from "@/components/RightRail";
import { Button, cx } from "@/components/ui";
import { hasRestorableWork } from "@/core/persistence";
import { registerClauseBridgeTools } from "@/webmcp/register";

const PANES = [
  { id: "controls", label: "Controls" },
  { id: "agreement", label: "Agreement" },
  { id: "agent", label: "Agent" },
] as const;

type PaneId = (typeof PANES)[number]["id"];

/** The three-part workspace, plus WebMCP registration on mount. */
export function Workspace() {
  // Seeded session on both server and client; anything saved is adopted after
  // mount so the first paint matches the server markup.
  const store = useMemo(
    () => new ClauseBridgeStore(undefined, undefined, browserSessionStorage),
    [],
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  // Below `lg` the three panes do not fit side by side, so they become tabs
  // rather than disappearing. Every control stays reachable on a phone.
  const [pane, setPane] = useState<PaneId>("agreement");

  useEffect(() => {
    const saved = loadPersistedSession();
    if (saved !== null && hasRestorableWork(saved)) {
      store.hydrate(saved);
      setRestored(true);
    }
  }, [store]);

  useEffect(() => {
    const outcome = registerClauseBridgeTools(store.asWebMcpBridge());

    if (outcome.status === "registered") {
      store.setWebMcpStatus({ kind: "registered", toolNames: outcome.toolNames });
      return () => {
        outcome.unregister();
      };
    }

    store.setWebMcpStatus(
      outcome.status === "unavailable"
        ? { kind: "unavailable", reason: outcome.reason }
        : { kind: "error", reason: outcome.reason },
    );
    return undefined;
  }, [store]);

  return (
    <StoreContext.Provider value={store}>
      <div className="flex h-dvh flex-col overflow-hidden">
        <KeyboardShortcuts />
        <Header onOpenPreview={() => setPreviewOpen(true)} />

        {restored && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-edited-500 bg-edited-100 px-4 py-2 text-[11px] text-edited-700"
          >
            <span>
              <strong className="font-semibold">Picked up where you left off.</strong> Your staged
              redlines and decisions were restored from this browser.
            </span>
            <span className="ml-auto flex items-center gap-2">
              <Button size="sm" onClick={() => setRestored(false)}>
                Keep working
              </Button>
              <Button
                size="sm"
                variant="reject"
                onClick={() => {
                  store.resetDemo();
                  setRestored(false);
                }}
              >
                Start fresh
              </Button>
            </span>
          </div>
        )}

        <DemoGuide />

        <nav
          aria-label="Workspace pane"
          className="flex gap-1 border-b border-ink-200 bg-white px-3 py-2 lg:hidden"
        >
          {PANES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={pane === item.id ? "page" : undefined}
              onClick={() => setPane(item.id)}
              className={cx(
                "flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors",
                pane === item.id
                  ? "border-chrome-950 bg-chrome-950 text-white"
                  : "border-ink-200 bg-white text-ink-500 hover:border-ink-400 hover:text-ink-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[19rem_minmax(0,1fr)_23rem]">
          <div
            className={cx(
              "min-h-0 flex-col lg:flex",
              pane === "controls" ? "flex" : "hidden",
            )}
          >
            <LeftRail />
          </div>

          <div
            className={cx(
              "min-h-0 flex-col lg:flex",
              pane === "agreement" ? "flex" : "hidden",
            )}
          >
            <AgreementPane />
          </div>

          <div
            className={cx("min-h-0 flex-col lg:flex", pane === "agent" ? "flex" : "hidden")}
          >
            <RightRail />
          </div>
        </main>

        {previewOpen && <PreviewDialog onClose={() => setPreviewOpen(false)} />}
      </div>
    </StoreContext.Provider>
  );
}
