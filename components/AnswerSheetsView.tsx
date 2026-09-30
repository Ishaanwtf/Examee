"use client";

import { useRef, useState } from "react";
import { AlertCircle, ArrowRight, ClipboardList, Loader2, UploadCloud } from "lucide-react";
import { useApp, type OcrPage, type OcrQuestion } from "@/lib/store";
import type { Exam } from "@/lib/domain";

const initial: Exam = { academicYear: "2026", examination: "End Semester Examination", major: "B.Tech Computer Science", semester: "3", subject: "Engineering Mathematics", courseCode: "MAT301", markingScheme: "" };
const friendly: Record<string, string> = { PENDING: "Pending", PROCESSING: "Processing", AI_EVALUATED: "AI Evaluated", NEEDS_REVIEW: "Needs Review", FINALIZED: "Finalized", FAILED: "Failed" };
type OcrResponse = { pages?: { pageNumber: number; text: string; questions: { questionNumber: string; text: string; pageNumber?: number }[] }[]; error?: string };

async function ocrReadyFiles(file: File): Promise<File[]> {
  if (file.type !== "application/pdf") return [file];
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: File[] = [];
  for (let index = 1; index <= pdfDocument.numPages; index += 1) {
    const page = await pdfDocument.getPage(index); const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d"); if (!context) throw new Error("Could not prepare this PDF page for OCR.");
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("Could not render this PDF page for OCR.");
    if (blob.size >= 3 * 1024 * 1024) throw new Error(`PDF page ${index} is too large to process. Use a lower-resolution scan.`);
    pages.push(new File([blob], `${file.name}-page-${index}.jpg`, { type: "image/jpeg" }));
  }
  return pages;
}

function MarkingSchemePanel() {
  const { markingScheme, setMarkingScheme } = useApp();
  const [importing, setImporting] = useState(false); const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  async function importScheme(file: File) {
    setImporting(true); setError(null);
    try {
      const pages = await ocrReadyFiles(file); const extracted: string[] = [];
      for (const pageFile of pages) {
        const form = new FormData(); form.append("file", pageFile);
        const response = await fetch("/api/process", { method: "POST", body: form });
        const data: OcrResponse = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || "Could not read the marking scheme file.");
        extracted.push(...(data.pages || []).map(page => page.questions.map(question => `${question.questionNumber ? `Q${question.questionNumber}` : "Scheme"}: ${question.text}`).join("\n\n") || page.text));
      }
      const text = extracted.join("\n\n");
      if (!text.trim()) throw new Error("No readable marking scheme content was found in this file.");
      setMarkingScheme(text);
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setImporting(false); }
  }
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
    <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-indigo-500"/><h2 className="text-[15px] font-semibold">Marking Scheme</h2></div><input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void importScheme(file); e.target.value = ""; }}/><button onClick={() => ref.current?.click()} disabled={importing} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:bg-slate-100"><UploadCloud className="h-3.5 w-3.5"/>{importing ? "Reading scheme…" : "Import Scheme File"}</button></div>
    <p className="mb-3 text-[12.5px] text-slate-400">Paste a question-wise marking scheme or import a PDF/image. AI grading uses it for maximum marks and step-wise marking criteria.</p>
    {error && <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-500"><AlertCircle className="h-3.5 w-3.5"/>{error}</div>}
    <textarea value={markingScheme} onChange={e => setMarkingScheme(e.target.value)} rows={8} placeholder={"Example:\nQ1 (5 marks): 2 marks for correct formula, 2 for substitution, 1 for final answer.\nQ2 (8 marks): 4 for derivation, 2 for diagram, 2 for explanation."} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700 focus:border-indigo-300"/>
    <div className="mt-2 flex justify-between text-[11.5px] text-slate-400"><span>{markingScheme.trim() ? `Scheme set (${markingScheme.trim().length} characters) — used by AI Grading.` : "No scheme set yet — AI Grading will use standard subject knowledge."}</span>{markingScheme && <button onClick={() => setMarkingScheme("")} className="font-medium hover:text-rose-500">Clear scheme</button>}</div>
  </section>;
}

function SheetTable({ sheets, onOpen }: { sheets: ReturnType<typeof useApp>["sheets"]; onOpen: (id: string) => void }) { return <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="pb-3">Answer Sheet ID</th><th className="pb-3">Subject</th><th className="pb-3">Semester</th><th className="pb-3">Major</th><th className="pb-3">Status</th><th className="pb-3"/></tr></thead><tbody>{sheets.map(s => <tr key={s.id} className="border-t border-slate-100"><td className="py-3 font-semibold">{s.id}</td><td>{s.exam.subject}</td><td>{s.exam.semester}</td><td>{s.exam.major}</td><td><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{friendly[s.status]}</span></td><td><button onClick={() => onOpen(s.id)} className="flex items-center gap-1 text-indigo-600">Open <ArrowRight className="h-3 w-3"/></button></td></tr>)}{sheets.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-slate-400">No matching answer sheets.</td></tr>}</tbody></table></div></div>; }

export default function AnswerSheetsView({ onOpenEvaluation }: { onOpenEvaluation: () => void }) {
  const { user, users, sheets, createSheet, updateSheet, openSheet } = useApp();
  const [file, setFile] = useState<File | null>(null); const [exam, setExam] = useState<Exam>(initial); const [studentId, setStudentId] = useState("CSE23-0142"); const [teacher, setTeacher] = useState("math-teacher"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [filters, setFilters] = useState({ subject: "", semester: "", major: "", status: "" }); const ref = useRef<HTMLInputElement>(null);
  const fields: [keyof Exam, string][] = [["academicYear", "Academic Year"], ["examination", "Examination"], ["major", "Major / Program"], ["semester", "Semester"], ["subject", "Subject"], ["courseCode", "Course Code"]];
  async function ingest() {
    if (!file || !user) return setError("Select a PDF, PNG, JPG, or JPEG answer sheet.");
    setBusy(true); setError(null); let sheetId: string | null = null;
    try {
      const sheet = await createSheet({ filename: file.name, fileSize: file.size, studentId, assignedTeacherId: teacher || undefined, exam }); sheetId = sheet.id;
      const upload = new FormData(); upload.append("email", user.email); upload.append("sheetId", sheet.id); upload.append("file", file);
      const stored = await fetch("/api/files", { method: "POST", body: upload }); const storedData = await stored.json();
      if (!stored.ok) throw new Error(storedData.error || "Could not store the uploaded file.");
      const inputFiles = await ocrReadyFiles(file); const allPages: OcrPage[] = []; const allQuestions: OcrQuestion[] = [];
      for (const [index, inputFile] of inputFiles.entries()) {
        const form = new FormData(); form.append("file", inputFile);
        const response = await fetch("/api/process", { method: "POST", body: form }); const data: OcrResponse = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || `OCR failed on page ${index + 1}.`);
        for (const page of data.pages || []) {
          const pageNumber = allPages.length + 1; allPages.push({ pageNumber, text: page.text });
          allQuestions.push(...page.questions.map(question => ({ ...question, pageNumber })));
        }
      }
      await updateSheet(sheet.id, { pages: allPages, questions: allQuestions, status: "PENDING" });
      setFile(null); if (ref.current) ref.current.value = "";
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed."; setError(message);
      if (sheetId) await updateSheet(sheetId, { status: "FAILED", ocrError: message });
    } finally { setBusy(false); }
  }
  const open = (id: string) => { openSheet(id); onOpenEvaluation(); };
  if (user?.role === "EXAM_CELL") return <div><header className="mb-6"><h1 className="text-2xl font-bold">Answer Sheet Ingestion</h1><p className="mt-1 text-sm text-slate-400">Import a scan with academic metadata and route it to an evaluator.</p></header><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><div className="grid grid-cols-2 gap-4">{fields.map(([key, name]) => <label key={key} className="text-xs font-medium text-slate-500">{name}<input value={exam[key]} onChange={e => setExam({ ...exam, [key]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label>)}<label className="text-xs font-medium text-slate-500">Student Roll Number / ID<input value={studentId} onChange={e => setStudentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><label className="text-xs font-medium text-slate-500">Assigned Teacher<select value={teacher} onChange={e => setTeacher(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">Unassigned</option>{users.filter(u => u.role === "TEACHER").map(u => <option key={u.id} value={u.id}>{u.name} — {u.subject}</option>)}</select></label></div><label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-4"><span className="text-sm text-slate-600">{file ? file.name : "Choose answer-sheet scan (PDF, PNG, JPG)"}</span><UploadCloud className="h-5 w-5 text-indigo-600"/><input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)}/></label>{error && <p className="mt-3 text-sm text-rose-500">{error}</p>}<button onClick={() => void ingest()} disabled={busy} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">{busy ? "Digitizing with AI…" : "Import & Digitize Answer Sheet"}</button></div><SheetTable sheets={sheets} onOpen={open}/></div>;
  const visible = sheets.filter(s => (!filters.subject || s.exam.subject === filters.subject) && (!filters.semester || s.exam.semester === filters.semester) && (!filters.major || s.exam.major === filters.major) && (!filters.status || s.status === filters.status)); const options = (field: keyof typeof filters) => Array.from(new Set(sheets.map(s => field === "subject" ? s.exam.subject : field === "semester" ? s.exam.semester : field === "major" ? s.exam.major : s.status)));
  return <div><header className="mb-6"><h1 className="text-2xl font-bold">Answer Sheet Work Queue</h1><p className="mt-1 text-sm text-slate-400">Only papers assigned to {user?.name} are shown.</p></header><div className="mb-5 grid grid-cols-4 gap-3">{(["subject", "semester", "major", "status"] as const).map(key => <select key={key} value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All {key}</option>{options(key).map(value => <option key={value} value={value}>{value}</option>)}</select>)}</div><SheetTable sheets={visible} onOpen={open}/><MarkingSchemePanel/></div>;
}
