// Past readings for each station, as rows of { t (ms), temp (°C), wind (kn), gust (kn), dir (°) }.
import { readFile } from "node:fs/promises";

const HOUR = 3_600_000;
const KEEP_HOURS = 72; // how much of Hudson's own log to carry from run to run
const KMH_TO_KN = 1 / 1.852;
const MS_TO_KN = 1.94384;
const TEMPEST_DEVICE = 429251; // the Tempest sensor (ST-00115792) at the Club de Voile des Laurentides

const num = (v) => (v == null || v === "" ? null : Number(v));
const scale = (v, k) => (v == null ? null : v * k);

// One row per clock hour (the earliest in that hour), newest first, covering the last `hours` hours.
export function lastHours(rows, now, hours = 24) {
  const byHour = new Map();
  for (const r of [...rows].sort((a, b) => a.t - b.t)) {
    const h = Math.floor(r.t / HOUR);
    if (!byHour.has(h)) byHour.set(h, r);
  }
  return [...byHour.values()].filter((r) => r.t > now - hours * HOUR).sort((a, b) => b.t - a.t);
}

// Environment Canada's public observations: the top-of-the-hour reading for the past day.
export async function pastEccc(station, now) {
  try {
    const url = "https://api.weather.gc.ca/collections/swob-realtime/items?" + new URLSearchParams({
      f: "json", limit: 1600, sortby: "-date_tm-value", "stn_nam-value": station,
      datetime: new Date(now - 25 * HOUR).toISOString().slice(0, 19) + "Z/..",
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = ((await res.json()).features ?? []).map((f) => f.properties)
      .filter((p) => p["date_tm-value"]?.slice(14, 16) === "00" && p.air_temp != null)
      .map((p) => ({
        t: Date.parse(p["date_tm-value"]), temp: num(p.air_temp),
        wind: scale(num(p.avg_wnd_spd_10m_pst10mts), KMH_TO_KN), gust: scale(num(p.max_wnd_spd_10m_pst10mts), KMH_TO_KN),
        dir: num(p.avg_wnd_dir_10m_pst10mts),
      }));
    return lastHours(rows, now);
  } catch (err) {
    console.warn(`Past data for ${station} unavailable (${err.message}).`);
    return null;
  }
}

// The club's Tempest sensor, one-minute observations for the past day (needs TEMPEST_TOKEN).
export async function pastTempest(token, now) {
  try {
    if (!token) throw new Error("TEMPEST_TOKEN is not set");
    const url = `https://swd.weatherflow.com/swd/rest/observations/device/${TEMPEST_DEVICE}?` + new URLSearchParams({
      time_start: Math.floor((now - 25 * HOUR) / 1000), time_end: Math.floor(now / 1000), token,
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // obs_st columns: 0 time, 2 wind avg (m/s), 3 gust (m/s), 4 direction, 7 air temperature
    const rows = ((await res.json()).obs ?? []).filter((o) => o[7] != null).map((o) => ({
      t: o[0] * 1000, temp: o[7], wind: scale(o[2], MS_TO_KN), gust: scale(o[3], MS_TO_KN), dir: o[4],
    }));
    return lastHours(rows, now);
  } catch (err) {
    console.warn(`Past data for the club station unavailable (${err.message}).`);
    return null;
  }
}

// Hudson's WeatherLink feed has no history, so each run adds its reading to a small log that is
// published with the site and read back by the next run (from GitHub Pages in CI, from site/ locally).
export async function loadPublished(outDir, file, fallback) {
  try {
    const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
    if (repo) {
      const [owner, name] = repo.split("/");
      const res = await fetch(`https://${owner.toLowerCase()}.github.io/${name}/${file}`, { signal: AbortSignal.timeout(30_000) });
      return res.ok ? await res.json() : fallback;
    }
    return JSON.parse(await readFile(new URL(file, outDir), "utf8"));
  } catch {
    return fallback;
  }
}

// Rolling log of each location's most recent readings (one per run, so 15 minutes apart), oldest first.
// `latest` maps location -> reading { t, temp, wind, gust, dir } or null. A reading whose time is already
// in the log (the station hasn't updated since the last run) is not added twice.
export function recordLatest(log, latest, keep = 4) {
  const out = {};
  for (const [place, reading] of Object.entries(latest)) {
    const rows = Array.isArray(log?.[place]) ? [...log[place]] : [];
    if (reading && reading.t != null && !rows.some((r) => r.t === reading.t)) rows.push(reading);
    out[place] = rows.sort((a, b) => a.t - b.t).slice(-keep);
  }
  return out;
}

// Adds the station's latest reading (if any) to the log and drops entries older than KEEP_HOURS.
export function recordHudson(log, station, now) {
  const out = Array.isArray(log) ? [...log] : [];
  if (station && !out.some((r) => r.t === station.lastReceived)) {
    out.push({
      t: station.lastReceived, temp: num(station.temperature),
      wind: num(station.wind), gust: num(station.gust), dir: num(station.windDirection), // WeatherLink reports knots
    });
  }
  return out.filter((r) => r.t > now - KEEP_HOURS * HOUR).sort((a, b) => a.t - b.t);
}
