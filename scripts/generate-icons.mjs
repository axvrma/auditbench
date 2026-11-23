import { chromePath } from "./chrome.mjs";
import puppeteer from "puppeteer-core";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
});
try {
  const page = await browser.newPage();
  const svg = await readFile("branding/mark.svg", "utf8");
  await page.setViewport({ width: 1024, height: 1024 });
  await page.setContent(
    `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: "desktop/icon.png", omitBackground: true });
  await page.setViewport({ width: 256, height: 256 });
  const png = await page.screenshot({ omitBackground: true });
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 0;
  header[7] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile("desktop/icon.ico", Buffer.concat([header, png]));
  if (process.platform === "darwin") {
    const folder = "/tmp/lighthouse-brand.iconset";
    await mkdir(folder, { recursive: true });
    for (const size of [16, 32, 128, 256, 512])
      for (const scale of [1, 2])
        execFileSync(
          "sips",
          [
            "-z",
            String(size * scale),
            String(size * scale),
            "desktop/icon.png",
            "--out",
            `${folder}/icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`,
          ],
          { stdio: "ignore" },
        );
    execFileSync("iconutil", ["-c", "icns", folder, "-o", "desktop/icon.icns"]);
    await rm(folder, { recursive: true, force: true });
  }
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#101b19;color:#f6f5ee;font:28px system-ui;padding:65px 80px}header{display:flex;align-items:center;gap:18px;font-weight:600}header svg{width:56px;height:56px}h1{font-size:78px;font-weight:500;line-height:1.05;letter-spacing:-3px;margin:65px 0 30px}em{font-style:normal;color:#dceccb}p{font:16px monospace;color:#b2c6aa}</style><header>${svg}Auditbench</header><h1>Website performance,<br><em>without the guesswork.</em></h1><p>LOCAL AUDITS. MEASURED PROGRESS. A CLEARER PICTURE.</p>`,
  );
  await page.screenshot({ path: "landing/assets/social.png" });
} finally {
  await browser.close();
}
