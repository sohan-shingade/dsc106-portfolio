# DSC 106 Portfolio Lab

Personal portfolio site for DSC 106 labs. Built up lab by lab.

## Deploy

- Repo: `github.com/sohan-shingade/dsc106-portfolio`
- GitHub Pages URL: `https://sohan-shingade.github.io/dsc106-portfolio/`
- Local dev: `python3 -m http.server 8000` from `lab/` root, or Live Server
- `BASE_PATH` in `global.js` switches between `/` (localhost) and `/dsc106-portfolio/` (prod). Update the prod path if the repo is renamed.

## Structure

```
lab/
  index.html           # Home
  projects/index.html  # Projects grid
  resume/index.html    # Resume
  contact/index.html   # Contact form (mailto + JS interceptor)
  style.css            # Global styles
  global.js            # Global JS module (nav, theme, form)
  images/              # Profile photo etc.
  resume.pdf
```

All HTML pages link `style.css` and `global.js` (as `type="module"`). No per-page JS.

## Labs completed

- **Lab 1**: static HTML scaffold, multi-page site with nav, photo, resume, projects, contact form.
- **Lab 2**: CSS — `oklch` accent color, flex nav with `display: contents`, CSS grid for projects + form with `subgrid`, hover states, monospace type.
- **Lab 3**: JS — `global.js` module. Auto-rendered nav with current-page highlight, dark-mode theme switcher with `localStorage` persistence, enhanced contact form (JS builds mailto URL from `FormData`), `color-scheme: light dark` on root.

## Key conventions

- Single shared `style.css` at `lab/` root. Per-page styles live there too, not inline.
- Single `global.js` module. Runs on every page. Owns nav, theme switcher, form interceptor.
- Nav is fully generated in JS — **do not** add `<nav>` markup to HTML. Add pages by editing the `pages` array in `global.js`.
- Current-page detection via `a.host === location.host && a.pathname === location.pathname`. `BASE_PATH` makes this work on GH Pages too.
- External links detected by `a.host !== location.host` → get `target="_blank"` automatically.
- Theme switcher inserted with `insertAdjacentHTML('afterbegin', ...)`, then nav `prepend`ed. Switcher ends up above nav visually; CSS positions it absolute top-right.
- Colors use `oklch()` and `color-mix(in oklch, ..., canvas ...)` so hover states adapt to dark mode via `canvas` keyword.
- Contact form: `<form data-contact action="mailto:...">`. JS listens for submit, preventDefault, builds URL from FormData + `encodeURIComponent`, sets `location.href`.
- `localStorage.colorScheme` stores the active value (`"light dark"`, `"light"`, or `"dark"`).

## Adding a new lab (future)

- Continue building on `global.js` — do not fragment into per-page scripts unless the assignment requires it.
- For data-driven features (lab 4+ likely uses D3), add them as additional module imports inside `global.js` or as page-specific modules loaded alongside `global.js`.
- Keep nav source of truth in the `pages` array.
- When adding libraries, prefer ES module CDN imports (e.g. `https://cdn.jsdelivr.net/npm/d3@7/+esm`) so everything stays static — no build step.
- Respect light+dark by using `oklch` + `canvas`/`canvastext` system colors; avoid hardcoded `#fff`/`#000`.

## Not to do

- No build step, no npm, no framework. Static files only.
- Do not re-hardcode nav in HTML.
- Do not inline styles or scripts in HTML pages.
- Do not remove `type="module"` from the script tag — `global.js` assumes module scope.
