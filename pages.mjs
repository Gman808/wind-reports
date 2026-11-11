// Page shell shared by every page (header, menu, text-size buttons, styles, footer) and the two text pages
// (About, Data Sources), each in English and French.
import { AGE_TEXT, setLang, t } from "./i18n.mjs";

export const VERSION = "1.6"; // see CHANGELOG.md; each released version is tagged v<version> in git

// Where each page lives. Worker URLs here; cli.mjs maps the same pages to file names for a local preview.
export const PAGES = {
  home: { en: "/", fr: "/fr" },
  about: { en: "/about", fr: "/fr/a-propos" },
  sources: { en: "/data-sources", fr: "/fr/sources-de-donnees" },
  other: { en: "/other-wind-sites", fr: "/fr/autres-sites-de-vent" },
  chart: { en: "/wind-chart", fr: "/fr/graphique-du-vent" },
  chart2: { en: "/wind-chart-2", fr: "/fr/graphique-du-vent-2" },
  shifts: { en: "/wind-shifts", fr: "/fr/changements-de-vent" },
  recent: { en: "/recent-wind", fr: "/fr/vent-recent" },
};
export const ROUTES = Object.fromEntries(
  Object.entries(PAGES).flatMap(([page, langs]) => Object.entries(langs).map(([lang, path]) => [path, { page, lang }])),
);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CSS = `
:root{--bg:#fff;--text:#1b1f24;--panel:#f2f5f8;--stripe:#f8fafc;--hover:#e8f0fb;--line:#d5dbe1;--line-strong:#9aa7b4;
  --now:#fff3bf;--muted:#555;--accent:#0b5cad;--head1:2.35rem;--timecol:6rem}
html{scroll-behavior:smooth}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55}
a{color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.wrap{max-width:780px;margin:0 auto;padding:0 16px 2rem}

/* Header: menu button, title, text-size buttons */
header.top{max-width:780px;margin:0 auto;padding:.75rem 16px;display:flex;align-items:center;gap:.75rem;position:relative}
.site-title{flex:1;margin:0;font-size:1.35rem;line-height:1.25}
.site-title a{color:inherit;text-decoration:none}
.btn,.icon-btn{font:inherit;color:var(--text);background:var(--panel);border:1px solid var(--line-strong);border-radius:8px;cursor:pointer;min-height:2.5rem}
.btn{padding:.35rem .9rem}.btn:hover,.icon-btn:hover{background:var(--hover)}
.icon-btn{min-width:2.5rem;padding:0 .5rem;font-weight:700}
.fontbtns{display:flex;gap:.35rem}

/* Three-line menu button (works without JavaScript: it is a details element) */
.menu summary{list-style:none;width:2.75rem;height:2.75rem;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:8px;background:var(--panel);
  display:flex;flex-direction:column;justify-content:center;gap:5px;padding:0 .65rem;cursor:pointer}
.menu summary::-webkit-details-marker{display:none}
.menu summary span{display:block;height:3px;border-radius:2px;background:var(--text)}
.menu[open] summary{background:var(--hover)}
.menu nav{position:absolute;left:16px;top:calc(100% - .1rem);z-index:30;min-width:16rem;background:var(--bg);border:1px solid var(--line-strong);
  border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.2);padding:.5rem;display:grid;gap:.15rem}
.menu nav a{display:block;padding:.6rem .75rem;border-radius:6px;color:var(--text);text-decoration:none}
.menu nav a:hover{background:var(--hover)}
.menu .lang{display:flex;gap:.4rem;padding-bottom:.5rem;margin-bottom:.35rem;border-bottom:1px solid var(--line)}
.menu .lang a,.menu .lang span{flex:1;text-align:center;padding:.5rem;border:1px solid var(--line-strong);border-radius:6px}
.menu .lang span{background:var(--accent);color:#fff;font-weight:700}

/* Reading data */
h2{font-size:1.4rem;margin:2rem 0 .5rem;scroll-margin-top:1rem}
h3{font-size:1.1rem;margin:1.25rem 0 .35rem}
.updated{margin:.25rem 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}
small,.note{color:var(--muted)}
.old{color:#b45309}
.facts{display:grid;grid-template-columns:minmax(7rem,max-content) 1fr;gap:.3rem 1.25rem;background:var(--panel);padding:.9rem 1rem;border-radius:10px;margin:0}
.facts dt{color:var(--muted)}
.facts dd{margin:0;font-weight:600}
td,th,.facts dd{font-variant-numeric:tabular-nums}
table{border-collapse:separate;border-spacing:0;width:100%}
th,td{text-align:left;padding:.4rem .6rem;border-bottom:1px solid var(--line);white-space:nowrap;background:var(--cell,var(--bg))}
thead th{background:var(--panel)}
tbody tr:nth-child(even){--cell:var(--stripe)}
tbody tr.band{--cell:var(--panel);font-weight:600}
tbody tr.now{--cell:var(--now);font-weight:700}
tbody tr:not(.band):not(.now):hover{--cell:var(--hover)}
.g{border-left:2px solid var(--line-strong)}

/* Scroll container: each table scrolls inside its own box, with the header rows and the Time column kept in view. */
.scroll-container{overflow:auto;max-height:70vh;border:1px solid var(--line);border-radius:8px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.scroll-container thead th{position:sticky;top:0;z-index:2}
.scroll-container thead tr+tr th{top:var(--head1)}
.scroll-container tbody td:first-child,.scroll-container thead tr:first-child th:first-child{position:sticky;left:0;z-index:1}
.scroll-container thead tr:first-child th:first-child{z-index:3}
.scroll-container tbody tr.band td:first-child{position:static}
.band .stick{position:sticky;left:.6rem;display:inline-block}
.timeline tbody tr:not(.band) td:first-child,.timeline thead tr:first-child th:first-child{min-width:var(--timecol);box-sizing:border-box}

/* Mobile CSS grid snap: on a phone the Wind Timeline scrolls sideways one location (a 3-column group) at a time,
   each group snapping in beside the Time column. */
@media(max-width:640px){
  :root{--head1:2.1rem;--timecol:6.25rem}
  html[lang=fr]{--timecol:7.25rem}
  .timeline tbody tr.now td:first-child{white-space:normal;line-height:1.25}
  .site-title{font-size:1.1rem}
  th,td{padding:.35rem .5rem;font-size:.9rem}
  .timeline{scroll-snap-type:x mandatory;scroll-padding-left:var(--timecol)}
  .timeline thead tr:first-child th:not(:first-child){scroll-snap-align:start}
}

/* Text pages */
.page ul{padding-left:1.25rem}.page li{margin:.3rem 0}
.source{border:1px solid var(--line);border-radius:10px;padding:.25rem 1rem 1rem;margin:1rem 0}
.embed.tall{height:44rem}
.chart{width:100%;height:52rem;border:1px solid var(--line);border-radius:10px;margin:.75rem 0}
.embed{width:100%;height:28rem;border:1px solid var(--line);border-radius:10px;display:block;margin:.75rem 0}
.foot{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line)}

@media(prefers-color-scheme:dark){
  :root{--bg:#14181c;--text:#e8eaed;--panel:#1f262d;--stripe:#181e24;--hover:#26323f;--line:#333b44;--line-strong:#5b6877;
    --now:#4a4012;--muted:#aab2bb;--accent:#7db7f5}
  .menu .lang span{color:#0b1b2b}
}`;

// Runs in the <head> so the saved text size is applied before the page is drawn (no flash).
const EARLY = `try{var f=localStorage.getItem("fs");if(f)document.documentElement.style.fontSize=f+"%"}catch(e){}`;

// Text-size buttons and menu behaviour.
const SCRIPT = `(function(){
var sizes=[87.5,100,112.5,125,150],cur=100;
try{cur=parseFloat(localStorage.getItem("fs"))||100}catch(e){}
function set(p){cur=p;document.documentElement.style.fontSize=p+"%";try{localStorage.setItem("fs",p)}catch(e){}}
function step(d){var i=sizes.indexOf(cur);if(i<0)i=1;set(sizes[Math.max(0,Math.min(sizes.length-1,i+d))])}
document.getElementById("font-down").onclick=function(){step(-1)};
document.getElementById("font-up").onclick=function(){step(1)};
var menu=document.querySelector(".menu");
menu.addEventListener("click",function(e){if(e.target.closest("a"))menu.removeAttribute("open")});
document.addEventListener("keydown",function(e){if(e.key==="Escape")menu.removeAttribute("open")});
document.addEventListener("click",function(e){if(!menu.contains(e.target))menu.removeAttribute("open")});
})();`;

// ctx = { lang, page, href(page, lang) }; body is trusted HTML; `extraScript` is added after the shared script.
export function layout({ ctx, title, body, extraScript = "" }) {
  const { lang, page, href } = ctx;
  setLang(lang);
  const other = lang === "fr" ? "en" : "fr";
  const home = href("home", lang);
  const siteTitle = t("Lake of Two Mountains Wind Report");
  const link = (label, to) => `<a href="${esc(to)}">${esc(label)}</a>`;
  const langRow = ["fr", "en"].map((l) => {
    const name = l === "fr" ? "Français" : "English";
    return l === lang ? `<span aria-current="true" lang="${l}">${name}</span>` : `<a href="${esc(href(page, l))}" lang="${l}" hreflang="${l}">${name}</a>`;
  }).join("");
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title ? `${title} – ${siteTitle}` : siteTitle)}</title>
<script>${EARLY}</script>
<style>${CSS}
</style>
</head><body>
<header class="top">
<details class="menu"><summary aria-label="${esc(t("Menu"))}"><span></span><span></span><span></span></summary>
<nav aria-label="${esc(t("Menu"))}">
<div class="lang" role="group" aria-label="${esc(t("Language"))}">${langRow}</div>
${link(t("About"), href("about", lang))}
${link(t("Recent Wind Details"), `${href("recent", lang)}#details`)}
${link(t("Wind Timeline"), `${href("recent", lang)}#timeline`)}
${link(t("Wind Chart"), href("chart", lang))}
${link(t("Wind Chart 2"), href("chart2", lang))}
${link(t("Wind Shift Table"), href("shifts", lang))}
${link(t("Data Sources"), href("sources", lang))}
${link(t("Other Wind Sites"), href("other", lang))}
</nav></details>
<h1 class="site-title"><a href="${esc(home)}">${esc(siteTitle)}</a></h1>
<div class="fontbtns"><button id="font-down" class="icon-btn" type="button" aria-label="${esc(t("Smaller text"))}" title="${esc(t("Smaller text"))}">A−</button><button id="font-up" class="icon-btn" type="button" aria-label="${esc(t("Larger text"))}" title="${esc(t("Larger text"))}">A+</button></div>
</header>
<main class="wrap">
${body}
<footer class="foot"><small>${esc(t("Version"))} ${VERSION} · ${esc(t("Weather data"))}: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0), Environment and Climate Change Canada, Hudson Yacht Club, Club de Voile des Laurentides · ${link(t("Data Sources"), href("sources", lang))}</small></footer>
</main>
<script>${SCRIPT}${extraScript}</script>
</body></html>`;
}

// The live "x minutes ago" counter and the Refresh button (home page only).
export function ageScript(lang) {
  return `
var A=${JSON.stringify(AGE_TEXT[lang])},age=document.getElementById("age"),t0=Date.parse(age.dataset.t);
function show(){var m=Math.max(0,Math.round((Date.now()-t0)/60000));
age.textContent=m<1?A.now:m===1?A.one:m<120?A.mins.replace("{n}",m):A.hours.replace("{n}",Math.round(m/60));
age.className=m>45?"old":""}
show();setInterval(show,30000);
// A new query string gets past the browser and CDN caches, so this fetches the latest page.
document.getElementById("refresh").onclick=function(){location.href=location.pathname+"?r="+Date.now()};`;
}

// ---- Text pages ----------------------------------------------------------------------------------------------

const ext = (url, label) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

export function aboutPage(ctx) {
  const { lang, href } = ctx;
  setLang(lang); // t() reads a module-level language, so every page sets it before using it
  const src = `<a href="${esc(href("sources", lang))}">`;
  const body = lang === "fr" ? `
<div class="page">
<h2>À propos</h2>
<p>Le <strong>Rapport des vents du lac des Deux Montagnes</strong> réunit sur une même page le vent autour du lac des Deux Montagnes, en nœuds, pour les plaisanciers et toute personne qui surveille le lac.</p>
<h3>Contenu de la page</h3>
<ul>
<li><strong>Conditions actuelles</strong> – la dernière mesure de trois stations météo : Hudson (HYC), Pointe-aux-Anglais (CVL) et Sainte-Anne-de-Bellevue (station météo).</li>
<li><strong>Prévisions sur cinq jours</strong> – les prévisions quotidiennes pour Hudson.</li>
</ul>
<p>La page <a href="${esc(href("recent", lang))}">Vent récent</a> contient :</p>
<ul>
<li><strong>Détails récents du vent</strong> – les mesures des quatre dernières heures de chaque station, chaque heure menant au Graphique du vent 2.</li>
<li><strong>Chronologie du vent</strong> – un seul tableau pour les trois endroits : mesures récentes, une ligne <em>Maintenant</em> en surbrillance et le vent prévu pour les 12 prochaines heures.</li>
</ul>
<h3>Lire les chiffres</h3>
<ul>
<li>La vitesse du vent et les rafales sont en nœuds (nd). Un nœud équivaut à 1,852 km/h.</li>
<li><em>Provenance</em> indique d'où souffle le vent, en point cardinal et en degrés : O (270°) est un vent d'ouest.</li>
<li>Les heures sont celles de l'Est. Un tiret (–) signifie qu'il n'y a pas de mesure.</li>
</ul>
<h3>Mesuré ou prévu?</h3>
<p>Les conditions actuelles, les détails récents du vent et les relevés de vent passés sont des <strong>mesures</strong> de stations météo. Le vent prévu et les prévisions sur cinq jours sont des <strong>prévisions de modèles informatiques</strong>, et non des mesures; le vent sur l'eau peut différer des deux. Une station peut n'afficher aucune donnée lorsque ses capteurs sont hors ligne ou déplacés.</p>
<h3>À quel point est-ce à jour?</h3>
<p>La page recueille des données fraîches chaque fois qu'elle est ouverte ou actualisée. Le site enregistre aussi une mesure aux 15 minutes, ce qui alimente l'historique récent, car certaines stations ne conservent pas d'historique.</p>
<p>Ce rapport est un guide seulement et ne doit pas être la seule base des décisions de sécurité sur l'eau. Consultez les prévisions et les avertissements officiels d'Environnement Canada.</p>
<p>Voir ${src}Sources des données</a> pour savoir d'où provient chaque chiffre.</p>
</div>` : `
<div class="page">
<h2>About</h2>
<p>The <strong>Lake of Two Mountains Wind Report</strong> puts the wind around Lake of Two Mountains (Lac des Deux Montagnes) on one page, in knots, for sailors and anyone watching the lake.</p>
<h3>What is on the page</h3>
<ul>
<li><strong>Current Conditions</strong> – the latest reading from three weather stations: Hudson (HYC), Pointe-aux-Anglais (CVL) and Sainte-Anne-de-Bellevue (Weather Station).</li>
<li><strong>Five Day Forecast</strong> – a daily outlook for Hudson.</li>
</ul>
<p>The <a href="${esc(href("recent", lang))}">Recent Wind</a> page has:</p>
<ul>
<li><strong>Recent Wind Details</strong> – each station's readings for the past four hours; each time links to Wind Chart 2.</li>
<li><strong>Wind Timeline</strong> – one table for the three locations: recent readings, a highlighted <em>Now</em> row, and the next 12 hours of forecast wind.</li>
</ul>
<h3>Reading the numbers</h3>
<ul>
<li>Wind speed and gusts are in knots (kn). One knot is 1.852 km/h.</li>
<li><em>From</em> is the direction the wind is blowing <em>from</em>, as a compass point and degrees: W (270°) is a west wind.</li>
<li>Times are Eastern. A dash (–) means there is no reading.</li>
</ul>
<h3>Measured or forecast?</h3>
<p>Current Conditions, Recent Wind Details and the Historical Wind Readings are <strong>measurements</strong> from weather stations. Forecasted Wind and the Five Day Forecast are <strong>computer model forecasts</strong>, not measurements, and the wind on the water can differ from either. A station can show no data when its sensors are offline or being moved.</p>
<h3>How up to date is it?</h3>
<p>The page collects fresh data every time it is opened or refreshed. The site also saves a reading every 15 minutes, which is where the recent history comes from, because some stations keep no history of their own.</p>
<p>Use this report as a guide only, not as the sole basis for decisions about safety on the water. Check Environment Canada for official forecasts and warnings.</p>
<p>See ${src}Data Sources</a> for where each number comes from.</p>
</div>`;
  return layout({ ctx, title: t("About"), body });
}

export function sourcesPage(ctx) {
  const { lang } = ctx;
  setLang(lang);
  const wl = ext("https://www.weatherlink.com/", "WeatherLink");
  const body = lang === "fr" ? `
<div class="page">
<h2>Sources des données</h2>
<p>Chaque chiffre de cette page vient de l'une des quatre sources ci-dessous. Les trois premières sont des <strong>mesures</strong> de stations; la quatrième est un <strong>modèle de prévision</strong>. Une cinquième source, la tour de recherche NEON (SERC), ne sert qu'à des <strong>données d'essai</strong> sur les pages Graphique du vent 2 et Tableau des changements de direction.</p>

<section class="source"><h3>Hudson (HYC) – station météo du Hudson Yacht Club</h3>
<p>Une station Davis du Hudson Yacht Club, affichée sur la page ${ext("https://hudsonyachtclub.com/club-weather", "Météo du club")} grâce à ${wl}. Ce site lit le même flux public que l'affichage intégré : température, vent (en nœuds), rafales, direction, pression, humidité et pluie.</p>
<p class="note">Ce flux n'est pas documenté officiellement et pourrait changer. Quand les capteurs ne transmettent rien, la page affiche des tirets. Les mesures de plus de 2 heures sont ignorées. Cette station ne conserve pas d'historique; celui du site vient de mesures enregistrées aux 15 minutes.</p></section>

<section class="source"><h3>Pointe-aux-Anglais (CVL) – station du Club de voile des Laurentides</h3>
<p>Une station météo Tempest (station 59196), dont la ${ext("https://tempestwx.com/station/59196/", "page publique")} est sur tempestwx.com. Les mesures sont lues par l'${ext("https://weatherflow.github.io/Tempest/api/", "API Tempest (WeatherFlow)")}, avec un jeton d'accès; le vent, en mètres par seconde, est converti en nœuds. En cas d'échec, la page utilise le bloc météo publié sur le site du ${ext("https://www.cvl.qc.ca", "Club de voile des Laurentides")}.</p>
<p class="note">Ces données ont servi à mettre le site au point et peuvent provenir d'un capteur déplacé ou en essai.</p></section>

<section class="source"><h3>Sainte-Anne-de-Bellevue (station météo) – Environnement Canada</h3>
<p>Observations officielles en temps réel de la station « STE-ANNE-DE-BELLEVUE 1 », obtenues par l'${ext("https://api.weather.gc.ca/", "API MSC GeoMet")} d'Environnement et Changement climatique Canada (${ext("https://weather.gc.ca/", "météo officielle")}). Le vent est la moyenne sur 10 minutes et la rafale est le maximum de ces 10 minutes (en km/h, convertis en nœuds). La pression est celle de la station, non ramenée au niveau de la mer.</p></section>

<section class="source"><h3>SERC – tour NEON, Smithsonian Environmental Research Center (Maryland)</h3>
<p>Des mesures du vent à 20 fois par seconde de l'anémomètre sonique du haut (environ 61,6 m) de la tour du ${ext("https://www.neonscience.org/", "NEON (National Ecological Observatory Network)")} au Smithsonian Environmental Research Center, au Maryland. Ce site n'utilise que le <strong>11 juillet 2024</strong> (et, sur certaines pages d'essai, le 27 juillet 2024), moyenné à 1 mesure par seconde, puis à la minute ou à 30 secondes. Ce sont des <strong>données d'essai</strong> pour l'analyse des changements de direction et des rafales : ce n'est pas le vent sur le lac des Deux Montagnes.</p>
<p class="note">NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Jeu de données consulté à ${ext("https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026", "data.neonscience.org")} le 9 novembre 2026. Données archivées à ${ext("https://doi.org/10.48443/xymh-2v16", "https://doi.org/10.48443/xymh-2v16")}. La direction du vent a été orientée à l'aide de NEON, 2D wind speed and direction (DP1.00001.001), RELEASE-2026, ${ext("https://doi.org/10.48443/d4h5-ys70", "https://doi.org/10.48443/d4h5-ys70")} (écart typique ±14°, la direction est donc approximative).</p></section>

<section class="source"><h3>Prévisions – Open-Meteo</h3>
<p>${ext("https://open-meteo.com/", "Open-Meteo")} est un service gratuit de prévisions. Il fournit le <strong>vent prévu</strong> heure par heure à 10 m au-dessus du sol pour les trois endroits, les <strong>prévisions sur cinq jours</strong> pour Hudson et, lorsque la station de Hudson ne transmet rien, les conditions actuelles de remplacement. Le modèle est choisi par Open-Meteo pour la région (lors de nos essais, il correspondait au modèle GFS de la NOAA).</p>
<p class="note">Données météo par Open-Meteo.com, licence ${ext("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0")}. Un modèle représente une zone de plusieurs kilomètres : il ne voit pas les effets locaux sur l'eau.</p></section>

<h3>Traitement des données</h3>
<ul>
<li>Le vent est affiché en nœuds : km/h ÷ 1,852 et m/s × 1,94384.</li>
<li>Les heures sont celles de l'Est. Une mesure de station de plus de 2 heures est considérée comme périmée.</li>
<li>Les relevés récents (détails récents du vent et relevés de vent passés) sont enregistrés par ce site aux 15 minutes.</li>
</ul>
</div>` : `
<div class="page">
<h2>Data Sources</h2>
<p>Every number on this page comes from one of the four sources below. The first three are station <strong>measurements</strong>; the fourth is a <strong>forecast model</strong>. A fifth source, the NEON research tower (SERC), is used only for <strong>test data</strong> on the Wind Chart 2 and Wind Shift Table pages.</p>

<section class="source"><h3>Hudson (HYC) – Hudson Yacht Club weather station</h3>
<p>A Davis weather station run by the Hudson Yacht Club and shown on the club's ${ext("https://hudsonyachtclub.com/club-weather", "Club Weather")} page through ${wl}. This site reads the same public data feed the embedded display uses: temperature, wind (in knots), gusts, direction, pressure, humidity and rain.</p>
<p class="note">The feed is not officially documented and could change. When the sensors report nothing, the page shows dashes. Readings older than 2 hours are ignored. This station keeps no history, so the site's history comes from readings it records every 15 minutes.</p></section>

<section class="source"><h3>Pointe-aux-Anglais (CVL) – Club de Voile des Laurentides station</h3>
<p>A Tempest weather station (station 59196) with a ${ext("https://tempestwx.com/station/59196/", "public page")} on tempestwx.com. Readings are fetched through the ${ext("https://weatherflow.github.io/Tempest/api/", "Tempest (WeatherFlow) API")} with an access token; wind arrives in metres per second and is converted to knots. If that fails, the page falls back to the weather block published on the ${ext("https://www.cvl.qc.ca", "Club de Voile des Laurentides website")}.</p>
<p class="note">While the site was being built these readings may come from a sensor that was moved indoors or being tested.</p></section>

<section class="source"><h3>Sainte-Anne-de-Bellevue (Weather Station) – Environment Canada</h3>
<p>Official real-time observations from the “STE-ANNE-DE-BELLEVUE 1” station, fetched from the ${ext("https://api.weather.gc.ca/", "MSC GeoMet API")} of Environment and Climate Change Canada (${ext("https://weather.gc.ca/", "official weather")}). Wind is the 10-minute average and gusts are the maximum in those 10 minutes (reported in km/h, converted to knots). Pressure is the station pressure, not adjusted to sea level.</p></section>

<section class="source"><h3>SERC – NEON tower, Smithsonian Environmental Research Center (Maryland)</h3>
<p>Wind measurements taken 20 times a second by the top sonic anemometer (about 61.6 m) on the ${ext("https://www.neonscience.org/", "NEON (National Ecological Observatory Network)")} tower at the Smithsonian Environmental Research Center in Maryland. This site uses only <strong>11 July 2024</strong> (and, on some test pages, 27 July 2024), averaged to 1 reading per second, then to a minute or 30 seconds. It is <strong>test data</strong> for the wind-shift and gust analysis, not wind on Lake of Two Mountains.</p>
<p class="note">NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026. Dataset accessed from ${ext("https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026", "data.neonscience.org")} on November 9, 2026. Data archived at ${ext("https://doi.org/10.48443/xymh-2v16", "https://doi.org/10.48443/xymh-2v16")}. Wind direction was oriented using NEON, 2D wind speed and direction (DP1.00001.001), RELEASE-2026, ${ext("https://doi.org/10.48443/d4h5-ys70", "https://doi.org/10.48443/d4h5-ys70")} (typical difference ±14°, so direction is approximate).</p></section>

<section class="source"><h3>Forecasts – Open-Meteo</h3>
<p>${ext("https://open-meteo.com/", "Open-Meteo")} is a free weather forecast service. It provides the hourly <strong>Forecasted Wind</strong> at 10 m above ground for all three locations, the <strong>Five Day Forecast</strong> for Hudson, and the stand-in current conditions when Hudson's station reports nothing. Open-Meteo chooses the model for the area (in our tests it matched NOAA's GFS model).</p>
<p class="note">Weather data by Open-Meteo.com, licensed ${ext("https://creativecommons.org/licenses/by/4.0/", "CC BY 4.0")}. A model covers an area several kilometres wide, so it cannot see local effects on the water.</p></section>

<h3>How the data is handled</h3>
<ul>
<li>Wind is shown in knots: km/h ÷ 1.852 and m/s × 1.94384.</li>
<li>Times are Eastern. A station reading older than 2 hours is treated as out of date.</li>
<li>The recent history (Recent Wind Details and the Historical Wind Readings) is recorded by this site every 15 minutes.</li>
</ul>
</div>`;
  return layout({ ctx, title: t("Data Sources"), body });
}

export function otherPage(ctx) {
  const { lang } = ctx;
  setLang(lang);
  const windy = ext("https://www.windy.com/?45.476,-74.143,14", "Windy.com");
  const sail = ext("https://www.sailflow.com/spot/679871", "SailFlow.com");
  const spot = "https://www.sailflow.com/spot/679871"; // the Hudson spot page, which allows being shown inside another page
  // Windy's own embed address for the same spot and zoom (www.windy.com itself cannot be shown inside another page).
  const map = "https://embed.windy.com/embed2.html?lat=45.476&lon=-74.143&detailLat=45.476&detailLon=-74.143&zoom=14&level=surface&overlay=wind&product=ecmwf&marker=true&metricWind=kt&metricTemp=%C2%B0C";
  const guruUrl = "https://wap2.windguru.cz/view.php?&sc=261655&m=3&n=&from=search&start=0&full=1";
  const guru = ext("https://www.windguru.cz/261655", "Windguru.cz");
  const body = lang === "fr" ? `
<div class="page">
<h2>Autres sites de vent</h2>
<p>D'autres sites utiles pour suivre le vent sur le lac des Deux Montagnes.</p>
<section class="source"><h3>${guru}</h3>
<p>Windguru est un service de prévisions de vent très utilisé par les véliplanchistes, kitesurfeurs et plaisanciers. Ce tableau donne, heure par heure, la vitesse du vent, les rafales et la direction prévues pour ce site.</p>
<iframe class="embed tall" src="${guruUrl}" title="Windguru – prévisions" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">${ext(guruUrl, "Ouvrir le tableau Windguru")}. Windguru affiche les vitesses dans ses propres unités.</p>
</section>
<section class="source"><h3>${windy}</h3>
<p>Windy est un service gratuit de cartes météo animées. Il montre le vent, les rafales, la pluie, les nuages et les vagues sur une carte que l'on peut déplacer et agrandir, et propose plusieurs modèles de prévision (ECMWF, GFS et d'autres) ainsi qu'une prévision détaillée heure par heure pour n'importe quel point. Utile pour voir le vent arriver sur la région avant qu'il atteigne le lac.</p>
<iframe class="embed" src="${map}" title="Windy – vent près de Hudson" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">Carte Windy centrée sur le lac (45,476, −74,143), vent en nœuds. ${ext("https://www.windy.com/?45.476,-74.143,14", "Ouvrir dans Windy")}.</p>
</section>
<section class="source"><h3>${sail}</h3>
<p>SailFlow (de WeatherFlow, les créateurs de Tempest) est un service de rapports et de prévisions de vent pour les plaisanciers, les véliplanchistes et les kitesurfeurs. Voici son rapport pour la <strong>zone de navigation de Hudson</strong> : le vent actuel de stations voisines et un graphique de prévision de la vitesse, des rafales et de la direction du vent pour les prochains jours.</p>
<iframe class="embed tall" src="${spot}" title="SailFlow – Hudson" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">${ext("https://www.sailflow.com/map#45.482,-74.099,13,1,!679871,2", "Ouvrir la carte SailFlow")}. SailFlow affiche les vitesses dans ses propres unités (réglables dans SailFlow).</p></section>
</div>` : `
<div class="page">
<h2>Other Wind Sites</h2>
<p>Other useful sites for following the wind on Lake of Two Mountains.</p>
<section class="source"><h3>${guru}</h3>
<p>Windguru is a wind forecast service widely used by windsurfers, kiteboarders and sailors. This table gives the hour-by-hour forecast wind speed, gusts and direction for this spot.</p>
<iframe class="embed tall" src="${guruUrl}" title="Windguru – forecast" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">${ext(guruUrl, "Open the Windguru table")}. Windguru shows speeds in its own units.</p>
</section>
<section class="source"><h3>${windy}</h3>
<p>Windy is a free animated weather-map service. It shows wind, gusts, rain, clouds and waves on a map you can drag and zoom, offers several forecast models (ECMWF, GFS and others), and gives a detailed hour-by-hour forecast for any point. It is handy for watching wind approach the region before it reaches the lake.</p>
<iframe class="embed" src="${map}" title="Windy – wind near Hudson" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">Windy map centred on the lake (45.476, −74.143), wind in knots. ${ext("https://www.windy.com/?45.476,-74.143,14", "Open in Windy")}.</p>
</section>
<section class="source"><h3>${sail}</h3>
<p>SailFlow (from WeatherFlow, the makers of Tempest) is a wind-report and forecast service for sailors, kiteboarders and windsurfers. This is its report for the <strong>Hudson Sailing Area</strong>: current wind from nearby stations, plus a forecast chart of wind speed, gusts and direction for the coming days.</p>
<iframe class="embed tall" src="${spot}" title="SailFlow – Hudson" loading="lazy" referrerpolicy="no-referrer"></iframe>
<p class="note">${ext("https://www.sailflow.com/map#45.482,-74.099,13,1,!679871,2", "Open the SailFlow map")}. SailFlow shows speeds in its own units (set them in SailFlow's settings).</p></section>
</div>`;
  return layout({ ctx, title: t("Other Wind Sites"), body });
}
