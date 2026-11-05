// Cloudflare Worker: fetches fresh weather on every page load, and every 15 minutes (cron) records the
// logs and sends the 6:00 / 17:00 email. Settings are in wrangler.toml; secrets are set with `wrangler secret put`.
import { collect, emailDue, emailSubject, persist, render, summarize } from "./weather.mjs";

// KV namespace binding (WEATHER) as the { get, put } store the library expects.
const kvStore = (kv) => ({
  async get(key, fallback) {
    return (await kv.get(key, "json")) ?? fallback;
  },
  async put(key, value) {
    await kv.put(key, JSON.stringify(value));
  },
});

// A page rendered in the last few seconds is reused, so a burst of visitors (or a refresh-happy one)
// can't hammer the weather services. Per-isolate memory, so it is only a courtesy limit.
const REUSE_MS = 15_000;
let recent = { at: 0, html: "" };

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

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/") return new Response("Not found", { status: 404 });
    if (Date.now() - recent.at > REUSE_MS) {
      const store = kvStore(env.WEATHER);
      // The 24-hour histories are refreshed by the cron; on a brand-new deployment (nothing stored yet) do it once here.
      const firstRun = (await store.get("past-eccc", null)) === null;
      const c = await collect({ tempestToken: env.TEMPEST_TOKEN, store, refreshPast: firstRun });
      if (firstRun) await persist(c, store);
      recent = { at: Date.now(), html: render(c) };
    }
    return new Response(recent.html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  },

  async scheduled(event, env, ctx) {
    const store = kvStore(env.WEATHER);
    const c = await collect({ tempestToken: env.TEMPEST_TOKEN, store });
    await persist(c, store);
    if (emailDue(c.now)) ctx.waitUntil(sendEmail(env, c));
  },
};
