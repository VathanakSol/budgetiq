# BudgetIQ Monthly Budget Tracker

Next.js app with Neon Postgres persistence for monthly budgets and expenses.

## Features

- Month navigation with previous/next arrows
- Editable monthly budget
- Budget progress bar (green → amber → red)
- Donut chart for category spending
- Add expense form (name, amount, category)
- Expense list with delete action
- Sidebar with category totals and remaining balance

## Tech Stack

- Next.js App Router
- TypeScript
- Neon Postgres (`@neondatabase/serverless`)
- Recharts

## Setup

1. Install dependencies:

	```bash
	npm install
	```

2. Create your environment file from the sample:

	```bash
	copy .env.example .env.local
	```

3. Set `DATABASE_URL` in `.env.local` using your Neon connection string.

4. Start the app:

	```bash
	npm run dev
	```

5. Open http://localhost:3000.

## Database

- API routes auto-create required tables on first request.
- Reference schema is in `db/schema.sql`.

## API Endpoints

- `GET /api/budget?month=YYYY-MM`
- `PUT /api/budget`
- `GET /api/expenses?month=YYYY-MM`
- `POST /api/expenses`
- `DELETE /api/expenses/:id`
- `GET /api/insights?month=YYYY-MM`
