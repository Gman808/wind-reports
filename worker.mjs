// Cloudflare Worker: fetches fresh weather on every page load, and every 15 minutes (cron) records the
// logs and sends the 6:00 / 17:00 email. Settings are in wrangler.toml; secrets are set with `wrangler secret put`.
import { ECCC_STATION, collect, emailDue, emailSubject, persist, renderHome, renderRecent, summarize } from "./weather.mjs";
import { chartPage } from "./chart.mjs";
import { buildSources, shiftPage } from "./shift-table.mjs";
import { chart2Opts, chart2Rows, serc, sercCredit } from "./serc-data.mjs";
import { ecccMinutes, tempestMinutes } from "./history.mjs";
import { chartRows } from "./logger-core.mjs";
import { PAGES, ROUTES, aboutPage, otherPage, setBeaconToken, sourcesPage } from "./pages.mjs";

export { WindLogger } from "./logger.mjs";

// KV namespace binding (WEATHER) as the { get, put } store the library expects.
const kvStore = (kv) => ({
  async get(key, fallback) {
    return (await kv.get(key, "json")) ?? fallback;
  },
  async put(key, value) {
    await kv.put(key, JSON.stringify(value));
  },
});

// Data collected in the last few seconds is reused (for either language), so a burst of visitors (or a
// refresh-happy one) can't hammer the weather services. Per-isolate memory, so it is only a courtesy limit.
const REUSE_MS = 15_000;
let recent = { at: 0, c: null };

const href = (page, lang) => PAGES[page][lang];

const chartOpts = (lang) => ({
  intro: lang === "fr"
    ? "Vent à la minute des quatre dernières heures à la station météo de Sainte-Anne-de-Bellevue (Environnement Canada), en nœuds."
    : "One-minute wind for the last four hours from the Sainte-Anne-de-Bellevue weather station (Environment Canada), in knots.",
});

async function sendEmail(env, c) {
  if (!env.RESEND_API_KEY || !env.EMAIL_TO || !env.EMAIL_FROM) {
    console.log("Email skipped: RESEND_API_KEY, EMAIL_TO and EMAIL_FROM are not all set.");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [env.EMAIL_TO], subject: emailSubject(c.now), text: summarize(c) }),
  });
  console.log(res.ok ? "Email sent." : `Email failed: HTTP ${res.status} ${await res.text()}`);
}

// Visit counts in Workers Analytics Engine (binding ANALYTICS). No cookies and no IP addresses are stored: just the page, the
// language, the visitor's country/region/city (from Cloudflare), the referring site's host, and mobile or desktop.
// Query it with SQL, e.g.  SELECT blob2 AS page, SUM(_sample_interval) AS views FROM wind_reports WHERE blob1 = 'view' GROUP BY page
const track = (env, data) => { try { env.ANALYTICS?.writeDataPoint(data); } catch { /* analytics must never break a page */ } };
const hostOf = (u) => { try { return new URL(u).hostname; } catch { return ""; } };

function trackView(env, request, route) {
  const cf = request.cf ?? {};
  track(env, {
    indexes: [route.page],
    blobs: ["view", new URL(request.url).pathname, route.lang, cf.country ?? "", cf.region ?? "", cf.city ?? "",
      hostOf(request.headers.get("referer") ?? ""), /Mobi/i.test(request.headers.get("user-agent") ?? "") ? "mobile" : "desktop"],
    doubles: [1],
  });
}

// POST /a  { f: page the visitor was on, t: where they went (a page path, or the host of an outside link) }
async function trackClick(request, env) {
  try {
    const { f, t } = JSON.parse((await request.text()).slice(0, 500));
    const cf = request.cf ?? {};
    track(env, { indexes: ["click"], blobs: ["click", String(f).slice(0, 120), String(t).slice(0, 120), cf.country ?? ""], doubles: [1] });
  } catch { /* ignore malformed beacons */ }
  return new Response(null, { status: 204 });
}

const LOG_PAGES ={ "/wind-log": "en", "/fr/journal-du-vent": "fr" };
const logOpts = (lang) => ({
  title: lang === "fr" ? "Journal du vent Tempest" : "Tempest Wind Log",
  intro: lang === "fr"
    ? "Vent mesuré environ toutes les 3 secondes par notre station Tempest sur l'eau (quatre dernières heures), en nœuds. La ligne bleu pâle est la plus forte mesure dans la minute environnante."
    : "Wind measured about every 3 seconds by our Tempest station on the water (last four hours), in knots. The light-blue line is the strongest reading within the surrounding minute.",
});

// /api/logger/*: status and csv are open; start and stop need the LOGGER_KEY secret as a bearer token.
async function loggerApi(request, env, url) {
  if (!env.LOGGER) return new Response("Logger is not set up", { status: 404 });
  const log = env.LOGGER.get(env.LOGGER.idFromName("tempest"));
  const action = url.pathname.slice("/api/logger/".length);
  const json = (o) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
  if (action === "status") return json(await log.status());
  if (action === "csv") return new Response(await log.csv(Number(url.searchParams.get("hours")) || 4), { headers: { "content-type": "text/csv" } });
  if (action === "start" || action === "stop") {
    if (request.method !== "POST") return new Response("Use POST", { status: 405 });
    if (!env.LOGGER_KEY || request.headers.get("authorization") !== `Bearer ${env.LOGGER_KEY}`) return new Response("Unauthorized", { status: 401 });
    try {
      return json(action === "start" ? await log.start(Number(url.searchParams.get("hours")) || 4) : await log.stop());
    } catch (e) {
      return new Response(e.message, { status: 502 });
    }
  }
  return new Response("Not found", { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    setBeaconToken(env.CF_BEACON_TOKEN);
    if (pathname === "/a" && request.method === "POST") return trackClick(request, env);
    if (pathname.startsWith("/api/logger/")) return loggerApi(request, env, url);
    if (LOG_PAGES[pathname]) {
      const lang = LOG_PAGES[pathname];
      const obs = env.LOGGER ? await env.LOGGER.get(env.LOGGER.idFromName("tempest")).obs(4) : [];
      const page = chartPage({ lang, page: "chart", href }, obs.length ? chartRows(obs) : [], logOpts(lang));
      return new Response(page, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=15" } });
    }
    const route = ROUTES[pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname];
    if (!route) return new Response("Not found", { status: 404 });
    trackView(env, request, route);
    const ctx = { ...route, href };
    const headers = { "content-type": "text/html; charset=utf-8" };

    // The chart reads the last four hours of one-minute wind straight from Environment Canada.
    if (route.page === "chart") {
      const rows = await ecccMinutes(ECCC_STATION, Date.now());
      return new Response(chartPage(ctx, rows ?? [], chartOpts(route.lang)), { headers: { ...headers, "cache-control": "public, max-age=60" } });
    }
    // Wind Chart 2 shows the NEON sample of 11 July 2024 (one-minute gusts, averages and lulls).
    if (route.page === "chart2") {
      return new Response(chartPage(ctx, chart2Rows, chart2Opts(route.lang)), { headers: { ...headers, "cache-control": "public, max-age=300" } });
    }
    // The shift table reads the last 12 hours of one-minute wind from Environment Canada.
    if (route.page === "shifts") {
      const [stadb, cvl, hyc] = await Promise.all([
        ecccMinutes(ECCC_STATION, Date.now(), 12), tempestMinutes(env.TEMPEST_TOKEN, Date.now(), 12), kvStore(env.WEATHER).get("hudson-history", []),
      ]);
      const sources = buildSources({ hyc, cvl: cvl ?? [], stadb: stadb ?? [], serc });
      return new Response(shiftPage(ctx, sources, { sercCredit: sercCredit(route.lang) }), { headers: { ...headers, "cache-control": "public, max-age=60" } });
    }
    // About and Data Sources are fixed text: no weather data needed.
    if (route.page !== "home" && route.page !== "recent") {
      return new Response(({ about: aboutPage, sources: sourcesPage, other: otherPage })[route.page](ctx), { headers: { ...headers, "cache-control": "public, max-age=300" } });
    }
    if (!recent.c || Date.now() - recent.at > REUSE_MS) {
      const store = kvStore(env.WEATHER);
      // The 24-hour histories are refreshed by the cron; on a brand-new deployment (nothing stored yet) do it once here.
      const firstRun = (await store.get("past-eccc", null)) === null;
      const c = await collect({ tempestToken: env.TEMPEST_TOKEN, store, refreshPast: firstRun });
      if (firstRun) await persist(c, store);
      recent = { at: Date.now(), c };
    }
    const render = route.page === "recent" ? renderRecent : renderHome;
    return new Response(render(recent.c, ctx), { headers: { ...headers, "cache-control": "no-store" } });
  },

  async scheduled(event, env, ctx) {
    const store = kvStore(env.WEATHER);
    const c = await collect({ tempestToken: env.TEMPEST_TOKEN, store });
    await persist(c, store);
    if (emailDue(c.now)) ctx.waitUntil(sendEmail(env, c));
  },
};
