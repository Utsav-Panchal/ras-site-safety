# RAS Site Safety Forms

A small web app for the RAS Junior Software Developer assessment.
Framers fill in a daily safety form (with photos) on their phone. Admins review who submitted, on which site, and when.

| | |
|---|---|
| **Frontend** | React 18, Vite, React Router, plain CSS |
| **Backend** | Node.js + Express, running as a **Netlify Function** (`serverless-http`) |
| **Database** | PostgreSQL (hosted on Neon). Photos are stored in the database (`bytea`) |
| **Auth** | Username + password, bcrypt hashes, JWT bearer token, role checks on the server |
| **Hosting** | Netlify (site + function). Neon for PostgreSQL |

- Live app: https://fancy-puffpuff-699f43.netlify.app/
- Repository: https://github.com/Utsav-Panchal/ras-site-safety.git
- ERD: [docs/erd.pdf](docs/erd.pdf)

## Test credentials

| Role | Username | Password |
|---|---|---|
| Admin (supervisor) | `admin` | `admin123` |
| Framer | `marcus` | `framer123` |
| Framers (more) | `priya`, `dan`, `sofia`, `liam` | `framer123` |

These are demo accounts for a demo database only.

## What it does

1. **Auth and roles.** Sign up, log in, two roles: Framer and Admin. Framers can only create and read their own forms. Admins can read everything. The rules are enforced **on the server**, not only hidden in the UI.
2. **Safety form.** Site, date, worker name from the login, 8 checklist items, notes, and 1 to 5 photos. Validation in the browser and again on the server. Clear success screen and error messages. The worker side is mobile first.
3. **Admin dashboard.**
   - Submissions list with worker, site, date, status, filters (site, worker, date range, status, text search) and pagination. Filters live in the URL.
   - Detail view with the checklist, notes and photos (click to enlarge).
   - **Admin actions:** mark a flagged form as resolved, add private follow-up notes, delete a form (with a confirmation popup), delete several at once, export the filtered list to CSV.
   - Summary: compliance rate, compliance by site, who submitted today, who is missing, most missed items, open follow-ups, last 7 or 30 days chart, activity log.
4. **Sites (admin).** The admin **Sites** page adds, edits, archives and restores job sites. New sites show in the framers' dropdown right away. Archived sites disappear from the dropdown but keep their old forms.
5. **Data.** `npm run seed` creates 1 admin, 5 framers, 4 sites and about 45 forms with demo photos.

## Run it on your computer

You need Node 20.6+ and a PostgreSQL database (local, or a free Neon one).

```bash
git clone <your GitHub URL> && cd ras-site-safety
npm install
cp .env.example .env            # then edit DATABASE_URL and JWT_SECRET
npm run seed                    # creates tables + demo data (drops existing tables!). Re-run it after pulling this version: the `sites` table has a new `active` column
npm run dev:api                 # terminal 1: API on http://localhost:4000
npm run dev:web                 # terminal 2: React on http://localhost:5173
```

Open http://localhost:5173. Vite forwards `/api` to the Express server, so there is no CORS setup.

Tests (need the seeded database): `npm test`

## Deploy on Netlify

1. Create a free project on [neon.tech](https://neon.tech) and copy the connection string (ends with `?sslmode=require`).
2. Seed it from your computer:
```bash
   DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require" npm run seed
```
3. Push to GitHub. In Netlify choose *Add new site > Import an existing project* and pick the repo. Netlify reads `netlify.toml`.
4. Add environment variables: `DATABASE_URL`, `JWT_SECRET` (long random text) and optionally `APP_TZ` (default `America/Toronto`).
5. Deploy and sign in with the test credentials.

`netlify.toml` rewrites `/api/*` to the function `netlify/functions/api.js`, which wraps the same Express app used locally. Every other URL returns `index.html`.

## API

All routes are under `/api` and need `Authorization: Bearer <token>` unless noted.

| Method and path | Who | What |
|---|---|---|
| `POST /auth/login` | anyone | username + password, returns token and user |
| `POST /auth/register` | anyone | sign up. Always creates a **FRAMER** |
| `GET /auth/me` | any user | who am I |
| `POST /admin/users` | admin | create a user and choose the role |
| `GET /meta` | any user | sites, checklist items, upload limits |
| `GET /workers` | any user | framers, for the filter |
| `POST /submissions` | framer | create a form (multipart: fields + `photos`) |
| `GET /submissions/mine` | any user | my own forms |
| `GET /submissions` | admin | list with filters: `siteId, userId, from, to, status, q, page` |
| `GET /submissions/:id` | owner or admin | detail (admins also get notes, history, 7-day strip) |
| `GET /photos/:id` | owner or admin | the image |
| `POST /submissions/:id/resolve` | admin | mark a flagged form as resolved (409 if already resolved or not flagged) |
| `POST /submissions/:id/notes` | admin | add a private follow-up note |
| `DELETE /submissions/:id` | admin | delete a form (photos and notes go with it) |
| `POST /submissions/bulk-delete` | admin | body `{ ids: [...] }`, 1 to 100 forms |
| `GET /admin/summary?days=7\|30` | admin | dashboard numbers |
| `GET /admin/export.csv` | admin | CSV of the forms, same filters as the list |
| `GET /admin/sites` | admin | all sites (active and archived) with form counts |
| `POST /admin/sites` | admin | add a site (`name`, `address`). 409 if the name exists |
| `PATCH /admin/sites/:id` | admin | edit `name` / `address`, or `active: false` to archive, `true` to restore |

## Assumptions and decisions

- **Sign-up.** Anyone can sign up, but the server always gives the role FRAMER and ignores any `role` in the request. Admins are created only by another admin or by the seed. Passwords need 8 to 72 characters (bcrypt reads at most 72).
- **Sites are archived, never deleted.** Old forms point at a site, so deleting one would break history. Archiving (`sites.active = false`) hides it from the form dropdown and the server also refuses new forms for it. Site names are unique ignoring upper/lower case.
- **Sessions last 1 hour.** After that the app asks the user to sign in again.
- **CSV safety.** Cells that start with `=`, `+`, `-` or `@` get a leading `'` so Excel cannot run them as formulas.
- **Deleting is permanent** and needs a tick in the confirmation popup. The activity log keeps a line about it.
- **Status.** A form is `FLAGGED` if any checklist item is unchecked, otherwise `COMPLIANT`. A note is required when flagged.
- **Photos are required** (1 to 5). Allowed types: JPG, PNG, WebP. The server checks the real file signature, not only the file name. The browser shrinks photos before upload.
- **Photos live in PostgreSQL**, because Netlify Function disks are temporary. For a bigger product I would use object storage (S3 or Netlify Blobs) and keep only the URL in the database.
- **Photos are private.** `GET /photos/:id` checks the owner or admin. The browser downloads them with `fetch` and the token, because an `<img>` tag cannot send the header.
- **"Today" and "missing today"** use the company time zone (`APP_TZ`), not the server's. A framer is "missing" if they have no form for today.
- **Someone else's form returns 404, not 403**, so ids cannot be guessed.
- **Token storage.** The JWT is kept in `localStorage` (simple, fine for this scope). Production would use an httpOnly cookie plus CSRF protection, and rate limiting on login.
- **Fonts and logo.** Barlow Condensed and Nunito Sans are free substitutes. Put the RAS logo at `frontend/public/ras-logo.png` and it appears automatically.
- **Cold starts.** The first request after a quiet period can take a second or two (Netlify Function and Neon wake up).
- **Seed data is demo data.** `npm run seed` drops and recreates all tables. Never run it on a real database.

## Possible next steps

Edit a form on the same day, site assignments per worker, reminders, photo storage in object storage, httpOnly cookies and rate limiting on login, an activity-log entry for site changes.