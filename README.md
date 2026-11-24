# FETTLE for Meta · VIM

An independent portfolio for Meta's **Business Solutions Engineer, Logistics** role (London), by R. Firman Insan Muhammad (VIM).

**Live:** https://rfim.github.io/vim-meta-logistics/

FETTLE is a mine-to-fix flywheel built in Crea Digital Ventures. Process mining turns ERP event logs into Petri nets. The gaps become Claude Code's context, Multica priorities and acceptance tests. Claude Code drafts the fix, a person approves it, and the log is mined again.

## Pages (each one is a row of horizontal slides: ← →, swipe or the step tabs)
| Page | What it shows |
|---|---|
| `index.html` | **The story (landing page):** fireside chat, operating principle, Pull up a chair, What would you do? |
| `overview.html` | Name first, "Per the role" quotes, **the Fettle process in one loop**: flywheel map → 1 Mine (live Petri net) → 2 Measure (fitness) → 3 Prompt → 4 Agents draft → 5 Human gate (responsible AI) → 6 Re-mine → 7 Learn → results, Fettle and Toast, logos, Stated plainly. `flywheel.html` and `mining.html` redirect here. |
| `fettle.html` | Fettle results, the **Python** process miner and the **React** Petri net source |
| `toast.html` | Toast results, plus **PostgreSQL** for the audit trail, lot traceability (concept) and FIFO |
| `nexus.html` | Nexus (Lifepal) results and path, plus **Databricks SQL / dbt** for the CDC merge, quality holds and Gold |
| `spares.html` | ROP = μL + zσ√L per part and data centre, asset lifecycle with RMA, FIFO SQL, a Tuesday at DC-C |
| `governance.html` | Responsible AI in the posting's own words, mapped to controls |
| `notebook.html` | A "Run all" workspace that computes everything in the browser |

Flywheel animation previews: `docs/flywheel-options/*.gif`. Open `overview.html?style=eight|ring|track#flywheel` to pick one.

## Code
- `code/python/fettle_mine.py`: event log → directly-follows graph → variants → waits → token-replay fitness → context pack (standard library only; run `python3 code/python/fettle_mine.py`)
- `code/sql/toast/*.sql`: PostgreSQL audit trail with a human-approval trigger, lot traceability, FIFO pick
- `code/sql/nexus/*.sql`: Databricks CDC merge (newest LSN wins), 3σ volume hold and critical checks, dbt Gold model

The SQL and Python were written for this portfolio to show the patterns. They are not production code from Crea Digital Ventures or Lifepal.

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
