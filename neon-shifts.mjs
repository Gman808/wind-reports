// Builds the local Wind Shift Table page from the two NEON 1 Hz samples (NEON_20Hz/serc-<day>-1hz.json; not committed).
// Writes site/neon-serc-shifts.html and site/neon-serc-shifts-fr.html.
import { readFile, writeFile } from "node:fs/promises";
import { directionBlocks, shiftPage } from "./shift-table.mjs";

const FILES = {
  home: { en: "index.html", fr: "fr.html" },
  about: { en: "about.html", fr: "a-propos.html" },
  sources: { en: "data-sources.html", fr: "sources-de-donnees.html" },
  other: { en: "other-wind-sites.html", fr: "autres-sites-de-vent.html" },
  chart: { en: "neon-serc-shifts.html", fr: "neon-serc-shifts-fr.html" },
};
const href = (page, lang) => FILES[page][lang];
const DAYS = ["2024-07-11", "2024-07-27"];
const data = await Promise.all(DAYS.map(async (d) => JSON.parse(await readFile(new URL(`./NEON_20Hz/serc-${d}-1hz.json`, import.meta.url), "utf8"))));
const days = data.map((d) => ({ blocks: directionBlocks(d.rows) }));
const offsets = [...new Set(data.map((d) => d.offset.toFixed(0)))].join(" / "), std = Math.max(...data.map((d) => d.residualStd)).toFixed(0);

const doi = (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
const CREDIT = {
  en: `<strong>Credit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026. Data archived at ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
Wind direction was oriented using NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Data archived at ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Processing: raw 20 Hz sonic readings averaged to 1 Hz, then to 30-second mean directions; direction rotated (${offsets}°) to match the tower's 2D wind direction (typical difference ±${std}°, so treat direction as approximate).`,
  fr: `<strong>Crédit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 le 9 novembre 2026. Données archivées à ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
La direction du vent a été orientée à l'aide de NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Données archivées à ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Traitement : mesures soniques brutes à 20 Hz moyennées à 1 Hz, puis en directions moyennes de 30 secondes; direction pivotée (${offsets}°) pour concorder avec la direction du vent 2D de la tour (écart typique ±${std}°, la direction est donc approximative).`,
};
for (const lang of ["en", "fr"]) {
  await writeFile(new URL(`./site/${FILES.chart[lang]}`, import.meta.url), shiftPage({ lang, page: "chart", href }, days, CREDIT[lang]));
  console.log("wrote site/" + FILES.chart[lang]);
}
