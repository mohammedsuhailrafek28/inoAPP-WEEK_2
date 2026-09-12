export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  // Present only on document-grounded assistant replies (Phase 3 RAG).
  citations?: MessageCitation[];
  groundingStatus?: "grounded" | "insufficient";
};

// Compact, display-only citation. Mirrors the authoritative server Citation but
// carries just what the UI renders.
export type MessageCitation = {
  citationId: string;
  filename: string;
  pageNumber: number;
};

export type ExplanationMode = "simple" | "detailed" | "exam";

export type ExamMarks = 2 | 5 | 10 | 16;

export interface ChatRequest {
  message: string;
  mode: ExplanationMode;
  history: ChatMessage[];
  marks?: ExamMarks;
}

export interface ChatResponse {
  content: string;
}

export interface ChatErrorResponse {
  error: string;
}
