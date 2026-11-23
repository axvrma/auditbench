import { Launcher } from "chrome-launcher";
export const chromePath =
  process.env.CHROME_PATH || Launcher.getInstallations()[0];
if (!chromePath)
  throw new Error(
    "Google Chrome is required. Set CHROME_PATH to an installed Chrome/Chromium executable.",
  );
