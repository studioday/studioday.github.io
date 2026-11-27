# Tanmay Kaper — portfolio

Live at **https://studioday.github.io**

Experiences built in analysis and expression: a day sky for economics research and code, a dusk for creative work, and a deck of playing cards as the navigation.

## How it's built

Hand-written HTML, CSS and JavaScript with no framework and no npm. A small Python build (standard library only) turns `src/` into the static site.

```
src/
  content/    site, papers, creative work, tech projects, CV (JSON + paper HTML)
  templates/  page templates
  assets/     CSS, JS (components + Lenis), fonts, images, video
tools/
  build.py    src/ → site/  (hashed JS folder, versioned CSS, sitemap, manifest)
```

## Work on it locally

```bash
python3 tools/build.py
cd site && python3 -m http.server 4322
```

Then open http://localhost:4322.

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages. Nothing else to do.

**Moving to a custom domain later:** set `SITE_URL` in the workflow (and `url` in `src/content/site.json`) to the new address, add the domain under *Settings → Pages → Custom domain*, and point the domain's DNS at GitHub Pages. `wrangler.jsonc` is kept for a Cloudflare Workers move instead.

## Licences

Code © Tanmay Kaper, all rights reserved. Inter and Instrument Serif are under the SIL Open Font License; Lenis is MIT (see `src/assets/js/vendor/`).
