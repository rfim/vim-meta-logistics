# FETTLE for Meta · VIM

An independent portfolio for Meta's **Business Solutions Engineer, Logistics** role (London), by R. Firman Insan Muhammad (VIM).

**Live:** https://rfim.github.io/vim-meta-logistics/

FETTLE is a mine-to-fix flywheel built in Crea Digital Ventures. Process mining turns ERP event logs into Petri nets. The gaps become Claude Code's context, Multica priorities and acceptance tests. Claude Code drafts the fix, a person approves it, and the log is mined again.

## Pages (each one is a row of horizontal slides: ← →, swipe or the step tabs)
| Page | What it shows |
|---|---|
| `index.html` | Hero, "Per the role" quotes, headline results, Fettle and Toast, Built with, Stated plainly |
| `story.html` | Fireside chat, operating principle, Pull up a chair, What would you do? |
| `mining.html` | Live Petri net → mined prompt → responsible-AI gate (risk, bias, accuracy, human approval) → re-mined |
| `flywheel.html` | Two-wheel loop (fitness 0.20 → 0.85), prompt before/after, review notes → rules, agent board, impact |
| `spares.html` | ROP = μL + zσ√L per part and data centre, asset lifecycle with RMA, FIFO SQL, a Tuesday at DC-C |
| `governance.html` | Responsible AI in the posting's own words, mapped to controls |
| `notebook.html` | A "Run all" workspace that computes everything in the browser |

## Stack
React 19 + TypeScript, built with Vite as a multi-page app. GitHub Actions builds and deploys it to Pages (`.github/workflows/pages.yml`). The Petri net engine (`src/lib/petri.ts`) is plain SVG with no chart library.

```bash
npm ci
npm run dev       # local development
npm run build     # type-check and build to dist/
```

## Honesty rules
- Every Meta-side number is synthetic and labelled as a synthetic sample.
- Fettle, Toast, Lifepal and Deloitte figures are measured results from my CV.
- The flywheel replay is illustrative between the measured start (0.20) and end (0.85).
- Data centre logistics is new to me.

Colour tokens were sampled from Meta's own pages, and `src/styles/meta-tone.css` notes the source of each. Meta's typeface is not used; the site uses Inter. Logo sources and licences are in `public/assets/logos/SOURCES.md`.

*An independent application, not affiliated with or endorsed by Meta.*
