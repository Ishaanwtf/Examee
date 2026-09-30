"use client";

import DonutChart from "@/components/DonutChart";
import StatusPill from "@/components/StatusPill";
import type { Status } from "@/components/StatusPill";
import type { Section } from "@/app/page";
import { useApp } from "@/lib/store";
import { FileText } from "lucide-react";

function isFlagged(sheet: { evaluation: Record<string, { decision: string | null }> }): boolean {
  return Object.values(sheet.evaluation).some((e) => e.decision === "flag");
}

function sheetStatus(sheet: {
  status: string;
  submitted: boolean;
  evaluation: Record<string, { decision: string | null }>;
}): Status {
  if (sheet.status === "processing") return "Processing";
  if (sheet.status === "failed") return "Failed";
  if (isFlagged(sheet)) return "Flagged";
  if (sheet.submitted) return "Evaluated";
  return "Pending";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function totalScore(
  sheet: { evaluation: Record<string, { score: string }> }
): string {
  const scores = Object.values(sheet.evaluation)
    .map((e) => Number(e.score))
    .filter((n) => !Number.isNaN(n));
  if (scores.length === 0) return "—";
  return String(scores.reduce((a, b) => a + b, 0));
}

export default function DashboardView({
  onNavigate
}: {
  onNavigate: (section: Section) => void;
}) {
  const { sheets, openSheet } = useApp();

  const flagged = sheets.filter((s) => isFlagged(s)).length;
  const evaluated = sheets.filter((s) => s.submitted && !isFlagged(s)).length;
  const pending = sheets.filter((s) => s.status === "ready" && !s.submitted && !isFlagged(s)).length;

  const STATS = [
    { label: "Total Answer Sheets", value: String(sheets.length), sub: sheets.length === 0 ? "No sheets uploaded" : "This session", subColor: "text-slate-400", valueColor: undefined },
    { label: "Pending Evaluation", value: String(pending), sub: pending === 0 ? "Nothing pending" : "Awaiting grading", subColor: "text-blue-500", valueColor: undefined },
    { label: "Evaluated", value: String(evaluated), sub: evaluated === 0 ? "None yet" : "Grades submitted", subColor: "text-emerald-500", valueColor: undefined },
    { label: "Flagged / Needs Review", value: String(flagged), sub: flagged === 0 ? "No flags" : "Attention required", subColor: "text-rose-500", valueColor: flagged > 0 ? "text-rose-500" : undefined }
  ];

  const recent = sheets.slice(0, 6);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Overview of answer sheets in this session
        </p>
      </header>

      {/* Active exam banner */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-indigo-600">
              ACTIVE
            </span>
            <span className="text-[13px] text-slate-400">Currently Grading</span>
          </div>
          <p className="text-[17px] font-semibold text-slate-900">
            {sheets.length > 0
              ? `${sheets.length} answer sheet${sheets.length === 1 ? "" : "s"} in this session`
              : "No answer sheets uploaded yet"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={() => onNavigate("answer-sheets")}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Upload Sheet
          </button>
          <button
            onClick={() => onNavigate("evaluation")}
            disabled={sheets.length === 0}
            className={[
              "rounded-lg px-4 py-2 text-[13px] font-medium",
              sheets.length === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            ].join(" ")}
          >
            Resume Evaluation
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          >
            <p className="text-[12.5px] text-slate-400">{s.label}</p>
            <p className={["mt-2 text-2xl font-bold", s.valueColor ?? "text-slate-900"].join(" ")}>
              {s.value}
            </p>
            <p className={["mt-1 text-[12px]", s.subColor].join(" ")}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-[1fr_320px] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-900">
              Recent Answer Sheets
            </h2>
            <button
              onClick={() => onNavigate("answer-sheets")}
              className="text-[13px] font-medium text-indigo-600 hover:underline"
            >
              View All Sheets
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                <FileText className="h-4 w-4 text-slate-300" />
              </div>
              <p className="text-[13.5px] font-medium text-slate-600">
                No answer sheets yet
              </p>
              <p className="mt-1 text-[12.5px] text-slate-400">
                Upload a sheet to see it listed here.
              </p>
              <button
                onClick={() => onNavigate("answer-sheets")}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo-500"
              >
                Upload Answer Sheet
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">File</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      openSheet(row.id);
                      onNavigate("evaluation");
                    }}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="max-w-[220px] truncate py-3 text-[13.5px] font-semibold text-slate-800">
                      {row.filename}
                    </td>
                    <td className="py-3">
                      <StatusPill
                        status={sheetStatus({
                          status: row.status,
                          submitted: row.submitted,
                          evaluation: row.evaluation
                        })}
                      />
                    </td>
                    <td className="py-3 text-[13.5px] text-slate-700">
                      {row.submitted ? totalScore(row) : "—"}
                    </td>
                    <td className="py-3 text-[13.5px] text-slate-400">
                      {formatDate(row.uploadedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="mb-4 text-[15px] font-semibold text-slate-900">
              Evaluation Progress
            </h2>
            {sheets.length === 0 ? (
              <p className="text-[13px] text-slate-400">
                Upload and evaluate sheets to see progress.
              </p>
            ) : (
              <div className="flex items-center gap-5">
                <DonutChart
                  segments={[
                    { value: evaluated, color: "#10B981" },
                    { value: pending, color: "#4F46E5" },
                    { value: flagged, color: "#F43F5E" }
                  ]}
                />
                <ul className="space-y-2 text-[13px]">
                  <li className="flex items-center gap-2 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Evaluated ({evaluated})
                  </li>
                  <li className="flex items-center gap-2 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    Pending ({pending})
                  </li>
                  <li className="flex items-center gap-2 text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Flagged ({flagged})
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">
                Needs Attention
              </h2>
            </div>
            {flagged === 0 ? (
              <p className="text-[13px] text-slate-400">
                No flagged sheets right now.
              </p>
            ) : (
              <div className="space-y-2">
                {sheets
                  .filter((s) => Object.values(s.evaluation).some((e) => e.decision === "flag"))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 rounded-xl bg-rose-50 p-3"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-500 text-[11px] font-bold">
                        !
                      </div>
                      <button
                        onClick={() => {
                          openSheet(s.id);
                          onNavigate("evaluation");
                        }}
                        className="truncate text-left text-[13px] leading-snug text-slate-700 hover:underline"
                      >
                        {s.filename} — flagged for review
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
