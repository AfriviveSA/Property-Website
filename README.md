# The Property Guy

Full-stack desktop web app for South African property investment analysis.

## Solution Layout

- `ThePropertyGuy.sln`: Visual Studio solution entry point
- `frontend`: React + TypeScript + Vite client
- `backend`: Node.js + Express + TypeScript API with Prisma ORM

## Quick Start

1. Install Node.js 20+ and npm.
2. Copy env templates:
   - `cp frontend/.env.example frontend/.env`
   - `cp backend/.env.example backend/.env`
3. Install dependencies:
   - `cd backend && npm install`
   - `cd ../frontend && npm install`
4. Prepare database (SQLite dev):
   - `cd ../backend && npm run prisma:generate && npm run prisma:migrate`
5. Start services:
   - `npm run dev` in `backend`
   - `npm run dev` in `frontend`

## Core Features Implemented

- JWT auth with bcrypt password hashing
- Email confirmation token flow (pluggable mailer)
- Subscription states (FREE, TRIAL, SUBSCRIBED)
- Free usage limiter (3 calculations for guests/users)
- Multiple property calculators with reusable engine
- PDF report generation endpoint
- Saved reports endpoint scaffolding
- Blog/Learn, Contact, Admin, Dashboard frontend pages
- SEO files (`robots.txt`, `sitemap.xml`) and semantic layout
- Accessibility-aware form labels, keyboard-focusable controls, high contrast theme

## Test Commands

- Backend unit tests: `npm run test`
- Backend integration tests: `npm run test:integration`
- Frontend tests: `npm run test`

## Deployment

- Dockerfiles for frontend and backend included.
- `docker-compose.yml` provided for local container orchestration.
- Add CI pipeline to run tests, migrations, and build artifacts before deploy.

## Disclaimer

This software provides estimates and not financial, legal, tax, or investment advice.
