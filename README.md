# Saathi

A student wellbeing research prototype that connects private check-ins, recorded trends, transparent questionnaire scoring, and practical support activities. Built for Palak Tomar.

**This is an academic prototype, not a clinical service.** It does not diagnose, predict future PHQ-9 scores, contact counselors, dispatch emergency help, or claim demographic fairness. The counselor interface is explicitly simulated. The application is functional end to end for consented device-bound records and activity progress.

## Features

- Responsive dashboard with an invented sample experience, accessible navigation, and original SVG artwork.
- Daily mood, energy, sleep, and concern check-ins.
- Optional PHQ-9 and GAD-7 questionnaires with server-side validation and versioned deterministic scoring.
- PHQ-9 item 9 support guidance independent of total score. No automated communications.
- Historical mood chart, dated record table, and JSON data export.
- Searchable support activities, a breathing timer, saved plans, and usefulness feedback.
- Explicit adult consent, 30-day device sessions, active-data deletion, and expiration cleanup.
- Separate synthetic counselor workflow with acknowledgment and follow-up states.
- Research transparency page and reproducible offline next-day mood experiments.

## Run locally

Requires Node.js 24 or later. The app, local server and tests have **zero runtime package dependencies**.

```sh
node scripts/dev.mjs
```

Open `http://127.0.0.1:8787`. SQLite data is written to ignored `.data/development.sqlite`. The local server binds only loopback and is not intended as a public hosting server.

```sh
node --test tests/*.test.mjs
node --check public/app.js
node --check public/domain.js
node --check src/worker.js
```

## Deploy to Cloudflare

Live website: https://saathi-wellbeing.raivivek395.workers.dev

The current deployment uses **Cloudflare Workers + D1**, created through the dashboard without a paid upgrade or CLI OAuth grant. Run `pnpm build:dashboard` to generate the ignored `dist/dashboard-worker.js`, paste it into this Worker's code editor and deploy. The bundle embeds the public assets and runs the same API handler. Asset requests count toward Worker usage; the free plan has usage limits and is not an unlimited hosting commitment.

The dedicated D1 database is bound as `DB`; `migrations/0001_initial.sql` initializes its schema. A daily `0 3 * * *` UTC cron invokes expiration cleanup. For another account, create its own database and update the ID. Never run the initial schema against an unrelated database.

The alternative CLI deployment uses **Workers Static Assets + D1**. API requests and static responses pass through the Worker so security headers apply consistently.

1. Install the locked development dependencies with `pnpm install --frozen-lockfile` (or `npm install` if you do not use pnpm).
2. Sign in with `npx wrangler login`. A browser session alone is not command-line authorization. Never paste access tokens into source code or chat.
3. Create a dedicated database with `npx wrangler d1 create saathi-wellbeing`.
4. Set the returned database ID in `wrangler.jsonc` (the checked-in ID identifies this project's existing database).
5. Apply the schema with `npx wrangler d1 migrations apply saathi-wellbeing --remote`.
6. Run `npx wrangler deploy --dry-run`, then `npx wrangler deploy`.
7. Verify `/api/health`, sample navigation, private-space creation, saving, refresh persistence, export and deletion on the returned HTTPS URL.

Use a dedicated Worker and database. GitHub CI runs checks and tests; it does not deploy automatically or store deployment secrets. Future deploys can use the dashboard bundle or the optional Wrangler route above.

Run `node scripts/smoke.mjs https://saathi-wellbeing.raivivek395.workers.dev` to verify HTTPS assets, copyright, secure cookies, consent, persistence, plans, isolation and deletion. It creates and deletes only its own synthetic test sessions.

## Source map

| Path | Responsibility |
|---|---|
| `public/app.js` | UI, navigation, consent flow, charts, forms and activity progress |
| `public/styles.css` | Responsive styles, keyboard focus and reduced-motion handling |
| `public/domain.js` | Instrument questions, validation, scoring and transparent matching rules |
| `src/worker.js` | API, session authorization, security headers, expiry cleanup |
| `migrations/0001_initial.sql` | Database schema, constraints and cascading deletion |
| `scripts/dev.mjs` | Local HTTP and SQLite adapter using the production handler |
| `tests/` | Score boundaries, authorization, consent, isolation and data lifecycle tests |
| `research/evaluate.py` | Offline participant-held-out regression and baseline comparison |
| `docs/ARCHITECTURE.md` | System design, privacy boundaries and deployment considerations |
| `docs/RESEARCH.md` | Dataset findings, experimental results and limitations |

Comments explain the reasons behind safety, scoring, privacy, and data decisions. Code does not disguise rules as machine learning or mark unimplemented clinical functionality as complete.

## Data policy

Source datasets, generated participant-level data, local databases, credentials and dependency caches are excluded from Git. No original survey row is bundled into the site. Only aggregate findings appear in the research page. Live visitors start with invented records or an empty private space.

The system uses pseudonymous, device-bound access. The browser cookie is HttpOnly, SameSite=Strict, and Secure on HTTPS. Only the SHA-256 hash of its 256-bit random token is stored. No cross-device recovery is provided. Hosting administrators can access the database, so this is **not end-to-end encryption**. See the in-app privacy page and architecture document for retention limitations.

## Research experiment

Install NumPy in your research environment, then run:

```sh
python research/evaluate.py --data "../Dataset_14-day_AA_depression_symptoms_mood_and_PHQ-9.csv.zip"
```

The resulting JSON is ignored by Git. The script uses participant-separated training, validation and test sets, training-only scaling, validation-selected ridge regularization, and participant bootstrap intervals. It predicts next-day mean `happiness.score`, not future PHQ-9. The model is deliberately not connected to live student decisions.

## Scope before a real institutional pilot

Clinical review, questionnaire suitability, data-use permissions, a verified support directory, staff identities and permissions, service response procedures, operational abuse controls, retention policy review, and local-user validation are still needed. The public prototype should not be represented as a staffed counseling service.

## References

- [Moodpath longitudinal study](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0244955)
- [PHQ and GAD screeners](https://www.phqscreeners.com/)
- [PSS scoring guidance](https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pssscoring.html)
- [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

No dataset redistribution license is assumed. Instrument content remains attributable to its original authors; verify applicable permissions and local clinical use before a pilot.

## Copyright

© 2026 Palak Tomar. All rights reserved. Third-party instrument content and dependencies retain their respective rights and licenses.
