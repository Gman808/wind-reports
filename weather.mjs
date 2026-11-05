// Hudson, QC weather: fetch every source, build the page and the email text.
// Runs unchanged in a Cloudflare Worker (worker.mjs) and in Node (cli.mjs); it uses no files and no process.env.
import { lastHours, pastEccc, pastTempest, recordHudson, recordLatest } from "./history.mjs";

const LAT = 45.4547, LON = -74.1503;
const TZ = "America/Toronto";
// Hudson Yacht Club's Davis WeatherLink station (the public embed on hudsonyachtclub.com/club-weather)
const STATION_ID = "38c24915210f434abd5b834365a0d225";
const STATION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // ignore the station if it hasn't reported in 2 hours
// Club de Voile des Laurentides (Pointe-aux-Anglais): its Tempest station readings are printed on the club's home page.
const CLUB_URL = "https://www.cvl.qc.ca";
// Same station via the Tempest service (station 59196). Needs a token from tempestwx.com in TEMPEST_TOKEN.
const TEMPEST_STATION = 59196;
const MS_TO_KN = 1.94384;
// Sainte-Anne-de-Bellevue: Environment Canada's public real-time observations (no key needed).
const ECCC_STATION = "STE-ANNE-DE-BELLEVUE 1";
const KMH_TO_KN = 1 / 1.852;
const SEND_HOURS = [6, 17]; // local hours at which an email goes out

const CODES = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Freezing fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 80: "Rain showers",
  81: "Rain showers", 82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ hail",
};
const desc = (c) => CODES[c] ?? "?";
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: LAT, longitude: LON, timezone: TZ, forecast_days: 5, forecast_hours: 12, wind_speed_unit: "kn",
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m",
    hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant",
  });
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  return res.json();
}

// Returns current conditions from the club station, or null if it's unreachable or stale.
async function fetchStation() {
  try {
    const res = await fetch(`https://www.weatherlink.com/embeddablePage/getData/${STATION_ID}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = await res.json();
    if (s.noAccess || s.temperature == null) throw new Error("no data");
    if (Date.now() - s.lastReceived > STATION_MAX_AGE_MS) throw new Error("station data is stale");
    return s;
  } catch (err) {
    console.warn(`Station unavailable (${err.message}); using Open-Meteo for current conditions.`);
    return null;
  }
}

// Latest Tempest observation for the club's station, in the same shape as fetchClub() returns. Null if
// there's no token, the service is unreachable, or the reading is stale. Values are passed through as reported.
async function fetchTempest(token) {
  try {
    if (!token) throw new Error("TEMPEST_TOKEN is not set");
    const res = await fetch(`https://swd.weatherflow.com/swd/rest/observations/station/${TEMPEST_STATION}?token=${token}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const o = (await res.json()).obs?.[0];
    if (!o || o.air_temperature == null) throw new Error("no data");
    const at = new Date(o.timestamp * 1000);
    if (Date.now() - at > STATION_MAX_AGE_MS) throw new Error("station data is stale");
    return {
      source: "Club de Voile des Laurentides weather station (Tempest)",
      t: at.getTime(),
      time: new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(at),
      temp: o.air_temperature, feels: o.feels_like,
      wind: o.wind_avg * MS_TO_KN, gust: o.wind_gust * MS_TO_KN, dir: o.wind_direction,
      humidity: o.relative_humidity, pressure: o.sea_level_pressure ?? o.barometric_pressure,
      rainLabel: "Rain today", rain: o.precip_accum_local_day,
    };
  } catch (err) {
    console.warn(`Tempest station unavailable (${err.message}).`);
    return null;
  }
}

// Reads the club's weather block from its home page. Returns the readings, or null if the page is
// unreachable, the block is missing, or the reading is stale. Impossible values become null individually.
async function fetchClub() {
  try {
    const res = await fetch(CLUB_URL, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = new TextDecoder("latin1").decode(await res.arrayBuffer());
    const block = html.split("Derni")[1]?.split("</td>")[0];
    if (!block) throw new Error("weather block not found");
    const text = block.replace(/<[^>]+>/g, " ").replace(/&deg;/g, "°").replace(/&[a-z]+;/g, "").replace(/\s+/g, " ");
    const num = (re) => { const m = text.match(re); return m ? Number(m[1]) : null; };
    const when = text.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!when) throw new Error("no timestamp");
    // The club prints local (Eastern) time; compare against the same clock.
    const nowLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date());
    const asUtc = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h, mi);
    const n = nowLocal.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/).slice(1).map(Number);
    const age = asUtc(...n) - asUtc(...when.slice(1).map(Number));
    if (age > STATION_MAX_AGE_MS) throw new Error(`last reading was ${when[0]} (stale)`);
    const o = {
      time: when[0],
      temp: num(/mp\S*rature : (-?[\d.]+)/), feels: num(/Ressendi : (-?[\d.]+)/),
      wind: num(/Vent : ([\d.]+)/), gust: num(/Rafale : ([\d.]+)/), dir: num(/Dir : (\d+)/),
      humidity: num(/Humidit\S* : ([\d.]+)/), pressure: num(/Pression : ([\d.]+)/),
      source: "Club de Voile des Laurentides weather station (from cvl.qc.ca)",
      rainLabel: "Rain past hour", rain: num(/1hr : ([\d.]+)/),
    };
    if (o.temp == null) throw new Error("no temperature");
    if (o.pressure < 950 || o.pressure > 1070) o.pressure = null; // not physically possible at lake level
    if (o.humidity < 5 || o.humidity > 100) o.humidity = null;
    return o;
  } catch (err) {
    console.warn(`Club station unavailable (${err.message}).`);
    return null;
  }
}

// Returns the latest Environment Canada observation for Sainte-Anne-de-Bellevue, or null if unreachable or stale.
async function fetchEccc() {
  try {
    const url = "https://api.weather.gc.ca/collections/swob-realtime/items?" + new URLSearchParams({
      f: "json", limit: 1, sortby: "-date_tm-value", "stn_nam-value": ECCC_STATION,
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = (await res.json()).features?.[0]?.properties;
    if (!p || p.air_temp == null) throw new Error("no data");
    if (Date.now() - Date.parse(p["date_tm-value"]) > STATION_MAX_AGE_MS) throw new Error("station data is stale");
    return p;
  } catch (err) {
    console.warn(`Sainte-Anne-de-Bellevue station unavailable (${err.message}).`);
    return null;
  }
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const INHG_TO_KPA = 3.38639;
const compass = (deg) => COMPASS[Math.round(deg / 22.5) % 16];
const kn = (v) => Math.round(Number(v));
const wind = (dir, speed, gust) => `${compass(dir)} ${kn(speed)} kn` + (gust != null ? ` gusting ${kn(gust)}` : "");

// Current conditions as [label, value] rows, from the club station or (fallback) Open-Meteo.
function currentRows(c, s) {
  if (s) {
    const trend = s.barometerTrend ? ` (${s.barometerTrend.toLowerCase()})` : "";
    return [
      ["Source", "Hudson Yacht Club weather station"],
      ["Temperature", `${s.temperature}°C (feels like ${s.temperatureFeelLike}°C)`],
      ["Wind speed", `${kn(s.wind)} kn`],
      ["Wind gusts", `${kn(s.gust)} kn`],
      ["Wind direction", `${compass(s.windDirection)} (${Math.round(s.windDirection)}°)`],
      ["Pressure", `${(Number(s.barometer) * INHG_TO_KPA).toFixed(1)} kPa${trend}`],
      ["Humidity", `${s.humidity}%`],
      ["Rain today", `${s.rain} mm`],
    ];
  }
  return [
    ["Source", "Open-Meteo model (club station unavailable)"],
    ["Temperature", `${Math.round(c.temperature_2m)}°C (feels like ${Math.round(c.apparent_temperature)}°C)`],
    ["Conditions", desc(c.weather_code)],
    ["Wind speed", `${kn(c.wind_speed_10m)} kn`],
    ["Wind gusts", `${kn(c.wind_gusts_10m)} kn`],
    ["Wind direction", `${compass(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°)`],
    ["Humidity", `${c.relative_humidity_2m}%`],
  ];
}

// Same rows as the Hudson list, for Environment Canada's station (wind in km/h, 10-minute averages, pressure in hPa).
function ecccRows(p) {
  if (!p) return [["Status", "Station data unavailable right now"]];
  const num = (v) => (v == null ? null : Number(v));
  const speed = num(p.avg_wnd_spd_10m_pst10mts), gust = num(p.max_wnd_spd_10m_pst10mts), dir = num(p.avg_wnd_dir_10m_pst10mts);
  return [
    ["Source", "Environment Canada, Sainte-Anne-de-Bellevue station"],
    ["Temperature", `${p.air_temp}°C`],
    ["Wind speed", speed == null ? "n/a" : `${kn(speed * KMH_TO_KN)} kn`],
    ["Wind gusts", gust == null ? "n/a" : `${kn(gust * KMH_TO_KN)} kn`],
    ["Wind direction", dir == null ? "n/a" : `${compass(dir)} (${Math.round(dir)}°)`],
    ["Pressure", p.stn_pres == null ? "n/a" : `${(p.stn_pres / 10).toFixed(1)} kPa`],
    ["Humidity", p.rel_hum == null ? "n/a" : `${p.rel_hum}%`],
    ["Rain past hour", p.pcpn_amt_pst1hr == null ? "n/a" : `${p.pcpn_amt_pst1hr} mm`],
  ];
}

// Same rows as the Hudson list, for the club's station (wind already in knots, pressure in mb).
function clubRows(o) {
  if (!o) return [["Status", "Station data unavailable right now"]];
  const f = (v, fn) => (v == null ? "n/a" : fn(v));
  return [
    ["Source", o.source],
    ["Last reading", o.time],
    ["Temperature", f(o.temp, (v) => `${v}°C` + (o.feels != null ? ` (feels like ${o.feels}°C)` : ""))],
    ["Wind speed", f(o.wind, (v) => `${kn(v)} kn`)],
    ["Wind gusts", f(o.gust, (v) => `${kn(v)} kn`)],
    ["Wind direction", f(o.dir, (v) => `${compass(v)} (${Math.round(v)}°)`)],
    ["Pressure", f(o.pressure, (v) => `${(v / 10).toFixed(1)} kPa`)],
    ["Humidity", f(o.humidity, (v) => `${v}%`)],
    [o.rainLabel, f(o.rain, (v) => `${v} mm`)],
  ];
}

const FORECAST_HEAD = ["Day", "Conditions", "Low / High", "Precip", "Wind (kn)", "Gusts (kn)"];

// One row of strings per forecast day; all wind in knots.
function forecastRows({ daily: d }) {
  return d.time.map((day, i) => [
    i === 0 ? "Today" : new Date(day + "T12:00:00").toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "2-digit" }),
    desc(d.weather_code[i]),
    `${Math.round(d.temperature_2m_min[i])} / ${Math.round(d.temperature_2m_max[i])}°C`,
    `${d.precipitation_probability_max[i]}% (${d.precipitation_sum[i]} mm)`,
    `${compass(d.wind_direction_10m_dominant[i])} ${kn(d.wind_speed_10m_max[i])} kn`,
    `${kn(d.wind_gusts_10m_max[i])} kn`,
  ]);
}

const HOURLY_HEAD = ["Time", "Wind (kn)", "Gusts (kn)", "Direction"];

// Next 12 hours of wind, starting with the current hour; all wind in knots.
function hourlyRows({ current, hourly: h }) {
  const start = Math.max(0, h.time.findIndex((t) => t >= current.time.slice(0, 13)));
  return h.time.slice(start, start + 12).map((t, j) => {
    const i = start + j;
    const dt = new Date(t + ":00");
    const label = dt.toLocaleDateString("en-CA", { weekday: "short" }) + " " + t.slice(11, 16);
    return [label, `${kn(h.wind_speed_10m[i])} kn`, `${kn(h.wind_gusts_10m[i])} kn`,
      `${compass(h.wind_direction_10m[i])} (${Math.round(h.wind_direction_10m[i])}°)`];
  });
}

const PAST_HEAD = ["Time", "Temp", "Wind (kn)", "Gusts (kn)", "Direction"];
const hourFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const orNa = (v, fn) => (v == null ? "n/a" : fn(v));

// Past readings as strings, newest first; all wind in knots.
function pastTableRows(rows) {
  return rows.map((r) => [
    hourFormat.format(new Date(r.t)).replace(",", ""),
    orNa(r.temp, (v) => `${Number(v).toFixed(1)}°C`),
    orNa(r.wind, (v) => `${kn(v)} kn`),
    orNa(r.gust, (v) => `${kn(v)} kn`),
    orNa(r.dir, (v) => `${compass(v)} (${Math.round(v)}°)`),
  ]);
}

// Plain-text version for the email.
export function summarize({ data, station, club, eccc }) {
  const bullets = (rows) => rows.map(([k, v]) => `• ${k}: ${v}`);
  const lines = ["Current Conditions – Hudson", ...bullets(currentRows(data.current, station)), "",
    "Current Conditions – Pointe-aux-Anglais", ...bullets(clubRows(club)), "",
    "Current Conditions – Sainte-Anne-de-Bellevue", ...bullets(ecccRows(eccc)), "", "Five Day Forecast"];
  for (const r of forecastRows(data)) lines.push(`• ${r[0]}: ${r[1]}, ${r[2]}, precip ${r[3]}, wind ${r[4]} gusting ${r[5]}`);
  return lines.join("\n");
}

export function render(c) {
  const { data, station, club, eccc, past, now } = c;
  const stamp = now.toLocaleString("en-CA", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
  const e = escapeHtml;
  const list = (rows) => `<ul>${rows.map(([k, v]) => `<li><b>${e(k)}:</b> ${e(v)}</li>`).join("")}</ul>`;
  const table = (headings, rows) => `<div class="scroll"><table><thead><tr>${headings.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const head = FORECAST_HEAD.map((h) => `<th>${e(h)}</th>`).join("");
  const body = forecastRows(data).map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("");
  const pastSection = (title, rows, empty) => `<h3>${e(title)}</h3>${
    rows?.length ? table(PAST_HEAD, pastTableRows(rows)) : `<p><small>${e(empty)}</small></p>`}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hudson, QC Weather</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 16px;line-height:1.5}
h1{margin-bottom:0}h2{margin-top:1.5rem}h3{margin:1rem 0 .25rem}ul{background:#f2f5f8;padding:1rem 1rem 1rem 2rem;border-radius:8px;margin:0}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid #d5dbe1;white-space:nowrap}
th{background:#f2f5f8}small{color:#666}button{font:inherit;margin-left:.5rem;padding:.1rem .7rem;cursor:pointer}.old{color:#b45309}
@media(prefers-color-scheme:dark){body{background:#14181c;color:#e6e6e6}ul,th{background:#1f262d}td,th{border-color:#333b44}small{color:#999}}</style>
</head><body><h1>Current Conditions</h1><small>Last updated ${e(stamp)} (Eastern) · <span id="age" data-t="${now.toISOString()}"></span></small>
<button id="refresh" type="button">Refresh</button>
<h2>Hudson</h2>${list(currentRows(data.current, station))}
<h2>Pointe-aux-Anglais</h2>${list(clubRows(club))}
<h2>Sainte-Anne-de-Bellevue</h2>${list(ecccRows(eccc))}
<h2>Last 4 Readings</h2><small>One reading per update, about 15 minutes apart. Each station's own reading time is shown.</small>
${pastSection("Hudson", past.log4.hudson, "No station reading yet: Hudson's outdoor sensors aren't reporting.")}
${pastSection("Pointe-aux-Anglais", past.log4.club, "No station reading yet.")}
${pastSection("Sainte-Anne-de-Bellevue", past.log4.eccc, "No station reading yet.")}
<h2>Past 24 Hours</h2>
${pastSection("Hudson", past.hudson, "History is still building: Hudson's station keeps no record, so each update adds one reading here.")}
${pastSection("Pointe-aux-Anglais", past.club, "Past data unavailable right now.")}
${pastSection("Sainte-Anne-de-Bellevue", past.eccc, "Past data unavailable right now.")}
<h2>Hourly Wind Forecast</h2>${table(HOURLY_HEAD, hourlyRows(data))}
<h2>Five Day Forecast</h2><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
<script>
var age = document.getElementById("age"), t = Date.parse(age.dataset.t);
function show() {
  var m = Math.max(0, Math.round((Date.now() - t) / 60000));
  age.textContent = m < 1 ? "just now" : m === 1 ? "1 minute ago" : m < 120 ? m + " minutes ago" : Math.round(m / 60) + " hours ago";
  age.className = m > 45 ? "old" : "";
}
show(); setInterval(show, 30000);
// A new query string gets past the browser and CDN caches, so this fetches the latest published page.
document.getElementById("refresh").onclick = function () { location.href = location.pathname + "?r=" + Date.now(); };
</script>
</body></html>`;
}

// Fetches every source and works out the logs. `store` is { get(key, fallback), put(key, value) }:
// KV in the Worker, files in Node. With refreshPast = false the two heavy 24-hour histories are read from
// the store (written by the last scheduled run) instead of being fetched, which keeps page loads quick.
export async function collect({ tempestToken, store, now = new Date(), refreshPast = true }) {
  const nowMs = now.getTime();
  const [data, station, club, eccc] = await Promise.all([
    fetchWeather(), fetchStation(), fetchTempest(tempestToken).then((t) => t ?? fetchClub()), fetchEccc(),
  ]);
  const [hudsonLog, readingsLog] = await Promise.all([store.get("hudson-history", []), store.get("readings-log", {})]);
  const [pastClub, pastSte] = refreshPast
    ? await Promise.all([pastTempest(tempestToken, nowMs), pastEccc(ECCC_STATION, nowMs)])
    : await Promise.all([store.get("past-club", null), store.get("past-eccc", null)]);
  const hudsonAll = recordHudson(hudsonLog, station, nowMs);
  // This moment's reading for each location (wind in knots); the log keeps the last 4.
  const latest = {
    hudson: station && { t: station.lastReceived, temp: Number(station.temperature), wind: Number(station.wind),
      gust: Number(station.gust), dir: Number(station.windDirection) },
    club: club?.t != null ? { t: club.t, temp: club.temp, wind: club.wind, gust: club.gust, dir: club.dir } : null,
    eccc: eccc && {
      t: Date.parse(eccc["date_tm-value"]), temp: Number(eccc.air_temp),
      wind: eccc.avg_wnd_spd_10m_pst10mts == null ? null : eccc.avg_wnd_spd_10m_pst10mts * KMH_TO_KN,
      gust: eccc.max_wnd_spd_10m_pst10mts == null ? null : eccc.max_wnd_spd_10m_pst10mts * KMH_TO_KN,
      dir: eccc.avg_wnd_dir_10m_pst10mts ?? null,
    },
  };
  const log4 = recordLatest(readingsLog, latest);
  const past = { hudsonLog: hudsonAll, hudson: lastHours(hudsonAll, nowMs), club: pastClub, eccc: pastSte, log4 };
  return { data, station, club, eccc, past, now };
}

// Saves what the next run (or page load) needs. Only scheduled runs should call this.
export async function persist({ past }, store) {
  await Promise.all([
    store.put("hudson-history", past.hudsonLog), store.put("readings-log", past.log4),
    past.club && store.put("past-club", past.club), past.eccc && store.put("past-eccc", past.eccc),
  ]);
}

// The email goes out at 6:00 and 17:00 Eastern, from the first scheduled run of that hour.
// The schedule fires at :13, :28, :43 and :58, so "minute < 28" picks the :13 run (and tolerates delay).
export function emailDue(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "numeric", minute: "numeric", hourCycle: "h23" })
    .formatToParts(now).map((p) => [p.type, p.value]));
  return SEND_HOURS.includes(Number(parts.hour)) && Number(parts.minute) < 28;
}

export const emailSubject = (now) => {
  const hour = Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  return `Hudson weather – ${hour < 12 ? "Morning" : "Evening"} update`;
};
