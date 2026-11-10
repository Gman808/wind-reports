// Counts sustained wind shifts in a 1 Hz sample (NEON_20Hz/serc-<day>-1hz.json): a shift is a change of more than THRESH degrees
// from the wind direction of the preceding 2 minutes that holds for at least 2 minutes (every 30 s block of those 2 minutes stays
// more than THRESH degrees away from the old direction, on the same side). Usage: node shifts.mjs <day> [threshold]
import { readFile } from "node:fs/promises";
const DAY = process.argv[2] ?? "2024-07-11", THRESH = Number(process.argv[3] ?? 5);
const { rows } = JSON.parse(await readFile(new URL(`./NEON_20Hz/serc-${DAY}-1hz.json`, import.meta.url), "utf8"));
const rad = Math.PI / 180, norm = (d) => ((d % 360) + 360) % 360, diff = (a, b) => ((a - b + 540) % 360) - 180;
const dmean = (ds) => norm(Math.atan2(ds.reduce((a, d) => a + Math.sin(d * rad), 0), ds.reduce((a, d) => a + Math.cos(d * rad), 0)) / rad);
const B = 30, HOLD = 4; // 30 s blocks; 4 blocks = 2 minutes
const blocks = []; for (let i = 0; i + B <= rows.length; i += B) blocks.push(dmean(rows.slice(i, i + B).map((r) => r.dir)));
const events = [];
let k = HOLD; // the first reference needs 2 minutes of history
while (k + HOLD <= blocks.length) {
  const ref = dmean(blocks.slice(k - HOLD, k));
  const d0 = diff(blocks[k], ref);
  if (Math.abs(d0) > THRESH && blocks.slice(k, k + HOLD).every((b) => Math.sign(diff(b, ref)) === Math.sign(d0) && Math.abs(diff(b, ref)) > THRESH)) {
    const to = dmean(blocks.slice(k, k + HOLD));
    events.push({ block: k, t: rows[k * B].t, from: ref, to, change: diff(to, ref) });
    k += HOLD; // continue from the end of the held stretch, with the new direction as history
  } else k++;
}
const minutes = (blocks.length * B) / 60, tenMin = Math.ceil(minutes / 10);
const perTen = Array(tenMin).fill(0); for (const e of events) perTen[Math.floor((e.block * B) / 600)]++;
const sorted = [...perTen].sort((a, b) => a - b);
const hm = (ms) => new Date(ms).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
console.log(`${DAY}  threshold >${THRESH}°, held >=2 min`);
console.log(`events ${events.length} in ${minutes.toFixed(0)} min -> ${(events.length / (minutes / 10)).toFixed(2)} per 10 min; per 10-min window: min ${sorted[0]}, median ${sorted[Math.floor(sorted.length / 2)]}, max ${sorted.at(-1)}; windows with none: ${perTen.filter((x) => !x).length}/${tenMin}`);
console.log("mean size", (events.reduce((a, e) => a + Math.abs(e.change), 0) / events.length).toFixed(0) + "°", "veers", events.filter((e) => e.change > 0).length, "backs", events.filter((e) => e.change < 0).length);
if (process.argv[4] === "list") console.log(events.map((e) => `${hm(e.t)} ${e.from.toFixed(0)}->${e.to.toFixed(0)} (${e.change.toFixed(0)})`).join("\n"));
console.log("per 10 min:", perTen.join(" "));
