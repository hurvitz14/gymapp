# LIFT

A sleek black-and-blue workout tracker inspired by Hevy, with step tracking, meal logging and personal-record alerts. Installable web app (PWA) on Supabase.

## Features
- **Workout logging** — routines, one-tap sets pre-filled from your last session, warm-up/drop/failure sets, auto rest timer, history
- **Personal-record alerts** — a database trigger detects a new heaviest weight or estimated 1RM on any lift, and body-weight milestones (every 5 kg toward your goal). Alerts show as an in-app banner and notification feed, and as a device notification while the app is open.
- **Steps** — daily goal ring, weekly chart, quick add
- **Meals** — calories and macros against goals, quick re-add of recent meals
- **Progress** — estimated 1RM and volume charts per lift, body-weight chart, record list
- Kg/lb units, CSV export, offline app shell

## Run locally
Any static server works, for example `python3 -m http.server` in this folder, then open http://localhost:8000.

## Deploy
Push to GitHub, then enable **Settings → Pages → Deploy from branch → main / root**.
Add the Pages URL under Supabase **Authentication → URL Configuration → Site URL**.

## Backend (Supabase)
Project `lift-app` (ref `mjfcomrwtikkiamyowww`). The schema, row-level security and PR triggers are in `supabase/migrations/`. Every table is protected by RLS, so the publishable key in `config.js` is safe to ship.

## Roadmap
- Background push when the app is closed (needs a VAPID key pair and an edge function that sends Web Push)
- Automatic step sync (needs a native wrapper for HealthKit / Health Connect)
- Progressive-overload suggestions, plate calculator, barcode meal scan
