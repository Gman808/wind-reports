# Changelog

Every change to how the site looks or behaves is a numbered version. Each version is a git tag (`v<version>`) and is
deployed to Cloudflare with the same tag, so any of them can be brought back (see "Going back" below).
The version number is also shown at the bottom of the page.

## 1.6 — Tempest wind logger (branch `tempest-logger`, not deployed)
- A Durable Object (`logger.mjs`, SQLite) that records a Tempest's rapid wind (about every 3 s) over WeatherFlow's WebSocket for a session
  of 1 to 24 hours (default 4). Control: `POST /api/logger/start?hours=4` and `/api/logger/stop` with `Authorization: Bearer <LOGGER_KEY>`;
  `GET /api/logger/status` and `/api/logger/csv?hours=4` are open.
- A page for the log, `/wind-log` and `/fr/journal-du-vent`, using the Wind Chart (not in the menu): blue wind line and arrows, blue-purple gust
  line and arrows (strongest reading within the surrounding minute), last four hours.
- Setup: `wrangler secret put LOGGER_KEY`, set `LOGGER_STATION_ID` in wrangler.toml to the on-the-water station (TEMPEST_TOKEN must be
  authorized for it; the default 59196 is the indoor CVL sensor, which reads zero wind). Pure helpers are in `logger-core.mjs`.

## 1.5 — Wind Chart
- **Other Wind Sites** now starts with the Windguru forecast table for the spot (embedded above Windy).
- `analyze.mjs`: wind-shift and gust analysis of the NEON 1 Hz sample (not part of the site).
- Wind Chart: blue-purple solid gust line with arrows (gust direction), and the chart is twice as tall (52 rem) so the gap between wind and gusts is easier to see.

- New page **Wind Chart** (`/wind-chart`, `/fr/graphique-du-vent`): the last four hours of one-minute wind from the Sainte-Anne-de-Bellevue
  station as a line chart with an arrow at each point showing which way the wind blows, a gust line, drag-to-zoom and tooltips.
  Technique after tkurki's Grafana ECharts gist; drawn with Apache ECharts 5.6.0.

## 1.3 — Other Wind Sites
- New page **Other Wind Sites** (`/other-wind-sites`, `/fr/autres-sites-de-vent`), linked from the menu: Windy.com with a
  short explanation, a link, and Windy's embedded wind map centred on the lake (45.476, -74.143, zoom 14, knots).
- Also on that page: SailFlow's Hudson Sailing Area report and forecast chart (spot 679871), embedded.

## 1.2.1 — fix
- About and Data Sources could come out in the wrong language (the language was only set by the home page); every page now
  sets its own language before building.

## 1.2 — Lake of Two Mountains Wind Report: French, menu, pages, text size
- The site is now titled **Lake of Two Mountains Wind Report** (*Rapport des vents du lac des Deux Montagnes*).
- Full **French version** (`/fr`) alongside English: every label, table, weather description, compass point (O for west) and
  the unit (nd for nœuds). The email stays in English.
- "Last 4 Readings" is now **Details from the last Hour**.
- **Three-line menu button** with Français / English at the top, About, Details from the last Hour, Wind Timeline and
  Data Sources. It is a details element, so it also works without JavaScript.
- Two new pages, each in both languages: **About** (`/about`, `/fr/a-propos`) and **Data Sources**
  (`/data-sources`, `/fr/sources-de-donnees`), which names each source, links to it and explains how it is used.
- **Text size buttons** (A− / A+) in the header; the choice is remembered in the browser.
- **Readability CSS:** location data as label/value lists, aligned digits, striped rows with a hover highlight, a divider
  between locations in the Wind Timeline, visible keyboard focus, larger tap targets, reduced-motion support.
- Code split into `i18n.mjs` (text), `pages.mjs` (layout, menu, About, Data Sources) and `weather.mjs` (data and tables).

## 1.1 — scroll containers and mobile grid snap
- Every table now sits in a **scroll container**: it scrolls inside its own box (up to 70% of the screen height), with the
  header rows and the Time column kept in view.
- **Mobile CSS grid snap** on the Wind Timeline: on a phone (640px wide or less) the table scrolls sideways one location
  at a time, each location's three columns snapping in beside the Time column.
- Colours moved into CSS variables (light and dark); the version number is shown at the bottom of the page.

## 1.0 — base
The starting point for all later versions (git tag `v1.0-base`, Cloudflare version `d6fb4a41`):
- Current conditions for Hudson (HYC), Pointe-aux-Anglais (CVL) and Sainte-Anne-de-Bellevue (Weather Station).
- Last 4 Readings, the Wind Timeline (historical readings, a Now row, 12 hours of forecast) and the Five Day Forecast.
- Runs on a Cloudflare Worker: fresh data on every page load, logs recorded every 15 minutes.

## Going back
- Code: `git checkout v1.0-base` (or any `v1.x` tag), or `git revert` the commit that introduced a change.
- Live site: `npx wrangler rollback <version-id>` (list versions with `npx wrangler deployments list`), then redeploy
  from the tag with `npx wrangler deploy` if you want the code and the live site to match.

## Making the next version
1. Change the code and set `VERSION` in `weather.mjs`.
2. Add an entry at the top of this file.
3. Commit, then `git tag -a v<version> -m "<summary>"` and `git push origin main v<version>`.
4. `npx wrangler deploy --tag v<version> --message "<summary>"`.
