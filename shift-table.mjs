// Wind-shift table: counts sustained direction shifts in 30-second direction blocks of the NEON 1 Hz samples, with the three
// inputs (shift size, time window, minutes of data) as pull-down cells. The calculation is computeShifts(), which runs in
// the browser (its source is embedded in the page) and in Node (for testing and for shifts.mjs-style checks).
import { setLang } from "./i18n.mjs";
import { layout } from "./pages.mjs";

// blocks: direction (degrees, wind from) of each 30 s block, oldest first.
// A shift is a change of more than `thresh` degrees from the direction of the previous 2 minutes that holds for at least
// 2 minutes (each of the 4 following 30 s blocks stays more than `thresh` away on the same side). The new direction then
// becomes the baseline. Returns the counts per `bucketMin`-minute window and the average durations (minutes).
export function computeShifts(blocks, thresh, minutes, bucketMin) {
  var rad = Math.PI / 180;
  var norm = function (d) { return ((d % 360) + 360) % 360; };
  var diff = function (a, b) { return ((a - b + 540) % 360) - 180; };
  var dmean = function (ds) {
    var s = 0, c = 0;
    for (var i = 0; i < ds.length; i++) { s += Math.sin(ds[i] * rad); c += Math.cos(ds[i] * rad); }
    return norm(Math.atan2(s, c) / rad);
  };
  var HOLD = 4, n = Math.min(blocks.length, Math.floor(minutes * 2)), b = blocks.slice(0, n);
  var events = [], k = HOLD;
  while (k + HOLD <= n) {
    var ref = dmean(b.slice(k - HOLD, k)), d0 = diff(b[k], ref), held = Math.abs(d0) > thresh;
    for (var j = k; held && j < k + HOLD; j++) {
      var d = diff(b[j], ref);
      if (Math.sign(d) !== Math.sign(d0) || Math.abs(d) <= thresh) held = false;
    }
    if (held) {
      events.push({ block: k, change: diff(dmean(b.slice(k, k + HOLD)), ref) });
      k += HOLD;
    } else k++;
  }
  var windows = Math.max(1, Math.ceil(minutes / bucketMin)), per = [];
  for (var w = 0; w < windows; w++) per.push(0);
  events.forEach(function (e) { per[Math.min(windows - 1, Math.floor((e.block * 0.5) / bucketMin))]++; });
  var sorted = per.slice().sort(function (x, y) { return x - y; });
  var avg = function (xs) { return xs.length ? xs.reduce(function (a, x) { return a + x; }, 0) / xs.length : null; };
  // Duration of a shift: how long the new direction lasts, from one shift to the next (the last shift has no next one).
  // Veer/back time: the time from a shift to the next shift in the opposite sense (a veer followed by a back, or the reverse).
  var durations = [], vb = [];
  for (var i = 0; i + 1 < events.length; i++) {
    durations.push((events[i + 1].block - events[i].block) * 0.5);
    if (Math.sign(events[i + 1].change) !== Math.sign(events[i].change)) vb.push((events[i + 1].block - events[i].block) * 0.5);
  }
  return {
    count: events.length,
    perWindow: events.length / (minutes / bucketMin),
    min: sorted[0], median: sorted[Math.floor(sorted.length / 2)], max: sorted[sorted.length - 1],
    empty: per.filter(function (x) { return !x; }).length, windows: windows,
    size: avg(events.map(function (e) { return Math.abs(e.change); })),
    veers: events.filter(function (e) { return e.change > 0; }).length,
    backs: events.filter(function (e) { return e.change < 0; }).length,
    duration: avg(durations), veerBack: avg(vb),
  };
}

// Mean direction of each 30 s block of 1 Hz rows ({ dir }).
export function directionBlocks(rows) {
  const out = [];
  for (let i = 0; i + 30 <= rows.length; i += 30) {
    let s = 0, c = 0;
    for (let j = i; j < i + 30; j++) { s += Math.sin(rows[j].dir * Math.PI / 180); c += Math.cos(rows[j].dir * Math.PI / 180); }
    out.push(+(((Math.atan2(s, c) * 180 / Math.PI) + 360) % 360).toFixed(1));
  }
  return out;
}

const TEXT = {
  en: {
    title: "Wind Shift Table",
    intro: "How often the wind direction shifts, and how long a shift lasts, in the two NEON 1 Hz samples. Change the three settings in the first table and the results update.",
    settings: "Settings", setting: "Setting", value: "Value",
    size: "Shift size (more than, degrees)", window: "Time window (minutes)", minutes: "Minutes of data to look at",
    results: "Results", measure: "Measure",
    total: "Shifts in the data", per: "Shifts per {w} minutes (average)", range: "Shifts per {w}-minute window (lowest / middle / highest)",
    none: "Windows with no shift", sizeAvg: "Average size of a shift (degrees)", vb: "Veers / backs",
    dur: "Average duration of a shift (minutes)", vbt: "Average veer-back time (minutes)",
    min: "min", of: "of", na: "–",
    how: "A <strong>shift</strong> is a change of more than the chosen number of degrees from the wind direction of the previous 2 minutes that then holds for at least 2 minutes (directions are 30-second averages). Once a shift is counted, the new direction becomes the starting point for the next one. A <strong>veer</strong> turns the wind clockwise and a <strong>back</strong> counterclockwise. <strong>Duration of a shift</strong> is how long the new direction lasts, from one shift to the next. <strong>Veer-back time</strong> is the time from a shift to the next shift in the opposite sense (a veer followed by a back, or the reverse). The data starts at the beginning of each sample: 11:30 Eastern on 11 July and 13:30 Eastern on 27 July.",
    caveat: "Small sizes (5°) count a lot of ordinary turbulence at this height; the larger sizes show the real swings. Direction is approximate (see the credit below). This is a test data set, not wind on Lake of Two Mountains.",
    d1: "11 July 2024", d2: "27 July 2024",
  },
  fr: {
    title: "Tableau des changements de direction",
    intro: "À quelle fréquence la direction du vent change, et combien de temps dure un changement, dans les deux échantillons NEON à 1 Hz. Modifiez les trois réglages du premier tableau et les résultats se mettent à jour.",
    settings: "Réglages", setting: "Réglage", value: "Valeur",
    size: "Ampleur du changement (plus de, degrés)", window: "Fenêtre de temps (minutes)", minutes: "Minutes de données à examiner",
    results: "Résultats", measure: "Mesure",
    total: "Changements dans les données", per: "Changements par tranche de {w} minutes (moyenne)", range: "Changements par fenêtre de {w} minutes (minimum / médiane / maximum)",
    none: "Fenêtres sans changement", sizeAvg: "Ampleur moyenne d'un changement (degrés)", vb: "Virements / adonnements",
    dur: "Durée moyenne d'un changement (minutes)", vbt: "Temps moyen virement-adonnement (minutes)",
    min: "min", of: "sur", na: "–",
    how: "Un <strong>changement</strong> est une variation de plus du nombre de degrés choisi par rapport à la direction du vent des 2 minutes précédentes, qui tient ensuite pendant au moins 2 minutes (les directions sont des moyennes de 30 secondes). Une fois un changement compté, la nouvelle direction devient le point de départ du suivant. Un <strong>virement</strong> fait tourner le vent dans le sens horaire et un <strong>adonnement</strong>, dans le sens antihoraire. La <strong>durée d'un changement</strong> est le temps pendant lequel la nouvelle direction se maintient, d'un changement au suivant. Le <strong>temps virement-adonnement</strong> est le temps entre un changement et le suivant dans le sens opposé (un virement suivi d'un adonnement, ou l'inverse). Les données commencent au début de chaque échantillon : 11 h 30 (heure de l'Est) le 11 juillet et 13 h 30 le 27 juillet.",
    caveat: "Les petites valeurs (5°) comptent beaucoup de turbulence ordinaire à cette hauteur; les plus grandes montrent les vrais balancements. La direction est approximative (voir le crédit ci-dessous). Il s'agit d'un jeu de données d'essai, et non du vent sur le lac des Deux Montagnes.",
    d1: "11 juillet 2024", d2: "27 juillet 2024",
  },
};

const PAGE_SCRIPT = `
(function(){
var sel=function(id,vals,def){var s=document.getElementById(id);vals.forEach(function(v){var o=document.createElement("option");o.value=v;o.textContent=v;if(v===def)o.selected=true;s.appendChild(o)});s.addEventListener("change",draw)};
var range=function(a,b,st){var r=[];for(var v=a;v<=b;v+=st)r.push(v);return r};
sel("s-size",range(5,45,5),5);sel("s-win",range(10,60,10),10);sel("s-min",range(30,240,30),240);
var f1=function(x){return x==null?D.T.na:x.toFixed(1)};
function cell(r,k){return r[k]}
function draw(){
 var th=+document.getElementById("s-size").value,w=+document.getElementById("s-win").value,m=+document.getElementById("s-min").value;
 var res=D.days.map(function(d){return computeShifts(d.blocks,th,m,w)});
 var rows=[
  [D.T.total,function(r){return r.count}],
  [D.T.per.replace("{w}",w),function(r){return r.perWindow.toFixed(2)}],
  [D.T.range.replace("{w}",w),function(r){return r.min+" / "+r.median+" / "+r.max}],
  [D.T.none,function(r){return r.empty+" "+D.T.of+" "+r.windows}],
  [D.T.sizeAvg,function(r){return r.size==null?D.T.na:Math.round(r.size)+"°"}],
  [D.T.vb,function(r){return r.veers+" / "+r.backs}],
  [D.T.dur,function(r){return f1(r.duration)}],
  [D.T.vbt,function(r){return f1(r.veerBack)}]];
 document.getElementById("res").innerHTML="<thead><tr><th scope='col'>"+D.T.measure+"</th>"+D.days.map(function(d){return "<th scope='col'>"+d.label+"</th>"}).join("")+"</tr></thead><tbody>"+
  rows.map(function(row){return "<tr><th scope='row'>"+row[0]+"</th>"+res.map(function(r){return "<td>"+row[1](r)+"</td>"}).join("")+"</tr>"}).join("")+"</tbody>";
}
draw();
})();`;

// days: [{ label, blocks }]. ctx = { lang, page, href }. credit: HTML credit paragraph.
export function shiftPage(ctx, days, credit) {
  const { lang } = ctx;
  setLang(lang);
  const T = TEXT[lang];
  days = days.map((d, i) => ({ ...d, label: d.label ?? T["d" + (i + 1)] }));
  const data = { T: { ...T }, days };
  for (const k of ["how", "caveat", "intro"]) delete data.T[k];
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const body = `
<div class="page">
<style>
.shifts{border-collapse:collapse;width:100%;margin:.5rem 0 1rem}
.shifts th,.shifts td{border:1px solid var(--line);padding:.45rem .6rem;text-align:left}
.shifts thead th{background:var(--soft,rgba(128,128,128,.12))}
.shifts td{font-variant-numeric:tabular-nums}
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
<table class="shifts" id="res" aria-live="polite"></table>
<p class="note">${T.how}</p>
<p class="note">${T.caveat}</p>
<p class="note">${credit}</p>
</div>`;
  const extra = `var D=${json};var computeShifts=${computeShifts.toString()};${PAGE_SCRIPT}`;
  return layout({ ctx, title: T.title, body, extraScript: extra });
}
