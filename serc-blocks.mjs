// Makes serc-blocks.json (committed, ~3 KB): the 30-second mean wind directions of the NEON 1 Hz sample of 11 July 2024,
// for the SERC choice on the Wind Shift Table. Reads NEON_20Hz/serc-2024-07-11-1hz.json (not committed).
import { readFile, writeFile } from "node:fs/promises";
const DAY = "2024-07-11";
const { rows, offset, residualStd } = JSON.parse(await readFile(new URL(`./NEON_20Hz/serc-${DAY}-1hz.json`, import.meta.url), "utf8"));
const blocks = [];
for (let i = 0; i + 30 <= rows.length; i += 30) {
  let s = 0, c = 0;
  for (let j = i; j < i + 30; j++) { s += Math.sin(rows[j].dir * Math.PI / 180); c += Math.cos(rows[j].dir * Math.PI / 180); }
  blocks.push(+(((Math.atan2(s, c) * 180 / Math.PI) + 360) % 360).toFixed(1));
}
await writeFile(new URL("./serc-blocks.json", import.meta.url), JSON.stringify({ day: DAY, t0: rows[0].t, blockMin: 0.5, blocks, offset: +offset.toFixed(1), residualStd: +residualStd.toFixed(1) }));
console.log("wrote serc-blocks.json,", blocks.length, "blocks from", new Date(rows[0].t).toISOString());
