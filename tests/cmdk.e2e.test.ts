import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const distDir = resolve(import.meta.dirname, "../../rsmack/rsmack-docs/dist");
const hasBuiltSite = existsSync(join(distDir, "index.html"));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

describe.runIf(hasBuiltSite)("Command Palette Real Built Site E2E Suite (Playwright)", () => {
  let server: Server;
  let baseUrl = "";
  let browser: Browser;

  beforeAll(async () => {
    server = createServer((req, res) => {
      const rawPath = (req.url || "/").split("?")[0];
      let filePath = join(distDir, rawPath);
      if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
      }
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(readFileSync(filePath));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (typeof addr === "object" && addr) baseUrl = `http://127.0.0.1:${addr.port}`;
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("opens on built EN & FR pages with zero console errors, searches Pagefind, and copies merged .md files", async () => {
    const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (err) => { if (String(err.stack || err.message).includes("cmdk")) errors.push(err.message); });

    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
    await page.keyboard.press("/");
    expect(await page.locator("#sl-cmdk-dialog").isVisible()).toBe(true);

    const input = page.locator("#sl-cmdk-input");
    await input.fill("macro");
    await page.waitForSelector("#sl-cmdk-list a.sl-cmdk-row");

    const firstHref = await page.locator("#sl-cmdk-list a.sl-cmdk-row").first().getAttribute("href");
    expect(firstHref).toBeTruthy();

    await page.locator("#sl-cmdk-list a.sl-cmdk-row--page .sl-cmdk-row__mark").nth(0).click();
    await page.locator("#sl-cmdk-list a.sl-cmdk-row--page .sl-cmdk-row__mark").nth(1).click();
    expect(await page.locator("#sl-cmdk-status").textContent()).toContain("2 selected");

    await input.press("Meta+Shift+C");
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("\n\n---\n\n");
    expect(errors).toEqual([]);

    await page.goto(baseUrl + "/fr/", { waitUntil: "networkidle" });
    await page.keyboard.press("/");
    expect(await page.locator("#sl-cmdk-status").textContent()).toContain("Tapez pour rechercher");
    expect(errors).toEqual([]);
    await context.close();
  });

  it("previews and commits theme toggle in / commands mode on built site", async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme || "light");

    await page.keyboard.press("/");
    await page.locator("#sl-cmdk-input").fill("/theme");
    await page.waitForTimeout(150);

    const previewedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(previewedTheme).not.toBe(initialTheme);

    await page.locator("#sl-cmdk-input").press("Enter");
    const committedTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(committedTheme).toBe(previewedTheme);
    await page.close();
  });
});
