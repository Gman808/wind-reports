// The Lake of Two Mountains Wind Report logo (version 14): two mountains, two J/22 sailboats, wind and wave lines.
// The files in public/ (logo.svg, favicon.svg, logo.png, ...) are generated from these pieces.

const WIND_AND_WAVES = `<g fill="none" stroke="#7db7f5" stroke-width="6" stroke-linecap="round">
<path d="M168 56 Q193 38 218 56 T268 56M168 78 Q193 60 218 78 T268 78M438 56 Q463 74 488 56 T538 56M438 78 Q463 96 488 78 T538 78"/>
<path d="M168 236 Q193 218 218 236 T268 236M438 236 Q463 254 488 236 T538 236"/>
<path d="M168 258 Q194.4 240 220.9 258 T273.7 258 T326.6 258 T379.4 258 T432.3 258 T485.1 258 T538 258"/>
</g>`;

const MOUNTAINS = `<polygon points="168,205 318,65 468,205" fill="#0b5cad"/><polygon points="238,205 388,65 538,205" fill="#0b5cad"/>`;

const boat = (transform) => `<g transform="${transform}"><path d="M214 224 L330 220 L316 238 L214 238 Z" fill="#1b3a5c"/>
<path d="M285 126 Q270 180 228 219 H285 Z M290 148 Q312 188 322 218 H290 Z" fill="#fff" stroke="#1b3a5c" stroke-width="2" stroke-linejoin="round"/>
<path d="M287 126 V224" stroke="#1b3a5c" stroke-width="3" stroke-linecap="round"/></g>`;

const BOATS = boat("translate(60,-10)") + "\n" + boat("translate(105,-4)");

// The full logo: x 160-546, y 40-278. `attrs` goes on the <svg> element.
export const logoSvg = (attrs = "") =>
  `<svg ${attrs} viewBox="160 40 386 238">\n${WIND_AND_WAVES}\n${MOUNTAINS}\n${BOATS}\n</svg>`;

// Favicon: a white rounded square with the mountains, boats and two thicker wave lines (the thin wind lines vanish at 16-32 px).
export const faviconSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="153 -23 400 400">
<rect x="153" y="-23" width="400" height="400" rx="60" fill="#fff"/>
<g transform="translate(0,-9)">
<g fill="none" stroke="#7db7f5" stroke-width="12" stroke-linecap="round">
<path d="M168 262 Q194.4 244 220.9 262 T273.7 262 T326.6 262 T379.4 262 T432.3 262 T485.1 262 T538 262"/>
<path d="M168 292 Q194.4 274 220.9 292 T273.7 292 T326.6 292 T379.4 292 T432.3 292 T485.1 292 T538 292"/>
</g>
${MOUNTAINS}
${BOATS}
</g>
</svg>`;
