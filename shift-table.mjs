// Wind-shift table: counts sustained direction shifts in 30-second direction blocks of the NEON 1 Hz samples, with the three
// inputs (shift size, time window, minutes of data) as pull-down cells. The calculation is computeShifts(), which runs in
// the browser (its source is embedded in the page) and in Node (for testing and for shifts.mjs-style checks).
import { setLang } from "./i18n.mjs";
import { layout } from "./pages.mjs";

// blocks: direction (degrees, wind from) of each block of blockMin minutes, oldest first; null where a block has no reading.
// The most recent `minutes` of them are used. A shift is a change of more than `thresh` degrees from the direction of the
// previous 2 minutes that holds for at least 2 minutes (each block of those 2 minutes stays more than `thresh` away on the same
// side). The new direction then becomes the baseline. Returns the counts per `bucketMin`-minute window and average durations (minutes).
export function computeShifts(blocks, thresh, minutes, bucketMin, blockMin) {
  var rad = Math.PI / 180;
  var norm = function (d) { return ((d % 360) + 360) % 360; };
  var diff = function (a, b) { return ((a - b + 540) % 360) - 180; };
  var dmean = function (ds) {
    var s = 0, c = 0;
    for (var i = 0; i < ds.length; i++) { s += Math.sin(ds[i] * rad); c += Math.cos(ds[i] * rad); }
    return norm(Math.atan2(s, c) / rad);
  };
  var valid = function (xs) { return xs.filter(function (x) { return x != null; }); };
  var HOLD = Math.max(1, Math.round(2 / blockMin)), n = Math.min(blocks.length, Math.floor(minutes / blockMin));
  var b = blocks.slice(blocks.length - n), covered = n * blockMin;
  var events = [], k = HOLD;
  while (k + HOLD <= n) {
    var hist = valid(b.slice(k - HOLD, k));
    if (hist.length < Math.ceil(HOLD / 2) || b[k] == null) { k++; continue; }
    var ref = dmean(hist), d0 = diff(b[k], ref), held = Math.abs(d0) > thresh;
    for (var j = k; held && j < k + HOLD; j++) {
      if (b[j] == null) { held = false; break; }
      var d = diff(b[j], ref);
      if (Math.sign(d) !== Math.sign(d0) || Math.abs(d) <= thresh) held = false;
    }
    if (held) {
      events.push({ block: k, change: diff(dmean(b.slice(k, k + HOLD)), ref) });
      k += HOLD;
    } else k++;
  }
  var windows = Math.max(1, Math.ceil(covered / bucketMin)), per = [];
  for (var w = 0; w < windows; w++) per.push(0);
  events.forEach(function (e) { per[Math.min(windows - 1, Math.floor((e.block * blockMin) / bucketMin))]++; });
  var sorted = per.slice().sort(function (x, y) { return x - y; });
  var avg = function (xs) { return xs.length ? xs.reduce(function (a, x) { return a + x; }, 0) / xs.length : null; };
  // Duration of a shift: how long the new direction lasts, from one shift to the next (the last shift has no next one).
  // Veer/back time: the time from a shift to the next shift in the opposite sense (a veer followed by a back, or the reverse).
  var durations = [], vb = [];
  for (var i = 0; i + 1 < events.length; i++) {
    durations.push((events[i + 1].block - events[i].block) * blockMin);
    if (Math.sign(events[i + 1].change) !== Math.sign(events[i].change)) vb.push((events[i + 1].block - events[i].block) * blockMin);
  }
  return {
    count: events.length,
    perWindow: events.length / (covered / bucketMin),
    min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1],
    empty: per.filter(function (x) { return !x; }).length, windows: windows, covered: covered,
    size: avg(events.map(function (e) { return Math.abs(e.change); })),
    veers: events.filter(function (e) { return e.change > 0; }).length,
    backs: events.filter(function (e) { return e.change < 0; }).length,
    duration: avg(durations), veerBack: avg(vb),
  };
}

// Readings ({ t (ms), dir }) -> { blocks, t0 }: one direction per block of blockMin minutes from the first to the last reading
// (a later reading in the same block replaces an earlier one), null for a block with no reading.
export function regularBlocks(rows, blockMin = 1) {
  const clean = (rows ?? []).filter((r) => r.dir != null);
  if (!clean.length) return { blocks: [], t0: 0 };
  const ms = blockMin * 60000, t0 = Math.floor(clean[0].t / ms) * ms, n = Math.floor((clean.at(-1).t - t0) / ms) + 1, blocks = Array(n).fill(null);
  for (const r of clean) blocks[Math.floor((r.t - t0) / ms)] = r.dir;
  return { blocks, t0 };
}

// The four data sources of the table, in the order of the pull-down. Each has its direction blocks, the minutes per block and
// a description of how often readings arrive. hyc / cvl / stadb: readings [{ t, dir }]; serc: { t0, blockMin, blocks } or null.
export function buildSources({ hyc, cvl, stadb, serc }) {
  const make = (id, name, blockMin, rows, freq) => ({ id, name, blockMin, ...regularBlocks(rows, blockMin), freq });
  return [
    make("HYC", { en: "Hudson Yacht Club (our own log of its station)", fr: "Hudson Yacht Club (notre journal de sa station)" }, 15, hyc, { en: "Every 15 minutes", fr: "Toutes les 15 minutes" }),
    make("CVL", { en: "Club de Voile des Laurentides (Tempest)", fr: "Club de voile des Laurentides (Tempest)" }, 1, cvl, { en: "Every minute", fr: "Chaque minute" }),
    make("StAdB", { en: "Sainte-Anne-de-Bellevue (Environment Canada)", fr: "Sainte-Anne-de-Bellevue (Environnement Canada)" }, 1, stadb, { en: "Every minute", fr: "Chaque minute" }),
    {
      id: "SERC", name: { en: "NEON tower, Maryland (test data, 11 July 2024)", fr: "Tour NEON, Maryland (données d'essai, 11 juillet 2024)" },
      blockMin: serc?.blockMin ?? 0.5, blocks: serc?.blocks ?? [], t0: serc?.t0 ?? 0,
      freq: { en: "Every 30 seconds (averaged from 1-second readings)", fr: "Toutes les 30 secondes (moyenne de mesures à la seconde)" },
    },
  ];
}

const TEXT = {
  en: {
    title: "Wind Shift Table",
    intro: "How often the wind direction shifts, and how long a shift lasts. Pick a data source and change the three settings in the first table, and the results update.",
    settings: "Settings", setting: "Setting", value: "Value",
    size: "Shift size (more than, degrees)", window: "Sample window (minutes)", minutes: "Amount of data to analyse to look (# of most recent minutes)",
    results: "Results", measure: "Measure", data: "Data used", empty: "No readings are available from this source right now.",
    period: "Period covered", freq: "Sample frequency (time between readings)", hold: "A shift must hold for (minutes)",
    total: "Shifts in the data", per: "Shifts per {w} minutes (average)", range: "Shifts per {w}-minute window (lowest / middle / highest)",
    none: "Windows with no shift", sizeAvg: "Average size of a shift (degrees)", vb: "Veers / backs",
    dur: "Average duration of a shift (minutes)", vbt: "Average veer-back time (minutes)",
    of: "of", na: "–", span: "{a} to {b} ({m} minutes)",
    how: `<strong>What the terms mean</strong><ul>
<li><strong>Data used:</strong> the weather station the readings come from. <strong>HYC</strong> is the Hudson Yacht Club's station (we log one reading about every 15 minutes). <strong>CVL</strong> is the Tempest station at the Club de Voile des Laurentides (its sensor is indoors, so its wind direction is not meaningful). <strong>StAdB</strong> is the Environment Canada station at Sainte-Anne-de-Bellevue. <strong>SERC</strong> is the NEON tower at the Smithsonian Environmental Research Center in Maryland, a test data set from 11 July 2024 (see the credit when it is selected).</li>
<li><strong>Sample frequency:</strong> the time between the readings of the chosen source. A shift can only be seen as finely as this.</li>
<li><strong>A shift must hold for:</strong> at least 2 minutes, or one reading when readings are more than 2 minutes apart.</li>
<li><strong>Shift:</strong> the wind direction moves more than the chosen number of degrees away from where it was during the previous 2 minutes, and stays there for the hold time. A missing reading breaks a shift. Once a shift is counted, the new direction becomes the starting point for the next one.</li>
<li><strong>Veer:</strong> a shift that turns the wind clockwise (for example from west toward north).</li>
<li><strong>Back:</strong> a shift that turns the wind counterclockwise (for example from north toward west).</li>
<li><strong>Veers / backs:</strong> how many of the shifts were veers and how many were backs.</li>
<li><strong>Duration of a shift:</strong> how long the new direction lasts, measured from one shift to the next shift of either kind. The most recent shift has no next shift yet, so it is left out of the average.</li>
<li><strong>Veer-back time:</strong> how long it takes the wind to swing the other way. It is measured from a shift to the next shift in the opposite sense: from a veer to the next back, or from a back to the next veer. Shifts in between that go the same way as the first one are skipped. A veer at 10:00 followed by a back at 10:04 counts as 4 minutes. It is about half of one full back-and-forth swing.</li>
<li><strong>Sample window:</strong> the length of each slice the data is cut into for the "per window" rows.</li>
<li><strong>Amount of data:</strong> how many of the most recent minutes are analysed (at most 12 hours; the data is read when the page loads).</li>
</ul>`,
    caveat: "Small sizes (5°) count ordinary gust-to-gust turbulence; the larger sizes show the real swings. At light wind the direction is less reliable and the count goes up.",
  },
  fr: {
    title: "Tableau des changements de direction",
    intro: "À quelle fréquence la direction du vent change, et combien de temps dure un changement. Choisissez une source de données et modifiez les trois réglages du premier tableau, et les résultats se mettent à jour.",
    settings: "Réglages", setting: "Réglage", value: "Valeur",
    size: "Ampleur du changement (plus de, degrés)", window: "Fenêtre d'échantillon (minutes)", minutes: "Quantité de données à analyser (nombre de minutes les plus récentes)",
    results: "Résultats", measure: "Mesure", data: "Données utilisées", empty: "Aucune mesure n'est disponible pour cette source pour le moment.",
    period: "Période couverte", freq: "Fréquence d'échantillonnage (temps entre les mesures)", hold: "Un changement doit tenir (minutes)",
    total: "Changements dans les données", per: "Changements par tranche de {w} minutes (moyenne)", range: "Changements par fenêtre de {w} minutes (minimum / médiane / maximum)",
    none: "Fenêtres sans changement", sizeAvg: "Ampleur moyenne d'un changement (degrés)", vb: "Virements / adonnements",
    dur: "Durée moyenne d'un changement (minutes)", vbt: "Temps moyen virement-adonnement (minutes)",
    of: "sur", na: "–", span: "{a} à {b} ({m} minutes)",
    how: `<strong>Signification des termes</strong><ul>
<li><strong>Données utilisées :</strong> la station météo d'où viennent les mesures. <strong>HYC</strong> est la station du Hudson Yacht Club (nous consignons une mesure environ toutes les 15 minutes). <strong>CVL</strong> est la station Tempest du Club de voile des Laurentides (son capteur est à l'intérieur, la direction du vent n'y est donc pas significative). <strong>StAdB</strong> est la station d'Environnement Canada à Sainte-Anne-de-Bellevue. <strong>SERC</strong> est la tour NEON du Smithsonian Environmental Research Center, au Maryland, un jeu de données d'essai du 11 juillet 2024 (voir le crédit lorsqu'elle est sélectionnée).</li>
<li><strong>Fréquence d'échantillonnage :</strong> le temps entre les mesures de la source choisie. Un changement ne peut être vu plus finement que cela.</li>
<li><strong>Un changement doit tenir :</strong> au moins 2 minutes, ou une mesure lorsque les mesures sont espacées de plus de 2 minutes.</li>
<li><strong>Changement :</strong> la direction du vent s'éloigne de plus du nombre de degrés choisi de ce qu'elle était pendant les 2 minutes précédentes, et y reste pendant la durée de maintien. Une mesure manquante interrompt un changement. Une fois un changement compté, la nouvelle direction devient le point de départ du suivant.</li>
<li><strong>Virement :</strong> un changement qui fait tourner le vent dans le sens horaire (par exemple de l'ouest vers le nord).</li>
<li><strong>Adonnement :</strong> un changement qui fait tourner le vent dans le sens antihoraire (par exemple du nord vers l'ouest).</li>
<li><strong>Virements / adonnements :</strong> combien de changements étaient des virements et combien étaient des adonnements.</li>
<li><strong>Durée d'un changement :</strong> le temps pendant lequel la nouvelle direction se maintient, mesuré d'un changement au changement suivant, de l'un ou l'autre type. Le changement le plus récent n'a pas encore de suivant et n'entre donc pas dans la moyenne.</li>
<li><strong>Temps virement-adonnement :</strong> le temps que met le vent à repartir dans l'autre sens. Il est mesuré d'un changement au changement suivant de sens opposé : d'un virement au prochain adonnement, ou d'un adonnement au prochain virement. Les changements intermédiaires dans le même sens que le premier sont ignorés. Un virement à 10 h 00 suivi d'un adonnement à 10 h 04 compte pour 4 minutes. C'est environ la moitié d'un va-et-vient complet.</li>
<li><strong>Fenêtre d'échantillon :</strong> la longueur de chaque tranche dans laquelle les données sont découpées pour les lignes « par fenêtre ».</li>
<li><strong>Quantité de données :</strong> combien des dernières minutes sont analysées (au plus 12 heures; les données sont lues au chargement de la page).</li>
</ul>`,
    caveat: "Les petites valeurs (5°) comptent la turbulence ordinaire d'une rafale à l'autre; les plus grandes montrent les vrais balancements. Par vent faible, la direction est moins fiable et le compte augmente.",
  },
};

const PAGE_SCRIPT = `
(function(){
var $=function(id){return document.getElementById(id)};
var fill=function(id,vals,def){var s=$(id);s.innerHTML="";vals.forEach(function(v){var o=document.createElement("option");o.value=v;o.textContent=v;if(v===def)o.selected=true;s.appendChild(o)})};
var range=function(a,b,st){var r=[];for(var v=a;v<=b;v+=st)r.push(v);return r};
var f1=function(x){return x==null?D.T.na:x.toFixed(1)};
var when=function(ms){return new Date(ms).toLocaleString(D.locale,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"})};
D.sources.forEach(function(s,i){var o=document.createElement("option");o.value=i;o.textContent=s.id;if(s.id==="StAdB")o.selected=true;$("s-src").appendChild(o)});
$("s-size").innerHTML="";fill("s-size",[3,5,7,10,12,15,20,25,30,40,45,60,90,180],5);fill("s-win",range(10,60,10),10);
function source(){return D.sources[+$("s-src").value]}
function fillMinutes(){var s=source(),have=s.blocks.length*s.blockMin,top=Math.max(30,Math.floor(have/30)*30);fill("s-min",range(30,top,30),Math.min(240,top))}
function set(id,v){$(id).textContent=v}
function draw(){
 var s=source(),th=+$("s-size").value,w=+$("s-win").value,m=+$("s-min").value;
 var hold=Math.max(1,Math.round(2/s.blockMin))*s.blockMin;
 set("r-freq",s.freq);set("r-hold",hold%1?hold.toFixed(1):String(hold));
 $("r-per-l").textContent=D.T.per.replace("{w}",w);$("r-range-l").textContent=D.T.range.replace("{w}",w);
 $("serc-credit").hidden=s.id!=="SERC";
 var have=s.blocks.filter(function(x){return x!=null}).length;
 var ids=["r-total","r-per","r-range","r-none","r-size","r-vb","r-dur","r-vbt"];
 if(have<2*Math.max(1,Math.round(2/s.blockMin))+1){set("r-period",D.T.empty);ids.forEach(function(id){set(id,D.T.na)});return}
 var r=computeShifts(s.blocks,th,m,w,s.blockMin);
 var end=s.t0+s.blocks.length*s.blockMin*60000,start=end-r.covered*60000;
 set("r-period",D.T.span.replace("{a}",when(start)).replace("{b}",when(end)).replace("{m}",Math.round(r.covered)));
 set("r-total",r.count);set("r-per",r.perWindow.toFixed(2));set("r-range",r.min+" / "+r.median+" / "+r.max);
 set("r-none",r.empty+" "+D.T.of+" "+r.windows);set("r-size",r.size==null?D.T.na:Math.round(r.size)+"°");
 set("r-vb",r.veers+" / "+r.backs);set("r-dur",f1(r.duration));set("r-vbt",f1(r.veerBack));
}
$("s-src").addEventListener("change",function(){fillMinutes();draw()});
["s-size","s-win","s-min"].forEach(function(id){$(id).addEventListener("change",draw)});
fillMinutes();draw();
})();`;

// sources: from buildSources(). ctx = { lang, page, href }. opts.sercCredit: HTML for the NEON credit (shown when SERC is selected).
export function shiftPage(ctx, sources, opts = {}) {
  const { lang } = ctx;
  setLang(lang);
  const T = TEXT[lang];
  const data = {
    T: { ...T }, locale: lang === "fr" ? "fr-CA" : "en-CA",
    sources: sources.map((s) => ({ id: s.id, blocks: s.blocks, t0: s.t0, blockMin: s.blockMin, name: s.name[lang], freq: s.freq[lang] })),
  };
  for (const k of ["how", "caveat", "intro"]) delete data.T[k];
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const row = (label, cell, id) => `<tr><th scope="row"${id ? ` id="${id}-l"` : ""}>${label}</th><td${id ? ` id="${id}"` : ""}>${cell}</td></tr>`;
  const body = `
<div class="page">
<style>
.shifts{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}
.shifts th,.shifts td{border:1px solid var(--line);padding:.45rem .6rem;text-align:left;overflow-wrap:anywhere;white-space:normal}
.shifts thead th{background:var(--panel)}
.shifts th:first-child{text-align:right}
.shifts td{font-variant-numeric:tabular-nums}
.terms ul{margin:.4rem 0 0;padding-left:1.25rem}
.terms li{margin:.35rem 0}
.shifts select{font:inherit;padding:.25rem .4rem;min-width:5.5rem}
</style>
<h2>${T.title}</h2>
<p>${T.intro}</p>
<h3>${T.settings}</h3>
<table class="shifts"><thead><tr><th scope="col">${T.setting}</th><th scope="col">${T.value}</th></tr></thead><tbody>
<tr><th scope="row"><label for="s-size">${T.size}</label></th><td><select id="s-size"></select></td></tr>
<tr><th scope="row"><label for="s-win">${T.window}</label></th><td><select id="s-win"></select></td></tr>
<tr><th scope="row"><label for="s-min">${T.minutes}</label></th><td><select id="s-min"></select></td></tr>
</tbody></table>
<h3>${T.results}</h3>
<table class="shifts" aria-live="polite"><thead><tr><th scope="col">${T.measure}</th><th scope="col">${T.value}</th></tr></thead><tbody>
<tr><th scope="row"><label for="s-src">${T.data}</label></th><td><select id="s-src"></select></td></tr>
${row(T.period, "", "r-period")}
${row(T.freq, "", "r-freq")}
${row(T.hold, "", "r-hold")}
${row(T.total, "", "r-total")}
${row(T.per.replace("{w}", "10"), "", "r-per")}
${row(T.range.replace("{w}", "10"), "", "r-range")}
${row(T.none, "", "r-none")}
${row(T.sizeAvg, "", "r-size")}
${row(T.vb, "", "r-vb")}
${row(T.dur, "", "r-dur")}
${row(T.vbt, "", "r-vbt")}
</tbody></table>
<div class="note terms">${T.how}</div>
<p class="note">${T.caveat}</p>
${opts.sercCredit ? `<p class="note" id="serc-credit" hidden>${opts.sercCredit}</p>` : `<p id="serc-credit" hidden></p>`}
</div>`;
  const extra = `var D=${json};var computeShifts=${computeShifts.toString()};${PAGE_SCRIPT}`;
  return layout({ ctx, title: T.title, body, extraScript: extra });
}
