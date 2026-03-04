import { NextRequest, NextResponse } from "next/server";
import { getBudgetForMonth, upsertBudgetForMonth } from "@/lib/db";

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

    const budget = await getBudgetForMonth(month);
    return NextResponse.json({ month, budget });
  } catch (error) {
    console.error("Failed to read monthly budget", error);
    return NextResponse.json({ error: "Unable to fetch budget." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { month?: string; amount?: unknown };
    if (!body.month || !isValidMonthKey(body.month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const amount = parseAmount(body.amount);
    if (amount === null || amount < 0) {
      return NextResponse.json({ error: "Budget amount must be a non-negative number." }, { status: 400 });
    }

    const budget = await upsertBudgetForMonth(body.month, amount);
    return NextResponse.json({ month: body.month, budget });
  } catch (error) {
    console.error("Failed to update monthly budget", error);
    return NextResponse.json({ error: "Unable to update budget." }, { status: 500 });
  }
}
