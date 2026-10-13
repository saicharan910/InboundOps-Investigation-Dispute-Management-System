# InboundOps — Investigation & Dispute Management

A deployable portfolio project for an Investigation Representative / operations analyst role.

## Stack
- React + Vite frontend
- Flask REST API
- SQLite database (no PostgreSQL)
- Plain professional light UI — no glassmorphism, no AI styling
- Synthetic demo data only

## Run locally
Requirements: Python 3.10+ and Node.js 18+.

1. Extract this folder.
2. Open a terminal in the project folder.
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```
5. Start the app:
   ```bash
   python app.py
   ```
6. Open http://localhost:5000

The database is created and seeded automatically on first launch.

## Deploy to Render
1. Upload this folder to a new GitHub repository.
2. In Render, create a **Web Service** connected to that repository.
3. Runtime: Python.
4. Build command:
   ```bash
   pip install -r requirements.txt && cd frontend && npm install && npm run build && cd ..
   ```
5. Start command:
   ```bash
   gunicorn app:app
   ```
6. For persistent data, attach a Render persistent disk mounted at `/var/data`, and set environment variable:
   `DATABASE_PATH=/var/data/inboundops.db`

   SQLite works without PostgreSQL. A persistent disk is needed on hosting platforms whose filesystem resets between deploys/restarts. If you use a free ephemeral service, case changes may be lost after a restart/redeploy.

## Features
- Operations KPI dashboard
- Search, status/priority/FC filters
- Case list with sorting
- Create and update investigation cases
- Investigation notes and activity history
- Escalation workflow
- SLA / overdue indicators
- CSV export
- Responsive layout
- SQLite schema and synthetic sample records created automatically

## Important
This is a portfolio simulation, not an Amazon system. Do not enter real seller, customer, or payment data.
