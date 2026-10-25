// Renders scripts/icon.svg to the PNG sizes the manifest and iOS need, using
// the installed Chrome. Run: node scripts/generate-icons.mjs
import { copyFileSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
const outputs = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/maskable-512.png", 512],
  ["src/app/apple-icon.png", 180],
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
for (const [path, size] of outputs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path, omitBackground: false });
  console.log(path);
}
await browser.close();
copyFileSync(new URL("./icon.svg", import.meta.url), "src/app/icon.svg");
console.log("src/app/icon.svg");
