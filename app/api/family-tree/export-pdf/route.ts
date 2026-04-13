import { NextResponse } from "next/server";
import { exportFamilyToPDF } from "@/app/family-tree/actions";

export async function GET() {
  const result = await exportFamilyToPDF();

  if (!result.success || !result.data) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return new NextResponse(result.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
