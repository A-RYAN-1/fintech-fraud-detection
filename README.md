# Fintech Fraud Detection

A comprehensive fraud detection system for fintech applications, built with a robust backend API and modern frontend interface.

## Overview

This project implements an intelligent fraud detection and prevention system designed to protect financial transactions in real-time. It features advanced risk evaluation, transaction monitoring, audit logging, and a user-friendly dashboard for managing fraud cases and viewing transaction analytics.

## Tech Stack

### Backend

- **Framework**: Ruby on Rails 7+
- **Database**: PostgreSQL
- **Queue System**: Redis-based job processing
- **Security**: Brakeman, Bundler Audit
- **Testing**: RSpec/Minitest

### Frontend

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **State Management**: Redux/Context API
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

## Getting Started

### Prerequisites

- Ruby 3.0+
- Node.js 18+
- PostgreSQL 12+
- Redis (for background jobs)
- Docker (optional, for containerization)

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Install Ruby dependencies:

   ```bash
   bundle install
   ```

3. Set up the database:

   ```bash
   rails db:create db:migrate db:seed
   ```

4. Configure credentials:

   ```bash
   EDITOR=nano rails credentials:edit
   ```

5. Start the Rails server:
   ```bash
   rails server
   ```

The API will be available at `http://localhost:3000`

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

### Docker Setup

Build and run the entire application using Docker:

```bash
cd backend
docker build -t fraud-detection-backend .
docker run -p 3000:3000 fraud-detection-backend
```

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

```bash
cd backend
rails test                    # Run all tests
rails test test/models       # Run model tests
rails test test/services     # Run service tests
```

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
- `credentials.yml.enc` - Encrypted secrets (use `rails credentials:edit`)

### Frontend

Configuration files in `frontend/`:

- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration

## Production Deployment

### Backend

1. Build Docker image
2. Set environment variables and encrypted credentials
3. Run database migrations: `rails db:migrate`
4. Start Puma server with production configuration

### Frontend

1. Build production bundle: `npm run build`
2. Deploy `dist/` folder to CDN or static hosting
3. Configure CORS and API endpoints for production

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and write tests
3. Run tests and linting: `npm run lint && npm run test`
4. Submit a pull request

## Project Demo

[Fintech Fraud Detection Enginer.webm](https://github.com/user-attachments/assets/42ca9ee7-99e5-4c0d-afd0-0cd9f127ea64)
