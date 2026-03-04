import { neon } from "@neondatabase/serverless";

export type ExpenseRecord = {
  id: number;
  name: string;
  amount: number;
  category: string;
  createdAt: string;
};

const connectionString = process.env.DATABASE_URL;
const sql = connectionString ? neon(connectionString) : null;

let schemaInitPromise: Promise<void> | null = null;

function getSqlClient() {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return sql;
}

async function ensureSchema() {
  if (schemaInitPromise) {
    await schemaInitPromise;
    return;
  }

  const client = getSqlClient();
  schemaInitPromise = (async () => {
    await client`CREATE TABLE IF NOT EXISTS budgets (
      month_key TEXT PRIMARY KEY,
      amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await client`CREATE TABLE IF NOT EXISTS expenses (
      id BIGSERIAL PRIMARY KEY,
      month_key TEXT NOT NULL,
      name TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL CHECK (amount > 0),
      category TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;

    await client`CREATE INDEX IF NOT EXISTS expenses_month_key_idx ON expenses (month_key)`;
  })();

  await schemaInitPromise;
}

export async function getBudgetForMonth(monthKey: string) {
  await ensureSchema();
  const client = getSqlClient();

  const rows = (await client`
    SELECT amount
    FROM budgets
    WHERE month_key = ${monthKey}
    LIMIT 1
  `) as Array<{ amount: number | string }>;

  return Number(rows[0]?.amount ?? 0);
}

export async function upsertBudgetForMonth(monthKey: string, amount: number) {
  await ensureSchema();
  const client = getSqlClient();

  const rows = (await client`
    INSERT INTO budgets (month_key, amount)
    VALUES (${monthKey}, ${amount})
    ON CONFLICT (month_key)
    DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
    RETURNING amount
  `) as Array<{ amount: number | string }>;

  return Number(rows[0]?.amount ?? 0);
}

export async function getExpensesForMonth(monthKey: string): Promise<ExpenseRecord[]> {
  await ensureSchema();
  const client = getSqlClient();

  const rows = (await client`
    SELECT id, name, amount, category, created_at
    FROM expenses
    WHERE month_key = ${monthKey}
    ORDER BY created_at DESC, id DESC
  `) as Array<{
    id: number | string;
    name: string;
    amount: number | string;
    category: string;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    createdAt: row.created_at,
  }));
}

export async function addExpense(params: {
  monthKey: string;
  name: string;
  amount: number;
  category: string;
}): Promise<ExpenseRecord> {
  await ensureSchema();
  const client = getSqlClient();

  const rows = (await client`
    INSERT INTO expenses (month_key, name, amount, category)
    VALUES (${params.monthKey}, ${params.name}, ${params.amount}, ${params.category})
    RETURNING id, name, amount, category, created_at
  `) as Array<{
    id: number | string;
    name: string;
    amount: number | string;
    category: string;
    created_at: string;
  }>;

  const row = rows[0];
  return {
    id: Number(row.id),
    name: row.name,
    amount: Number(row.amount),
    category: row.category,
    createdAt: row.created_at,
  };
}

export async function deleteExpenseById(id: number) {
  await ensureSchema();
  const client = getSqlClient();

  await client`
    DELETE FROM expenses
    WHERE id = ${id}
  `;
}
