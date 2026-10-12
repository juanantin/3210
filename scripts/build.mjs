#!/usr/bin/env node
/* ==========================================================================
   "Build" — copies the static site into dist/
   --------------------------------------------------------------------------
   The site needs no build: every file is served as written. This exists
   because the Vercel project was created while this repo was a Vite app, and
   a project keeps running `npm run build` and serving `dist/` — with no
   package.json that build failed and the last Vite deployment stayed live.
   Copying the served files into dist/ makes the deploy right under either
   setting (Vite preset, or Other with vercel.json's commands), and keeps
   scripts/, worker/ and the image originals off the public site.

   Run:  npm run build      (then serve dist/ to check it)
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

// Everything the page loads, and nothing else.
const SERVED = ['index.html', 'config.js', 'favicon.ico', 'site.webmanifest', 'assets', 'images', 'data'];
// Kept in the repo, never published.
const SKIP = new Set([path.join(ROOT, 'images', 'src')]);

fs.rmSync(OUT, { recursive: true, force: true });

let files = 0;
for (const entry of SERVED) {
  const from = path.join(ROOT, entry);
  if (!fs.existsSync(from)) {
    console.error(`missing: ${entry}`);
    process.exit(1);
  }
  fs.cpSync(from, path.join(OUT, entry), {
    recursive: true,
    filter: (src) => {
      if (SKIP.has(src)) return false;
      if (fs.statSync(src).isFile()) files++;
      return true;
    },
  });
}

console.log(`dist/ ready — ${files} files`);
