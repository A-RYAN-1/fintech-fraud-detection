# Fintech Fraud Detection

A comprehensive fraud detection system for fintech applications, built with a robust backend API and modern frontend interface.

Last updated: 2026-10-15. Live on free tiers (Vercel, Render, Neon).

## Try it live

https://fintech-fraud-detection-aryan.vercel.app

Demo login: `john@example.com` / `password123` (seeded demo data; anyone can use it). The API sleeps after 15 minutes idle, so the first login can take about a minute.

1. Log in and open the dashboard: transactions, risk scores and spending stats for the demo customer.
2. Create a small card payment: this browser is a device the account has not used, so it comes back **flagged** (UNTRUSTED_DEVICE).
3. Create a 95,000 card payment: it comes back **blocked**, with the rules that fired listed (for example AMOUNT_DEVIATION_HIGH, UNTRUSTED_DEVICE).

## Overview

This project implements an intelligent fraud detection and prevention system designed to protect financial transactions in real-time. It features advanced risk evaluation, transaction monitoring, audit logging, and a user-friendly dashboard for managing fraud cases and viewing transaction analytics.

## Why it exists

A learning project: the two of us built it to learn rule-based risk scoring and background jobs in Rails 8 on a realistic fintech problem. It taught how to keep scoring rules explainable (each blocked or flagged transaction lists the rules that fired) and how much a small app has to handle once sessions, devices and audit logs are real.

## Tech Stack

### Backend

- **Framework**: Ruby on Rails 8.1 (API mode), Ruby 3.2
- **Database**: PostgreSQL 16
- **Queue System**: Solid Queue (database-backed, no Redis)
- **Security**: Brakeman, Bundler Audit
- **Testing**: Minitest

### Frontend

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Styling**: Tailwind CSS 3
- **Testing**: Vitest
- **State Management**: Redux Toolkit, TanStack Query
- **API Client**: Axios

## Project Structure

```
fintech-fraud-detection/
├── backend/                    # Rails API backend
│   ├── app/
│   │   ├── controllers/       # API endpoints
│   │   ├── models/            # Data models
│   │   ├── services/          # Business logic
│   │   │   ├── risk_rules_processor.rb
│   │   │   ├── transaction_risk_evaluator.rb
│   │   │   └── transaction_post_processor.rb
│   │   ├── jobs/              # Background jobs
│   │   └── mailers/           # Email notifications
│   ├── config/                # Rails configuration
│   ├── db/                    # Database schema & migrations
│   ├── test/                  # Test suite
│   └── postman/               # API documentation
├── frontend/                   # React TypeScript frontend
│   ├── src/
│   │   ├── components/        # Reusable React components
│   │   ├── pages/             # Page components
│   │   ├── features/          # Feature-specific modules
│   │   ├── hooks/             # Custom React hooks
│   │   ├── store/             # State management
│   │   ├── utils/             # Utility functions
│   │   └── types/             # TypeScript definitions
│   ├── public/                # Static assets
│   └── test/                  # Test files
└── README.md                  # This file
```

## Key Features

### Transaction Management

- Real-time transaction processing and risk evaluation
- Multi-factor risk assessment
- Automatic fraud detection and flagging
- Transaction history and detailed analytics

### Risk Evaluation

- Advanced rule-based risk assessment engine
- Risk score calculation
- Device fingerprinting and tracking
- Pattern recognition for suspicious activities
- User transaction statistics and baselines

### User Management

- User authentication and authorization
- User profiles with transaction history
- Notification preferences
- Device management and tracking

### Audit & Compliance

- Complete audit logging of all transactions
- Compliance tracking for regulatory requirements
- Notification system for fraud alerts
- Weekly reports on transaction trends

### Admin Dashboard

- Real-time transaction monitoring
- Fraud case management
- User and device management
- Analytics and reporting

## Run it locally

Works on Windows (Git Bash), macOS and Linux. You need **Docker** (Docker Desktop on Windows and macOS, started first) and **Node 24**. Ruby and PostgreSQL are not installed on the host: they run in containers.

### 1. API and database (Docker Compose)

From the repository root:

```bash
docker compose up
```

The first run installs the gems, creates, migrates and seeds the database, and takes a few minutes. It is ready when this returns `"status":"ok"`:

```bash
curl http://localhost:3000/api/v1/health
```

The API is at `http://localhost:3000/api/v1`. Stop it with `docker compose down` (add `-v` to also drop the database and the gem cache).

### 2. Frontend (Vite)

Node is pinned in `frontend/mise.toml`. With [mise](https://mise.jdx.dev) installed, it picks Node 24 for you; otherwise use any Node 24.

```bash
cd frontend
cp .env.example .env      # points the app at the local API
mise install              # skip if you manage Node another way
npm ci
npm run dev
```

Open `http://localhost:5173` and sign in with a seeded demo user: `john@example.com` / `password123`.

### Try the fraud rules

On the dashboard, create a transaction: a small card payment from the browser (a device the user has not used before) comes back **flagged** for an untrusted device; a very large one (for example 95,000) is **blocked**, with the triggered rules listed.

### Without Docker

Install Ruby 3.2 and PostgreSQL yourself, copy `backend/.env.development.example` to `backend/.env` and fill in your database user, then from `backend/`: `bundle install`, `bin/rails db:prepare`, `bin/rails server`.

## Environment variables

Local runs need nothing beyond the defaults above: `compose.yaml` sets the backend variables and `frontend/.env.example` the frontend ones.

### Frontend (`frontend/.env`)

| Variable | What it is | Local value |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API (`/api/v1` on Vercel) | `http://localhost:3000/api/v1` |
| `VITE_APP_NAME` | Name shown in the UI | `Fintech Risk Engine` |

### Backend (see `backend/.env.development.example` and `backend/.env.production.example`)

| Variable | What it is | Needed |
|---|---|---|
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | PostgreSQL connection for development | local |
| `DATABASE_URL` | PostgreSQL connection string | production |
| `SECRET_KEY_BASE` | Signs the session cookie (`bin/rails secret`) | production |
| `FRONTEND_URL` | Frontend origin: allowed by CORS and by host authorization (it proxies `/api`) | always |
| `APP_HOST` | The API's own host: host authorization and links in emails | always |
| `SOLID_QUEUE_IN_PUMA` | `true` runs background jobs inside the web process | optional |
| `SMTP_ADDRESS`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Mail server for blocked-transaction emails; without `SMTP_USERNAME` mail is skipped | optional |
| `RAILS_LOG_LEVEL` | Log level | optional |

Never commit a real `.env` file; only the `.example` files are tracked.

## API Documentation

The API follows RESTful conventions. Full API documentation is available in the Postman collection:

- [MASTER_COLLECTION.json](backend/postman/MASTER_COLLECTION.json) - Complete API documentation
- [Phase0-Foundation.json](backend/postman/Phase0-Foundation.json) - Core endpoints
- [Phase1-Auth.json](backend/postman/Phase1-Auth.json) - Authentication endpoints
- [Phase3-4-Transactions.json](backend/postman/Phase3-4-Transactions.json) - Transaction endpoints
- [Phase5-Enhanced-Transactions.json](backend/postman/Phase5-Enhanced-Transactions.json) - Advanced features

OpenAPI specification available at: [public/openapi.yaml](backend/public/openapi.yaml)

## Core Models

### User

- Represents a user account in the system
- Tracks user activity and transaction history

### Transaction

- Represents individual financial transactions
- Stores transaction details and metadata
- Links to fraud evaluations and audit logs

### Device

- Tracks devices used for transactions
- Captures device fingerprinting information
- Enables device-based fraud detection

### Fraud Evaluation

- Contains risk assessment results
- Stores risk scores and evaluation details
- Links decisions and actions taken

### Audit Log

- Complete record of all system activities
- Tracks changes and user actions
- Compliance and audit purposes

### Notification

- User notifications and alerts
- Email and in-app notifications
- Fraud alerts and transaction confirmations

## Running Tests

### Backend

With the Docker setup (API container running):

```bash
docker compose exec api bin/rails test                  # Run all tests
docker compose exec api bin/rails test test/models      # Run model tests
docker compose exec api bin/rails test test/services    # Run service tests
```

Without Docker, run the same `bin/rails test ...` commands from `backend/`.

### Frontend

```bash
cd frontend
npm run test                  # Run all tests
npm run test:coverage        # Generate coverage report
```

## Code Quality & Security

### Backend

- **Brakeman**: Security vulnerability scanning

  ```bash
  bundle exec brakeman
  ```

- **RuboCop**: Code style and quality

  ```bash
  bundle exec rubocop
  ```

- **Bundler Audit**: Dependency vulnerability checking
  ```bash
  bundle exec bundler-audit check
  ```

### Frontend

- **ESLint**: JavaScript/TypeScript linting

  ```bash
  npm run lint
  ```

- **Prettier**: Code formatting
  ```bash
  npm run format
  ```

## Development Scripts

### Backend

```bash
bin/dev              # Start development environment
bin/setup            # Initial project setup
bin/ci               # Run CI checks
bin/jobs             # Start job processor
```

### Frontend

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run format       # Format with Prettier
```

## Environment Configuration

### Backend

Configuration files are located in `backend/config/`:

- `application.rb` - Application-wide settings
- `database.yml` - Database connection settings
- `environments/` - Environment-specific settings (development, test, production)
- `puma.rb` - Web server configuration

### Frontend

Configuration files in `frontend/`:

- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration

## Production Deployment

Free tiers only: the API on a Render free web service (Docker), PostgreSQL on Neon, the frontend on Vercel.

```
browser ──> Vercel (static frontend) ──/api/*──> Render (Rails API, Solid Queue in Puma) ──> Neon (PostgreSQL)
```

The frontend proxies `/api/*` to the API (`frontend/vercel.json`), so the session cookie is first-party and works in browsers that block third-party cookies. The Render free instance sleeps after 15 minutes idle; the first request after that takes about a minute.

### Backend (Render)

1. Neon: create a project, open *Connect*, turn connection pooling off and copy the direct connection string (migrations take advisory locks, which a pooler breaks).
2. Render: *New > Blueprint*, pick this repository. `render.yaml` creates the free web service from `backend/Dockerfile`, generates `SECRET_KEY_BASE`, and asks for `DATABASE_URL`, `FRONTEND_URL` and `APP_HOST`.
3. The container runs `bin/rails db:prepare` on every start, then Puma on `$PORT` with Solid Queue inside it (about 210 MB of the 512 MB free instance, measured locally). Health check: `/up`.
4. Demo data: on an empty database `db:prepare` loads the schema and runs `db/seeds.rb` once (5 users, 32 transactions); later restarts only migrate.

### Frontend (Vercel)

1. Import the repository with root directory `frontend` (framework preset: Vite).
2. Set `VITE_API_BASE_URL=/api/v1`. If the Render service URL differs from the one in `frontend/vercel.json`, update the rewrite destination.
3. Put the Vercel URL in the API's `FRONTEND_URL`.

## Status and roadmap

- Reached: runs locally from a fresh clone on Windows and Linux (Docker Compose for the API and PostgreSQL, mise for Node), checked 2026-10-13. Backend 37 tests, frontend 174 tests, all passing.
- Deployed free on 2026-10-15: frontend on Vercel (https://fintech-fraud-detection-aryan.vercel.app), Rails API on a Render free web service (Docker, Singapore), PostgreSQL on Neon. Checked live that day: login, session cookie, transaction list, a 95,000 payment from a new device blocked.
- Known limitations: the Render free instance sleeps after 15 minutes idle, so the first request after that takes about a minute. No CI runs yet: the Rails template workflow sits in `backend/.github/`, where GitHub does not pick it up.
- Planned: CI (GitHub Actions) running both test suites on every push, an uptime check on the live URL, Lighthouse numbers for the frontend.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and write tests
3. Run tests and linting: `npm run lint && npm run test`
4. Submit a pull request

## Credits

Built by two people:

- **Aryan Deshmukh** ([A-RYAN-1](https://github.com/A-RYAN-1)): backend (Rails API, risk rules engine, PostgreSQL, Solid Queue jobs).
- **[OldStager01](https://github.com/OldStager01)**: frontend and the original deployment. The original repository is [OldStager01/fintech-fraud-detection](https://github.com/OldStager01/fintech-fraud-detection).

## Project Demo

[Fintech Fraud Detection Enginer.webm](https://github.com/user-attachments/assets/42ca9ee7-99e5-4c0d-afd0-0cd9f127ea64)

## License

No license yet: all rights reserved by both authors. This may change once the two of us agree on one.
