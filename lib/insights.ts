import { getBudgetForMonth, getExpensesForMonth } from "@/lib/db";

type RiskLevel = "Low" | "Medium" | "High";
type IQStatus = "Good" | "Warning" | "Risk";

export type BudgetInsights = {
  month: string;
  iqScore: {
    score: number;
    status: IQStatus;
    spent: number;
    budget: number;
    topCategory: string | null;
    components: {
      budgetControl: number;
      categoryBalance: number;
      consistency: number;
    };
  };
  forecast: {
    forecastEnd: number;
    overrunAmount: number;
    safeToSpendPerDay: number;
    daysLeft: number;
    riskLevel: RiskLevel;
  };
};

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonthKey(monthKey: string) {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    return null;
  }

  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return { year, monthIndex };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function monthProgress(monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    throw new Error("Invalid month key.");
  }

  const today = new Date();
  const selectedValue = parsed.year * 12 + parsed.monthIndex;
  const currentValue = today.getFullYear() * 12 + today.getMonth();

  const daysInMonth = new Date(parsed.year, parsed.monthIndex + 1, 0).getDate();

  if (selectedValue < currentValue) {
    return {
      daysInMonth,
      daysElapsed: daysInMonth,
      daysLeft: 0,
    };
  }

  if (selectedValue > currentValue) {
    return {
      daysInMonth,
      daysElapsed: 0,
      daysLeft: daysInMonth,
    };
  }

  const daysElapsed = today.getDate();
  return {
    daysInMonth,
    daysElapsed,
    daysLeft: daysInMonth - daysElapsed,
  };
}

export async function getBudgetInsights(monthKey: string): Promise<BudgetInsights> {
  if (!MONTH_KEY_PATTERN.test(monthKey)) {
    throw new Error("Invalid month format. Use YYYY-MM.");
  }

  const [budget, currentExpenses] = await Promise.all([
    getBudgetForMonth(monthKey),
    getExpensesForMonth(monthKey),
  ]);

  const spent = currentExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const currentCategoryTotals = new Map<string, number>();
  for (const expense of currentExpenses) {
    currentCategoryTotals.set(
      expense.category,
      (currentCategoryTotals.get(expense.category) ?? 0) + expense.amount
    );
  }

  const sortedCurrentCategories = Array.from(currentCategoryTotals.entries()).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCurrentCategories[0]?.[0] ?? null;
  const topCategorySpend = sortedCurrentCategories[0]?.[1] ?? 0;

  const budgetControl = clamp01(1 - Math.max(0, spent - budget) / Math.max(budget, 1));
  const categoryBalance = spent > 0 ? clamp01(1 - topCategorySpend / spent) : 1;

  const progress = monthProgress(monthKey);
  const dailyTotals = new Map<number, number>();
  for (const expense of currentExpenses) {
    const dayOfMonth = new Date(expense.createdAt).getDate();
    if (dayOfMonth >= 1 && dayOfMonth <= progress.daysElapsed) {
      dailyTotals.set(dayOfMonth, (dailyTotals.get(dayOfMonth) ?? 0) + expense.amount);
    }
  }

  let consistency = 1;
  if (progress.daysElapsed > 0) {
    const series = Array.from({ length: progress.daysElapsed }, (_, index) => dailyTotals.get(index + 1) ?? 0);
    const average = series.reduce((sum, value) => sum + value, 0) / series.length;
    const variance =
      series.reduce((sum, value) => sum + (value - average) * (value - average), 0) / series.length;
    const stdDev = Math.sqrt(variance);
    consistency = clamp01(1 - Math.min(1, stdDev / Math.max(average, 1)));
  }

  const score = Math.round((budgetControl * 0.6 + categoryBalance * 0.25 + consistency * 0.15) * 100);
  const status: IQStatus = score >= 75 ? "Good" : score >= 50 ? "Warning" : "Risk";

  const spentSoFar = spent;
  const dailyRate = progress.daysElapsed > 0 ? spentSoFar / progress.daysElapsed : 0;
  const forecastEnd = progress.daysElapsed > 0 ? dailyRate * progress.daysInMonth : spentSoFar;
  const overrunAmount = Math.max(0, forecastEnd - budget);
  const safeToSpendPerDay = progress.daysLeft > 0 ? Math.max(0, (budget - spentSoFar) / progress.daysLeft) : 0;

  let riskLevel: RiskLevel = "Low";
  if (budget <= 0) {
    riskLevel = forecastEnd > 0 ? "High" : "Low";
  } else {
    const usageRatio = forecastEnd / budget;
    if (usageRatio > 1) {
      riskLevel = "High";
    } else if (usageRatio > 0.8) {
      riskLevel = "Medium";
    }
  }

  return {
    month: monthKey,
    iqScore: {
      score,
      status,
      spent: round2(spent),
      budget: round2(budget),
      topCategory,
      components: {
        budgetControl: round2(budgetControl),
        categoryBalance: round2(categoryBalance),
        consistency: round2(consistency),
      },
    },
    forecast: {
      forecastEnd: round2(forecastEnd),
      overrunAmount: round2(overrunAmount),
      safeToSpendPerDay: round2(safeToSpendPerDay),
      daysLeft: progress.daysLeft,
      riskLevel,
    },
  };
}
