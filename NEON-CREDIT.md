# NEON data credit

Anything produced from the NEON data (charts, tables, analysis, pages, write-ups) must carry this credit.

> NEON (National Ecological Observatory Network). Bundled data products - eddy covariance (DP4.00200.001), RELEASE-2026.
> Dataset accessed from https://data.neonscience.org/data-products/DP4.00200.001/RELEASE-2026 on November 9, 2026.
> Data archived at https://doi.org/10.48443/xymh-2v16

- Site: SERC (Smithsonian Environmental Research Center, Mid-Atlantic Domain D02), basic package, 2024-07.
- These are released (not provisional) data, so the citation uses the release's DOI, not the "provisional" wording from NEON's
  template. The DOI comes from the NEON API (`/api/v0/products/DP4.00200.001?release=RELEASE-2026`).
- NEON's data policy and citation guidelines: https://www.neonscience.org/data-policy
- The downloaded files are kept in `NEON_eddy-flux/` (not committed to git; about 150 MB).

## 1 Hz sample (27 July 2024)
- Raw 20 Hz sonic data (L0', tower-top sensor, SERC, 2024-07-27) from NEON's public file store, documented in "EC L0 prime data:
  download instructions" (https://data.neonscience.org/api/v0/documents/EC_L0P_Download_Inst_vB). Same credit as above (DP4.00200.001).
- Wind direction oriented against the 2D wind product (DP1.00001.001, RELEASE-2026), DOI https://doi.org/10.48443/d4h5-ys70.
  Cite it wherever the direction is shown.
- Averaged here to 1 Hz (mean of the 20 readings in each second); direction rotated to match the 2D wind direction (about ±14°).
- Pages that show it: `neon-sample.mjs` builds `site/neon-serc-2024-07-27*.html` locally. The raw and 1 Hz files stay in `NEON_20Hz/`.

## 1 Hz sample (11 July 2024)
- Same source, processing and credit as the 27 July sample (raw 20 Hz tower-top sonic, DP4.00200.001; direction oriented with DP1.00001.001).
- Window 11:30–15:30 Eastern (15:30–19:30 UTC). Build with `node neon-sample.mjs 2024-07-11`; analysis with `node analyze.mjs 2024-07-11`.
