// Pure helpers for the Tempest wind logger (no Cloudflare imports, so they can be tested in Node).
// A Tempest's "rapid wind" message is one reading about every 3 seconds: { type: "rapid_wind", device_id, ob: [epoch s, m/s, degrees] }.
export const MS_TO_KN = 1.94384;
export const GUST_WINDOW_S = 30; // the gust line is the strongest reading within this many seconds either side

export function parseRapid(msg) {
  if (msg?.type !== "rapid_wind" || !Array.isArray(msg.ob)) return null;
  const [t, speed, dir] = msg.ob;
  if (![t, speed, dir].every(Number.isFinite) || speed < 0 || dir < 0 || dir > 360) return null;
  return { t: t * 1000, speed, dir };
}

// obs: [{ t (ms), speed (m/s), dir }] oldest first -> rows for chartPage: wind and gust in knots with their directions.
// The sensor reports a direction of 0 when it is calm; those readings keep their speed but draw no arrow.
export function chartRows(obs, windowS = GUST_WINDOW_S) {
  const w = windowS * 1000, out = [];
  let lo = 0, hi = 0;
  for (let i = 0; i < obs.length; i++) {
    while (obs[lo].t < obs[i].t - w) lo++;
    while (hi < obs.length && obs[hi].t <= obs[i].t + w) hi++;
    let g = i;
    for (let j = lo; j < hi; j++) if (obs[j].speed > obs[g].speed) g = j;
    out.push({ t: obs[i].t, wind: obs[i].speed * MS_TO_KN, gust: obs[g].speed * MS_TO_KN, dir: obs[i].speed > 0 ? obs[i].dir : null, gustDir: obs[g].speed > 0 ? obs[g].dir : null });
  }
  return out;
}

export const csv = (obs) => "time_utc,wind_speed_kn,wind_from_deg\n" + obs.map((o) => `${new Date(o.t).toISOString()},${(o.speed * MS_TO_KN).toFixed(2)},${o.dir}`).join("\n");

// The ST (Tempest) device id of a station, from the REST station record.
export function tempestDevice(station) {
  const d = station?.stations?.[0]?.devices?.find((x) => x.device_type === "ST");
  return d?.device_id ?? null;
}
