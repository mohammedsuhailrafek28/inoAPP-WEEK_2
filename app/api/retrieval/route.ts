import { NextRequest, NextResponse } from "next/server";
import { retrieveDocumentChunks } from "@/lib/documents/retrieval";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { question?: unknown; documentIds?: unknown };
    if (typeof body.question !== "string" || !Array.isArray(body.documentIds) || !body.documentIds.every((id) => typeof id === "string")) return NextResponse.json({ error: "A question and documentIds are required." }, { status: 400 });
    return NextResponse.json(await retrieveDocumentChunks(body.question, body.documentIds));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Retrieval failed." }, { status: 500 }); }
}
