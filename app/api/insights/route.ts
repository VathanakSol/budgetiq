import { NextRequest, NextResponse } from "next/server";
import { getBudgetInsights } from "@/lib/insights";

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month");
    if (!month || !MONTH_KEY_PATTERN.test(month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM." }, { status: 400 });
    }

    const insights = await getBudgetInsights(month);
    return NextResponse.json(insights);
  } catch (error) {
    console.error("Failed to compute budget insights", error);
    return NextResponse.json({ error: "Unable to compute insights." }, { status: 500 });
  }
}
