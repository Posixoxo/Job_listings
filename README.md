# CurrenX — Free & Open Job Discovery Engine

Searching for a job is stressful enough without paywalls, locked features, or platforms demanding a subscription just to apply or see full job details. If someone is looking for work, why ask them to pay money?

**CurrenX** is a completely free, automated job discovery platform that scrapes, aggregates, and presents active job listings with direct application links — giving job seekers unfiltered access to opportunities without charging a single dime.

**Mission: zero paywalls, zero subscription traps.**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Key Features](#key-features)
- [Repository Structure](#repository-structure)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Getting Started](#getting-started)
- [Automated Data Pipeline](#automated-data-pipeline)
- [License](#license)

---

## Architecture Overview

CurrenX is a full-stack, decoupled web application paired with an automated ETL (Extract, Transform, Load) data pipeline.

```
                 ┌────────────────────────────────┐
                 │   GitHub Actions Workflow       │
                 │   (scheduled daily, 15:00 UTC)  │
                 └────────────────┬─────────────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │  Python Ingestion    │
                       │ (BeautifulSoup /     │
                       │  Requests)           │
                       └──────────┬───────────┘
                                  │
                                  ▼
┌───────────────────┐    ┌────────────────────┐    ┌──────────────────────┐
│  React Frontend    │───▶│  Express.js API     │───▶│  PostgreSQL Database │
│  (Vite + Tailwind)  │    │  (Node.js REST)     │    │  (Knex migrations)   │
└───────────────────┘    └────────────────────┘    └──────────────────────┘
```

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Lucide React Icons |
| **Backend** | Express.js 5, Node.js (`type: "module"`), CORS, Dotenv |
| **Database & ORM** | PostgreSQL, `pg` Pool, Knex.js (schema migrations) |
| **Ingestion Pipeline** | Python 3.11, BeautifulSoup4, Requests, Psycopg2 |
| **CI/CD & Automation** | GitHub Actions (scheduled cron ingestion) |
| **Hosting** | Vercel (frontend), Render / Railway (backend API), remote PostgreSQL |

---

## Key Features

- **Unfiltered job search** — filter by keyword, company, location, job type (full-time, part-time, contract), and work model (remote, hybrid, onsite).
- **Automated ingestion** — a Python scraper runs daily via GitHub Actions at 4:00 PM WAT (8:00 AM EDT / 15:00 UTC) to pull fresh listings into the database.
- **Optimized pagination** — server-side SQL pagination (`LIMIT` / `OFFSET`) for consistent performance on large datasets.
- **HTML sanitization** — raw HTML job descriptions are sanitized into clean, readable text before being sent to the client.
- **Subscriber management** — email subscription system backed by a unique index constraint in PostgreSQL (duplicate prevention via error code `23505`).

---

## Repository Structure

```
job-listings-app/
├── .github/
│   └── workflows/
│       └── ingest.yml               # Scheduled GitHub Actions cron pipeline
├── migrations/
│   └── 20260826181039_create_initial_tables.js   # Knex DB migration
├── job-ingestion-engine/
│   └── ingest.py                    # Python web scraper & database ingester
├── src/
│   ├── components/
│   │   └── SubscribeModal.jsx       # Subscribe modal with local storage tracking
│   ├── App.jsx                      # Core job listing view & search interface
│   └── main.jsx                     # React entry point
├── .env.example                     # Environment variable template
├── knexfile.js                      # Knex migration & environment config
├── package.json                     # Project dependencies & scripts
├── server.js                        # Express.js backend REST API
├── vite.config.js                   # Frontend build config & dev proxy
└── README.md                        # Main project documentation
```

---

## Database Schema

Schema is managed via **Knex.js** for zero-downtime host switching (e.g. moving between Render and Railway).

### `job_listings`

| Column | Type | Attributes |
|---|---|---|
| `id` | `SERIAL` | Primary key |
| `title` | `VARCHAR` | Not null |
| `company_name` | `VARCHAR` | Not null |
| `location` | `VARCHAR` | Not null |
| `employment_type` | `VARCHAR` | Optional |
| `description` | `TEXT` | Sanitized string |
| `apply_url` | `TEXT` | Direct application link |
| `logo_url` | `TEXT` | `COALESCE` default |
| `posted_at` | `TIMESTAMP` | Default `NOW()` |
| `is_active` | `BOOLEAN` | Default `true` |

### `subscribers`

| Column | Type | Attributes |
|---|---|---|
| `id` | `SERIAL` | Primary key |
| `email` | `VARCHAR(255)` | Unique, not null |
| `created_at` | `TIMESTAMP` | Default `NOW()` |

---

## API Documentation

**Base URL**
- Local: `http://localhost:5000`
- Production: `https://your-api-domain.onrender.com`

### `GET /api/jobs`
Fetches a paginated list of active jobs matching optional filter parameters (keyword, company, location, job type, work model).

### `POST /api/subscribe`
Stores an email address in the `subscribers` table.

---

## Getting Started

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-username/job-listings-app.git
cd job-listings-app
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://user:password@localhost:5432/currenx_db
PORT=5000
VITE_API_URL=http://localhost:5000
```

### 3. Run database migrations

```bash
npm run migrate
```

### 4. Start the local servers

```bash
npm run start   # Backend API (Terminal 1)
npm run dev      # Frontend client (Terminal 2)
```

---

## Automated Data Pipeline

The repository includes an automated ingestion pipeline defined in `.github/workflows/ingest.yml`, which runs daily at **15:00 UTC** (4:00 PM WAT / 8:00 AM EDT).

To enable it on GitHub:

1. Go to **Repository Settings → Secrets and variables → Actions**.
2. Add a new repository secret named `DATABASE_URL` containing your remote production database connection string.

---

## License

This project is open source and built to empower job seekers everywhere. Fork it, customize it, or deploy your own instance to keep job hunting free and accessible...