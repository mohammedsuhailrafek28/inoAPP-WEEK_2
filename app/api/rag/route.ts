import { NextRequest, NextResponse } from "next/server";
import type { ChatMessage } from "@/types/chat";
import type { RagRequest } from "@/types/rag";
import { answerWithRag, RagGenerationError, RagRequestError } from "@/lib/documents/rag";

export const runtime = "nodejs";

function normaliseHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatMessage =>
      !!item && typeof item === "object" &&
      (( item as ChatMessage).role === "user" || (item as ChatMessage).role === "assistant") &&
      typeof (item as ChatMessage).content === "string")
    .slice(-20)
    .map((item) => ({ id: String(item.id ?? ""), role: item.role, content: item.content, timestamp: Number(item.timestamp ?? 0) }));
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
  }

  const payload: RagRequest = {
    question: typeof body.question === "string" ? body.question : "",
    documentIds: Array.isArray(body.documentIds) ? body.documentIds.filter((id): id is string => typeof id === "string") : [],
    mode: (body.mode === "simple" || body.mode === "detailed" || body.mode === "exam") ? body.mode : "simple",
    marks: typeof body.marks === "number" ? (body.marks as RagRequest["marks"]) : undefined,
    history: normaliseHistory(body.history),
  };

  try {
    const result = await answerWithRag(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RagRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RagGenerationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    // Never surface raw database / provider errors.
    return NextResponse.json({ error: "Something went wrong while answering from your documents. Please try again." }, { status: 500 });
  }
}
