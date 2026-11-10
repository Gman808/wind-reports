// Builds the local NEON sample page: four hours of 1 Hz tower-top wind from SERC (27 July 2024) on the Wind Chart.
// Reads NEON_20Hz/serc-2024-07-27-1hz.json (made from NEON's raw 20 Hz file; not committed) and writes site/neon-serc-*.html.
import { readFile, writeFile } from "node:fs/promises";
import { chartPage } from "./chart.mjs";

const DAY = process.argv[2] ?? "2024-07-27";
// "1hz" (default): four hours at 1 Hz. "20hz": ten minutes of the raw 20 Hz samples around the strongest gust of the day.
// "last-hour": the 1 Hz data, but only the last hour of the four-hour window.
const LAST = process.argv[3] === "last-hour";
const MODE = process.argv[3] === "20hz" ? "20hz" : "1hz", HZ = MODE === "20hz" ? 20 : 1;
const FILES = {
  home: { en: "index.html", fr: "fr.html" },
  about: { en: "about.html", fr: "a-propos.html" },
  sources: { en: "data-sources.html", fr: "sources-de-donnees.html" },
  other: { en: "other-wind-sites.html", fr: "autres-sites-de-vent.html" },
  chart: { en: `neon-serc-${DAY}${MODE === "20hz" ? "-20hz" : LAST ? "-last-hour" : ""}.html`, fr: `neon-serc-${DAY}${MODE === "20hz" ? "-20hz" : LAST ? "-last-hour" : ""}-fr.html` },
};
const href = (page, lang) => FILES[page][lang];
const { rows: allRows, offset, residualStd } = JSON.parse(await readFile(new URL(`./NEON_20Hz/serc-${DAY}-${MODE}.json`, import.meta.url), "utf8"));
const rows = LAST ? allRows.slice(-3600) : allRows;
const MONTHS = { en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] };
const [Y, M, D] = DAY.split("-").map(Number);
const hm = (ms) => new Date(ms).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Toronto" });
const hms = (ms) => new Date(ms).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "America/Toronto" });
const span = MODE === "20hz" ? `${hms(rows[0].t)}–${hms(rows.at(-1).t + 50)}` : `${hm(rows[0].t)}–${hm(rows.at(-1).t + 1000)}`;
const dateEn = `${D} ${MONTHS.en[M - 1]} ${Y}`, dateFr = `${D === 1 ? "1er" : D} ${MONTHS.fr[M - 1]} ${Y}`;
// Gust line: the strongest 1 s speed within the surrounding minute (30 s either side), with the direction at that moment.
const points = rows.map((r, i) => {
  let g = i;
  for (let j = Math.max(0, i - 30 * HZ); j <= Math.min(rows.length - 1, i + 30 * HZ); j++) if (rows[j].wind > rows[g].wind) g = j;
  return { t: r.t, wind: r.wind, gust: rows[g].wind, dir: r.dir, gustDir: rows[g].dir };
});

const doi = (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
const TEXT = {
  en: {
    title: `NEON SERC 1 Hz wind – ${dateEn}`,
    intro: `Four hours of 1 Hz wind (${span} Eastern) from the top sonic anemometer (about 61.6 m) on the NEON tower at the Smithsonian Environmental Research Center, Maryland. Each blue point is the average of 20 readings taken in that second. The blue-purple gust line is the strongest one-second speed within the surrounding minute. This is a test data set for the wind-shift and gust analysis, not wind on Lake of Two Mountains.`,
    how: "How to read it: each arrow points the way the wind is blowing toward (a west wind gives an arrow pointing right) and the blue line is the wind speed. The blue-purple arrows on the gust line show the strongest gust nearby and the way it blows, so you can compare it with the wind. Arrows are thinned out when zoomed out; drag across the chart to zoom in, and hover or tap a point for the details.",
    credit: `<strong>Credit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026. Data archived at ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
Wind direction was oriented using NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Data archived at ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Processing: raw 20 Hz sonic readings averaged to 1 Hz (u, v, w and horizontal speed); direction from the 1 Hz mean horizontal vector, rotated by ${offset.toFixed(0)}° to match the tower's 2D wind direction (typical difference ±${residualStd.toFixed(0)}°, so treat direction as approximate).`,
  },
  fr: {
    title: `Vent à 1 Hz de NEON à SERC – ${dateFr}`,
    intro: `Quatre heures de vent à 1 Hz (${span.replace(":", " h ").replace(":", " h ").replace("–", " à ")}, heure de l'Est) de l'anémomètre sonique du haut (environ 61,6 m) de la tour NEON du Smithsonian Environmental Research Center, au Maryland. Chaque point bleu est la moyenne de 20 mesures prises durant cette seconde. La ligne violet bleuté des rafales est la vitesse sur une seconde la plus forte dans la minute environnante. Il s'agit d'un jeu de données d'essai pour l'analyse des changements de direction et des rafales, et non du vent sur le lac des Deux Montagnes.`,
    how: "Comment le lire : chaque flèche pointe vers où le vent souffle (un vent d'ouest donne une flèche vers la droite) et la ligne bleue est la vitesse du vent. Les flèches violet bleuté sur la ligne des rafales montrent la plus forte rafale à proximité et sa direction, pour la comparer au vent. Les flèches sont espacées quand le graphique est complet; faites glisser pour zoomer, et survolez ou touchez un point pour les détails.",
    credit: `<strong>Crédit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 le 9 novembre 2026. Données archivées à ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
La direction du vent a été orientée à l'aide de NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Données archivées à ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Traitement : mesures soniques brutes à 20 Hz moyennées à 1 Hz (u, v, w et vitesse horizontale); direction tirée du vecteur horizontal moyen à 1 Hz, pivotée de ${offset.toFixed(0)}° pour concorder avec la direction du vent 2D de la tour (écart typique ±${residualStd.toFixed(0)}°, la direction est donc approximative).`,
  },
};
if (LAST) {
  TEXT.en.title += " (last hour)";
  TEXT.fr.title += " (dernière heure)";
  TEXT.en.intro = TEXT.en.intro.replace("Four hours of 1 Hz wind", "The last hour of 1 Hz wind");
  TEXT.fr.intro = TEXT.fr.intro.replace("Quatre heures de vent à 1 Hz", "La dernière heure de vent à 1 Hz");
}
if (MODE === "20hz") {
  TEXT.en.title = `NEON SERC 20 Hz wind – ${dateEn}`;
  TEXT.fr.title = `Vent à 20 Hz de NEON à SERC – ${dateFr}`;
  TEXT.en.intro = `Ten minutes of the raw 20 Hz wind (${span} Eastern, 20 readings per second) from the top sonic anemometer (about 61.6 m) on the NEON tower at the Smithsonian Environmental Research Center, Maryland, centred on the strongest gust of the day. Nothing is averaged: each point is one reading, 0.05 s apart. The blue-purple gust line is the strongest reading within the surrounding minute. This is a test data set for the wind-shift and gust analysis, not wind on Lake of Two Mountains.`;
  TEXT.fr.intro = `Dix minutes de vent brut à 20 Hz (${span.replace("–", " à ")}, heure de l'Est, 20 mesures par seconde) de l'anémomètre sonique du haut (environ 61,6 m) de la tour NEON du Smithsonian Environmental Research Center, au Maryland, centrées sur la plus forte rafale de la journée. Rien n'est moyenné : chaque point est une mesure, à 0,05 s d'intervalle. La ligne violet bleuté des rafales est la plus forte mesure dans la minute environnante. Il s'agit d'un jeu de données d'essai, et non du vent sur le lac des Deux Montagnes.`;
  TEXT.en.credit = TEXT.en.credit.replace(/Processing:[^]*$/, `Processing: raw 20 Hz sonic readings, speed from the horizontal components; direction rotated by ${offset.toFixed(0)}° to match the tower's 2D wind direction (typical difference ±${residualStd.toFixed(0)}°, so treat direction as approximate).`);
  TEXT.fr.credit = TEXT.fr.credit.replace(/Traitement :[^]*$/, `Traitement : mesures soniques brutes à 20 Hz, vitesse tirée des composantes horizontales; direction pivotée de ${offset.toFixed(0)}° pour concorder avec la direction du vent 2D de la tour (écart typique ±${residualStd.toFixed(0)}°, la direction est donc approximative).`);
}
for (const lang of ["en", "fr"]) {
  const html = chartPage({ lang, page: "chart", href }, points, { title: TEXT[lang].title, intro: TEXT[lang].intro, how: TEXT[lang].how, credit: TEXT[lang].credit, fine: MODE === "20hz" });
  await writeFile(new URL(`./site/${FILES.chart[lang]}`, import.meta.url), html);
  console.log("wrote site/" + FILES.chart[lang]);
}
