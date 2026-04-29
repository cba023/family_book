import { NextResponse } from "next/server";
import { autoInitialize } from "@/lib/auto-init";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await autoInitialize();

  if (result.success) {
    return NextResponse.json({
      status: "ok",
      message: result.message,
    });
  }

  return NextResponse.json(
    {
      status: "error",
      message: result.message,
    },
    { status: 500 },
  );
}
