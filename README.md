# TGEAPCET 2026 — College Predictor

A free, frontend-only React website that helps TGEAPCET students find eligible
colleges based on their rank, caste category, and gender.

## Features
- 942 college-branch combinations from the 2025 last rank statements.
- Filter by district, branch, and college type
- Sortable results table (click column headers)
- Safe / Borderline / Tight chance badges
- Print / Save as PDF (browser print)
- Works 100% in the browser — no backend needed

---

## Project structure

```
tgeapcet-predictor/
├── src/
│   ├── App.jsx       ← Main component (all filtering logic)
│   ├── data.js       ← 942 college records (generated from PDF)
│   ├── index.css     ← All styles
│   └── main.jsx      ← React entry point
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## Updating data each year

1. Get the new PDF from the official TGEAPCET website
2. Run `python3 extract_tgeapcet.py` (converts PDF → CSV)
3. Run `python3 convert_to_json.py` (converts CSV → src/data.js)
4. Run `npm run deploy`

---

## Tech stack
| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool (fast dev server) |
| gh-pages | Deploy to GitHub Pages |
| No backend | All filtering runs in the browser |

---

*Built with real TGEAPCET 2025 First Phase Last Rank Statement data.*
