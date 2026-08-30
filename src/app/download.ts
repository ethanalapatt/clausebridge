"use client";

/**
 * Browser download of a deterministic export.
 *
 * Everything stays in the tab: the Markdown is rendered from local state into a
 * Blob and handed to the browser's own save path. No network request, no upload,
 * no third-party helper.
 */
export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoking synchronously can cancel the download in some browsers; give the
  // save a turn of the event loop first.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
