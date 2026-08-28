/** Gate 7 capture: 1400×920, deviceScaleFactor 1. */

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "web/package.json"));
const { chromium } = require("playwright");
const outDir = join(root, "output/07-actual");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1400, height: 920 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(15_000);

async function shot(slug) {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(outDir, `${slug}.png`),
    animations: "disabled",
  });
  console.log("wrote", slug);
}

await page.goto("http://127.0.0.1:5173/login");
await page.getByTestId("login-view").waitFor();
await page.evaluate(() => document.fonts.ready);
await page.getByTestId("auth-email").fill("xiaoming@traveler.com");
await page.getByTestId("auth-password").fill("password12ab");
await shot("login-screen");

await page.goto("http://127.0.0.1:5173/register");
await page.getByTestId("register-view").waitFor();
await page.evaluate(() => document.fonts.ready);
await shot("registration-screen");

await page.goto("http://127.0.0.1:5173/forgot");
await page.getByTestId("forgot-view").waitFor();
await page.evaluate(() => document.fonts.ready);
await shot("forgot-password-screen");

await page.goto("http://127.0.0.1:5173/login");
await page.getByTestId("skip-login").click();
await page.getByTestId("workbench").waitFor();
await shot("chat-screen");

await browser.close();
