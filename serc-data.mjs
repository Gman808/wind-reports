// The SERC choice on the Wind Shift Table: 30-second wind directions from the NEON tower (serc-blocks.json) and its credit text.
import serc from "./serc-blocks.json" with { type: "json" };

export { serc };

const doi = (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`;
export const sercCredit = (lang) => lang === "fr"
  ? `<strong>Crédit (SERC).</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 le 9 novembre 2026. Données archivées à ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
La direction du vent a été orientée à l'aide de NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Données archivées à ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Traitement : mesures soniques brutes à 20 Hz moyennées à 1 Hz, puis en directions moyennes de 30 secondes (11 juillet 2024); direction pivotée de ${serc.offset.toFixed(0)}° pour concorder avec la direction du vent 2D de la tour (écart typique ±${serc.residualStd.toFixed(0)}°, la direction est donc approximative).`
  : `<strong>Credit (SERC).</strong> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026. Data archived at ${doi("https://doi.org/10.48443/xymh-2v16")}.<br>
Wind direction was oriented using NEON (National Ecological Observatory Network). 2D wind speed and direction (DP1.00001.001), RELEASE-2026. Data archived at ${doi("https://doi.org/10.48443/d4h5-ys70")}.<br>
Processing: raw 20 Hz sonic readings averaged to 1 Hz, then to 30-second mean directions (11 July 2024); direction rotated by ${serc.offset.toFixed(0)}° to match the tower's 2D wind direction (typical difference ±${serc.residualStd.toFixed(0)}°, so treat direction as approximate).`;
