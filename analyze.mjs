// Wind-shift and gust analysis of the 1 Hz sample (NEON_20Hz/serc-<day>-1hz.json). Writes NEON_20Hz/serc-${DAY}-analysis.json.
import { readFile, writeFile } from "node:fs/promises";
const DAY = process.argv[2] ?? "2024-07-27";
const { rows } = JSON.parse(await readFile(new URL(`./NEON_20Hz/serc-${DAY}-1hz.json`, import.meta.url), "utf8"));
const rad = Math.PI / 180, norm = (d) => ((d % 360) + 360) % 360, diff = (a, b) => ((a - b + 540) % 360) - 180; // signed a-b in (-180,180]
const mean = (xs) => xs.reduce((a, x) => a + x, 0) / xs.length;
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
// Vector mean of directions (wind-from), weighted by nothing.
const dmean = (ds) => norm(Math.atan2(mean(ds.map((d) => Math.sin(d * rad))), mean(ds.map((d) => Math.cos(d * rad)))) / rad);
const N = rows.length, KN = 1;

// ---- Direction: block means ----
const block = (sec) => { const out = []; for (let i = 0; i + sec <= N; i += sec) { const r = rows.slice(i, i + sec); out.push({ i, dir: dmean(r.map((x) => x.dir)), spd: mean(r.map((x) => x.wind)) }); } return out; };
const b5 = block(300);
const shifts = [];
for (let k = 1; k < b5.length; k++) {
  const d = diff(b5[k].dir, b5[k - 1].dir);
  if (Math.abs(d) >= 15) {
    // persistent if the following 5-minute block stays on the new side (closer to new than to old direction)
    const nxt = b5[k + 1];
    const persistent = nxt ? Math.abs(diff(nxt.dir, b5[k].dir)) < Math.abs(diff(nxt.dir, b5[k - 1].dir)) : null;
    shifts.push({ at: rows[b5[k].i].t, from: b5[k - 1].dir, to: b5[k].dir, change: d, persistent });
  }
}
const b5Changes = b5.slice(1).map((b, k) => Math.abs(diff(b.dir, b5[k].dir)));

// ---- Direction: oscillation about a 10-minute running mean, from 10 s block directions ----
const b10 = block(10);
const run = (k) => dmean(b10.slice(Math.max(0, k - 30), Math.min(b10.length, k + 31)).map((x) => x.dir)); // +/-5 min
const dev = b10.map((b, k) => diff(b.dir, run(k)));
const swings = []; // runs of the same sign with peak >= 10 deg
let cur = { sign: Math.sign(dev[0]), peak: 0, start: 0 };
for (let k = 0; k < dev.length; k++) {
  const sg = Math.sign(dev[k]);
  if (sg !== cur.sign && sg !== 0) { if (cur.peak >= 10) swings.push({ ...cur, end: k }); cur = { sign: sg, peak: 0, start: k }; }
  cur.peak = Math.max(cur.peak, Math.abs(dev[k]));
}
// A full oscillation = one swing each side. Periods = time between successive same-sign swings.
const sameSignGaps = []; for (let k = 2; k < swings.length; k++) if (swings[k].sign === swings[k - 2].sign) sameSignGaps.push((swings[k].start - swings[k - 2].start) * 10);
// Spectrum of 10 s direction deviations (period 20 s .. 20 min), crude DFT.
const spec = []; for (const per of [30, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200]) {
  let c = 0, s = 0; dev.forEach((v, k) => { const a = 2 * Math.PI * (k * 10) / per; c += v * Math.cos(a); s += v * Math.sin(a); });
  spec.push({ periodSec: per, amp: 2 * Math.hypot(c, s) / dev.length });
}

// ---- Gusts: 3 s mean speed against the 10 min running mean ----
const sp = rows.map((r) => r.wind);
const sp3 = sp; // 1 s values, no smoothing (the name is kept from the earlier 3 s version)
const base = new Array(N); { let sum = 0; const H = 300; for (let i = 0; i < Math.min(N, H); i++) sum += sp[i]; for (let i = 0; i < N; i++) { const lo = Math.max(0, i - H), hi = Math.min(N - 1, i + H); let s = 0; for (let j = lo; j <= hi; j++) s += sp[j]; base[i] = s / (hi - lo + 1); } }
const dirBase = rows.map((_, i) => dmean(rows.slice(Math.max(0, i - 300), Math.min(N, i + 301)).filter((_, j) => j % 5 === 0).map((r) => r.dir)));
function events(sign) { // sign +1 gusts, -1 lulls
  const out = []; let open = null;
  for (let i = 0; i < N; i++) {
    const ex = sign * (sp3[i] - base[i]), hit = ex >= Math.max(2, 0.3 * base[i]);
    if (hit) { if (!open) open = { start: i, peak: i, ex }; else if (ex > open.ex) { open.peak = i; open.ex = ex; } open.last = i; }
    else if (open && i - open.last > 10) { out.push(open); open = null; }
  }
  if (open) out.push(open);
  return out.map((e) => ({ t: rows[e.peak].t, dur: e.last - e.start + 1, speed: sp3[e.peak], base: base[e.peak], excess: sign * (sp3[e.peak] - base[e.peak]), factor: sp3[e.peak] / base[e.peak],
    dirDiff: diff(dmean(rows.slice(e.start, e.last + 1).map((r) => r.dir)), dirBase[e.peak]) }));
}
const gusts = events(1), lulls = events(-1);
const gaps = (ev) => ev.slice(1).map((e, k) => (e.t - ev[k].t) / 1000);
const per10 = []; for (let i = 0; i + 600 <= N; i += 600) { const s = sp.slice(i, i + 600); per10.push({ t: rows[i].t, mean: mean(s), peak3: Math.max(...sp3.slice(i, i + 600)), gustFactor: Math.max(...sp3.slice(i, i + 600)) / mean(s), dirSd: sd(rows.slice(i, i + 600).map((r) => diff(r.dir, dmean(rows.slice(i, i + 600).map((x) => x.dir))))) }); }
const hours = N / 3600;
const summ = (ev) => ({ count: ev.length, perHour: +(ev.length / hours).toFixed(1), medianGapSec: ev.length > 1 ? Math.round(q(gaps(ev), 0.5)) : null, medianDurSec: ev.length ? q(ev.map((e) => e.dur), 0.5) : null,
  medianExcessKn: ev.length ? +q(ev.map((e) => e.excess), 0.5).toFixed(1) : null, maxKn: ev.length ? +Math.max(...ev.map((e) => e.speed)).toFixed(1) : null,
  medianAbsDirDiff: ev.length ? +q(ev.map((e) => Math.abs(e.dirDiff)), 0.5).toFixed(0) : null, meanSignedDirDiff: ev.length ? +mean(ev.map((e) => e.dirDiff)).toFixed(0) : null,
  share: ev.length ? { veer: ev.filter((e) => e.dirDiff > 5).length, back: ev.filter((e) => e.dirDiff < -5).length, steady: ev.filter((e) => Math.abs(e.dirDiff) <= 5).length } : null });
const out = {
  hours, meanKn: +mean(sp).toFixed(2), maxKn1s: +Math.max(...sp).toFixed(1), peak3sKn: +Math.max(...sp3).toFixed(1), gustFactorOverall: +(Math.max(...sp3) / mean(sp)).toFixed(2),
  direction: { overallStd5min: +sd(b5.map((b) => diff(b.dir, dmean(b5.map((x) => x.dir))))).toFixed(1), meanDir: +dmean(rows.map((r) => r.dir)).toFixed(0),
    blocks5min: b5.length, medianAbsChange5min: +q(b5Changes, 0.5).toFixed(1), p90AbsChange5min: +q(b5Changes, 0.9).toFixed(1),
    shifts15: { count: shifts.length, perHour: +(shifts.length / hours).toFixed(1), persistent: shifts.filter((s) => s.persistent).length, list: shifts.map((s) => ({ ...s, time: new Date(s.at).toISOString() })) },
    oscillation: { swings10deg: swings.length, perHour: +(swings.length / hours).toFixed(1), medianPeriodSec: sameSignGaps.length ? q(sameSignGaps, 0.5) : null, meanPeakDeg: +mean(swings.map((s) => s.peak)).toFixed(0), spectrum: spec.map((s) => ({ ...s, amp: +s.amp.toFixed(2) })) },
    dev10s: { sd: +sd(dev).toFixed(1), p95abs: +q(dev.map(Math.abs), 0.95).toFixed(1) } },
  gusts: summ(gusts), lulls: summ(lulls), per10min: per10.map((p) => ({ ...p, time: new Date(p.t).toISOString().slice(11, 16) })),
  events: { gusts, lulls },
};
await writeFile(new URL(`./NEON_20Hz/serc-${DAY}-analysis.json`, import.meta.url), JSON.stringify(out));
const { events: _e, per10min, ...show } = out; show.direction.shifts15.list = show.direction.shifts15.list.map((s) => `${s.time.slice(11, 16)}Z ${s.from.toFixed(0)}->${s.to.toFixed(0)} (${s.change.toFixed(0)}) ${s.persistent}`);
console.log(JSON.stringify(show, null, 1)); console.log(per10min.map((p) => `${p.time} mean ${p.mean.toFixed(1)} peak3 ${p.peak3.toFixed(1)} GF ${p.gustFactor.toFixed(2)} dirSd ${p.dirSd.toFixed(0)}`).join("\n"));
