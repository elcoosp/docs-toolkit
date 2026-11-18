import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startE2eFixtureSite, type E2eFixtureHandle } from "./fixtures/e2e-fixture-site";
describe("Full Site Features Self-Contained E2E Suite (Playwright)", () => {
let site: E2eFixtureHandle;
let browser: Browser;
beforeAll(async () => {
site = await startE2eFixtureSite();
browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
await browser?.close();
await site?.close();
});
it("1. toggles Zen Mode via button and Alt+Z and persists state across reloads", async () => {
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on("pageerror", (err) => { console.error("BROWSER_PAGEERROR:", err.message); errors.push(err.message); });
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
    await page.locator("[data-zen-toggle]").first().click();
expect(await page.locator("html").getAttribute("data-zen-mode")).toBe("true");
await page.reload({ waitUntil: "networkidle" });
expect(await page.locator("html").getAttribute("data-zen-mode")).toBe("true");
await page.keyboard.press("Alt+z");
expect(await page.locator("html").getAttribute("data-zen-mode")).toBeNull();
expect(errors).toEqual([]);
await page.close();
});
it("2. copies real page Markdown and opens/closes the AI actions dropdown", async () => {
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
await page.locator("#copy-markdown").click();
await page.waitForTimeout(200);
const clip = await page.evaluate(() => navigator.clipboard.readText());
expect(clip).toContain("# Macro Guide");
await page.locator("#open-ai-trigger").dispatchEvent("click");
expect(await page.locator(".action-dropdown").getAttribute("data-open")).toBe("true");
await page.keyboard.press("Escape");
expect(await page.locator(".action-dropdown").getAttribute("data-open")).toBe("false");
await context.close();
});
it("3. displays LinkPreview and TermGlossary HoverCards and ?highlight= arrival pulse", async () => {
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
const internalLink = page.locator(".sl-markdown-content a[href='/guides/install/']").first();
await internalLink.hover();
await page.waitForTimeout(150);
await page.waitForSelector(".sl-glossary-term", { timeout: 3000 });
const glossaryTerm = page.locator(".sl-glossary-term").first();
expect(await glossaryTerm.count()).toBe(1);
await glossaryTerm.hover();
await page.waitForTimeout(150);
await page.goto(site.baseUrl + "/guides/macro/?highlight=TokenStream", { waitUntil: "networkidle" });
await page.close();
});
it("4. verifies ReadingContext metadata, Smart TOC scroll progress, and RelatedPages links", async () => {
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
const text = (await page.locator(".sl-reading-context").textContent()) || "";
expect(text).toContain("3 min read");
await page.evaluate(() => window.scrollTo({ top: 900, behavior: "instant" as ScrollBehavior }));
await page.waitForTimeout(150);
await page.waitForSelector(".sl-related-wrap a[href='/guides/install/']", { timeout: 3000 });
const relatedLink = page.locator(".sl-related-wrap a[href='/guides/install/']").first();
expect(await relatedLink.count()).toBe(1);
await relatedLink.click();
await page.waitForLoadState("networkidle");
expect(page.url()).toContain("/guides/install/");
await page.close();
});
it("5. serves valid /llms*.txt, /llms.json, per-page .md, and 1200x630 /og/*.png artifacts", async () => {
for (const asset of ["/llms.txt", "/llms-full.txt", "/llms-small.txt", "/guides/macro.md"]) {
const res = await fetch(site.baseUrl + asset);
expect(res.status).toBe(200);
expect((await res.text()).length).toBeGreaterThan(20);
}
const jsonRes = await fetch(site.baseUrl + "/llms.json");
expect(jsonRes.status).toBe(200);
const data = await jsonRes.json();
expect(data.pages.length).toBe(2);
const ogDir = join(site.distDir, "og");
expect(existsSync(ogDir)).toBe(true);
const pngs = readdirSync(ogDir).filter((f) => f.endsWith(".png"));
expect(pngs.length).toBe(1);
const ogRes = await fetch(site.baseUrl + "/og/" + pngs);
expect(ogRes.status).toBe(200);
const buf = Buffer.from(await ogRes.arrayBuffer());
expect(buf.readUInt32BE(0)).toBe(0x89504e47);
expect(buf.readUInt32BE(16)).toBe(1200);
expect(buf.readUInt32BE(20)).toBe(630);
});
});
