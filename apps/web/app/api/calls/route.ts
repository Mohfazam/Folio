import { NextResponse } from "next/server";
import { getCallRecords, clearCallRecords } from "../../../lib/callStore.js";

export async function GET() {
  const records = await getCallRecords();
  return NextResponse.json({
    ok: true,
    count: records.length,
    calls: records,
  });
}

export async function DELETE() {
  await clearCallRecords();
  return NextResponse.json({
    ok: true,
    message: "Call records cleared successfully",
  });
}
