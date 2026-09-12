# AI Document Assistant

**Week 2 — InnoApp Technologies Generative AI Internship**

An editorial, dark, minimal study tool. Upload your own PDFs, select which ones
count as sources, and ask questions that are answered **only** from that material —
with every answer citing the exact document and physical page it came from.

---

## Problem

General AI chat will confidently answer from its training data, blend in
unsupported detail, and cannot point you to *where* in your notes something is
covered. For exam preparation that is the wrong tool: a student needs answers
that are traceable to their own lecture notes or textbook, and a clear signal
when the material simply does not cover a question.

## Solution

A retrieval-grounded assistant:

1. **Upload study material** — a text-based PDF.
2. **Wait for processing** — the document is read, split into page-aware pieces,
   embedded, and stored.
3. **Select source material** — choose one or more ready documents.
4. **Ask questions** — the question is embedded and matched against *only* the
   selected documents.
5. **Receive grounded answers** — the model is given the retrieved passages and
   nothing else, and is instructed to answer strictly from them.
6. **See exactly which document / page supports the answer** — citations are
   built on the server from retrieval metadata, never from model text.

If nothing relevant is found, the assistant says so and does **not** fall back to
a general answer.

## Features

- PDF upload with validation (type, size, signature) and private storage.
- Page-aware extraction and deterministic, page-scoped chunking.
- Semantic retrieval restricted to the user-selected documents.
- Quality threshold — weak matches are treated as "not covered".
- Grounded generation with an untrusted-source boundary (prompt-injection aware).
- Authoritative, server-built citations → real document → real physical page.
- Deterministic "not found in selected material" response when evidence is thin.
- Three answer styles — **Simple**, **Deep Dive**, **Exam** (2 / 5 / 10 / 16 marks).
  Style changes presentation only; it never changes what counts as evidence.
- Multi-turn conversations that re-run retrieval every turn (history is context,
  not evidence).
- Generic (non-document) study chat is still available when no document is selected.

## Architecture

```
PDF
  → Extraction (page-aware text)
  → Page-aware Chunking (deterministic, never crosses a page boundary)
  → Gemini Embeddings (task-typed: document vs query)
  → Supabase pgvector (vector similarity, filtered by selected document)
  → Semantic Retrieval (Top-K above a quality threshold)
  → Grounded Gemini Answer (only retrieved passages are provided)
  → Authoritative Source / Page Citations (assembled server-side)
```

### RAG request flow (`/api/rag`)

```
validate request
  → embed the query
  → pgvector search over ONLY the selected document ids
  → if retrieval is insufficient  → deterministic refusal, no generation call
  → assign stable evidence labels  (S1, S2, …)  server-side
  → apply an evidence context budget (drop lowest-ranked whole blocks)
  → build a grounded prompt: system rules + question + delimited untrusted sources
  → Gemini generation (JSON: { answer, usedSources })
  → parse / validate output (tolerant parser, safe on malformed output)
  → map referenced labels back to server-owned metadata
  → return { status, answer, citations, evidence }
```

## Technology stack

- **Next.js (App Router)** + **React** + **TypeScript**
- **Tailwind CSS v4** for the interface
- **Google Gemini** (`@google/genai`) — embeddings and generation
- **Supabase** — Postgres + `pgvector` for vectors, Storage for the original PDFs
- **pdfjs-dist** — server-side PDF text extraction
- **node:test** + **tsx** — test runner (no test framework dependency)

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase project

- Create a Supabase project.
- Enable the `vector` extension (the migration does this).
- Create a **private** Storage bucket for the PDFs (default name: `documents`;
  the first migration also provisions it).
- Link the CLI (optional, for running migrations from this repo):

  ```bash
  npx supabase link --project-ref <your-project-ref>
  ```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in the values. Variable **names**
only — never commit real values:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key (browser-safe) |
| `SUPABASE_URL` | Supabase project URL (server) |
| `SUPABASE_SECRET_KEY` | Supabase **service** key — server only, never exposed |
| `GEMINI_API_KEY` | Google Gemini API key — server only |
| `SUPABASE_DOCUMENTS_BUCKET` | *(optional)* Storage bucket name; defaults to `documents` |

`.env.local` and every `.env*` file except `.env.example` are git-ignored.

### 4. Migrations

Apply the SQL in `supabase/migrations/` in order:

- `001_document_assistant.sql` — `documents` / `document_chunks` tables,
  `vector(768)` column, HNSW cosine index, `updated_at` trigger, RLS enabled,
  private Storage bucket.
- `002_semantic_retrieval.sql` — the `match_document_chunks` RPC
  (filtered pgvector similarity search).

```bash
npx supabase db push
# or run each file in the Supabase SQL editor, in order
```

### 5. Run

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
```

## Usage

1. Open the app. With no documents you get an upload-focused start screen and a
   generic study composer.
2. Upload a text-based PDF. Processing is synchronous; the row shows **Ready**
   with a page count when done.
3. Tick one or more **Ready** documents under **Sources**.
4. Ask a question. The header shows *Answering from N sources*. The composer
   placeholder switches to *Ask about your selected material…*.
5. Read the answer. A **Sources** block lists each cited document and page.
6. Ask something the notes don't cover — you get a calm
   *Not found in selected material* response, not an error, and no generic answer.
7. Change **Simple / Deep Dive / Exam** (and marks) any time — the sources used
   do not change.

## Grounding behavior

- **Evidence only.** The model is given the retrieved passages and is told to use
  only them for document facts, to state when the material is incomplete, and to
  never introduce unsupported claims.
- **Untrusted sources.** Retrieved document text is placed inside an explicit
  `BEGIN/END UNTRUSTED RETRIEVED SOURCES` block in the user turn — never
  concatenated into the system instruction. The system rules tell the model that
  source text is data, not instructions, and must not be obeyed, revealed, or
  acted on.
- **Insufficient retrieval → no generation.** If the vector search returns
  nothing above the quality threshold, the API returns a fixed refusal message
  with zero citations and makes no model call.
- **Multi-turn.** Retrieval runs again for every question. Earlier assistant
  messages are conversational context for resolving references ("explain that
  again") and are never treated as factual evidence.
- **Mode independence.** Simple / Deep Dive / Exam and the mark target change
  answer length and structure only. A 16-mark request will not invent extra
  material to fill the format; it will say the material is limited.

## Citation architecture

Citations are **authoritative** and assembled entirely on the server:

- Retrieval returns `chunkId`, `documentId`, `filename`, `pageNumber` (the real
  physical PDF page persisted at ingestion), `similarity`.
- Each retrieved passage is given a stable label (`S1`, `S2`, …) on the server.
- The model may reference only those labels. Its output is parsed for the labels
  it used.
- Unknown labels (`S99`), malformed labels, and duplicates are dropped — never
  turned into a citation.
- Each surviving label is mapped back to its server-owned metadata. `filename`
  and `pageNumber` in a citation are copied from retrieval, **never parsed from
  model prose**.
- Citations are de-duplicated by chunk and returned in retrieval-rank order.

The full chain, verified end to end:

```
PDF physical page
  → persisted document_chunks.page_number
  → retrieval result pageNumber
  → server evidence label (S1…)
  → response Citation.pageNumber   (identical at every step)
```

## Supported PDFs & limitations

- **Text-based PDFs only.** Scanned / image-only PDFs are detected and marked
  **Scanned PDF — text extraction unavailable**. There is no OCR.
- Max upload size **20 MB**; PDF MIME type and `%PDF-` signature required.
- Password-protected PDFs are rejected with a clear message.
- Chunk token counts are word-based approximations, not a Gemini tokenizer.
- Retrieval is pure vector similarity — no keyword/hybrid search, no re-ranker.
- Ingestion is synchronous: the upload request returns when the document is
  fully processed. There are no progress percentages, only truthful states
  (Processing / Ready / Processing failed / Scanned PDF).

## Testing

```bash
npm test        # node:test via tsx — deterministic, no network
npm run lint    # eslint
npm run build   # type-check + production build
```

The test suite (embedding validation, retrieval failure paths, citation
mapping, prompt construction, grounded-service behavior, prompt-injection
delimiting, multi-turn grounding) uses mocked retrieval and generation and makes
**no real Gemini or Supabase calls**.

## Project structure

```
app/
  page.tsx                  workspace shell (documents rail + study area)
  layout.tsx                fonts, metadata
  globals.css               dark editorial design tokens + answer typography
  api/
    chat/route.ts           generic (non-document) study chat  — Week 1, unchanged
    documents/route.ts      upload + list
    documents/[id]/route.ts delete
    retrieval/route.ts      semantic retrieval (debug/internal)
    rag/route.ts            grounded question answering
components/
  DocumentWorkspace.tsx     upload + library + source selection
  EmptyState.tsx            workflow-teaching start screen
  ChatWindow.tsx            conversation list
  MessageBubble.tsx         answer rendering + Sources block
  Composer.tsx  Header.tsx  ModeControls.tsx
lib/
  ai.ts  prompts.ts         Week 1 generic chat — unchanged
  supabase/                 server-only admin + server clients
  documents/
    validation.ts           upload validation
    pdf-extractor.ts        page-aware text extraction
    chunker.ts              deterministic page-scoped chunking
    embeddings.ts           Gemini embeddings (task-typed, validated, retried)
    ingestion.ts            upload → store → extract → chunk → embed → ready
    retrieval.ts            query embedding + filtered pgvector RPC + row validation
    rag-prompt.ts           grounded prompt builder (system rules + untrusted sources)
    rag-generation.ts       Gemini generation call (JSON output, safe errors)
    rag.ts                  RAG orchestration + evidence budget + output parsing
    citations.ts            authoritative citation assembly + validation
types/
  chat.ts  documents.ts  rag.ts
supabase/
  migrations/               schema + retrieval RPC
tests/
```

## Security notes

- `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are used only in server modules;
  the privileged Supabase client is marked `server-only` and cannot be imported
  into client code.
- `/api/rag` returns only `{ status, answer, citations, evidence }`. It never
  returns vectors, prompts, API keys, or raw database / provider errors —
  request errors map to safe messages, generation failures to a generic message.
- Uploaded document text is treated as untrusted input at every stage and is
  never allowed into the system instruction.
- PDFs are stored in a **private** Supabase Storage bucket; RLS is enabled and
  all data access goes through the server service role.
- `.env.local`, `.next/`, `node_modules/`, Supabase CLI state (`supabase/.temp`),
  and local scratch files are git-ignored.

## Week 2 scope

**In scope:** PDF upload & processing, page-aware chunking, Gemini embeddings,
Supabase pgvector storage, selected-document semantic retrieval, quality
threshold, grounded generation, authoritative page-level citations,
insufficient-evidence refusal, Simple / Deep Dive / Exam modes over grounded
evidence, multi-turn grounding, and a productized dark editorial interface.

**Deliberately not in scope:** authentication / multi-user, an in-app PDF viewer,
OCR, hybrid or keyword search, a re-ranker, persistent chat history, analytics,
and any Week 3 profile / memory features.

## Known limitations

- Single-user: no auth; RLS is enabled but no per-user policy is claimed yet.
- Synchronous ingestion blocks the upload request for the duration of processing
  (fine for the target PDF sizes; not suitable for very large documents).
- No live status polling — because ingestion is synchronous, a document is either
  already `Ready` when the upload returns, or `Processing failed` / `Scanned PDF`.
- Answer quality for supported questions depends on the live Gemini model;
  automated tests guarantee structure, grounding rules, and citation integrity,
  not prose quality.
- Prompt-injection handling is defense-in-depth (delimiting + explicit rules),
  not a guarantee.
- Conversation history is in-memory only and is trimmed before being sent to the
  model.
