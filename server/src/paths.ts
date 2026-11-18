import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const dataDirectory = process.env.LIGHTHOUSE_DATA_DIR || fileURLToPath(new URL('../', import.meta.url));
export const screenshotsDirectory = path.join(dataDirectory, 'screenshots');

mkdirSync(screenshotsDirectory, { recursive: true });
