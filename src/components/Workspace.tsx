"use client";

import { useEffect, useMemo, useState } from "react";

import { ClauseBridgeStore } from "@/app/store";
import { StoreContext } from "@/app/useClauseBridge";
import { AgreementPane } from "@/components/AgreementPane";
import { Header } from "@/components/Header";
import { LeftRail } from "@/components/LeftRail";
import { PreviewDialog } from "@/components/PreviewDialog";
import { RightRail } from "@/components/RightRail";
import { registerClauseBridgeTools } from "@/webmcp/register";

/** The three-part workspace, plus WebMCP registration on mount. */
export function Workspace() {
  const store = useMemo(() => new ClauseBridgeStore(), []);
  const [previewOpen, setPreviewOpen] = useState(false);

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
        <Header onOpenPreview={() => setPreviewOpen(true)} />

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[19rem_minmax(0,1fr)_23rem]">
          <div className="hidden min-h-0 lg:flex lg:flex-col">
            <LeftRail />
          </div>

          <div className="flex min-h-0 flex-col">
            <AgreementPane />
          </div>

          <div className="hidden min-h-0 lg:flex lg:flex-col">
            <RightRail />
          </div>
        </main>

        <p className="border-t border-ink-200 bg-white px-4 py-2 text-center text-[10px] text-ink-400 lg:hidden">
          ClauseBridge&apos;s three-part workspace needs a wider screen. Open this page on a desktop
          browser to use the outline, controls, and tool console.
        </p>

        {previewOpen && <PreviewDialog onClose={() => setPreviewOpen(false)} />}
      </div>
    </StoreContext.Provider>
  );
}
