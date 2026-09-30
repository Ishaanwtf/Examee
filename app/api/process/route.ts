import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";
// Answer sheets can be a few MB; give this route room to work.
export const maxDuration = 300;

const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg"
]);

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

// The AICredits API rejects request payloads around 5 MB of message content.
// Base64 inflates bytes by ~4/3, so we keep each encoded chunk comfortably
// below that ceiling.
const SAFE_BASE64_BYTES = 3 * 1024 * 1024; // ~3.1 MB encoded per chunk
const MAX_PDF_CHUNK_PAGES = 3;

const OCR_PROMPT = `You are digitizing a single student's handwritten or printed exam answer sheet page.

Task:
- Transcribe every visible answer exactly as written by the student, in reading order.
- Preserve the student's original wording, spelling, grammar, and mathematical work AS-IS. Do not correct, improve, or evaluate anything — you are a scanner, not a grader.
- Preserve mathematical notation as accurately as possible using plain text or simple markup.
- Preserve the question numbers exactly as written on the paper (e.g. "1", "2a", "Q3b").
- If a word, phrase, or section is genuinely unreadable, write [ILLEGIBLE] in its place rather than guessing.
- If the page is blank or contains no answers, return an empty questions array and empty text.

Return ONLY valid JSON (no markdown fences, no commentary) with this exact shape:
{
  "questions": [
    { "questionNumber": "<as printed, or empty string if none>", "text": "<the student's answer, verbatim>" }
  ]
}`;

function getClient() {
  const apiKey = process.env.AICREDITS_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://aicredits.in/v1"
  });
}

function parseOcrJson(raw: string): {
  questions: { questionNumber: string; text: string }[];
} {
  let text = raw.trim();
  // Strip markdown fences if the model added them anyway.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Malformed OCR response: no JSON object found.");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Malformed OCR response: missing questions array.");
  }
  return {
    questions: parsed.questions.map(
      (q: { questionNumber?: unknown; text?: unknown }) => ({
        questionNumber:
          typeof q.questionNumber === "string" ? q.questionNumber : "",
        text: typeof q.text === "string" ? q.text : ""
      })
    )
  };
}

async function runOcr(
  client: OpenAI,
  dataUrl: string
): Promise<{ questions: { questionNumber: string; text: string }[] }> {
  const completion = await client.chat.completions.create({
    model: process.env.OCR_MODEL || "google/gemini-3.1-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } }
        ]
      }
    ]
  });

  const text = completion.choices[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error("The model did not return any text for this file.");
  }
  return parseOcrJson(text);
}

export async function POST(req: NextRequest) {
  try {
    const client = getClient();
    if (!client) {
      return NextResponse.json(
        { error: "Server is missing AICREDITS_API_KEY. Add it to .env.local and restart the server." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, PNG, JPG, or JPEG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Please upload a file under 15 MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    if (file.type === "application/pdf") {
      const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pageCount = pdf.getPageCount();
      const bytes = Buffer.from(arrayBuffer);

      // If the whole PDF is small enough, send it in one request.
      if (bytes.length < SAFE_BASE64_BYTES) {
        const result = await runOcr(
          client,
          `data:application/pdf;base64,${bytes.toString("base64")}`
        );
        if (result.questions.length === 0) {
          return NextResponse.json(
            { error: "No readable answers were found in this document." },
            { status: 422 }
          );
        }
        return NextResponse.json({
          pages: [
            {
              pageNumber: 1,
              text: result.questions
                .map((q) => (q.questionNumber ? `${q.questionNumber}. ${q.text}` : q.text))
                .join("\n\n"),
              questions: result.questions.map((q) => ({ ...q, pageNumber: 1 }))
            }
          ]
        });
      }

      // Large PDF: split into page-group chunks, OCR each, combine in order.
      const chunkSize = Math.max(
        1,
        Math.floor(MAX_PDF_CHUNK_PAGES * (SAFE_BASE64_BYTES / bytes.length))
      );

      const allPages: {
        pageNumber: number;
        text: string;
        questions: { questionNumber: string; text: string; pageNumber: number }[];
      }[] = [];

      for (let start = 0; start < pageCount; start += chunkSize) {
        const end = Math.min(start + chunkSize, pageCount);
        const sub = await PDFDocument.create();
        const pageIndices = Array.from(
          { length: end - start },
          (_, i) => start + i
        );
        const copied = await sub.copyPages(pdf, pageIndices);
        copied.forEach((p) => sub.addPage(p));
        const chunkBytes = Buffer.from(await sub.save());

        if (chunkBytes.length >= SAFE_BASE64_BYTES) {
          return NextResponse.json(
            {
              error: `This PDF is too large to process (pages ${start + 1}-${end} exceed the request limit). Please split it into smaller files.`
            },
            { status: 413 }
          );
        }

        const chunkResult = await runOcr(
          client,
          `data:application/pdf;base64,${chunkBytes.toString("base64")}`
        );

        allPages.push({
          pageNumber: start + 1,
          text: chunkResult.questions
            .map((q) => (q.questionNumber ? `${q.questionNumber}. ${q.text}` : q.text))
            .join("\n\n"),
          questions: chunkResult.questions.map((q) => ({
            ...q,
            pageNumber: start + 1
          }))
        });
      }

      const totalQuestions = allPages.reduce((n, p) => n + p.questions.length, 0);
      if (totalQuestions === 0) {
        return NextResponse.json(
          { error: "No readable answers were found in this document." },
          { status: 422 }
        );
      }

      return NextResponse.json({ pages: allPages });
    }

    // Image: reject files that would exceed the safe request size.
    const imageBytes = Buffer.from(arrayBuffer);
    if (imageBytes.length >= SAFE_BASE64_BYTES) {
      return NextResponse.json(
        {
          error: "This image is too large for the OCR request limit (~3 MB). Please compress it or upload a smaller scan."
        },
        { status: 413 }
      );
    }

    const result = await runOcr(
      client,
      `data:${file.type};base64,${imageBytes.toString("base64")}`
    );
    if (result.questions.length === 0) {
      return NextResponse.json(
        { error: "No readable answers were found in this image." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      pages: [
        {
          pageNumber: 1,
          text: result.questions
            .map((q) => (q.questionNumber ? `${q.questionNumber}. ${q.text}` : q.text))
            .join("\n\n"),
          questions: result.questions.map((q) => ({ ...q, pageNumber: 1 }))
        }
      ]
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Malformed OCR response from the model. Please try again." },
        { status: 502 }
      );
    }
    console.error("OCR processing failed:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected error while processing the file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
