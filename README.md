# VPN Monitor Dashboard

A dynamic, real-time VPN monitoring dashboard built with Node.js (Express) + PostgreSQL backend and a vanilla HTML/CSS/JS frontend. Features animated connectivity flow visualization, full CRUD operations, health monitoring, and light/dark mode.

## Prerequisites

- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **PostgreSQL** v14+ ([postgresql.org/download/windows](https://www.postgresql.org/download/windows/))

## PostgreSQL Setup (Windows)

1. Download and run the PostgreSQL installer. Note the password you set for the `postgres` user.
2. Open **pgAdmin** or **psql** and create the database:
   ```sql
   CREATE DATABASE vpn_monitor;
   ```
3. (Optional) Run the schema manually:
   ```bash
   psql -U postgres -d vpn_monitor -f schema.sql
   ```
   > The server will also auto-create the schema on startup.

## Project Setup

1. **Copy the env file and set your credentials:**
   ```bash
   copy .env.example .env
   ```
   Edit `.env` and replace `password` with your PostgreSQL password.

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Seed sample data (optional but recommended for first run):**
   ```bash
   npm run seed
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. Open **http://localhost:3000** in your browser.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start server with hot-reload (`--watch`) |
| `npm start` | Start server in production mode |
| `npm run seed` | Insert 3 sample VPN entries into the database |

## Features

- **Full CRUD** — Add, edit, delete VPN entries with validation
- **Animated Topology** — SVG visualization: Source → VPN → Destination with flowing dot animations
- **Health Monitoring** — Auto-refresh every 5s with realistic latency simulation
- **Theme Toggle** — Light/Dark mode with smooth transitions
- **Toast Notifications** — Status change alerts
- **Search & Filter** — Filter by name, IP, or status
- **Keyboard Shortcuts** — `N` (add), `Esc` (close modal), keyboard-navigable

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/vpns` | List all VPNs (`?status=healthy&search=east`) |
| GET | `/api/vpns/:id` | Get single VPN |
| POST | `/api/vpns` | Create VPN |
| PUT | `/api/vpns/:id` | Update VPN |
| DELETE | `/api/vpns/:id` | Delete VPN |
| POST | `/api/vpns/:id/check` | Trigger manual health check |
| PATCH | `/api/vpns/:id/status` | Update health status |
