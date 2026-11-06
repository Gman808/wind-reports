# Changelog

Every change to how the site looks or behaves is a numbered version. Each version is a git tag (`v<version>`) and is
deployed to Cloudflare with the same tag, so any of them can be brought back (see "Going back" below).
The version number is also shown at the bottom of the page.

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
