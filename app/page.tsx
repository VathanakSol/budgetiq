"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Expense = {
  id: number;
  name: string;
  amount: number;
  category: string;
  createdAt: string;
};

type Insights = {
  month: string;
  iqScore: {
    score: number;
    status: "Good" | "Warning" | "Risk";
    spent: number;
    budget: number;
    topCategory: string | null;
  };
  forecast: {
    forecastEnd: number;
    overrunAmount: number;
    safeToSpendPerDay: number;
    daysLeft: number;
    riskLevel: "Low" | "Medium" | "High";
  };
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const CATEGORY_OPTIONS = [
  "Housing",
  "Food",
  "Transportation",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Other",
];

const CARD_CLASS =
  "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md";
const INPUT_CLASS =
  "rounded-md border border-zinc-300 px-3 py-2 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";
const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";
const NAV_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-3 py-1 text-lg leading-none text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 active:scale-95";

function monthKeyFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatCurrency(value: number) {
  return CURRENCY_FORMATTER.format(Number.isFinite(value) ? value : 0);
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`} />;
}

function getIQStatusStyle(status: Insights["iqScore"]["status"]) {
  if (status === "Good") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "Warning") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

function getRiskStyle(level: Insights["forecast"]["riskLevel"]) {
  if (level === "Low") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (level === "Medium") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

export default function Home() {
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [budget, setBudget] = useState(0);
  const [budgetInput, setBudgetInput] = useState("0");
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [insightsError, setInsightsError] = useState("");

  const [nameInput, setNameInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [categoryInput, setCategoryInput] = useState(CATEGORY_OPTIONS[0]);
  const [formError, setFormError] = useState("");
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const selectedMonthKey = useMemo(() => monthKeyFromDate(selectedMonth), [selectedMonth]);

  const totalSpent = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  const remaining = budget - totalSpent;

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    }

    return Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const pieData = categoryTotals.map((item) => ({
    name: item.category,
    value: item.amount,
  }));

  const budgetUsageRatio = budget > 0 ? totalSpent / budget : totalSpent > 0 ? 1 : 0;
  const progressWidth = `${Math.min(budgetUsageRatio * 100, 100)}%`;
  const progressColorClass =
    budgetUsageRatio <= 0.7
      ? "bg-emerald-500"
      : budgetUsageRatio <= 1
        ? "bg-amber-500"
        : "bg-rose-500";

  useEffect(() => {
    let isCancelled = false;

    async function loadMonthData() {
      setIsLoadingData(true);
      setDataError("");
      setIsLoadingInsights(true);
      setInsightsError("");

      try {
        const [budgetResponse, expensesResponse, insightsResponse] = await Promise.all([
          fetch(`/api/budget?month=${selectedMonthKey}`),
          fetch(`/api/expenses?month=${selectedMonthKey}`),
          fetch(`/api/insights?month=${selectedMonthKey}`),
        ]);

        if (!budgetResponse.ok || !expensesResponse.ok) {
          throw new Error("Unable to load data for this month.");
        }

        const budgetPayload = (await budgetResponse.json()) as { budget: number };
        const expensesPayload = (await expensesResponse.json()) as { expenses: Expense[] };

        if (!isCancelled) {
          const monthlyBudget = Number(budgetPayload.budget ?? 0);
          setBudget(monthlyBudget);
          setBudgetInput(String(monthlyBudget));
          setExpenses(expensesPayload.expenses ?? []);

          if (insightsResponse.ok) {
            const insightsPayload = (await insightsResponse.json()) as Insights;
            setInsights(insightsPayload);
            setInsightsError("");
          } else {
            setInsights(null);
            setInsightsError("Unable to load BudgetIQ insights.");
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setDataError(error instanceof Error ? error.message : "Unable to load monthly data.");
          setInsights(null);
          setInsightsError("Unable to load BudgetIQ insights.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingData(false);
          setIsLoadingInsights(false);
        }
      }
    }

    void loadMonthData();

    return () => {
      isCancelled = true;
    };
  }, [selectedMonthKey]);

  async function refreshInsights() {
    setIsLoadingInsights(true);
    setInsightsError("");

    try {
      const response = await fetch(`/api/insights?month=${selectedMonthKey}`);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to refresh BudgetIQ insights.");
      }

      const payload = (await response.json()) as Insights;
      setInsights(payload);
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : "Unable to refresh BudgetIQ insights.");
    } finally {
      setIsLoadingInsights(false);
    }
  }

  async function saveBudget() {
    const parsedBudget = Number(budgetInput);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setFormError("Budget must be a non-negative number.");
      return;
    }

    setFormError("");
    setIsSavingBudget(true);

    try {
      const response = await fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonthKey,
          amount: parsedBudget,
        }),
      });

      const payload = (await response.json()) as { budget?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update budget.");
      }

      const monthlyBudget = Number(payload.budget ?? parsedBudget);
      setBudget(monthlyBudget);
      setBudgetInput(String(monthlyBudget));
      setIsEditingBudget(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update budget.");
    } finally {
      setIsSavingBudget(false);
    }
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = nameInput.trim();
    const category = categoryInput.trim();
    const amount = Number(amountInput);

    if (!name) {
      setFormError("Expense name is required.");
      return;
    }

    if (!category) {
      setFormError("Expense category is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Expense amount must be greater than 0.");
      return;
    }

    setFormError("");
    setIsSubmittingExpense(true);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonthKey,
          name,
          amount,
          category,
        }),
      });

      const payload = (await response.json()) as {
        expense?: Expense;
        error?: string;
      };

      if (!response.ok || !payload.expense) {
        throw new Error(payload.error ?? "Unable to add expense.");
      }

      setExpenses((previous) => [payload.expense as Expense, ...previous]);
      setNameInput("");
      setAmountInput("");
      setCategoryInput(CATEGORY_OPTIONS[0]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to add expense.");
    } finally {
      setIsSubmittingExpense(false);
    }
  }

  async function handleDeleteExpense(id: number) {
    setPendingDeleteId(id);

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Unable to delete expense.");
      }

      setExpenses((previous) => previous.filter((expense) => expense.id !== id));
      setFormError("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete expense.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 px-4 py-8 text-zinc-900 sm:px-6 lg:px-8">
      <main className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className={CARD_CLASS}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium tracking-wide text-zinc-500">Monthly Budget Tracker</p>
                <div className="mt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}
                    className={NAV_BUTTON_CLASS}
                    aria-label="Previous month"
                  >
                    ‹
                  </button>
                  <h1 className="text-xl font-semibold tracking-tight">{monthLabel(selectedMonth)}</h1>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}
                    className={NAV_BUTTON_CLASS}
                    aria-label="Next month"
                  >
                    ›
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-medium text-zinc-500">Budget</p>
                {isLoadingData ? (
                  <div className="flex items-center justify-end">
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : !isEditingBudget ? (
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-2xl font-bold tracking-tight">{formatCurrency(budget)}</p>
                    <button
                      type="button"
                      onClick={() => setIsEditingBudget(true)}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={budgetInput}
                      onChange={(event) => setBudgetInput(event.target.value)}
                      className={`${INPUT_CLASS} w-36 py-1 text-right`}
                    />
                    <button
                      type="button"
                      onClick={() => void saveBudget()}
                      disabled={isSavingBudget}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {isLoadingData ? (
                <>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </>
              ) : (
                <>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 ring-1 ring-zinc-200/80">
                    <div
                      className={`h-full ${progressColorClass} transition-all duration-500`}
                      style={{ width: progressWidth }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>Spent: {formatCurrency(totalSpent)}</span>
                    <span>Remaining: {formatCurrency(remaining)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={CARD_CLASS}>
            <h2 className="text-lg font-semibold">Spending by Category</h2>
            <div className="mt-4 h-72">
              {isLoadingData ? (
                <div className="flex h-full flex-col items-center justify-center gap-4">
                  <Skeleton className="h-44 w-44 rounded-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ) : pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 text-sm text-zinc-500">
                  Add expenses to see the category breakdown.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="58%"
                      outerRadius="85%"
                      paddingAngle={2}
                    />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={CARD_CLASS}>
            <h2 className="text-lg font-semibold">Add Expense</h2>
            <form onSubmit={handleAddExpense} className="mt-4 grid gap-3 sm:grid-cols-4">
              <input
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                placeholder="Expense name"
                className={`${INPUT_CLASS} sm:col-span-2`}
              />
              <input
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="Amount"
                type="number"
                min="0"
                step="0.01"
                className={INPUT_CLASS}
              />
              <select
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                className={INPUT_CLASS}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSubmittingExpense}
                className="rounded-md bg-zinc-900 px-3 py-2 font-medium text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-4"
              >
                {isSubmittingExpense ? "Adding..." : "Add Expense"}
              </button>
            </form>
            {formError ? <p className="mt-3 text-sm text-rose-600">{formError}</p> : null}
          </div>

          <div className={CARD_CLASS}>
            <h2 className="text-lg font-semibold">Expenses</h2>
            {isLoadingData ? (
              <ul className="mt-4 space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li key={index} className="rounded-md border border-zinc-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : dataError ? (
              <p className="mt-4 text-sm text-rose-600">{dataError}</p>
            ) : expenses.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No expenses yet for this month.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {expenses.map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50"
                  >
                    <div>
                      <p className="font-medium">{expense.name}</p>
                      <p className="text-sm text-zinc-500">
                        {expense.category} · {new Date(expense.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">{formatCurrency(expense.amount)}</p>
                      <button
                        type="button"
                        onClick={() => void handleDeleteExpense(expense.id)}
                        className="rounded px-2 py-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                        aria-label={`Delete ${expense.name}`}
                        disabled={pendingDeleteId === expense.id}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className={`${CARD_CLASS} h-fit lg:sticky lg:top-6`}>
          <h2 className="text-lg font-semibold">Sidebar</h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-zinc-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="group relative inline-flex items-center">
                  <p className="cursor-help text-sm font-medium text-zinc-500">BudgetIQ Insights</p>
                  <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-72 rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-600 shadow-sm group-hover:block group-focus-within:block">
                    BudgetIQ analyzes your monthly budget and expenses to estimate your spending health
                    score, month-end forecast, and safe daily spend.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshInsights()}
                  disabled={isLoadingInsights}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingInsights ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              {isLoadingInsights ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-8 w-24" />
                    <Skeleton className="mt-2 h-3 w-36" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-zinc-200 p-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="mt-2 h-4 w-20" />
                    </div>
                    <div className="rounded-md border border-zinc-200 p-2">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="mt-2 h-4 w-20" />
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-200 p-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </div>
                </div>
              ) : insightsError || !insights ? (
                <p className="mt-2 text-sm text-rose-600">{insightsError || "Insights unavailable."}</p>
              ) : (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-500">Spending IQ Score</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getIQStatusStyle(insights.iqScore.status)}`}
                      >
                        {insights.iqScore.status}
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-zinc-900">{insights.iqScore.score}/100</p>
                    
                    <p className="mt-2 text-xs text-zinc-600">
                      Top category: {insights.iqScore.topCategory ?? "No data yet"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-zinc-200 p-2">
                      <p className="text-xs text-zinc-500">Forecast End</p>
                      <p className="font-semibold text-zinc-900">
                        {formatCurrency(insights.forecast.forecastEnd)}
                      </p>
                    </div>
                    <div className="rounded-md border border-zinc-200 p-2">
                      <p className="text-xs text-zinc-500">Safe / Day</p>
                      <p className="font-semibold text-zinc-900">
                        {formatCurrency(insights.forecast.safeToSpendPerDay)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
                    <div>
                      <p className="text-xs text-zinc-500">Risk Level</p>
                      <p className="text-xs text-zinc-600">{insights.forecast.daysLeft} day(s) left in month</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getRiskStyle(insights.forecast.riskLevel)}`}
                    >
                      {insights.forecast.riskLevel}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-zinc-500">Remaining Balance</p>
              {isLoadingData ? (
                <Skeleton className="mt-1 h-8 w-36" />
              ) : (
                <p className={`text-2xl font-bold ${remaining < 0 ? "text-rose-600" : "text-zinc-900"}`}>
                  {formatCurrency(remaining)}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-500">Category Totals</p>
              {isLoadingData ? (
                <ul className="mt-2 space-y-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
                    >
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-14" />
                    </li>
                  ))}
                </ul>
              ) : categoryTotals.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">No category totals yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {categoryTotals.map((item) => (
                    <li
                      key={item.category}
                      className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm"
                    >
                      <span>{item.category}</span>
                      <span className="font-medium">{formatCurrency(item.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
