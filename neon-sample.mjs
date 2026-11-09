// Builds the local NEON sample page: four hours of 1 Hz tower-top wind from SERC (27 July 2024) on the Wind Chart.
// Reads NEON_20Hz/serc-2024-07-27-1hz.json (made from NEON's raw 20 Hz file; not committed) and writes site/neon-serc-*.html.
import { readFile, writeFile } from "node:fs/promises";
import { chartPage } from "./chart.mjs";

const FILES = {
  home: { en: "index.html", fr: "fr.html" },
  about: { en: "about.html", fr: "a-propos.html" },
  sources: { en: "data-sources.html", fr: "sources-de-donnees.html" },
  other: { en: "other-wind-sites.html", fr: "autres-sites-de-vent.html" },
  chart: { en: "neon-serc-2024-07-27.html", fr: "neon-serc-2024-07-27-fr.html" },
};
const href = (page, lang) => FILES[page][lang];
const { rows, offset, residualStd } = JSON.parse(await readFile(new URL("./NEON_20Hz/serc-2024-07-27-1hz.json", import.meta.url), "utf8"));
const points = rows.map((r) => ({ t: r.t, wind: r.wind, gust: null, dir: r.dir, gustDir: null }));

const doi = (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
const TEXT = {
  en: {
    title: "NEON SERC 1 Hz wind – 27 July 2024",
    intro: "Four hours of 1 Hz wind (13:30–17:30 Eastern) from the top sonic anemometer (about 61.6 m) on the NEON tower at the Smithsonian Environmental Research Center, Maryland. Each point is the average of 20 readings taken in that second. This is a test data set for the wind-shift and gust analysis, not wind on Lake of Two Mountains.",
    how: "How to read it: each arrow points the way the wind is blowing toward (a west wind gives an arrow pointing right) and the line is the wind speed. Arrows are thinned out when zoomed out; drag across the chart to zoom in, and hover or tap a point for the details.",
    credit: `<strong>Credit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026. Data archived at ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
Wind direction was oriented using NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Data archived at ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Processing: raw 20 Hz sonic readings averaged to 1 Hz (u, v, w and horizontal speed); direction from the 1 Hz mean horizontal vector, rotated by ${offset.toFixed(0)}° to match the tower's 2D wind direction (typical difference ±${residualStd.toFixed(0)}°, so treat direction as approximate).`,
  },
  fr: {
    title: "Vent à 1 Hz de NEON à SERC – 27 juillet 2024",
    intro: "Quatre heures de vent à 1 Hz (13 h 30 à 17 h 30, heure de l'Est) de l'anémomètre sonique du haut (environ 61,6 m) de la tour NEON du Smithsonian Environmental Research Center, au Maryland. Chaque point est la moyenne de 20 mesures prises durant cette seconde. Il s'agit d'un jeu de données d'essai pour l'analyse des changements de direction et des rafales, et non du vent sur le lac des Deux Montagnes.",
    how: "Comment le lire : chaque flèche pointe vers où le vent souffle (un vent d'ouest donne une flèche vers la droite) et la ligne est la vitesse du vent. Les flèches sont espacées quand le graphique est complet; faites glisser pour zoomer, et survolez ou touchez un point pour les détails.",
    credit: `<strong>Crédit.</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 le 9 novembre 2026. Données archivées à ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
La direction du vent a été orientée à l'aide de NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Données archivées à ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Traitement : mesures soniques brutes à 20 Hz moyennées à 1 Hz (u, v, w et vitesse horizontale); direction tirée du vecteur horizontal moyen à 1 Hz, pivotée de ${offset.toFixed(0)}° pour concorder avec la direction du vent 2D de la tour (écart typique ±${residualStd.toFixed(0)}°, la direction est donc approximative).`,
  },
};
for (const lang of ["en", "fr"]) {
  const html = chartPage({ lang, page: "chart", href }, points, { title: TEXT[lang].title, intro: TEXT[lang].intro, how: TEXT[lang].how, credit: TEXT[lang].credit });
  await writeFile(new URL(`./site/${FILES.chart[lang]}`, import.meta.url), html);
  console.log("wrote site/" + FILES.chart[lang]);
}
