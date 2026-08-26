# CurrenX — Free & Open Job Discovery Engine

> **Why CurrenX?**  
> Searching for a job is stressful enough without running into paywalls, locked features, or platforms demanding subscription fees just to apply or see full job details. **If someone is looking for work, why ask them to pay money?**  
> 
> **CurrenX** was built with a clear mission: **Zero paywalls, zero subscription traps.** It is a completely free, automated job discovery platform engineered to scrape, aggregate, and present active job listings with direct application links—giving job seekers unfiltered access to opportunities without charging a single dime.

---

## 🏗️ System Architecture Overview

CurrenX is built as a full-stack, decoupled Web Application paired with an automated ETL (Extract, Transform, Load) data pipeline.

              +-------------------------------+
              |  GitHub Actions Workflow      |
              |  (Scheduled daily at 15:00UTC)|
              +---------------+---------------+
                              |
                              v
                    [ Python Ingestion ]
                    (BeautifulSoup / Requests)
                              |
                              v
+------------------+    +-------------------+    +--------------------+
| React Frontend   |--->| Express.js API    |--->| PostgreSQL DB      |
| (Vite + Tailwind)|    | (Node.js REST)    |    | (Knex Migrations)  |
+------------------+    +-------------------+    +--------------------+

---

## 🛠️ Technology Stack

* **Frontend:** React 19, Vite, Tailwind CSS 4, Lucide React Icons
* **Backend:** Express.js 5, Node.js (`type: "module"`), CORS, Dotenv
* **Database & ORM:** PostgreSQL, `pg` Pool, Knex.js (Schema Migrations)
* **Ingestion Pipeline:** Python 3.11, BeautifulSoup4, Requests, Psycopg2
* **CI/CD & Automation:** GitHub Actions (Automated Cron Job Ingestion)
* **Hosting Targets:** Vercel (Frontend), Render / Railway (Backend API), PostgreSQL Remote Server

---

## 🚀 Key Features

1. **Unfiltered Job Search:** Search by keywords, company name, location, job type (Full-time, Part-time, Contract), and work model (Remote, Hybrid, Onsite).
2. **Automated Ingestion:** Python scraper runs daily via GitHub Actions at 4:00 PM WAT (8:00 AM EDT) to pull fresh listings into the database.
3. **Optimized Pagination:** Server-side SQL pagination (`LIMIT` / `OFFSET`) ensuring high performance under large datasets.
4. **HTML Sanitization:** Backend sanitization cleans raw HTML descriptions into readable text prior to client delivery.
5. **Subscriber Management:** Email subscription system backed by unique index constraints in PostgreSQL (`23505` duplicate prevention) and persistent client storage.

---

## 📁 Repository Structure

job-listings-app/
├── .github/
│   └── workflows/
│       └── ingest.yml              # Scheduled GitHub Actions cron pipeline
├── migrations/
│   └── 20260826181039_create_initial_tables.js # Knex DB migration file
├── job-ingestion-engine/
│   └── ingest.py                   # Python web scraper & database ingester
├── src/
│   ├── components/
│   │   └── SubscribeModal.jsx      # Modal component with local storage tracking
│   ├── App.jsx                     # Core job listing view & search interface
│   └── main.jsx                    # React entry point
├── .env.example                    # Environment variable templates
├── knexfile.js                     # Knex migration & environment config
├── package.json                    # Project dependencies & operational scripts
├── server.js                       # Express.js backend REST API
├── vite.config.js                  # Frontend build configuration & dev proxy
└── README.md                       # Main project documentation


---

## 🗄️ Database Schema & Migrations

Managed via **Knex.js** for zero-downtime deployment host switching (e.g., moving between Render and Railway).

### `job_listings` Table
| Column | Type | Attributes |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `title` | VARCHAR | NOT NULL |
| `company_name` | VARCHAR | NOT NULL |
| `location` | VARCHAR | NOT NULL |
| `employment_type` | VARCHAR | Optional |
| `description` | TEXT | Sanitized string |
| `apply_url` | TEXT | Direct link |
| `logo_url` | TEXT | COALESCE default |
| `posted_at` | TIMESTAMP | DEFAULT NOW() |
| `is_active` | BOOLEAN | DEFAULT true |

### `subscribers` Table
| Column | Type | Attributes |
|---|---|---|
| `id` | SERIAL | PRIMARY KEY |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `created_at` | TIMESTAMP | DEFAULT NOW() |

---

## 🔌 API Documentation

### Base URL
- **Local:** `http://localhost:5000`
- **Production:** `https://your-api-domain.onrender.com`

### Endpoints

#### `GET /api/jobs`
Fetches a paginated list of active jobs matching optional filter parameters.

#### `POST /api/subscribe`
Stores an email address into the `subscribers` database table.

---

## ⚙️ Environment Setup & Installation

### 1. Clone & Install Dependencies
```bash
git clone [https://github.com/your-username/job-listings-app.git](https://github.com/your-username/job-listings-app.git)
cd job-listings-app
npm install
2. Configure Environment Variables
Create a .env file in the root directory:

Code snippet
DATABASE_URL=postgres://user:password@localhost:5432/currenx_db
PORT=5000
VITE_API_URL=http://localhost:5000
3. Run Database Migrations
Bash
npm run migrate
4. Start Local Servers
Bash
npm run start   # Backend API (Terminal 1)
npm run dev     # Frontend Client (Terminal 2)
🔄 Automated Data Pipeline (GitHub Actions)
The repository includes an automated pipeline in .github/workflows/ingest.yml running daily at 15:00 UTC (4:00 PM WAT / 8:00 AM EDT).

To enable this on GitHub:

Go to Repository Settings > Secrets and variables > Actions.

Add a new repository secret named DATABASE_URL containing your remote production database connection string.

📜 License & Usage
This project is open source and built to empower job seekers everywhere. Feel free to fork, customize, or deploy your own instance to keep job hunting free and accessible.


---

### How to push after creating `README.md`:

Run these 3 commands in your terminal:

```bash
git add README.md package.json
git commit -m "docs: add comprehensive README documentation"
git push origin main