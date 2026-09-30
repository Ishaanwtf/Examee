"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardView from "@/components/DashboardView";
import AnswerSheetsView from "@/components/AnswerSheetsView";
import EvaluationView from "@/components/EvaluationView";
import { AppProvider, useApp } from "@/lib/store";

export type Section =
  | "dashboard"
  | "answer-sheets"
  | "evaluation"
  | "analytics"
  | "moderation"
  | "settings";

function Shell() {
  const [section, setSection] = useState<Section>("dashboard");
  const { activeSheet } = useApp();

  return (
    <div className="flex">
      <Sidebar active={section} onNavigate={setSection} />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        {section === "dashboard" && <DashboardView onNavigate={setSection} />}
        {section === "answer-sheets" && (
          <AnswerSheetsView onOpenEvaluation={() => setSection("evaluation")} />
        )}
        {section === "evaluation" && <EvaluationView onBack={() => setSection("answer-sheets")} />}
        {(section === "analytics" ||
          section === "moderation" ||
          section === "settings") && (
          <div className="flex h-[70vh] items-center justify-center">
            <p className="text-[14px] text-slate-400">
              This screen wasn&apos;t part of the design handoff yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
