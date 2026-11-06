# Changelog

Every change to how the site looks or behaves is a numbered version. Each version is a git tag (`v<version>`) and is
deployed to Cloudflare with the same tag, so any of them can be brought back (see "Going back" below).
The version number is also shown at the bottom of the page.

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
