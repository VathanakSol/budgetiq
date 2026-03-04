import { NextResponse } from "next/server";
import { deleteExpenseById } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const expenseId = Number(id);

    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      return NextResponse.json({ error: "Invalid expense ID." }, { status: 400 });
    }

    await deleteExpenseById(expenseId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete expense", error);
    return NextResponse.json({ error: "Unable to delete expense." }, { status: 500 });
  }
}
