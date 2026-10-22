# Fintech Backend: Transaction Risk & Fraud Detection Engine

A secure, high-performance Ruby on Rails API for real-time transaction processing, automated risk assessment, and fraud detection.

## Technical Stack

- **Framework:** Ruby on Rails 8.1.2 (API Only)
- **Database:** PostgreSQL with UUID support
- **Authentication:** Secure Cookie-based Sessions (HttpOnly/SameSite)
- **Background Jobs:** SolidQueue (Rails 8 defaults)
- **Security:** bcrypt, SHA-256 device hashing, industry-standard SQL injection protection

## Quick Start for Developers

To get a perfect clone of this backend on your local machine, follow these exact steps:

### 1. Prerequisites
- **Ruby:** `3.2.0+`
- **PostgreSQL:** `14+` (Make sure your Postgres service is running)

### 2. Setup Procedure
```bash
# Clone the repository
git clone <repository-url>
cd fintech-backend

# Install dependencies
bundle install

# Initialize all databases (Primary + Job Queue)
# This will create your databases and run all migrations
bin/rails db:prepare
```

### 3. Environment Variables
Create a `.env` file in the root directory if you need to override default database settings:
```env
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_HOST=localhost
```

### 4. Running the Server
```bash
bin/rails server
```
The API will be available at `http://localhost:3000`.

### 5. Verify the Installation
```bash
curl http://localhost:3000/api/v1/health
```

---

## Database Inspection Guide

To check the state of your database and verify your data, use these commands:

### A. Find Your Database Names
Open `config/database.yml`. By default:
- **Primary Data:** `fintech_development` (Transactions, Users, Evaluations)
- **Background Jobs:** `fintech_development_queue` (Queue status, Scheduled reports)

### B. List All Tables
Run this in your terminal to see every table in your primary database:
```bash
bin/rails runner "puts ActiveRecord::Base.connection.tables"
```

### C. View Content (The Easy Way)
You don't need to know SQL. Use the Rails Runner to print data directly:
```bash
# View all Users
bin/rails runner "User.all.each { |u| p u.attributes }"

# View recent Transactions
bin/rails runner "Transaction.order(created_at: :desc).limit(5).each { |t| p t.attributes }"

# View Fraud Decisions
bin/rails runner "FraudEvaluation.all.each { |fe| p fe.attributes }"
```

### D. Entering the SQL Console
If you prefer standard SQL, just type:
```bash
bin/rails dbconsole
```
Inside the prompt, type `\dt` to list tables or `SELECT * FROM users;` to see data. Type `\q` to exit.

---

## Core Features

### Real-time Risk Assessment
Every transaction passes through a multi-rule engine that calculates a risk score based on:
- **Transaction Amount:** Flags unusually high values.
- **Spending Baseline:** Detects deviations from user's average behavior.
- **Velocity:** Monitors rapid-fire transactions within 60-second windows.
- **Device trust:** Tracks and hashes device signatures (MAC IDs) using SHA-256 for persistent identification.

### Automated Decisioning
Transactions are automatically categorized based on configurable thresholds defined as constants in `RiskRulesProcessor`:
- **SUCCESS:** Low risk score (< `FLAGGED_SCORE_THRESHOLD`, default: 30).
- **FLAGGED:** Medium risk score (`FLAGGED_SCORE_THRESHOLD` to `BLOCKED_SCORE_THRESHOLD`, default: 30–70).
- **BLOCKED:** High risk score (≥ `BLOCKED_SCORE_THRESHOLD`, default: 70).

### User Feedback Loop
Allows users to provide "Ground Truth" data on fraud decisions (marking them as accurate or inaccurate), enabling future machine learning improvements.

---

## System Architecture & Data Flow

The Fintech Risk Engine operates as a multi-layered filtration system with **atomic database transactions** ensuring data integrity. Below is the step-by-step lifecycle of a transaction.

### 1. Ingestion Layer
- **Endpoint:** `POST /api/v1/transactions`
- **Identity:** The `current_user` is identified via secure session cookies.
- **Enrichment:** The server captures the `ip_address` and performs SHA-256 hashing on the `device_id` (MAC/Hardware ID) to maintain privacy while ensuring persistent tracking.
- **Input Sanitization:** Search queries are sanitized for SQL wildcard characters (`%`, `_`) to prevent unexpected matching behavior.

### 2. Risk Evaluation Engine (Service Architecture)

The evaluation pipeline is split into three focused services for maintainability:

#### `TransactionRiskEvaluator` (Orchestrator)
- Entry point for the risk evaluation pipeline.
- Wraps the entire process in an `ActiveRecord::Base.transaction` block to ensure **atomicity** — if any step fails (e.g., AuditLog creation), all database changes are rolled back.
- Coordinates `RiskRulesProcessor` and `TransactionPostProcessor`.

#### `RiskRulesProcessor` (Business Logic)
Executes five distinct safety rules, each with **named constants** instead of magic numbers:

| Rule | Constant | Description |
|------|----------|-------------|
| First Transaction Check | `HIGH_AMOUNT_LIMIT` (100,000) | Flags first transactions above threshold |
| Amount Deviation | `DEVIATION_MULTIPLIER_*` (2x/5x/10x) | Compares against user's historical average |
| Velocity Control | `VELOCITY_WINDOW` (1 minute) | Checks rapid-fire transaction volume |
| Device Trust | `UNTRUSTED_DEVICE_RISK` (30) | Verifies hashed `device_id` history |
| Device Identity | `MISSING_DEVICE_RISK` (50) | Ensures non-null device identifier |

#### `TransactionPostProcessor` (Side Effects)
Handles all database writes and external actions:
- Creates `FraudEvaluation` record
- Updates `Transaction` status and risk score
- Sends email alerts for blocked transactions
- Creates in-app notifications for flagged/blocked transactions
- Writes `AuditLog` entry
- Updates `UserTransactionStat` on successful transactions

### 3. Decisioning & Persistence
- All database writes use **bang methods** (`create!`, `update!`) to raise exceptions on failure.
- These exceptions trigger automatic transaction rollback, ensuring data consistency.
- Based on the cumulative risk score:
  - **SUCCESS (< 30):** Transaction succeeds; user stats and device records are updated.
  - **FLAGGED (30–70):** Transaction is marked for review; notification created.
  - **BLOCKED (≥ 70):** Transaction is blocked; email alert sent via background job.

### 4. Notification & Alerts (Asynchronous)
- If a transaction is **BLOCKED**, `TransactionMailer.blocked_alert` is enqueued via `deliver_later`.
- This job is pushed to the **SolidQueue Background Worker** (stored in a dedicated PostgreSQL database).
- The worker sends a secure email alert to the user's registered address.

### 5. Human-in-the-Loop Feedback
- Users can view their transaction history via `GET /api/v1/transactions`.
- If a user identifies an error in the risk decision, they submit feedback via `POST /api/v1/transactions/:id/feedback`.
- Feedback submission and audit logging are wrapped in a **database transaction** — if the audit log fails, the feedback update is rolled back.

### Admin API
- `GET /api/v1/admin/users` (admin, manager): filters `role`, `status`, `search`, plus `page` and `per_page` (max 100).
- `PATCH /api/v1/admin/users/:id/status` and `PATCH /api/v1/admin/users/:id/role` (admin only): each change is written to the audit log in the same database transaction. An admin cannot change their own role or status.
- `GET /api/v1/admin/audit_logs` (admin only): filters `event_type`, `entity_type`, newest first.
- Suspending a user also ends that user's open session on its next request.

### Editable risk rules
The numbers behind the rules (19 keys: the block and flag thresholds, each rule's points, the deviation multipliers, the amount bounds, the velocity window) are stored in the `risk_rule_settings` table (`key` unique, `value`, `updated_by`). The migration seeds today's values, so scoring is unchanged until someone edits; a missing row falls back to the default in `RiskRuleConfig`, which also holds each key's allowed range. Values are read once per request.
- `GET /api/v1/admin/risk_rules` (admin, manager): every key with `value`, `default`, `min`, `max`, `whole_number` and a description.
- `PATCH /api/v1/admin/risk_rules/:key` with `value` (admin only): writes a `RISK_RULE_CHANGED` audit entry holding the old and new value. 422 for a non-number, a value outside the range, a fractional value on a whole-number key, or one that breaks an order (`flag_threshold` < `block_threshold`; low < medium < high multipliers; medium < large < very large amount bounds); 404 for an unknown key.
- `POST /api/v1/admin/risk_rules/reset` (admin only): restores every default and writes one `RISK_RULES_RESET` audit entry.

### 6. Recurring Intelligence
- **SolidQueue Scheduler:** Runs every Monday at 08:00 AM.
- **WeeklyReportJob:** Collects 7-day transaction volumes, average spending, and security alert counts.
- **Optimization:** Uses `includes(:user_transaction_stat)` to prevent N+1 queries when processing users.
- **Delivery:** Generates and sends a comprehensive report to each active user.

---

## Project Structure

```
app/
├── controllers/
│   └── api/v1/
│       ├── auth/                    # Registration & Session management
│       ├── admin/                   # Users and audit-log endpoints for admins and managers
│       ├── analytics_controller.rb  # Dashboard analytics with risk constants
│       ├── fraud_feedbacks_controller.rb  # User feedback with atomic writes
│       ├── health_controller.rb     # Health check endpoint
│       ├── notifications_controller.rb   # In-app notifications (soft delete)
│       └── transactions_controller.rb    # Transaction CRUD with safe search
├── jobs/
│   └── weekly_report_job.rb         # Scheduled weekly reports (N+1 optimized)
├── mailers/
│   └── transaction_mailer.rb        # Blocked transaction alerts
├── models/
│   ├── audit_log.rb                 # Immutable audit trail
│   ├── device.rb                    # Trusted device tracking
│   ├── fraud_evaluation.rb          # Risk evaluation records
│   ├── notification.rb              # Soft-deletable notifications
│   ├── transaction.rb               # Financial transactions
│   ├── user.rb                      # User accounts with bcrypt
│   └── user_transaction_stat.rb     # Spending baseline stats
└── services/
    ├── transaction_risk_evaluator.rb    # Orchestrator (atomic transactions)
    ├── risk_rules_processor.rb          # Risk scoring with named constants
    └── transaction_post_processor.rb    # DB writes, notifications, logging
```

## API Documentation for Frontend Integration

Formal API specifications are located in the `docs/` directory.

### Postman Collection
For rapid testing and integration, import the Master Collection:
`postman/MASTER_COLLECTION.json`

---

## Security Measures

| Measure | Implementation |
|---------|---------------|
| SQL Injection | Parameterized queries throughout; `sanitize_sql_like` for search wildcards |
| Authentication | Cookie-based sessions with `HttpOnly` and `SameSite` flags |
| Session Timeout | Configurable timeout (`SESSION_TIMEOUT = 10.minutes`) |
| Password Storage | bcrypt via `has_secure_password` |
| Authorization | Scoped queries (`current_user.transactions`) prevent IDOR |
| Input Validation | Strong params + model validations on all endpoints |
| Error Handling | `RecordNotFound` and `RecordInvalid` rescued gracefully |
| Date Parsing | Safe `Date.parse` with fallback to `Date.current` |
| Data Integrity | `ActiveRecord::Base.transaction` blocks ensure atomic writes |
