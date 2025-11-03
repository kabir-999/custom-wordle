# Custom Wordle - Deploy to Vercel

Static site (HTML/CSS/JS). No server required.

## Deploy steps

1. Install Vercel CLI (optional):
   ```bash
   npm i -g vercel
   ```
2. From this folder (`custom_wordle`), run:
   ```bash
   vercel --prod
   ```
   - Accept defaults. The included `vercel.json` config serves all files statically and caches assets.

## Notes

- Files served at project root: `index.html`, `styles.css`, `script.js`, `hallowen_bg.jpg`.
- Dictionary lookups use HTTPS to `dictionaryapi.dev` (no API key). Works on Vercel.
- Cache headers are set for static assets via `vercel.json`.


