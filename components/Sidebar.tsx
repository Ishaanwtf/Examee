"use client";

import {
  LayoutGrid,
  FileText,
  PenSquare,
  BarChart2,
  ShieldCheck,
  Settings,
  GraduationCap
} from "lucide-react";
import type { Section } from "@/app/page";

const NAV_ITEMS: { key: Section; label: string; icon: typeof LayoutGrid }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "answer-sheets", label: "Answer Sheets", icon: FileText },
  { key: "evaluation", label: "Evaluation", icon: PenSquare },
  { key: "analytics", label: "Analytics", icon: BarChart2 },
  { key: "moderation", label: "Moderation", icon: ShieldCheck },
  { key: "settings", label: "Settings", icon: Settings }
];

export default function Sidebar({
  active,
  onNavigate
}: {
  active: Section;
  onNavigate: (section: Section) => void;
}) {
  return (
    <aside className="flex h-screen w-[234px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
          <GraduationCap className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[17px] font-bold text-slate-900">ExamAI</span>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] font-medium transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-slate-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-[11px] font-semibold text-white">
          EX
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-slate-800">
            Examiner
          </p>
          <p className="text-[12px] text-slate-400">Local session</p>
        </div>
      </button>
    </aside>
  );
}
