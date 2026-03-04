import { NextRequest, NextResponse } from "next/server";
import { addExpense, getExpensesForMonth } from "@/lib/db";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidMonthKey(month: string) {
  return MONTH_KEY_PATTERN.test(month);
}

function parseAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month");
    if (!month || !isValidMonthKey(month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const expenses = await getExpensesForMonth(month);
    return NextResponse.json({ month, expenses });
  } catch (error) {
    console.error("Failed to fetch expenses", error);
    return NextResponse.json({ error: "Unable to fetch expenses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      month?: string;
      name?: string;
      amount?: unknown;
      category?: string;
    };

    if (!body.month || !isValidMonthKey(body.month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const name = body.name?.trim() ?? "";
    const category = body.category?.trim() ?? "";
    const amount = parseAmount(body.amount);

    if (!name) {
      return NextResponse.json({ error: "Expense name is required." }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: "Expense category is required." }, { status: 400 });
    }

    if (amount === null || amount <= 0) {
      return NextResponse.json({ error: "Expense amount must be greater than 0." }, { status: 400 });
    }

    const expense = await addExpense({
      monthKey: body.month,
      name,
      amount,
      category,
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("Failed to create expense", error);
    return NextResponse.json({ error: "Unable to create expense." }, { status: 500 });
  }
}
