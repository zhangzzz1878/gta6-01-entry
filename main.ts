// Solmar Bay — make.fun entry hand-in program (Node 22, standard library only).
// Copies this directory's game/ and screenshots/ beside it into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library. Deterministic: two runs over the same tree produce byte-identical
// output (the dossier is canonical JSON; the copies are plain file copies).
//
//   MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps from the bounty gate: text shapes the dossier bytes; the rest refuse
// an entry the scorer would refuse (over 4 screenshots or one over 256 KiB;
// over 993 files in game/ or 48 MiB of game files in all; a path under
// game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(out, 'dossier.json'), dossier);
