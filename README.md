# FMGE 75-Day Study Planner

A single-page, offline-friendly study planner for FMGE preparation. It runs entirely in the browser and stores progress in `localStorage` — no account, backend, or tracking.

## Features

- **Dashboard** — days/subjects/GT completion, MCQ total and accuracy, exam countdown, daily MCQ target.
- **19 subjects** — one main revision platform, reference book, covered/pending notes, completion checklist.
- **75-day plan** — phase overview plus a day-by-day tracker with calendar dates.
- **Grand Tests** — 8 GT slots, score and analysis tracking, subject-wise percentages with automatic OK / Watch / +1 revision flags.
- **Wrong-question notebook** — four mistake categories, notes and next actions.
- **Daily log & focus timer** — study time, MCQ accuracy, history, Pomodoro/stopwatch/custom timer that survives reloads.
- **Backup** — JSON export/import with validation and confirmation before replacing data.
- **Accessible & responsive** — keyboard-navigable tabs, labelled fields, print-friendly layout, mobile breakpoints.

## Run locally

The app is plain HTML/CSS/JS, so any static server works:

```bash
python -m http.server 8765
# open http://127.0.0.1:8765/
```

## Deploy

The repository root is a static site, so it can be imported directly into Vercel with no build step. `index.html` is the entry point.

## Data & privacy

All data stays in the browser's `localStorage` on the current device. Export a backup before changing browsers or clearing site data. The legacy single-file version of the planner is preserved in `archive/` for reference.
