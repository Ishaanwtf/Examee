"use client";

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileText,
  X,
  Check,
  ArrowRight,
  Trash2,
  ClipboardList,
  Loader2,
  AlertCircle
} from "lucide-react";
import StatusPill, { type Status } from "@/components/StatusPill";
import { useApp, type OcrQuestion, type OcrPage } from "@/lib/store";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg";

type StepKey = "upload" | "digitize" | "detect";

const STEPS: {
  key: StepKey;
  title: string;
  runningLabel: string;
  doneLabel: string;
  progressNoun: string;
}[] = [
  { key: "upload", title: "Uploading", runningLabel: "Transferring file...", doneLabel: "File received", progressNoun: "Uploaded" },
  { key: "digitize", title: "Digitizing Handwriting", runningLabel: "AI OCR processing", doneLabel: "AI OCR processing", progressNoun: "Digitized" },
  { key: "detect", title: "Detecting Questions", runningLabel: "Segmenting answers", doneLabel: "Answers segmented", progressNoun: "Detected" }
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function listStatus(sheet: {
  status: string;
  submitted: boolean;
  evaluation: Record<string, { decision: string | null }>;
}): Status {
  if (sheet.status === "processing") return "Processing";
  if (sheet.status === "failed") return "Failed";
  if (Object.values(sheet.evaluation).some((e) => e.decision === "flag"))
    return "Flagged";
  if (sheet.submitted) return "Evaluated";
  return "Pending";
}

type OcrResponse = {
  pages?: {
    pageNumber: number;
    text: string;
    questions: { questionNumber: string; text: string; pageNumber?: number }[];
  }[];
  error?: string;
};

export default function AnswerSheetsView({
  onOpenEvaluation
}: {
  onOpenEvaluation: () => void;
}) {
  const { sheets, addSheet, updateSheet, removeSheet, openSheet, markingScheme, setMarkingScheme } =
    useApp();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [percent, setPercent] = useState(0);
  const [result, setResult] = useState<{
    text: string;
    questions: OcrQuestion[];
    pages: OcrPage[];
    sheetId: string;
  } | null>(null);

  // Marking scheme import state
  const [schemeImporting, setSchemeImporting] = useState(false);
  const [schemeError, setSchemeError] = useState<string | null>(null);
  const schemeInputRef = useRef<HTMLInputElement>(null);

  async function handleSchemeImport(file: File) {
    setSchemeError(null);
    setSchemeImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/process", {
        method: "POST",
        body: formData
      });
      let data: OcrResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error("The server returned an unexpected response. Please try again.");
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || "Could not read the marking scheme file.");
      }
      const text = (data.pages || [])
        .map(
          (p) =>
            p.questions
              .map(
                (q) =>
                  `${q.questionNumber ? `Q${q.questionNumber}` : "Scheme"}: ${q.text}`
              )
              .join("\n\n") || p.text
        )
        .join("\n\n");
      if (!text.trim()) {
        throw new Error("No readable marking scheme content was found in this file.");
      }
      setMarkingScheme(text);
    } catch (err) {
      setSchemeError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSchemeImporting(false);
    }
  }

  const chooseFile = useCallback((f: File | undefined | null) => {
    setError(null);
    setStatus("idle");
    setResult(null);
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError("Unsupported file type. Please use PDF, PNG, JPG, or JPEG.");
      return;
    }
    setFile(f);
  }, []);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    chooseFile(e.dataTransfer.files?.[0]);
  }

  function animateStep(duration: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.round((elapsed / duration) * 100));
        setPercent(pct);
        if (pct >= 100) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      tick();
    });
  }

  async function handleProcess() {
    if (!file) return;
    setError(null);
    setStatus("running");
    setResult(null);

    const sheet = addSheet({
      filename: file.name,
      fileSize: file.size
    });

    try {
      setActiveStepIndex(0);
      setPercent(0);
      await animateStep(400);

      setActiveStepIndex(1);
      setPercent(0);
      const formData = new FormData();
      formData.append("file", file);

      const fetchPromise = fetch("/api/process", {
        method: "POST",
        body: formData
      });
      const progressDuringFetch = animateStep(2600);
      const [res] = await Promise.all([fetchPromise, progressDuringFetch]);
      setPercent(100);

      let data: OcrResponse;
      try {
        data = await res.json();
      } catch {
        throw new Error("The server returned an unexpected response. Please try again.");
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || "Processing failed. Please try again.");
      }

      setActiveStepIndex(2);
      setPercent(0);
      await animateStep(450);
      setPercent(100);

      const pages: OcrPage[] = (data.pages || []).map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text
      }));
      const questions: OcrQuestion[] = (data.pages || []).flatMap((p) =>
        p.questions.map((q) => ({
          questionNumber: q.questionNumber,
          text: q.text,
          pageNumber: q.pageNumber ?? p.pageNumber
        }))
      );

      const fullText = pages.map((p) => p.text).join("\n\n");

      updateSheet(sheet.id, (s) => ({
        ...s,
        status: "ready",
        pages,
        questions
      }));

      setResult({
        text: fullText,
        questions,
        pages,
        sheetId: sheet.id
      });
      setStatus("done");
    } catch (err) {
      updateSheet(sheet.id, (s) => ({
        ...s,
        status: "failed",
        ocrError: err instanceof Error ? err.message : "Processing failed."
      }));
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  function openInEvaluation(sheetId: string) {
    openSheet(sheetId);
    onOpenEvaluation();
  }

  const currentStep = STEPS[activeStepIndex];

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload Answer Sheet</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Import and automatically digitize scanned university exam papers
        </p>
      </header>

      <div className="mb-6 grid grid-cols-[1fr_320px] gap-6">
        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-16 text-center shadow-card transition-colors",
            isDragging ? "border-indigo-400 bg-indigo-50/40" : "border-indigo-200"
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            className="hidden"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <UploadCloud className="h-5 w-5 text-indigo-500" strokeWidth={2} />
          </div>
          <p className="text-[15px] font-semibold text-slate-800">
            Drag &amp; drop your PDF or images here
          </p>
          <p className="mt-1 text-[13px] text-slate-400">
            Supported formats: PDF, JPG, PNG — Max 15MB
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-500"
          >
            Browse Files
          </button>
        </div>

        {/* Selected file panel */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-4 text-[15px] font-semibold text-slate-900">
            Selected File
          </h2>

          {file ? (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                  <FileText className="h-4 w-4 text-rose-400" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-slate-800">
                    {file.name}
                  </p>
                  <p className="text-[12px] text-slate-400">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setStatus("idle");
                    setResult(null);
                  }}
                  className="shrink-0 text-slate-300 hover:text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleProcess}
                disabled={status === "running"}
                className={[
                  "w-full rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors",
                  status === "running"
                    ? "cursor-not-allowed bg-slate-100 text-slate-400"
                    : "bg-indigo-600 text-white hover:bg-indigo-500"
                ].join(" ")}
              >
                {status === "running" ? "Processing…" : "Process Answer Sheet"}
              </button>
            </>
          ) : (
            <p className="text-[13px] text-slate-400">
              No file selected yet — drop one on the left or browse to choose one.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-500">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Pipeline */}
      {status !== "idle" && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="mb-6 text-[15px] font-semibold text-slate-900">
            Digitization &amp; Extraction Pipeline
          </h2>

          <div className="mb-6 flex items-center">
            {STEPS.map((step, i) => {
              const isDone =
                status === "done" || i < activeStepIndex;
              const isActive = status === "running" && i === activeStepIndex;
              return (
                <div key={step.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-start">
                    <div
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold",
                        isDone
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-100 text-slate-400"
                      ].join(" ")}
                    >
                      {isDone ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                    </div>
                    <p
                      className={[
                        "mt-2 whitespace-nowrap text-[13px] font-semibold",
                        isDone || isActive ? "text-slate-800" : "text-slate-400"
                      ].join(" ")}
                    >
                      {step.title}
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      {isDone ? step.doneLabel : step.runningLabel}
                    </p>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={[
                        "mx-3 h-px flex-1",
                        isDone ? "bg-emerald-400" : "bg-slate-200"
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[13px]">
            <p className="font-medium text-slate-700">
              {status === "done"
                ? "Pipeline complete."
                : `Step ${activeStepIndex + 1} is actively processing...`}
            </p>
            <p className="font-semibold text-indigo-600">
              {status === "done" ? "100%" : `${percent}%`} {currentStep.progressNoun}
            </p>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${status === "done" ? 100 : percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Extracted text result */}
      {status === "done" && result && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Extracted Text
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-400">
                {result.questions.length} question
                {result.questions.length === 1 ? "" : "s"} across{" "}
                {result.pages.length} page{result.pages.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(result.text)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Copy text
              </button>
              <button
                onClick={() => openInEvaluation(result.sheetId)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-indigo-500"
              >
                Open in Evaluation
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <pre className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-slate-700">
              {result.text}
            </pre>
          </div>
        </div>
      )}

      {/* Uploaded sheets list */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Answer Sheets
          </h2>
          <span className="text-[12.5px] text-slate-400">
            {sheets.length} uploaded this session
          </span>
        </div>

        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
              <FileText className="h-4 w-4 text-slate-300" />
            </div>
            <p className="text-[13.5px] font-medium text-slate-600">
              No answer sheets uploaded yet
            </p>
            <p className="mt-1 text-[12.5px] text-slate-400">
              Process a file above to add it to this list.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sheets.map((sheet) => (
              <div key={sheet.id} className="flex items-center gap-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                  <FileText className="h-4 w-4 text-rose-400" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">
                    {sheet.filename}
                  </p>
                  <p className="text-[12px] text-slate-400">
                    {formatBytes(sheet.fileSize)} · uploaded {formatTime(sheet.uploadedAt)}
                    {sheet.status === "ready"
                      ? ` · ${sheet.questions.length} question${sheet.questions.length === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  {sheet.status === "failed" && sheet.ocrError && (
                    <p className="mt-1 truncate text-[12px] text-rose-500">
                      {sheet.ocrError}
                    </p>
                  )}
                </div>
                <StatusPill status={listStatus(sheet)} />
                <button
                  onClick={() => openInEvaluation(sheet.id)}
                  disabled={sheet.status !== "ready"}
                  className={[
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium",
                    sheet.status === "ready"
                      ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "cursor-not-allowed border border-slate-100 text-slate-300"
                  ].join(" ")}
                >
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeSheet(sheet.id)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                  title="Remove sheet"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Marking Scheme */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-500" strokeWidth={2} />
            <h2 className="text-[15px] font-semibold text-slate-900">
              Marking Scheme
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={schemeInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSchemeImport(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => schemeInputRef.current?.click()}
              disabled={schemeImporting}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium",
                schemeImporting
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              ].join(" ")}
            >
              {schemeImporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              {schemeImporting ? "Reading scheme…" : "Import Scheme File"}
            </button>
          </div>
        </div>
        <p className="mb-3 text-[12.5px] text-slate-400">
          Paste the scheme or import a PDF/image. The AI grader uses it to award
          step marks per question. If no scheme is provided, it grades against
          standard subject knowledge.
        </p>
        {schemeError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-500">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {schemeError}
          </div>
        )}
        <textarea
          value={markingScheme}
          onChange={(e) => setMarkingScheme(e.target.value)}
          placeholder={
            "Example:\nQ1 (5 marks): 2 marks for correct formula, 2 marks for substitution, 1 mark for final answer with units.\nQ2 (8 marks): 4 marks for correct derivation, 2 marks for diagram, 2 marks for explanation."
          }
          rows={8}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700 focus:border-indigo-300"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11.5px] text-slate-400">
            {markingScheme.trim()
              ? `Scheme set (${markingScheme.trim().length} characters) — used by AI Grading.`
              : "No scheme set yet — AI Grading will use standard subject knowledge."}
          </p>
          {markingScheme && (
            <button
              onClick={() => setMarkingScheme("")}
              className="text-[12px] font-medium text-slate-400 hover:text-rose-500"
            >
              Clear scheme
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
