// Local / GitHub Actions runner: builds site/ (index.html plus the log files) and can send the email.
// The live site runs from worker.mjs on Cloudflare; this stays for previewing the page without it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import nodemailer from "nodemailer";
import { collect, emailDue, emailSubject, persist, render, summarize } from "./weather.mjs";

const OUT = new URL("./site/", import.meta.url);

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
await writeFile(new URL("index.html", OUT), render(c));
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
