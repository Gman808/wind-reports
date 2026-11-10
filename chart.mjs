// Wind Chart page: wind speed as a line, with an arrow at each point showing which way the wind is blowing.
// The technique (an Apache ECharts line chart whose point markers are rotated arrows) is the one tkurki shared for the
// Volkov Labs ECharts panel in Grafana: https://gist.github.com/tkurki/0bb07f29987cc2af471b5e44706b00b4
import { KN, compassPoint, setLang, t } from "./i18n.mjs";
import { layout } from "./pages.mjs";

const ECHARTS = "https://cdnjs.cloudflare.com/ajax/libs/echarts/5.6.0/echarts.min.js";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ext = (url, label) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;

// Text that only this page uses.
const TEXT = {
  en: {
    title: "Wind Chart", alt: "Wind speed and direction over time", empty: "No one-minute readings are available right now.",
    gustFrom: "Gust from", zoom: "Zoom", reset: "Reset", save: "Save as image",
    noChart: "The chart could not be loaded. Check your connection and refresh the page.",
    how: "How to read it: each arrow points the way the wind is blowing toward (a west wind gives an arrow pointing right). The solid blue line and arrows are the average wind speed for the minute; the solid blue-purple line and arrows are the strongest gust within that minute, so the gap between them shows how gusty the wind is. Drag across the chart to zoom, and hover or tap a point for the details.",
    technique: 'The arrow-on-a-line chart follows the technique shared by {gist} for the {volkov} panel in Grafana, drawn here with {echarts}.',
  },
  fr: {
    title: "Graphique du vent", alt: "Vitesse et direction du vent dans le temps", empty: "Aucune mesure à la minute n'est disponible pour le moment.",
    gustFrom: "Rafale de", zoom: "Zoom", reset: "Réinitialiser", save: "Enregistrer l'image",
    noChart: "Le graphique n'a pas pu être chargé. Vérifiez votre connexion et actualisez la page.",
    how: "Comment le lire : chaque flèche pointe vers où le vent souffle (un vent d'ouest donne une flèche vers la droite). La ligne pleine bleue et ses flèches sont la vitesse moyenne du vent pour la minute; la ligne pleine violet bleuté et ses flèches sont la plus forte rafale de cette minute, et l'écart entre les deux montre à quel point le vent est rafaleux. Faites glisser sur le graphique pour zoomer, et survolez ou touchez un point pour les détails.",
    technique: 'Le graphique à flèches suit la technique partagée par {gist} pour le panneau {volkov} de Grafana, dessiné ici avec {echarts}.',
  },
};

// Runs in the browser. `D` holds the rows and the translated labels.
const CHART_SCRIPT = `
(function(){
var el=document.getElementById("wind-chart");
if(!window.echarts){el.outerHTML='<p class="note">'+D.L.noChart+'</p>';return}
var css=getComputedStyle(document.documentElement),col=function(n){return css.getPropertyValue(n).trim()};
var text=col("--text")||"#1b1f24",line=col("--line")||"#d5dbe1",accent="#1f6fd1",gustCol="#8c7ae6";
// An arrow that points right (east) at rotation 0.
var ARROW="path://M0,6 L14,6 L14,1 L24,10 L14,19 L14,14 L0,14 Z";
var rows=D.rows,chart=echarts.init(el);
var compass=function(d){return d==null?"–":D.compass[Math.round(d/22.5)%16]+" ("+Math.round(d)+"°)"};
// The wind is "from" dir, so it blows toward dir+180. echarts rotates symbols counter-clockwise: an arrow facing
// east turned to a compass bearing B needs (90 - B) degrees.
var rot=function(d){return d==null?0:90-((d+180)%360)};
function step(n){return Math.max(1,Math.ceil(n/D.maxArrows))}
function arrows(first,last){var s=step(last-first+1);return function(v,p){return (p.dataIndex%s===0)&&rows[p.dataIndex].dir!=null?16:0}}
var hasGust=rows.some(function(r){return r.gust!=null});
var avg=rows.map(function(r){return {value:[r.t,r.wind==null?null:+r.wind.toFixed(1)],symbolRotate:rot(r.dir)}});
var gust=rows.map(function(r){return {value:[r.t,r.gust==null?null:+r.gust.toFixed(1)],symbolRotate:rot(r.gustDir)}});
// Blue-purple arrows on the gust line, thinned like the wind arrows; none where there is no gust direction.
function gustArrows(first,last){var s=step(last-first+1);return function(v,p){return (p.dataIndex%s===0)&&rows[p.dataIndex].gustDir!=null?16:0}}
chart.setOption({
 backgroundColor:"transparent",textStyle:{color:text},
 tooltip:{trigger:"axis",formatter:function(ps){var i=ps[0].dataIndex,r=rows[i];
  return new Date(r.t).toLocaleTimeString(D.locale,D.fine?{hour:"2-digit",minute:"2-digit",second:"2-digit",fractionalSecondDigits:2,timeZone:"America/Toronto"}:{hour:"2-digit",minute:"2-digit",timeZone:"America/Toronto"})+"<br>"+
   D.L.wind+": <b>"+(r.wind==null?"–":r.wind.toFixed(1))+" "+D.unit+"</b><br>"+
   D.L.from+": <b>"+compass(r.dir)+"</b>"+
   (hasGust?"<br>"+D.L.gust+": <b>"+(r.gust==null?"–":r.gust.toFixed(1))+" "+D.unit+"</b>":"")+
   (r.gustDir==null?"":"<br>"+D.L.gustFrom+": <b>"+compass(r.gustDir)+"</b>")}},
 legend:{left:0,bottom:0,data:hasGust?[D.L.wind,D.L.gust]:[D.L.wind],textStyle:{color:text}},
 toolbox:{right:8,feature:{dataZoom:{yAxisIndex:"none",title:{zoom:D.L.zoom,back:D.L.reset}},restore:{title:D.L.reset},saveAsImage:{title:D.L.save}},iconStyle:{borderColor:text}},
 dataZoom:[{type:"inside"}],
 xAxis:{type:"time",axisLabel:{color:text},axisLine:{lineStyle:{color:line}},splitLine:{show:false}},
 yAxis:{type:"value",min:0,name:D.unit,nameTextStyle:{color:text},axisLabel:{color:text},splitLine:{lineStyle:{color:line}}},
 grid:{left:8,right:16,top:36,bottom:40,containLabel:true},
 series:[
  {name:D.L.wind,type:"line",data:avg,symbol:ARROW,symbolSize:arrows(0,rows.length-1),showSymbol:true,
   itemStyle:{color:accent},lineStyle:{width:1.5,color:accent},areaStyle:{opacity:0.25,color:accent},z:3},
  hasGust?{name:D.L.gust,type:"line",data:gust,symbol:ARROW,symbolSize:gustArrows(0,rows.length-1),showSymbol:true,itemStyle:{color:gustCol},lineStyle:{width:1.5,color:gustCol},areaStyle:{opacity:0.22,color:gustCol},z:2}:{type:"line",data:[]}
 ]});
// Zooming in shows fewer minutes, so draw an arrow for every point; zoomed out, thin them out.
chart.on("datazoom",function(){var o=chart.getOption().dataZoom[0],n=rows.length,a=Math.round(o.start/100*(n-1)),b=Math.round(o.end/100*(n-1));
 chart.setOption({series:hasGust?[{symbolSize:arrows(a,b)},{symbolSize:gustArrows(a,b)}]:[{symbolSize:arrows(a,b)}]})});
window.addEventListener("resize",function(){chart.resize()});
})();`;

// rows: [{ t (ms), wind, gust, dir, gustDir }] oldest first, wind in knots. ctx = { lang, page, href }.
// opts.source / opts.credit: HTML for the "Data" paragraph and an extra credit line.
export function chartPage(ctx, rows, opts = {}) {
  const { lang } = ctx;
  setLang(lang);
  const T = TEXT[lang];
  const L = {
    wind: t("Wind"), gust: t("Gusts"), from: t("From"), gustFrom: T.gustFrom, zoom: T.zoom, reset: T.reset, save: T.save, noChart: T.noChart,
  };
  const compass = [...Array(16)].map((_, i) => compassPoint(i));
  const data = { rows, L, compass, unit: KN(), locale: lang === "fr" ? "fr-CA" : "en-CA", maxArrows: 48, fine: !!opts.fine };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const empty = !rows?.length;
  const body = `
<div class="page">
<h2>${esc(opts.title ?? T.title)}</h2>
<p>${opts.intro ?? ""}</p>
${empty ? `<p class="note">${esc(T.empty)}</p>` : `<div id="wind-chart" class="chart" role="img" aria-label="${esc(T.alt)}"></div>`}
<p class="note">${opts.how ?? T.how}</p>
${opts.credit ? `<p class="note">${opts.credit}</p>` : ""}
<p class="note">${T.technique.replace("{gist}", ext("https://gist.github.com/tkurki/0bb07f29987cc2af471b5e44706b00b4", "tkurki"))
    .replace("{volkov}", ext("https://volkovlabs.io/plugins/volkovlabs-echarts-panel/", "Volkov Labs"))
    .replace("{echarts}", ext("https://echarts.apache.org/", "Apache ECharts"))}</p>
</div>`;
  const extra = empty ? "" : `var D=${json};${CHART_SCRIPT}`;
  // ECharts is loaded just before the page script; if it is blocked the chart area shows a message instead.
  const html = layout({ ctx, title: opts.title ?? T.title, body, extraScript: extra });
  const at = html.lastIndexOf("<script>");
  return empty ? html : `${html.slice(0, at)}<script src="${ECHARTS}"></script>\n${html.slice(at)}`;
}
