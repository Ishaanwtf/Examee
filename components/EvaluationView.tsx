"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileText,
  Wand2,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";
import {
  useApp,
  getEvaluationEntry,
  type OcrQuestion,
  type EvaluationEntry,
  type AiGrading,
  type AiQuestionGrade
} from "@/lib/store";

function QuestionCard({
  question,
  entry,
  aiGrade,
  onChange
}: {
  question: OcrQuestion;
  entry: EvaluationEntry;
  aiGrade?: AiQuestionGrade;
  onChange: (next: EvaluationEntry) => void;
}) {
  return (
    <div className="border-b border-slate-100 px-6 py-6 last:border-b-0">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13.5px] font-semibold text-slate-800">
          Question {question.questionNumber || "(unnumbered)"}{" "}
          <span className="font-normal text-slate-400">· page {question.pageNumber}</span>
        </p>
        {aiGrade && (
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-600">
            AI: {aiGrade.awarded}/{aiGrade.maxScore}
          </span>
        )}
      </div>

      <div className="mb-4 rounded-xl bg-slate-50 p-4 text-[13.5px] leading-relaxed text-slate-600">
        <pre className="whitespace-pre-wrap break-words font-sans">{question.text}</pre>
      </div>

      {/* AI step marking */}
      {aiGrade && aiGrade.steps.length > 0 && (
        <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} />
            <p className="text-[12px] font-semibold text-indigo-600">
              AI Step Marking
            </p>
          </div>
          <ul className="space-y-1.5">
            {aiGrade.steps.map((step, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-[12.5px]">
                <span className="flex items-start gap-2 text-slate-600">
                  <span
                    className={[
                      "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      step.marks >= step.maxMarks
                        ? "bg-emerald-500"
                        : step.marks > 0
                        ? "bg-amber-400"
                        : "bg-rose-400"
                    ].join(" ")}
                  />
                  {step.description}
                </span>
                <span className="shrink-0 font-semibold text-slate-700">
                  {step.marks}/{step.maxMarks}
                </span>
              </li>
            ))}
          </ul>
          {aiGrade.feedback && (
            <p className="mt-3 border-t border-indigo-100 pt-2 text-[12.5px] leading-snug text-slate-500">
              {aiGrade.feedback}
            </p>
          )}
        </div>
      )}

      <div className="mb-3 grid grid-cols-[1fr_110px] gap-3">
        <div>
          <label className="mb-1 block text-[11.5px] text-slate-400">
            Examiner Notes
          </label>
          <input
            value={entry.notes}
            onChange={(e) => onChange({ ...entry, notes: e.target.value })}
            placeholder="Add examiner notes…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 focus:border-indigo-300"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11.5px] text-slate-400">
            Score{aiGrade ? ` / ${aiGrade.maxScore}` : ""}
          </label>
          <div className="flex items-center rounded-lg border border-slate-200 px-2 py-2">
            <input
              value={entry.score}
              onChange={(e) =>
                onChange({ ...entry, score: e.target.value.replace(/[^0-9]/g, "") })
              }
              placeholder="0"
              className="w-full text-right text-[13px] font-semibold text-indigo-600"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={!aiGrade}
          title={
            aiGrade
              ? `Accept the AI score of ${aiGrade.awarded}/${aiGrade.maxScore}`
              : "Run AI Grading first — no AI score available yet"
          }
          onClick={() =>
            aiGrade &&
            onChange({
              score: String(aiGrade.awarded),
              notes: aiGrade.feedback || entry.notes,
              decision: "accept"
            })
          }
          className={[
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            aiGrade
              ? entry.decision === "accept"
                ? "bg-indigo-600 text-white"
                : "border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              : "cursor-not-allowed border border-slate-100 text-slate-300"
          ].join(" ")}
        >
          Accept AI Score
        </button>
        <button
          onClick={() => onChange({ ...entry, decision: "override" })}
          className={[
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            entry.decision === "override"
              ? "bg-slate-800 text-white"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          ].join(" ")}
        >
          Override
        </button>
        <button
          onClick={() =>
            onChange({ ...entry, decision: entry.decision === "flag" ? null : "flag" })
          }
          className={[
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
            entry.decision === "flag"
              ? "bg-rose-500 text-white"
              : "border border-rose-200 text-rose-500 hover:bg-rose-50"
          ].join(" ")}
        >
          {entry.decision === "flag" ? "Flagged" : "Flag for Review"}
        </button>
      </div>
    </div>
  );
}

export default function EvaluationView({
  onBack
}: {
  onBack: () => void;
}) {
  const { activeSheet, updateSheet, closeSheet, markingScheme } = useApp();
  const [qIndex, setQIndex] = useState(0);
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  async function runAiGrading() {
    if (!activeSheet || activeSheet.status !== "ready") return;
    setIsGrading(true);
    setGradeError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: activeSheet.questions.map((q) => ({
            questionNumber: q.questionNumber,
            text: q.text
          })),
          markingScheme
        })
      });
      let data: { questions?: AiQuestionGrade[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error("The server returned an unexpected response. Please try again.");
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || "AI grading failed. Please try again.");
      }
      const aiGrading: AiGrading = {
        gradedAt: new Date().toISOString(),
        questions: data.questions || []
      };
      updateSheet(activeSheet.id, (s) => ({ ...s, aiGrading }));
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "AI grading failed.");
    } finally {
      setIsGrading(false);
    }
  }

  if (!activeSheet || activeSheet.status !== "ready" || activeSheet.questions.length === 0) {
    return (
      <div>
        <header className="mb-6 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <h1 className="text-[17px] font-bold text-slate-900">Evaluation</h1>
        </header>
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white text-center shadow-card">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
            <FileText className="h-4 w-4 text-slate-300" />
          </div>
          <p className="text-[13.5px] font-medium text-slate-600">
            No sheet selected
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] text-slate-400">
            Open a processed sheet from Answer Sheets to start evaluating it.
          </p>
          <button
            onClick={onBack}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-500"
          >
            Go to Answer Sheets
          </button>
        </div>
      </div>
    );
  }

  const sheet = activeSheet;
  const questions = sheet.questions;
  const question = questions[Math.min(qIndex, questions.length - 1)];
  const entry = getEvaluationEntry(sheet, question.questionNumber);
  const aiGrade = sheet.aiGrading?.questions.find(
    (g) => g.questionNumber === question.questionNumber
  );
  const pageText =
    sheet.pages.find((p) => p.pageNumber === question.pageNumber)?.text ?? "";

  function setEntry(next: EvaluationEntry) {
    updateSheet(sheet.id, (s) => ({
      ...s,
      evaluation: { ...s.evaluation, [question.questionNumber]: next }
    }));
  }

  const gradedCount = questions.filter(
    (q) => getEvaluationEntry(sheet, q.questionNumber).score !== ""
  ).length;
  const totalScore = Object.values(sheet.evaluation)
    .map((e) => Number(e.score))
    .filter((n) => !Number.isNaN(n))
    .reduce((a, b) => a + b, 0);

  function submitGrades() {
    updateSheet(sheet.id, (s) => ({ ...s, submitted: true }));
    closeSheet();
    onBack();
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-slate-900">
              Evaluation Panel
            </h1>
            <p className="text-[12.5px] text-slate-400">{sheet.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] text-slate-400">
            {gradedCount}/{questions.length} graded · total {totalScore}
          </span>
          <button
            onClick={runAiGrading}
            disabled={isGrading}
            className={[
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium",
              isGrading
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
            ].join(" ")}
          >
            {isGrading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {isGrading
              ? "Grading…"
              : sheet.aiGrading
              ? "Re-run AI Grading"
              : "Run AI Grading"}
          </button>
          <button
            onClick={submitGrades}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-500"
          >
            Submit Grades
          </button>
        </div>
      </header>

      {gradeError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {gradeError}
        </div>
      )}

      {sheet.submitted && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-600">
          Grades submitted for this sheet.
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Full page text panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-slate-900">
              OCR Page Text
            </h2>
            <span className="text-[12px] text-slate-400">
              Page {question.pageNumber} of {sheet.pages.length}
            </span>
          </div>
          <div className="max-h-[60vh] min-h-[320px] overflow-y-auto rounded-xl border border-slate-100 bg-[#F7F6F1] p-5">
            {pageText ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-relaxed text-slate-700">
                {pageText}
              </pre>
            ) : (
              <p className="text-[13px] text-slate-400">
                No text extracted for this page.
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {sheet.pages.map((p) => (
                <span
                  key={p.pageNumber}
                  className={[
                    "flex h-7 min-w-7 items-center justify-center rounded-md border px-1 text-[12.5px] font-medium",
                    p.pageNumber === question.pageNumber
                      ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                      : "border-slate-200 text-slate-500"
                  ].join(" ")}
                >
                  {p.pageNumber}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Extracted question panel */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between px-6 pt-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" strokeWidth={2} />
              <h2 className="text-[14px] font-semibold text-slate-900">
                Extracted Answers
              </h2>
            </div>
            <span
              className={[
                "rounded-md px-2 py-0.5 text-[11.5px] font-medium",
                sheet.aiGrading
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-500"
              ].join(" ")}
            >
              {sheet.aiGrading
                ? `AI graded (${sheet.aiGrading.questions.length} questions)`
                : "Ready for evaluation"}
            </span>
          </div>

          <div className="mt-4">
            <QuestionCard
              question={question}
              entry={entry}
              aiGrade={aiGrade}
              onChange={setEntry}
            />
          </div>

          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setQIndex((i) => Math.max(0, i - 1))}
              disabled={qIndex === 0}
              className={[
                "flex items-center gap-1 text-[13px] font-medium",
                qIndex === 0
                  ? "cursor-not-allowed text-slate-300"
                  : "text-indigo-600 hover:underline"
              ].join(" ")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous Question
            </button>
            <span className="text-[12px] text-slate-400">
              Question {qIndex + 1} of {questions.length}
            </span>
            <button
              onClick={() => setQIndex((i) => Math.min(questions.length - 1, i + 1))}
              disabled={qIndex === questions.length - 1}
              className={[
                "flex items-center gap-1 text-[13px] font-medium",
                qIndex === questions.length - 1
                  ? "cursor-not-allowed text-slate-300"
                  : "text-indigo-600 hover:underline"
              ].join(" ")}
            >
              Next Question
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
