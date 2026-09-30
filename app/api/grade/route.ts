import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_MAX_PER_QUESTION = 10;
const QUESTIONS_PER_BATCH = 6;

const GRADE_PROMPT = `You are an exam grader grading a student's answers using a marking scheme.

For EACH question you receive:
1. "maxScore": the maximum marks for that question. Take it from the marking scheme if it states one (e.g. "(5 marks)", "out of 8"). If the scheme does not specify, use the default max provided.
2. Break the marks into STEPS ("step marking"): each step is one marking point from the scheme (or a logical part of the correct answer if no scheme). Each step has:
   - "description": what the step awards marks for (short, examiner-style)
   - "maxMarks": marks available for that step
   - "marks": marks actually awarded for this student's answer (0 <= marks <= maxMarks)
3. "awarded": total awarded marks (sum of step marks, never exceeding maxScore).
4. "feedback": 1-2 sentence examiner comment on what was correct/missing/wrong.

Grading rules:
- Grade strictly against the marking scheme when one is provided. Do not invent marks beyond maxScore.
- If no scheme is provided, judge correctness against standard subject knowledge — but still use step marking.
- Blank, off-topic, or unreadable answers get 0 with brief feedback.
- Preserve the questionNumber exactly as given.
- Do not correct or rewrite the student's answer; only grade it.

Return ONLY valid JSON (no markdown fences, no commentary) in this exact shape:
{
  "questions": [
    {
      "questionNumber": "<same as input>",
      "maxScore": <number>,
      "awarded": <number>,
      "steps": [
        { "description": "<string>", "maxMarks": <number>, "marks": <number> }
      ],
      "feedback": "<string>"
    }
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

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Malformed grading response: no JSON object found.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeGrades(parsed: unknown): {
  questionNumber: string;
  maxScore: number;
  awarded: number;
  steps: { description: string; maxMarks: number; marks: number }[];
  feedback: string;
}[] {
  const obj = parsed as { questions?: unknown };
  if (!obj || !Array.isArray(obj.questions)) {
    throw new Error("Malformed grading response: missing questions array.");
  }
  return obj.questions.map((q) => {
    const g = q as Record<string, unknown>;
    const steps = Array.isArray(g.steps)
      ? (g.steps as Record<string, unknown>[]).map((s) => ({
          description: typeof s.description === "string" ? s.description : "",
          maxMarks: Number(s.maxMarks) || 0,
          marks: Math.max(0, Number(s.marks) || 0)
        }))
      : [];
    const maxScore = Math.max(0, Number(g.maxScore) || 0);
    let awarded = Number(g.awarded);
    if (Number.isNaN(awarded)) {
      awarded = steps.reduce((sum, s) => sum + s.marks, 0);
    }
    awarded = Math.max(0, Math.min(awarded, maxScore));
    return {
      questionNumber: typeof g.questionNumber === "string" ? g.questionNumber : "",
      maxScore,
      awarded,
      steps,
      feedback: typeof g.feedback === "string" ? g.feedback : ""
    };
  });
}

async function gradeBatch(
  client: OpenAI,
  questions: { questionNumber: string; text: string }[],
  schemeText: string,
  defaultMax: number
) {
  const schemeSection = schemeText.trim()
    ? `MARKING SCHEME:\n${schemeText.trim()}`
    : `MARKING SCHEME: (none provided — default ${defaultMax} marks per question, grade against standard subject knowledge with step marking)`;

  const answersSection = questions
    .map(
      (q) =>
        `QUESTION ${q.questionNumber}:\n${q.text.trim() || "(no answer extracted)"}`
    )
    .join("\n\n");

  const completion = await client.chat.completions.create({
    model: process.env.OCR_MODEL || "google/gemini-3.1-flash-lite",
    messages: [
      {
        role: "user",
        content: `${GRADE_PROMPT}\n\nDefault max marks per question (use only if the scheme does not specify): ${defaultMax}\n\n${schemeSection}\n\nSTUDENT ANSWERS TO GRADE:\n\n${answersSection}`
      }
    ]
  });

  const text = completion.choices[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error("The model did not return any grading output.");
  }
  return normalizeGrades(extractJson(text));
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

    let body: {
      questions?: { questionNumber?: unknown; text?: unknown }[];
      markingScheme?: unknown;
      defaultMax?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const questions = (body.questions || []).map((q) => ({
      questionNumber: typeof q.questionNumber === "string" ? q.questionNumber : "",
      text: typeof q.text === "string" ? q.text : ""
    }));

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No extracted answers to grade. Run OCR on a sheet first." },
        { status: 400 }
      );
    }

    const schemeText = typeof body.markingScheme === "string" ? body.markingScheme : "";
    const defaultMax =
      typeof body.defaultMax === "number" && body.defaultMax > 0
        ? Math.floor(body.defaultMax)
        : DEFAULT_MAX_PER_QUESTION;

    // Grade in small batches so each response stays well within output limits.
    const graded: ReturnType<typeof normalizeGrades> = [];
    for (let i = 0; i < questions.length; i += QUESTIONS_PER_BATCH) {
      const batch = questions.slice(i, i + QUESTIONS_PER_BATCH);
      const batchGrades = await gradeBatch(client, batch, schemeText, defaultMax);
      graded.push(...batchGrades);
    }

    // Match grades back to input order by question number.
    const byNumber = new Map(graded.map((g) => [g.questionNumber, g]));
    const ordered = questions.map((q) => {
      const match = byNumber.get(q.questionNumber);
      if (match) return match;
      return {
        questionNumber: q.questionNumber,
        maxScore: defaultMax,
        awarded: 0,
        steps: [],
        feedback: "The grader did not return a result for this question."
      };
    });

    return NextResponse.json({ questions: ordered });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Malformed grading response from the model. Please try again." },
        { status: 502 }
      );
    }
    console.error("AI grading failed:", err);
    const message =
      err instanceof Error ? err.message : "Unexpected error while grading.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
