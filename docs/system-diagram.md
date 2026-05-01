# System Diagram

```mermaid
graph TD
  A[React Frontend] -->|HTTPS| B[Express API]
  B --> C[(PostgreSQL)]
  B --> D[Email Service]
  B --> E[Payment Provider Stripe/PayFast]
  B --> F[PDF Storage]
```

## Local development

- **Start database**:

```bash
docker compose up -d db
```

- **Environment variables**:
  - `backend/.env`: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `STRIPE_SECRET_KEY`
  - `frontend/.env`: `VITE_API_URL`

- **Run migrations**:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

- **Run apps**:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```
