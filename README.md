# StudyHub

Full-stack student app: tasks, study timer, session log. Plain HTML/CSS/JS frontend, Node + Express + MongoDB (Mongoose) backend, JWT login.

## Run it
1. Install Node.js 18+ and MongoDB (local) or create a free MongoDB Atlas cluster.
2. In this folder: `npm install`
3. Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`.
4. `npm start` then open http://localhost:3000

## Features
Landing page, login/register, sidebar dashboard (Overview, Tasks, Focus timer, Notes, Reports, Settings), task edit/delete, daily goal + streak, weekly and per-subject reports, CSV/JSON export, profile and password change, account deletion, dark mode, rate-limited login.

## API (all /api/tasks and /api/sessions routes need `Authorization: Bearer <token>`)
| Method | Route | Purpose |
|---|---|---|
| POST | /api/auth/register | Create account, returns token |
| POST | /api/auth/login | Log in, returns token |
| GET/PUT/DELETE | /api/auth/me | Profile, update name and daily goal, delete account |
| PUT | /api/auth/password | Change password |
| GET/POST | /api/tasks | List / create tasks |
| PUT/DELETE | /api/tasks/:id | Update (e.g. done) / delete a task |
| DELETE | /api/tasks | Clear completed tasks |
| GET/POST | /api/sessions | List (?date=YYYY-MM-DD) / log a study session |
| GET/POST/DELETE | /api/notes | Quick notes (DELETE uses /api/notes/:id) |

## Structure
- `server/` server.js, models.js (User, Task, Session), middleware.js (JWT), routes/
- `public/` index.html (landing), login.html + auth.js, app.html + script.js (dashboard), style.css, landing.css
