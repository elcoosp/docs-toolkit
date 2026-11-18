import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_PROVIDERS } from "../src/config/components/ai-providers";
import { initCommandSearch } from "../src/config/components/search-client";
import cssText from "../src/config/components/search.css?raw";

let copiedText = "";

function mountPalette() {
  localStorage.clear();
  copiedText = "";
  document.documentElement.dataset.theme = "light";
  document.body.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);

  const cfg = JSON.stringify({
    locale: "en",
    localePrefix: "",
    ui: {},
    aiProviders: AI_PROVIDERS,
  });
  const pages = JSON.stringify([
    {
      title: "Getting Started",
      url: "/tutorials/getting-started/",
      headings: [{ title: "Installation", slug: "installation" }, { title: "Quick Setup", slug: "quick-setup" }],
    },
    {
      title: "Write Your Own Macro",
      url: "/guides/write-your-own-macro/",
      headings: [{ title: "Macro Syntax", slug: "macro-syntax" }],
    },
    {
      title: "Megamac Reference",
      url: "/reference/megamac/",
      headings: [{ title: "Parameters", slug: "parameters" }],
    },
  ]);

  const root = document.createElement("div");
  root.setAttribute("data-cmdk-root", "");
  root.dataset.locale = "en";
  root.innerHTML = [
    "<button type=\"button\" data-cmdk-open>Search</button>",
    "<dialog id=\"sl-cmdk-dialog\">",
    "  <div class=\"sl-cmdk-panel\">",
    "    <div class=\"sl-cmdk-header\">",
    "      <input id=\"sl-cmdk-input\" type=\"search\" />",
    "      <button id=\"sl-cmdk-clear\" type=\"button\">Clear</button>",
    "    </div>",
    "    <div id=\"sl-cmdk-tabs\" role=\"tablist\"></div>",
    "    <div class=\"sl-cmdk-body\">",
    "      <div id=\"sl-cmdk-list\" role=\"listbox\"></div>",
    "      <aside id=\"sl-cmdk-preview\"></aside>",
    "    </div>",
    "    <div class=\"sl-cmdk-footer\"><span id=\"sl-cmdk-status\"></span></div>",
    "  </div>",
    "</dialog>",
    "<script type=\"application/json\" data-cmdk-config>" + cfg + "</script>",
    "<script type=\"application/json\" data-cmdk-pages>" + pages + "</script>",
  ].join("\n");
  document.body.appendChild(root);
  initCommandSearch();
}

function key(el: EventTarget, k: string, opts: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...opts }));
}

describe("Command Palette Real Browser DOM & E2E Suite", () => {
  beforeEach(() => {
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(async (txt: string) => {
      copiedText = txt;
    });
    vi.spyOn(window, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.endsWith(".md")) {
        return new Response("# Markdown for " + u, { status: 200 });
      }
      return new Response("<main><p>Preview paragraph content for testing.</p></main>", { status: 200 });
    });
    mountPalette();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens via / shortcut and renders empty state with quick actions and pages", () => {
    key(document, "/");
    const dialog = document.querySelector<HTMLDialogElement>("#sl-cmdk-dialog")!;
    expect(dialog.open).toBe(true);
    expect(document.querySelectorAll("#sl-cmdk-list [data-cmdk-idx]").length).toBeGreaterThanOrEqual(7);
  });

  it("cycles filter tabs cleanly with Tab and Shift+Tab without triggering multi-select", () => {
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    key(input, "Tab");
    const activeTab1 = document.querySelector("#sl-cmdk-tabs [aria-selected=\"true\"]")?.getAttribute("data-empty-view");
    expect(activeTab1).toBe("pinned");
    key(input, "Tab", { shiftKey: true });
    const activeTab2 = document.querySelector("#sl-cmdk-tabs [aria-selected=\"true\"]")?.getAttribute("data-empty-view");
    expect(activeTab2).toBe("all");
  });

  it("marks multiple pages with Cmd+M, copies merged Markdown with Cmd+Shift+C, and clears on Esc", async () => {
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    const rows = Array.from(document.querySelectorAll<HTMLElement>("#sl-cmdk-list a.sl-cmdk-row"));
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const firstIdx = Number(rows[0].dataset.cmdkIdx);
    for (let i = 0; i < firstIdx; i++) key(input, "ArrowDown");

    key(input, "m", { metaKey: true });
    key(input, "m", { metaKey: true });

    expect(document.querySelectorAll("#sl-cmdk-list .sl-cmdk-row[data-marked=\"true\"]").length).toBe(2);
    expect(document.querySelector("#sl-cmdk-status")?.textContent).toContain("2 selected");

    key(input, "c", { metaKey: true });
    await vi.waitFor(() => expect(copiedText.split("\n").length).toBe(2));

    key(input, "c", { metaKey: true, shiftKey: true });
    await vi.waitFor(() => expect(copiedText).toContain("\n\n---\n\n"));

    const dialog = document.querySelector<HTMLDialogElement>("#sl-cmdk-dialog")!;
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(dialog.open).toBe(true);
    expect(document.querySelectorAll("#sl-cmdk-list .sl-cmdk-row[data-marked=\"true\"]").length).toBe(0);
  });

  it("recalls recent search queries with Alt+P and Alt+N", async () => {
    localStorage.setItem("sl-cmdk-recent-v1", JSON.stringify(["megamac", "seanum"]));
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    input.value = "draft";
    key(input, "p", { altKey: true });
    expect(input.value).toBe("megamac");
    key(input, "p", { altKey: true });
    expect(input.value).toBe("seanum");
    key(input, "n", { altKey: true });
    expect(input.value).toBe("megamac");
    key(input, "n", { altKey: true });
    expect(input.value).toBe("draft");
  });

  it("expands Bento 12-AI drawer in / mode with zero horizontal scrollbar overflow", async () => {
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    input.value = "/";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await vi.waitFor(() => expect(document.querySelector(".sl-cmdk-row--expand-ai")).not.toBeNull());
    const expandBtn = document.querySelector<HTMLElement>(".sl-cmdk-row--expand-ai")!;
    expandBtn.click();

    await vi.waitFor(() => expect(document.querySelectorAll(".sl-cmdk-bento-tile").length).toBe(12));
    const list = document.querySelector<HTMLElement>("#sl-cmdk-list")!;
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  });

  it("previews color theme live on hover/selection and restores if cancelled", async () => {
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    input.value = "/";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await vi.waitFor(() => expect(document.querySelectorAll("#sl-cmdk-list [data-cmdk-idx]").length).toBeGreaterThan(2));
    expect(document.documentElement.dataset.theme).toBe("light");
    key(input, "ArrowDown");
    expect(document.documentElement.dataset.theme).toBe("dark");

    key(document, "k", { metaKey: true });
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("searches headings in # mode and pins pages with Cmd+D", async () => {
    key(document, "/");
    const input = document.querySelector<HTMLInputElement>("#sl-cmdk-input")!;
    input.value = "#macro";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await vi.waitFor(() => expect(document.querySelector("#sl-cmdk-list a.sl-cmdk-row")?.getAttribute("href")).toBe("/guides/write-your-own-macro/#macro-syntax"));
    key(input, "d", { metaKey: true });
    expect(JSON.parse(localStorage.getItem("sl-cmdk-pinned-pages-v1") || "[]").length).toBe(1);
  });
});
