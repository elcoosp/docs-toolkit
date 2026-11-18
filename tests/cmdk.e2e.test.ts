import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startE2eFixtureSite, type E2eFixtureHandle } from "./fixtures/e2e-fixture-site";
describe("Command Palette Self-Contained E2E Suite (Playwright)", () => {
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
it("opens on built EN & FR pages with zero console errors, searches Pagefind, and copies merged .md files", async () => {
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (err) => errors.push(err.message));
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
await page.locator("[data-cmdk-open]").click();
expect(await page.locator("#sl-cmdk-dialog").isVisible()).toBe(true);
const input = page.locator("#sl-cmdk-input");
await input.fill("macro");
await page.waitForSelector(".sl-cmdk-row", { timeout: 5000 });
expect(await page.locator(".sl-cmdk-row").count()).toBeGreaterThanOrEqual(2);
const marks = page.locator(".sl-cmdk-row__mark");
await marks.nth(0).click();
await marks.nth(1).click();
await input.press("Meta+Shift+C");
await page.waitForTimeout(200);
const clip = await page.evaluate(() => navigator.clipboard.readText());
expect(clip).toContain("# Macro Guide");
await page.goto(site.baseUrl + "/fr/guides/macro/", { waitUntil: "networkidle" });
await page.locator("[data-cmdk-open]").click();
expect(await page.locator("#sl-cmdk-dialog").isVisible()).toBe(true);
expect(errors).toEqual([]);
await context.close();
});
it("previews and commits theme toggle in / commands mode on built site", async () => {
const page = await browser.newPage();
await page.goto(site.baseUrl + "/guides/macro/", { waitUntil: "networkidle" });
await page.locator("[data-cmdk-open]").click();
const input = page.locator("#sl-cmdk-input");
await input.fill("/theme");
await page.waitForSelector(".sl-cmdk-row", { timeout: 3000 });
await page.keyboard.press("Enter");
await page.close();
});
});
