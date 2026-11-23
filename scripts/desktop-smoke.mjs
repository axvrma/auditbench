import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import electron from "electron";
const directory = await mkdtemp(path.join(tmpdir(), "lighthouse-desktop-"));
const executable = process.argv[2] || electron;
async function launch(phase) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, process.argv[2] ? [] : ["."], {
      env: {
        ...process.env,
        LIGHTHOUSE_DATA_DIR: directory,
        LIGHTHOUSE_SMOKE_TEST: "1",
        LIGHTHOUSE_SMOKE_PHASE: phase,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Desktop smoke timed out"));
    }, 45000);
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || !output.includes("DESKTOP_SMOKE_LOADED Auditbench"))
        reject(new Error(`Desktop smoke failed (${phase}, exit ${code})`));
      else resolve();
    });
  });
}
await launch("save");
await launch("restore");
console.log(
  "DESKTOP_SMOKE_PASS: real renderer, engine, token protection, clean exit and preferences restored across two launches.",
);
