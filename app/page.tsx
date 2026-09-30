"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardView from "@/components/DashboardView";
import AnswerSheetsView from "@/components/AnswerSheetsView";
import EvaluationView from "@/components/EvaluationView";
import { AppProvider, useApp } from "@/lib/store";
import AnalyticsView from "@/components/AnalyticsView";
import LoginView from "@/components/LoginView";

export type Section =
  | "dashboard"
  | "answer-sheets"
  | "evaluation"
  | "analytics";

function Shell() {
  const [section, setSection] = useState<Section>("dashboard");
  const { user, loading } = useApp();
  if (loading) return <div className="grid min-h-screen place-items-center text-indigo-600">Loading Examee…</div>;
  if (!user) return <LoginView />;

  return (
    <div className="flex">
      <Sidebar active={section} onNavigate={setSection} />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        {section === "dashboard" && <DashboardView onNavigate={setSection} />}
        {section === "answer-sheets" && (
          <AnswerSheetsView onOpenEvaluation={() => setSection("evaluation")} />
        )}
        {section === "evaluation" && <EvaluationView onBack={() => setSection("answer-sheets")} />}
        {section === "analytics" && <AnalyticsView />}
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
