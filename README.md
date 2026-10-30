# TeamFlow: Collaborative Project Management Platform

A multi-user project management app with role-based access control, built for a 3-hour full-stack hackathon.
Users with four roles (Admin, Project Manager, Team Member, Viewer) manage projects, tasks, team members and comments.
Permissions are enforced on the server, and concurrent task edits are protected with optimistic locking (HTTP 409).

## Features
- JWT login, with deactivated accounts blocked immediately
- Users: create, list, edit, deactivate/activate (Admin)
- Projects: create, list, edit, archive/restore, assign project manager
- Team: add, remove, change project-level role
- Tasks: create, edit, delete, assign, change status, with filters, search and pagination
- Comments: add, list, delete
- Version-based conflict detection on task updates (409 VERSION_CONFLICT) with a review dialog in the UI

## Tech Stack
- Frontend: React (Vite), JavaScript/JSX, Tailwind CSS v4, React Router, Axios, React Icons, Framer Motion
- Backend: Node.js, Express (ES Modules), JWT, bcryptjs
- Database: MongoDB Atlas with Mongoose

## Architecture
```
React (Vite)  --Axios + Bearer JWT-->  Express API  --Mongoose-->  MongoDB Atlas
                                         requireAuth -> project access check -> validation -> DB
```
- Roles have two layers: a global role on the user (admin, project_manager, team_member, viewer) and a project role on each membership (manager, member, viewer).
- Collections: `users`, `projects` (members embedded as `[{user, role}]`), `tasks` (with a `version` field), `comments`.
- All authorization lives in `server/src/middleware/auth.js` and the route handlers. The frontend only hides buttons.

## Prerequisites
- Node.js 18.11 or newer
- A MongoDB Atlas free (M0) cluster, a database user, and network access allowed (0.0.0.0/0 for development)

## Setup
```bash
# Backend
cd server
npm install
cp .env.example .env     # then fill in your own values
npm run seed             # wipes the database and inserts demo data
npm run dev              # http://localhost:5000

# Frontend (new terminal)
cd client
npm install
npm run dev              # http://localhost:5173
```

### Environment variables
`server/.env`
| Name | Purpose |
|---|---|
| PORT | API port (default 5000) |
| MONGODB_URI | Atlas connection string, including the database name |
| JWT_SECRET | Long random string used to sign tokens |
| CLIENT_ORIGIN | Allowed frontend origin (default http://localhost:5173) |

`client/.env` (optional)
| Name | Purpose |
|---|---|
| VITE_API_URL | API base URL (default http://localhost:5000/api) |

## Demo accounts (created by `npm run seed`, for demo only)
Password for all: `Demo@123`

| Role | Email |
|---|---|
| Admin | admin@demo.com |
| Project Manager | manager@demo.com |
| Team Member | alice@demo.com, bob@demo.com |
| Viewer | viewer@demo.com |

## API Overview
All routes are under `/api`. Success: `{ data, meta? }`. Error: `{ error: { code, message, details? } }`.

| Area | Endpoints |
|---|---|
| Health | GET /health |
| Auth | POST /auth/login, GET/PATCH /auth/me |
| Users (admin) | GET/POST /users, GET/PATCH /users/:id, POST /users/:id/deactivate, POST /users/:id/activate, GET /users/lookup |
| Projects | GET/POST /projects, GET/PATCH/DELETE /projects/:id, POST /projects/:id/archive, POST /projects/:id/unarchive |
| Team | GET/POST /projects/:id/members, PATCH/DELETE /projects/:id/members/:userId |
| Tasks | GET/POST /projects/:id/tasks, GET /tasks/mine, GET/PATCH/DELETE /tasks/:id |
| Comments | GET/POST /tasks/:id/comments, DELETE /comments/:id |

Task filtering: `status`, `priority`, `assignee` (id, `me`, `none`), `q`, `sort`, `page`, `limit`.

### Concurrency control
`PATCH /tasks/:id` requires the `version` the client last saw. The server runs
`findOneAndUpdate({ _id, version }, { $set, $inc: { version: 1 } })`.
If another user updated first, nothing matches and the server returns `409 VERSION_CONFLICT` with the latest task in `error.details.current`.

## Permissions
| Action | Admin | Project Manager | Member | Viewer |
|---|---|---|---|---|
| Manage users, create/archive projects, assign managers | Yes | No | No | No |
| Add/remove members, change member roles | Yes | Yes (not managers) | No | No |
| Create/delete/assign tasks | Yes | Yes | No | No |
| Edit task / change status | Yes | Yes | Own assigned tasks | No |
| Comment | Yes | Yes | Yes | No |
| Delete comment | Any | Any in project | Own | No |

## Known limitations
- No real-time updates: conflicts are detected on save, not live
- JWT is stored in localStorage, with no refresh tokens or rate limiting
- Offset pagination only
- No automated tests; testing was manual
