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
  var HOLD = Math.round(2 / blockMin), n = Math.min(blocks.length, Math.floor(minutes / blockMin));
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

// One-minute rows ({ t, dir }) -> { blocks, t0 }: one direction per minute from the first to the last row, null for a missing minute.
export function minuteBlocks(rows) {
  const clean = rows.filter((r) => r.dir != null);
  if (!clean.length) return { blocks: [], t0: 0 };
  const t0 = Math.floor(clean[0].t / 60000) * 60000, n = Math.floor((clean.at(-1).t - t0) / 60000) + 1, blocks = Array(n).fill(null);
  for (const r of clean) blocks[Math.floor((r.t - t0) / 60000)] = r.dir;
  return { blocks, t0 };
}

const TEXT = {
  en: {
    title: "Wind Shift Table",
    intro: "How often the wind direction shifts, and how long a shift lasts, from the live one-minute wind at the Sainte-Anne-de-Bellevue weather station (Environment Canada). Change the three settings in the first table and the results update.",
    settings: "Settings", setting: "Setting", value: "Value",
    size: "Shift size (more than, degrees)", window: "Sample window (minutes)", minutes: "Minutes of data to look at (most recent)",
    results: "Results", measure: "Measure", data: "Data used", empty: "No one-minute readings are available right now.",
    total: "Shifts in the data", per: "Shifts per {w} minutes (average)", range: "Shifts per {w}-minute window (lowest / middle / highest)",
    none: "Windows with no shift", sizeAvg: "Average size of a shift (degrees)", vb: "Veers / backs",
    dur: "Average duration of a shift (minutes)", vbt: "Average veer-back time (minutes)",
    of: "of", na: "–", span: "Sainte-Anne-de-Bellevue, {a}–{b} Eastern ({m} minutes)",
    how: "A <strong>shift</strong> is a change of more than the chosen number of degrees from the wind direction of the previous 2 minutes that then holds for at least 2 minutes (directions are Environment Canada's one-minute averages; a missing minute breaks a shift). Once a shift is counted, the new direction becomes the starting point for the next one. A <strong>veer</strong> turns the wind clockwise and a <strong>back</strong> counterclockwise. <strong>Duration of a shift</strong> is how long the new direction lasts, from one shift to the next. <strong>Veer-back time</strong> is the time from a shift to the next shift in the opposite sense (a veer followed by a back, or the reverse). The data is the most recent stretch of the last 12 hours and is read when the page loads.",
    caveat: "Small sizes (5°) count ordinary gust-to-gust turbulence; the larger sizes show the real swings. At light wind the direction is less reliable and the count goes up.",
  },
  fr: {
    title: "Tableau des changements de direction",
    intro: "À quelle fréquence la direction du vent change, et combien de temps dure un changement, d'après le vent à la minute en direct de la station météo de Sainte-Anne-de-Bellevue (Environnement Canada). Modifiez les trois réglages du premier tableau et les résultats se mettent à jour.",
    settings: "Réglages", setting: "Réglage", value: "Valeur",
    size: "Ampleur du changement (plus de, degrés)", window: "Fenêtre d'échantillon (minutes)", minutes: "Minutes de données à examiner (les plus récentes)",
    results: "Résultats", measure: "Mesure", data: "Données utilisées", empty: "Aucune mesure à la minute n'est disponible pour le moment.",
    total: "Changements dans les données", per: "Changements par tranche de {w} minutes (moyenne)", range: "Changements par fenêtre de {w} minutes (minimum / médiane / maximum)",
    none: "Fenêtres sans changement", sizeAvg: "Ampleur moyenne d'un changement (degrés)", vb: "Virements / adonnements",
    dur: "Durée moyenne d'un changement (minutes)", vbt: "Temps moyen virement-adonnement (minutes)",
    of: "sur", na: "–", span: "Sainte-Anne-de-Bellevue, {a}–{b} heure de l'Est ({m} minutes)",
    how: "Un <strong>changement</strong> est une variation de plus du nombre de degrés choisi par rapport à la direction du vent des 2 minutes précédentes, qui tient ensuite pendant au moins 2 minutes (les directions sont les moyennes à la minute d'Environnement Canada; une minute manquante interrompt un changement). Une fois un changement compté, la nouvelle direction devient le point de départ du suivant. Un <strong>virement</strong> fait tourner le vent dans le sens horaire et un <strong>adonnement</strong>, dans le sens antihoraire. La <strong>durée d'un changement</strong> est le temps pendant lequel la nouvelle direction se maintient, d'un changement au suivant. Le <strong>temps virement-adonnement</strong> est le temps entre un changement et le suivant dans le sens opposé (un virement suivi d'un adonnement, ou l'inverse). Les données sont la période la plus récente des 12 dernières heures, lue au chargement de la page.",
    caveat: "Les petites valeurs (5°) comptent la turbulence ordinaire d'une rafale à l'autre; les plus grandes montrent les vrais balancements. Par vent faible, la direction est moins fiable et le compte augmente.",
  },
};

const PAGE_SCRIPT = `
(function(){
var sel=function(id,vals,def){var s=document.getElementById(id);vals.forEach(function(v){var o=document.createElement("option");o.value=v;o.textContent=v;if(v===def)o.selected=true;s.appendChild(o)});s.addEventListener("change",draw)};
var range=function(a,b,st){var r=[];for(var v=a;v<=b;v+=st)r.push(v);return r};
var have=D.blocks.length*D.blockMin,top=Math.max(30,Math.floor(have/30)*30);
sel("s-size",range(5,45,5),5);sel("s-win",range(10,60,10),10);sel("s-min",range(30,top,30),Math.min(240,top));
var f1=function(x){return x==null?D.T.na:x.toFixed(1)};
var hm=function(ms){return new Date(ms).toLocaleTimeString(D.locale,{hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"})};
function draw(){
 var th=+document.getElementById("s-size").value,w=+document.getElementById("s-win").value,m=+document.getElementById("s-min").value;
 var r=computeShifts(D.blocks,th,m,w,D.blockMin);
 var end=D.t0+D.blocks.length*D.blockMin*60000,start=end-r.covered*60000;
 var rows=[
  [D.T.data,D.T.span.replace("{a}",hm(start)).replace("{b}",hm(end)).replace("{m}",Math.round(r.covered))],
  [D.T.total,r.count],
  [D.T.per.replace("{w}",w),r.perWindow.toFixed(2)],
  [D.T.range.replace("{w}",w),r.min+" / "+r.median+" / "+r.max],
  [D.T.none,r.empty+" "+D.T.of+" "+r.windows],
  [D.T.sizeAvg,r.size==null?D.T.na:Math.round(r.size)+"°"],
  [D.T.vb,r.veers+" / "+r.backs],
  [D.T.dur,f1(r.duration)],
  [D.T.vbt,f1(r.veerBack)]];
 document.getElementById("res").innerHTML="<thead><tr><th scope='col'>"+D.T.measure+"</th><th scope='col'>"+D.T.value+"</th></tr></thead><tbody>"+
  rows.map(function(row){return "<tr><th scope='row'>"+row[0]+"</th><td>"+row[1]+"</td></tr>"}).join("")+"</tbody>";
}
draw();
})();`;

// rows: one-minute readings [{ t (ms), dir }] oldest first (null or [] when unavailable). ctx = { lang, page, href }.
// opts.credit: optional HTML for a credit paragraph.
export function shiftPage(ctx, rows, opts = {}) {
  const { lang } = ctx;
  setLang(lang);
  const T = TEXT[lang];
  const { blocks, t0 } = minuteBlocks(rows ?? []);
  const empty = blocks.length < 8; // fewer than 8 minutes cannot hold even one shift
  const data = { T: { ...T }, blocks, t0, blockMin: 1, locale: lang === "fr" ? "fr-CA" : "en-CA" };
  for (const k of ["how", "caveat", "intro"]) delete data.T[k];
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const tables = empty ? `<p class="note">${T.empty}</p>` : `
<h3>${T.settings}</h3>
<table class="shifts"><thead><tr><th scope="col">${T.setting}</th><th scope="col">${T.value}</th></tr></thead><tbody>
<tr><th scope="row"><label for="s-size">${T.size}</label></th><td><select id="s-size"></select></td></tr>
<tr><th scope="row"><label for="s-win">${T.window}</label></th><td><select id="s-win"></select></td></tr>
<tr><th scope="row"><label for="s-min">${T.minutes}</label></th><td><select id="s-min"></select></td></tr>
</tbody></table>
<h3>${T.results}</h3>
<table class="shifts" id="res" aria-live="polite"></table>`;
  const body = `
<div class="page">
<style>
.shifts{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}
.shifts th,.shifts td{border:1px solid var(--line);padding:.45rem .6rem;text-align:left}
.shifts thead th{background:var(--panel)}
.shifts td{font-variant-numeric:tabular-nums}
.shifts select{font:inherit;padding:.25rem .4rem;min-width:5.5rem}
</style>
<h2>${T.title}</h2>
<p>${T.intro}</p>
${tables}
<p class="note">${T.how}</p>
<p class="note">${T.caveat}</p>
${opts.credit ? `<p class="note">${opts.credit}</p>` : ""}
</div>`;
  const extra = empty ? "" : `var D=${json};var computeShifts=${computeShifts.toString()};${PAGE_SCRIPT}`;
  return layout({ ctx, title: T.title, body, extraScript: extra });
}
