// Lake of Two Mountains wind report: fetch every source, build the pages and the email text.
// Runs unchanged in a Cloudflare Worker (worker.mjs) and in Node (cli.mjs); it uses no files and no process.env.
import { lastHours, pastEccc, pastTempest, recordHudson, recordLatest } from "./history.mjs";
import { KN, compassPoint, locale, setLang, t } from "./i18n.mjs";
import { ageScript, layout } from "./pages.mjs";

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
export const ECCC_STATION = "STE-ANNE-DE-BELLEVUE 1";
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
const desc = (c) => t(CODES[c] ?? "?");
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Where the Wind Timeline forecast is taken: Hudson, the club's station (Pointe-aux-Anglais) and the Environment Canada station.
const FORECAST_POINTS = [[LAT, LON], [45.49616, -74.17428], [45.427, -73.929]];
const FORECAST_HOURS = 12;

// Hourly model wind for each point, as [{ t (ms), wind (kn), gust (kn), dir }] arrays in FORECAST_POINTS order, or null.
// One Open-Meteo request covers all three points.
async function fetchForecasts() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
      latitude: FORECAST_POINTS.map((p) => p[0]).join(","), longitude: FORECAST_POINTS.map((p) => p[1]).join(","),
      timezone: TZ, timeformat: "unixtime", forecast_hours: FORECAST_HOURS + 2, wind_speed_unit: "kn",
      hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    });
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const json = await res.json();
    return (Array.isArray(json) ? json : [json]).map(({ hourly: h }) => h.time.map((t, i) => ({
      t: t * 1000, wind: h.wind_speed_10m[i], gust: h.wind_gusts_10m[i], dir: h.wind_direction_10m[i],
    })));
  } catch (err) {
    console.warn(`Hourly forecasts unavailable (${err.message}).`);
    return null;
  }
}

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: LAT, longitude: LON, timezone: TZ, forecast_days: 5, wind_speed_unit: "kn",
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,relative_humidity_2m",
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

const INHG_TO_KPA = 3.38639;
const compass = (deg) => compassPoint(Math.round(deg / 22.5) % 16);
const kn = (v) => Math.round(Number(v));
const knots = (v) => `${kn(v)} ${KN()}`;
const bearing = (deg) => `${compass(deg)} (${Math.round(deg)}°)`;
const na = (v, fn) => (v == null ? t("n/a") : fn(v));
const feels = (v) => `(${t("feels like")} ${v}°C)`;

// Current conditions as [label, value] rows, from the Hudson station or (fallback) Open-Meteo.
function currentRows(c, s) {
  if (s) {
    const trend = s.barometerTrend ? ` (${t(s.barometerTrend.toLowerCase())})` : "";
    return [
      [t("Source"), t("Hudson Yacht Club weather station")],
      [t("Temperature"), `${s.temperature}°C ${feels(s.temperatureFeelLike)}`],
      [t("Wind speed"), knots(s.wind)],
      [t("Wind gusts"), knots(s.gust)],
      [t("Wind from"), bearing(s.windDirection)],
      [t("Pressure"), `${(Number(s.barometer) * INHG_TO_KPA).toFixed(1)} kPa${trend}`],
      [t("Humidity"), `${s.humidity}%`],
      [t("Rain today"), `${s.rain} mm`],
    ];
  }
  return [
    [t("Source"), t("Open-Meteo model (club station unavailable)")],
    [t("Temperature"), `${Math.round(c.temperature_2m)}°C ${feels(Math.round(c.apparent_temperature))}`],
    [t("Conditions"), desc(c.weather_code)],
    [t("Wind speed"), knots(c.wind_speed_10m)],
    [t("Wind gusts"), knots(c.wind_gusts_10m)],
    [t("Wind from"), bearing(c.wind_direction_10m)],
    [t("Humidity"), `${c.relative_humidity_2m}%`],
  ];
}

const unavailable = () => [[t("Status"), t("Station data unavailable right now")]];

// Same rows as the Hudson list, for Environment Canada's station (wind in km/h, 10-minute averages, pressure in hPa).
function ecccRows(p) {
  if (!p) return unavailable();
  const num = (v) => (v == null ? null : Number(v));
  const speed = num(p.avg_wnd_spd_10m_pst10mts), gust = num(p.max_wnd_spd_10m_pst10mts), dir = num(p.avg_wnd_dir_10m_pst10mts);
  return [
    [t("Source"), t("Environment Canada, Sainte-Anne-de-Bellevue station")],
    [t("Temperature"), `${p.air_temp}°C`],
    [t("Wind speed"), na(speed, (v) => knots(v * KMH_TO_KN))],
    [t("Wind gusts"), na(gust, (v) => knots(v * KMH_TO_KN))],
    [t("Wind from"), na(dir, bearing)],
    [t("Pressure"), na(p.stn_pres, (v) => `${(v / 10).toFixed(1)} kPa`)],
    [t("Humidity"), na(p.rel_hum, (v) => `${v}%`)],
    [t("Rain past hour"), na(p.pcpn_amt_pst1hr, (v) => `${v} mm`)],
  ];
}

// Same rows as the Hudson list, for the club's station (wind already in knots, pressure in mb).
function clubRows(o) {
  if (!o) return unavailable();
  return [
    [t("Source"), t(o.source)],
    [t("Last reading"), o.time],
    [t("Temperature"), na(o.temp, (v) => `${v}°C` + (o.feels != null ? ` ${feels(o.feels)}` : ""))],
    [t("Wind speed"), na(o.wind, knots)],
    [t("Wind gusts"), na(o.gust, knots)],
    [t("Wind from"), na(o.dir, bearing)],
    [t("Pressure"), na(o.pressure, (v) => `${(v / 10).toFixed(1)} kPa`)],
    [t("Humidity"), na(o.humidity, (v) => `${v}%`)],
    [t(o.rainLabel), na(o.rain, (v) => `${v} mm`)],
  ];
}

// Heading text for a wind column: "Wind (kn)" / "Vent (nd)".
const windHead = (word) => `${t(word)} (${KN()})`;
const forecastHead = () => [t("Day"), t("Conditions"), t("Low / High"), t("Precip"), windHead("Wind"), windHead("Gusts")];
const pastHead = () => [t("Time"), t("Temp"), windHead("Wind"), windHead("Gusts"), t("From")];

// One row of strings per forecast day; all wind in knots.
function forecastRows({ daily: d }) {
  return d.time.map((day, i) => [
    i === 0 ? t("Today") : new Date(day + "T12:00:00").toLocaleDateString(locale(), { weekday: "short", month: "short", day: "2-digit" }),
    desc(d.weather_code[i]),
    `${Math.round(d.temperature_2m_min[i])} / ${Math.round(d.temperature_2m_max[i])}°C`,
    `${d.precipitation_probability_max[i]}% (${d.precipitation_sum[i]} mm)`,
    `${compass(d.wind_direction_10m_dominant[i])} ${knots(d.wind_speed_10m_max[i])}`,
    knots(d.wind_gusts_10m_max[i]),
  ]);
}

// How each location is named on the page and in the email.
const titles = () => ({
  hudson: "Hudson (HYC)", club: "Pointe-aux-Anglais (CVL)", eccc: `Sainte-Anne-de-Bellevue (${t("Weather Station")})`,
});
const clockFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Past readings as strings, newest first; all wind in knots.
function pastTableRows(rows) {
  const weekday = new Intl.DateTimeFormat(locale(), { timeZone: TZ, weekday: "short" });
  return rows.map((r) => [
    `${weekday.format(new Date(r.t))} ${clockFormat.format(new Date(r.t))}`,
    na(r.temp, (v) => `${Number(v).toFixed(1)}°C`),
    na(r.wind, knots),
    na(r.gust, knots),
    na(r.dir, bearing),
  ]);
}

// Plain-text version for the email (always English).
export function summarize({ data, station, club, eccc }) {
  setLang("en");
  const L = titles();
  const bullets = (rows) => rows.map(([k, v]) => `• ${k}: ${v}`);
  const lines = [`Current Conditions – ${L.hudson}`, ...bullets(currentRows(data.current, station)), "",
    `Current Conditions – ${L.club}`, ...bullets(clubRows(club)), "",
    `Current Conditions – ${L.eccc}`, ...bullets(ecccRows(eccc)), "", "Five Day Forecast"];
  for (const r of forecastRows(data)) lines.push(`• ${r[0]}: ${r[1]}, ${r[2]}, precip ${r[3]}, wind ${r[4]} gusting ${r[5]}`);
  return lines.join("\n");
}

// Wind Timeline, one table: a Time column, then Wind / Gusts / From for each location.
//   1. A "Historical Wind Readings" title row, then the past rows, oldest first: the last four clock hours (hourly data)
//      merged with the quarter-hour readings from the log behind "Details from the last Hour". Where both exist for the
//      same quarter hour, the logged reading is used.
//   2. A highlighted, bold "Now" row with each location's current reading.
//   3. A "Forecasted Wind" title row, then the next twelve hours of model wind (hourly), oldest first.
// "–" marks a cell with no data (Hudson's outdoor sensors are off, so it has no readings or history).
const PAST_HOURS = 4;

function windTimeline({ past, forecasts, current, now }, e) {
  const HOUR = 3_600_000, QUARTER = 900_000;
  const L = titles(), places = [L.hudson, L.club, L.eccc];
  const nowMs = now.getTime(), nowHour = Math.floor(nowMs / HOUR);
  // The first cell of each location carries class "g" (a divider line).
  const windCells = (r) => {
    const cell = (v, fn, cls = "") => `<td${cls ? ` class="${cls}"` : ""}>${v == null ? "–" : e(fn(v))}</td>`;
    return r
      ? cell(r.wind, (v) => String(kn(v)), "g") + cell(r.gust, (v) => String(kn(v))) + cell(r.dir, bearing)
      : '<td class="g">–</td><td>–</td><td>–</td>';
  };
  const rowHtml = (label, readings, cls = "") =>
    `<tr${cls ? ` class="${cls}"` : ""}><td>${e(label)}</td>${readings.map(windCells).join("")}</tr>`;
  const band = (text) => `<tr class="band"><td colspan="10"><span class="stick">${e(text)}</span></td></tr>`;

  // 1. Past: per location, quarter-hour slot -> reading. Hourly data first, then the logged quarter-hour readings on top.
  const hourly = [past.hudson, past.club, past.eccc];
  const quarter = ["hudson", "club", "eccc"].map((k) => past.log4?.[k] ?? []);
  const maps = hourly.map((rows, i) => {
    const m = new Map();
    for (const r of rows ?? []) {
      const h = Math.floor(r.t / HOUR);
      if (h > nowHour - PAST_HOURS && h <= nowHour) m.set(h * 4, r);
    }
    for (const r of quarter[i]) if (r.t > nowMs - PAST_HOURS * HOUR && r.t <= nowMs) m.set(Math.floor(r.t / QUARTER), r);
    return m;
  });
  const slots = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
  const pastHtml = slots.map((s) => rowHtml(clockFormat.format(new Date(s * QUARTER)), maps.map((m) => m.get(s)))).join("");

  // 2. Now
  const nowHtml = rowHtml(`${t("Now")} ${clockFormat.format(now)}`, current, "now");

  // 3. Forecast
  const fMaps = places.map((_, i) => new Map((forecasts?.[i] ?? []).map((r) => [Math.floor(r.t / HOUR), r])));
  const fHtml = [...Array(FORECAST_HOURS)].map((_, i) => {
    const h = nowHour + 1 + i;
    return rowHtml(clockFormat.format(new Date(h * HOUR)), fMaps.map((m) => m.get(h)));
  }).join("");

  const groups = places.map((p) => `<th colspan="3" class="g">${e(p)}</th>`).join("");
  const sub = places.map(() => `<th class="g">${windHead("Wind").replace(" (", "<br>(")}</th><th>${windHead("Gusts").replace(" (", "<br>(")}</th><th>${e(t("From"))}</th>`).join("");
  return `<div class="scroll-container timeline"><table><thead><tr><th rowspan="2">${e(t("Time"))}</th>${groups}</tr><tr>${sub}</tr></thead><tbody>${
    band(t("Historical Wind Readings"))}${pastHtml}${nowHtml}${band(t("Forecasted Wind"))}${fHtml}</tbody></table></div>`;
}

// Each location's current wind for the Now row, from its own station only (null, shown as dashes, when the station
// has no reading): the Hudson station, the club's station, the Environment Canada station.
function currentWind({ station, club, eccc }) {
  const num = (v) => (v == null ? null : Number(v));
  const kmh = (v) => (v == null ? null : v * KMH_TO_KN);
  return [
    station ? { wind: num(station.wind), gust: num(station.gust), dir: num(station.windDirection) } : null,
    club ? { wind: club.wind, gust: club.gust, dir: club.dir } : null,
    eccc ? { wind: kmh(eccc.avg_wnd_spd_10m_pst10mts), gust: kmh(eccc.max_wnd_spd_10m_pst10mts), dir: num(eccc.avg_wnd_dir_10m_pst10mts) } : null,
  ];
}

// The home page. ctx = { lang, page, href } (see pages.mjs).
export function renderHome(c, ctx) {
  const { data, station, club, eccc, now } = c;
  setLang(ctx.lang);
  const e = escapeHtml;
  const L = titles();
  const stamp = now.toLocaleString(locale(), { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
  const facts = (rows) => `<dl class="facts">${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join("")}</dl>`;
  const table = (headings, rows) => `<div class="scroll-container"><table><thead><tr>${headings.map((h) => `<th>${e(h).replace(" (", "<br>(")}</th>`).join("")}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((cell) => `<td>${e(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  const body = `
<p class="updated"><small>${e(t("Last updated"))} ${e(stamp)} ${e(t("(Eastern)"))} · <span id="age" data-t="${now.toISOString()}"></span></small>
<button id="refresh" class="btn" type="button">${e(t("Refresh"))}</button></p>
<section><h2>${e(t("Current Conditions"))}</h2>
<h3>${e(L.hudson)}</h3>${facts(currentRows(data.current, station))}
<h3>${e(L.club)}</h3>${facts(clubRows(club))}
<h3>${e(L.eccc)}</h3>${facts(ecccRows(eccc))}
</section>
<section id="forecast"><h2>${e(t("Five Day Forecast"))}</h2>${table(forecastHead(), forecastRows(data))}</section>`;
  return layout({ ctx, title: "", body, extraScript: ageScript(ctx.lang) });
}

// The past PAST_HOURS hours of one location's readings, newest first: hourly data merged with the quarter-hour log
// (the logged reading wins where both fall in the same quarter hour).
function recentReadings(hourly, logged, nowMs) {
  const HOUR = 3_600_000, QUARTER = 900_000, nowHour = Math.floor(nowMs / HOUR), m = new Map();
  for (const r of hourly ?? []) {
    const h = Math.floor(r.t / HOUR);
    if (h > nowHour - PAST_HOURS && h <= nowHour) m.set(h * 4, r);
  }
  for (const r of logged ?? []) if (r.t > nowMs - PAST_HOURS * HOUR && r.t <= nowMs) m.set(Math.floor(r.t / QUARTER), r);
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r);
}

// The Recent Wind page: Recent Wind Details (past four hours per location; each time links to Wind Chart 2) and the Wind Timeline.
export function renderRecent(c, ctx) {
  const { past, forecasts, now } = c;
  setLang(ctx.lang);
  const e = escapeHtml;
  const L = titles();
  const chart2 = e(ctx.href("chart2", ctx.lang));
  const stamp = now.toLocaleString(locale(), { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
  const detailTable = (rows) => {
    const cells = pastTableRows(rows);
    return `<div class="scroll-container"><table><thead><tr>${pastHead().map((h) => `<th>${e(h).replace(" (", "<br>(")}</th>`).join("")}</tr></thead><tbody>${
      cells.map((r) =>`<tr><td><a href="${chart2}">${e(r[0])}</a></td>${r.slice(1).map((cell) => `<td>${e(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  };
  const section = (title, hourly, logged, empty) => {
    const rows = recentReadings(hourly, logged, now.getTime());
    return `<h3>${e(title)}</h3>${rows.length ? detailTable(rows) : `<p class="note">${e(empty)}</p>`}`;
  };
  const body = `
<p class="updated"><small>${e(t("Last updated"))} ${e(stamp)} ${e(t("(Eastern)"))} · <span id="age" data-t="${now.toISOString()}"></span></small>
<button id="refresh" class="btn" type="button">${e(t("Refresh"))}</button></p>
<section id="details"><h2>${e(t("Recent Wind Details"))}</h2><p class="note">${e(t("The past four hours, newest first: readings about 15 minutes apart where this site has logged them, otherwise one reading per hour. Select a time to open Wind Chart 2."))}</p>
${section(L.hudson, past.hudson, past.log4.hudson, t("No station reading yet: Hudson's outdoor sensors aren't reporting."))}
${section(L.club, past.club, past.log4.club, t("No station reading yet."))}
${section(L.eccc, past.eccc, past.log4.eccc, t("No station reading yet."))}
</section>
<section id="timeline"><h2>${e(t("Wind Timeline"))}</h2>${windTimeline({ past, forecasts, current: currentWind(c), now }, e)}</section>`;
  return layout({ ctx, title: t("Recent Wind"), body, extraScript: ageScript(ctx.lang) });
}

// Fetches every source and works out the logs. `store` is { get(key, fallback), put(key, value) }:
// KV in the Worker, files in Node. With refreshPast = false the two heavy 24-hour histories are read from
// the store (written by the last scheduled run) instead of being fetched, which keeps page loads quick.
export async function collect({ tempestToken, store, now = new Date(), refreshPast = true }) {
  const nowMs = now.getTime();
  const [data, station, club, eccc, forecasts] = await Promise.all([
    fetchWeather(), fetchStation(), fetchTempest(tempestToken).then((t) => t ?? fetchClub()), fetchEccc(), fetchForecasts(),
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
  const log4 = recordLatest(readingsLog, latest, PAST_HOURS * 4 + 1); // four hours of quarter-hour readings
  const past = { hudsonLog: hudsonAll, hudson: lastHours(hudsonAll, nowMs), club: pastClub, eccc: pastSte, log4 };
  return { data, station, club, eccc, past, forecasts, now };
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
  return `Lake of Two Mountains Wind Report – ${hour < 12 ? "Morning" : "Evening"} update`;
};
