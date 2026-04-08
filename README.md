# Lighthouse Audit Agent

A fully local Lighthouse performance auditing tool with a modern dashboard. Run audits on any URL, track scores over time, and get actionable suggestions.

## Features

- **Module Organization**: Group URLs into modules (e.g., "E-Commerce", "Marketing")
- **Lighthouse Audits**: Performance, Accessibility, Best Practices, SEO, PWA scores
- **Authentication Support**: Add login credentials for pages behind auth
- **Screenshots**: Automatic full-page screenshots of each audit
- **Suggestions**: Actionable improvement recommendations with estimated savings
- **Score History**: Track score trends over time with charts

## Quick Start

```bash
# Install dependencies
npm install

# Start the app (runs both server and dashboard)
npm run dev
```

Open http://localhost:5173 in your browser.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Dashboard    │────▶│   Express API    │────▶│     SQLite      │
│   (React/Vite)  │     │   + Lighthouse   │     │   (data.db)     │
│   :5173         │     │   :4001          │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## Project Structure

```
lighthouse-agent/
├── server/               # Backend API
│   ├── src/
│   │   ├── index.ts      # Express server (port 4001)
│   │   ├── db.ts         # SQLite database
│   │   └── lighthouse.ts # Audit runner with auth support
│   ├── data.db           # SQLite database (auto-created)
│   └── screenshots/      # Captured screenshots
├── dashboard/            # Frontend
│   └── src/
│       ├── App.tsx
│       ├── components/   # React components
│       └── lib/api.ts    # API client
└── package.json
```

## Usage

### 1. Create a Module

Click "Modules" tab → Enter module name → "Create Module"

### 2. Add URLs

Expand a module → "Add URL to this module" → Enter URL

### 3. Add Authentication (Optional)

For pages requiring login:
- Click the ⚙️ icon next to a URL
- Enter login credentials
- The agent will authenticate before running audits

### 4. Run Audits

Click "Run Audit" button → Results appear automatically

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/modules` | List all modules |
| POST | `/api/modules` | Create a module |
| GET | `/api/urls` | List all URLs |
| POST | `/api/urls` | Add a URL |
| POST | `/api/audit/run` | Trigger audit |
| GET | `/api/audits` | List audit results |

## Database

SQLite database stored at `server/data.db` with tables:
- `modules` - URL groups
- `urls` - URLs with optional auth credentials
- `audits` - Lighthouse results
- `suggestions` - Improvement recommendations

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite (better-sqlite3)
- **Auditing**: Lighthouse, Puppeteer

## License

MIT
