# Lighthouse Audit Agent

A desktop app for running Lighthouse audits locally. Group URLs, audit pages behind a login, capture screenshots, and track scores over time.

## Install the desktop app

Get the installer for your operating system from [GitHub Releases](https://github.com/axvrma/lighthouse-agent/releases). Releases target macOS (Apple Silicon and Intel), Windows x64, and Linux x64. Install Google Chrome before running an audit. You can set `CHROME_PATH` to use a specific Chrome or Chromium executable.

Audit history and screenshots live in the `audits` subdirectory of the app's [per-user data directory](https://www.electronjs.org/docs/latest/api/app#appgetpathname). On macOS, that is `~/Library/Application Support/Lighthouse Agent/audits`. Existing developer data can be moved by copying `server/data.db` and `server/screenshots/` into this directory while both apps are closed.

The initial macOS installers are ad-hoc signed and not notarized. The Windows installer is unsigned. Your operating system may require approval to launch them.

## Features

- **Module Organization**: Group URLs into modules (e.g., "E-Commerce", "Marketing")
- **Lighthouse Audits**: Performance, Accessibility, Best Practices, SEO, PWA scores
- **Authentication Support**: Add login credentials for pages behind auth
- **Screenshots**: Automatic full-page screenshots of each audit
- **Suggestions**: Actionable improvement recommendations with estimated savings
- **Score History**: Track score trends over time with charts

## Development

Use Node.js 24 and install Google Chrome.

```bash
npm ci
npm start             # Build and run the Electron app
npm run dev            # Run the API and Vite development server
npm run package:desktop  # Build an installer for the current platform
```

Open http://localhost:5173 for browser development. If you switch to standalone Node.js development after an Electron build, run `npm rebuild better-sqlite3` so the native module matches Node.js.

### Release and landing page

- Installers are written to `release/`. The [desktop release workflow](.github/workflows/release.yml) builds installers on GitHub Actions and publishes them when a `v*` tag matches the version in the root `package.json`. For example, use `git tag v1.1.0` and `git push origin v1.1.0` for package version `1.1.0`.
- The landing page is buildless HTML and CSS in `landing/`. Import this repository in Netlify with `main` as the production branch. The root `netlify.toml` sets `landing` as the base directory and publishes that directory without a build command.
- Preview the landing page locally with `python3 -m http.server 4173 --bind 127.0.0.1 --directory landing`.

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
