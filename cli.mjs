// Local / GitHub Actions runner: builds site/ (index.html plus the log files) and can send the email.
// The live site runs from worker.mjs on Cloudflare; this stays for previewing the page without it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import nodemailer from "nodemailer";
import { ECCC_STATION, collect, emailDue, emailSubject, persist, renderHome, renderRecent, summarize } from "./weather.mjs";
import { chartPage } from "./chart.mjs";
import { buildSources, shiftPage } from "./shift-table.mjs";
import { chart2Opts, chart2Rows, serc, sercCredit } from "./serc-data.mjs";
import { ecccMinutes, tempestMinutes } from "./history.mjs";
import { aboutPage, otherPage, sourcesPage } from "./pages.mjs";

const OUT = new URL("./site/", import.meta.url);

// Local preview: every page is a file in site/ and the links are plain file names.
const FILES = {
  home: { en: "index.html", fr: "fr.html" },
  about: { en: "about.html", fr: "a-propos.html" },
  sources: { en: "data-sources.html", fr: "sources-de-donnees.html" },
  other: { en: "other-wind-sites.html", fr: "autres-sites-de-vent.html" },
  chart: { en: "wind-chart.html", fr: "graphique-du-vent.html" },
  chart2: { en: "wind-chart-2.html", fr: "graphique-du-vent-2.html" },
  shifts: { en: "wind-shifts.html", fr: "changements-de-vent.html" },
  recent: { en: "recent-wind.html", fr: "vent-recent.html" },
};
const href = (page, lang) => FILES[page][lang];

// Logs live as JSON files in site/. In GitHub Actions the previous run's files are read back from Pages.
const store = {
  async get(key, fallback) {
    try {
      const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
      if (repo) {
        const [owner, name] = repo.split("/");
        const res = await fetch(`https://${owner.toLowerCase()}.github.io/${name}/${key}.json`, { signal: AbortSignal.timeout(30_000) });
        return res.ok ? await res.json() : fallback;
      }
      return JSON.parse(await readFile(new URL(`${key}.json`, OUT), "utf8"));
    } catch {
      return fallback;
    }
  },
  async put(key, value) {
    await writeFile(new URL(`${key}.json`, OUT), JSON.stringify(value));
  },
};

async function sendEmail(text, subject) {
  const { SMTP_USER, SMTP_PASS, EMAIL_TO, SMTP_HOST = "smtp.gmail.com" } = process.env;
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port: 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({ from: SMTP_USER, to: EMAIL_TO, subject, text });
}

await mkdir(OUT, { recursive: true });
const c = await collect({ tempestToken: process.env.TEMPEST_TOKEN, store });
await persist(c, store);
const minutes = (await ecccMinutes(ECCC_STATION, Date.now())) ?? [];
const shiftSources = buildSources({
  hyc: await store.get("hudson-history", []), cvl: (await tempestMinutes(process.env.TEMPEST_TOKEN, Date.now(), 12)) ?? [],
  stadb: (await ecccMinutes(ECCC_STATION, Date.now(), 12)) ?? [], serc,
});
for (const lang of ["en", "fr"]) {
  const ctx = (page) => ({ lang, page, href });
  await writeFile(new URL(FILES.home[lang], OUT), renderHome(c, ctx("home")));
  await writeFile(new URL(FILES.recent[lang], OUT), renderRecent(c, ctx("recent")));
  await writeFile(new URL(FILES.about[lang], OUT), aboutPage(ctx("about")));
  await writeFile(new URL(FILES.sources[lang], OUT), sourcesPage(ctx("sources")));
  await writeFile(new URL(FILES.other[lang], OUT), otherPage(ctx("other")));
  await writeFile(new URL(FILES.chart[lang], OUT), chartPage(ctx("chart"), minutes));
  await writeFile(new URL(FILES.chart2[lang], OUT), chartPage(ctx("chart2"), chart2Rows, chart2Opts(lang)));
  await writeFile(new URL(FILES.shifts[lang], OUT), shiftPage(ctx("shifts"), shiftSources, { sercCredit: sercCredit(lang) }));
}
await writeFile(new URL("data.json", OUT), JSON.stringify(c.data));
const text = summarize(c);
console.log(text);

const scheduled = process.env.GITHUB_EVENT_NAME === "schedule";
if (process.argv.includes("--send") || (scheduled && emailDue(c.now))) {
  if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_TO) {
    await sendEmail(text, emailSubject(c.now));
    console.log("Email sent.");
  } else {
    console.log("Email skipped: SMTP_USER, SMTP_PASS and EMAIL_TO are not all set.");
  }
}
