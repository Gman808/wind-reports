// The SERC choice on the Wind Shift Table: 30-second wind directions from the NEON tower (serc-blocks.json) and its credit text.
import serc from "./serc-blocks.json" with { type: "json" };

import chart2Rows from "./serc-chart2.json" with { type: "json" };

export { serc, chart2Rows };

const doi = (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
export const sercCredit = (lang) => lang === "fr"
  ? `<strong>Crédit (SERC).</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 le 9 novembre 2026. Données archivées à ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
La direction du vent a été orientée à l'aide de NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Données archivées à ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Traitement : mesures soniques brutes à 20 Hz moyennées à 1 Hz, puis en directions moyennes de 30 secondes (11 juillet 2024); direction pivotée de ${serc.offset.toFixed(0)}° pour concorder avec la direction du vent 2D de la tour (écart typique ±${serc.residualStd.toFixed(0)}°, la direction est donc approximative).`
  : `<strong>Credit (SERC).</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026. Data archived at ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
Wind direction was oriented using NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Data archived at ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Processing: raw 20 Hz sonic readings averaged to 1 Hz, then to 30-second mean directions (11 July 2024); direction rotated by ${serc.offset.toFixed(0)}° to match the tower's 2D wind direction (typical difference ±${serc.residualStd.toFixed(0)}°, so treat direction as approximate).`;

// Wind Chart 2: the 11 July 2024 sample as one-minute gusts, averages and lulls, with its text and NEON credit.
export const chart2Opts = (lang) => lang === "fr"
  ? {
    title: "Graphique du vent 2",
    intro: "Quatre heures (11 h 30 à 15 h 30, heure de l'Est) du 11 juillet 2024, de l'anémomètre sonique du haut (environ 61,6 m) de la tour NEON du Smithsonian Environmental Research Center, au Maryland, présentées par minute : les rafales (la seconde la plus forte de la minute), la vitesse moyenne du vent et les accalmies (la seconde la plus faible). Il s'agit d'un jeu de données d'essai, et non du vent sur le lac des Deux Montagnes.",
    how: "Comment le lire : chaque flèche pointe vers où le vent souffle (un vent d'ouest donne une flèche vers la droite). Trois lignes bleues, de plus en plus foncées vers le bas : les rafales (la plus claire), la vitesse moyenne et les accalmies (la plus foncée). L'espace entre les rafales et la moyenne est rempli de bleu pâle, et celui entre la moyenne et les accalmies, d'un bleu un peu plus foncé. Chaque flèche montre la direction du vent à ce moment, les trois flèches peuvent donc différer. Faites glisser sur le graphique pour zoomer, et survolez ou touchez un point pour les détails.",
    credit: sercCredit(lang).replace("(SERC).", "."),
  }
  : {
    title: "Wind Chart 2",
    intro: "Four hours (11:30–15:30 Eastern) of 11 July 2024 from the top sonic anemometer (about 61.6 m) on the NEON tower at the Smithsonian Environmental Research Center, Maryland, shown as one value per minute: the gusts (the strongest second of the minute), the average wind speed and the lulls (the weakest second). This is a test data set, not wind on Lake of Two Mountains.",
    how: "How to read it: each arrow points the way the wind is blowing toward (a west wind gives an arrow pointing right). Three blue lines get darker toward the bottom: gusts (lightest), average wind speed and lulls (darkest). The space between the gusts and the average is filled with a light blue, and the space between the average and the lulls with a slightly darker blue. Each arrow shows the wind direction at that moment, so the three arrows can differ. Drag across the chart to zoom, and hover or tap a point for the details.",
    credit: sercCredit(lang).replace("(SERC).", "."),
  };
