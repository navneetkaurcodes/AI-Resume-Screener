# ResumeRay — Frontend for AI-Resume-Screener

This is the frontend (in `public/`) for your **FastAPI + PostgreSQL** backend
(`AI-Resume-Screener.zip`). It's a plain HTML/CSS/JS single-page app (hash
routing, ES modules, no build step) that talks to the FastAPI API directly.

## What changed in this pass

- **Registration now has a role dropdown** (`public/js/pages/register.js`):
  HR Manager or Admin. Picking Admin reveals an "Admin signup code" field.
  The code is checked server-side against `ADMIN_SIGNUP_CODE` in your
  backend's `.env` (see `app/routers/user.py`) — if it doesn't match, the
  account is silently created as `hr_manager` instead, and the frontend
  now tells the user that happened rather than pretending it worked.
- **Frontend now points at the FastAPI server explicitly.** It was
  previously calling relative paths like `fetch('/users/create_user')`,
  which only works if the frontend and backend share an origin. Since
  FastAPI (port 8000) and this static site (port 5500) don't, every
  request now goes to `window.API_BASE_URL`, set in `public/index.html`.
- **Fixed a role-casing bug.** The backend stores `role` as `"admin"` /
  `"hr_manager"` (lowercase), but several pages were checking for
  `"Admin"` (capitalized) — so admin-only UI (delete buttons, the Admin
  Console link, etc.) never actually appeared for real admins. Fixed in
  `main.js`, `shell.js`, `jobDetail.js`, `admin.js`, `profile.js`.
- **Fixed the resume-upload success toast** — it referenced a
  `res.resume.candidate_name` field the `/resumes/upload` endpoint
  doesn't return; it now just shows the uploaded filename.
- Removed two unused leftover files (`public/app.js`, `public/style.css`)
  that weren't referenced by `index.html` — the active files are
  `public/js/main.js` and `public/css/style.css`.

## How to run this against your real backend

**1. Start FastAPI:**
```bash
cd AI-Resume-Screener
# make sure .env has a real DATABASE_URL, SECRET_KEY, and ADMIN_SIGNUP_CODE
uvicorn app.main:app --reload
# → runs at http://127.0.0.1:8000
```

**2. Check CORS.** In `AI-Resume-Screener/.env`, `CORS_ORIGINS` must include
whatever origin you serve *this* frontend from. The default
(`http://localhost:5500`) matches VS Code's **Live Server** extension.

**3. Serve this frontend** — don't just double-click `index.html` (that
loads it as `file://`, which CORS will reject). Use Live Server on
`public/index.html`, or:
```bash
cd public
python -m http.server 5500
```
Then open `http://localhost:5500`.

**4. Confirm the base URL.** In `public/index.html`:
```html
<script>window.API_BASE_URL = "http://127.0.0.1:8000";</script>
```
Change this if uvicorn is running somewhere else.

**5. Register an account.** Go to `/#/register`, fill the form, pick
**HR Manager** or **Admin**. For Admin, enter whatever value you set as
`ADMIN_SIGNUP_CODE` in the backend `.env`. Check your Postgres `users`
table afterward — the row should be there.

## About `server.js` / `package.json` / `data.json`

These are an **optional Node/Express mock backend** (in-memory JSON
store, no real database) that was built to preview the frontend without
running Python. It replicates the same routes as FastAPI. **You don't
need it** if you're running the real FastAPI backend — it's only useful
for quickly eyeballing the UI:
```bash
npm install
npm start   # → http://localhost:3000, serves public/ AND fakes the API
```
Since the frontend now calls `API_BASE_URL` (FastAPI) directly rather
than relative paths, running `npm start` and going to `localhost:3000`
will *display* the site but its API calls will still go to FastAPI —
not this mock. If you want to preview against the mock instead, set
`window.API_BASE_URL = "http://localhost:3000"` temporarily.
