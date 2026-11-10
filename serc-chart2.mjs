// Makes serc-chart2.json (committed, ~30 KB): the NEON 1 Hz sample of 11 July 2024 summarised per minute for Wind Chart 2:
// the strongest second (gust), the mean (average wind) and the weakest second (lull) with the wind direction at each.
// Reads NEON_20Hz/serc-2024-07-11-1hz.json (not committed).
import { readFile, writeFile } from "node:fs/promises";
const { rows } = JSON.parse(await readFile(new URL("./NEON_20Hz/serc-2024-07-11-1hz.json", import.meta.url), "utf8"));
const rad = Math.PI / 180, r1 = (x) => +x.toFixed(1), r2 = (x) => +x.toFixed(2), out = [];
for (let i = 0; i + 60 <= rows.length; i += 60) {
  const g = rows.slice(i, i + 60);
  const hi = g.reduce((a, r) => (r.wind > a.wind ? r : a)), lo = g.reduce((a, r) => (r.wind < a.wind ? r : a));
  const sin = g.reduce((a, r) => a + Math.sin(r.dir * rad), 0), cos = g.reduce((a, r) => a + Math.cos(r.dir * rad), 0);
  out.push({ t: g[0].t, wind: r2(g.reduce((a, r) => a + r.wind, 0) / g.length), gust: r2(hi.wind), lull: r2(lo.wind), dir: r1(((Math.atan2(sin, cos) / rad) + 360) % 360), gustDir: r1(hi.dir), lullDir: r1(lo.dir) });
}
await writeFile(new URL("./serc-chart2.json", import.meta.url), JSON.stringify(out));
console.log("wrote serc-chart2.json,", out.length, "minutes");
