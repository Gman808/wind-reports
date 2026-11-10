// English / French text for the site. The English wording is the key; setLang("fr") makes t() return the French.
// Rendering is synchronous, so a module-level language is safe (nothing else runs between setLang and the end of a render).
let lang = "en";
export const setLang = (l) => { lang = l === "fr" ? "fr" : "en"; };
export const getLang = () => lang;
export const locale = () => (lang === "fr" ? "fr-CA" : "en-CA");

const FR = {
  // page and section titles
  "Lake of Two Mountains Wind Report": "Rapport des vents du lac des Deux Montagnes",
  "Current Conditions": "Conditions actuelles",
  "Details from the last Hour": "Détails de la dernière heure",
  "Wind Timeline": "Chronologie du vent",
  "Five Day Forecast": "Prévisions sur cinq jours",
  "Historical Wind Readings": "Relevés de vent passés",
  "Forecasted Wind": "Vent prévu",
  "Weather Station": "station météo",
  "About": "À propos",
  "Data Sources": "Sources des données",
  "Other Wind Sites": "Autres sites de vent",
  "Wind Chart": "Graphique du vent",
  "Wind Shift Table": "Tableau des changements de direction",
  "Menu": "Menu",
  "Language": "Langue",
  "Smaller text": "Texte plus petit",
  "Larger text": "Texte plus grand",
  "Version": "Version",
  "Weather data": "Données météo",
  // header line
  "Last updated": "Dernière mise à jour",
  "(Eastern)": "(heure de l'Est)",
  "Refresh": "Actualiser",
  "just now": "à l'instant",
  // table headings and cells
  "Time": "Heure", "Temp": "Temp.", "Wind": "Vent", "Gusts": "Rafales", "From": "Provenance",
  "Day": "Jour", "Conditions": "Conditions", "Low / High": "Min / Max", "Precip": "Précip.",
  "Now": "Maintenant", "Today": "Aujourd'hui", "n/a": "s. o.",
  // list labels
  "Source": "Source", "Temperature": "Température", "Wind speed": "Vitesse du vent", "Wind gusts": "Rafales",
  "Wind from": "Provenance du vent", "Pressure": "Pression", "Humidity": "Humidité", "Rain today": "Pluie aujourd'hui",
  "Rain past hour": "Pluie (dernière heure)", "Last reading": "Dernière mesure", "Status": "État", "feels like": "ressenti",
  // sources and notes
  "Hudson Yacht Club weather station": "Station météo du Hudson Yacht Club",
  "Open-Meteo model (club station unavailable)": "Modèle Open-Meteo (station du club indisponible)",
  "Environment Canada, Sainte-Anne-de-Bellevue station": "Environnement Canada, station de Sainte-Anne-de-Bellevue",
  "Club de Voile des Laurentides weather station (Tempest)": "Station météo du Club de voile des Laurentides (Tempest)",
  "Club de Voile des Laurentides weather station (from cvl.qc.ca)": "Station météo du Club de voile des Laurentides (selon cvl.qc.ca)",
  "Station data unavailable right now": "Données de la station indisponibles pour le moment",
  "One reading per update, about 15 minutes apart. Each station's own reading time is shown.":
    "Une mesure par mise à jour, environ aux 15 minutes. L'heure propre à chaque station est indiquée.",
  "No station reading yet: Hudson's outdoor sensors aren't reporting.":
    "Aucune mesure de la station pour l'instant : les capteurs extérieurs de Hudson ne transmettent pas.",
  "No station reading yet.": "Aucune mesure de la station pour l'instant.",
  // pressure trend (WeatherLink wording, lower-cased)
  "steady": "stable", "falling": "en baisse", "rising": "en hausse", "falling slowly": "en baisse lente",
  "falling rapidly": "en baisse rapide", "rising slowly": "en hausse lente", "rising rapidly": "en hausse rapide",
  // weather descriptions
  "Clear": "Dégagé", "Mostly clear": "Plutôt dégagé", "Partly cloudy": "Partiellement nuageux", "Overcast": "Couvert",
  "Fog": "Brouillard", "Freezing fog": "Brouillard givrant", "Light drizzle": "Bruine légère", "Drizzle": "Bruine",
  "Heavy drizzle": "Forte bruine", "Freezing drizzle": "Bruine verglaçante", "Light rain": "Pluie légère", "Rain": "Pluie",
  "Heavy rain": "Forte pluie", "Freezing rain": "Pluie verglaçante", "Light snow": "Faible neige", "Snow": "Neige",
  "Heavy snow": "Forte neige", "Snow grains": "Neige en grains", "Rain showers": "Averses de pluie",
  "Violent showers": "Averses violentes", "Snow showers": "Averses de neige", "Heavy snow showers": "Fortes averses de neige",
  "Thunderstorm": "Orage", "Thunderstorm w/ hail": "Orage avec grêle",
};
export const t = (s) => (lang === "fr" ? FR[s] ?? s : s);

// Wind speed unit: knots are "kn" in English and "nd" (nœuds) in French.
export const KN = () => (lang === "fr" ? "nd" : "kn");

// Compass points; in French West is O (ouest).
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const COMPASS_FR = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export const compassPoint = (i) => (lang === "fr" ? COMPASS_FR : COMPASS)[i];

// "x minutes ago" strings for the page's live age counter (the browser script cannot call t()).
export const AGE_TEXT = {
  en: { now: "just now", one: "1 minute ago", mins: "{n} minutes ago", hours: "{n} hours ago" },
  fr: { now: "à l'instant", one: "il y a 1 minute", mins: "il y a {n} minutes", hours: "il y a {n} heures" },
};
