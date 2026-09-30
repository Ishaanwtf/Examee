# ExamAI (hackathon prototype)

A full-stack app that OCRs handwritten/printed exam answer sheets using
Gemini Vision (via AICredits), inside an "ExamAI" dashboard UI: Dashboard,
Answer Sheets (upload), and an Evaluation panel. No database, no auth, no
cloud storage — files are processed in memory and discarded once the
response is sent.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS, `lucide-react` icons
- `/api/process` route → [AICredits](https://aicredits.in) OpenAI-compatible
  API (`openai` Node SDK, pointed at `https://aicredits.in/v1`) → Gemini
  vision model

## Setup

```bash
npm install
cp .env.example .env.local
# then edit .env.local and paste your real key:
# AICREDITS_API_KEY=your_key_here
# OCR_MODEL=google/gemini-3.1-flash-lite
```

Get an AICredits API key from https://aicredits.in if you don't have one
yet. `OCR_MODEL` can be swapped for any vision-capable model AICredits
exposes.

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Screens

`app/page.tsx` holds a single `section` state and swaps between screens —
no routing, so state (like an in-progress upload) survives switching tabs
in the sidebar (`components/Sidebar.tsx`).

- **Dashboard** (`components/DashboardView.tsx`) — stat cards, recent
  answer sheets table, an SVG donut chart (`components/DonutChart.tsx`),
  and an AI alerts panel. All data here is static mock data matching the
  design, not wired to a backend.
- **Answer Sheets** (`components/AnswerSheetsView.tsx`) — the real,
  functional upload flow: drag-and-drop or file picker → `POST
  /api/process` → Gemini OCR → extracted text, styled as a 5-step
  "Digitization & Extraction Pipeline". **Only steps 1–2 (Uploading,
  Digitizing Handwriting) reflect real work** — the backend only performs
  OCR. Steps 3–5 (Detecting Questions, Evaluating Answers, Generating
  Insights) are presentational and complete on a short timer once OCR
  returns, since there's no question-segmentation or scoring model wired
  up. The raw extracted text is revealed below the pipeline when it's done.
- **Evaluation** (`components/EvaluationView.tsx`) — the per-question
  review panel (scan preview, AI-extracted answer text/code, editable
  score + examiner notes, Accept/Override/Flag actions). This screen uses
  the sample CS201 content from the design as static demo data — there's
  no real per-question grading model behind it in this prototype.

`app/api/process/route.ts` is unchanged from the OCR backend: it reads the
uploaded file server-side, base64-encodes it into a `data:<mime>;base64,...`
URI, and sends it as multimodal content to AICredits using the official
`openai` SDK. `AICREDITS_API_KEY` is only read server-side and never sent
to the client.

## Notes / limits for this prototype

- 15 MB max file size (adjust `MAX_FILE_BYTES` in `app/api/process/route.ts`).
- Single-file, single-page processing — no batching or queueing.
- No persistence: refreshing the page clears any in-progress result.
- Analytics / Moderation / Settings nav items are placeholders — they
  weren't part of the design handoff.
