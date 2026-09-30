"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type OcrQuestion = {
  questionNumber: string;
  text: string;
  pageNumber: number;
};

export type OcrPage = {
  pageNumber: number;
  text: string;
};

export type EvaluationEntry = {
  score: string;
  notes: string;
  decision: "accept" | "override" | "flag" | null;
};

export type AiStep = {
  description: string;
  maxMarks: number;
  marks: number;
};

export type AiQuestionGrade = {
  questionNumber: string;
  maxScore: number;
  awarded: number;
  steps: AiStep[];
  feedback: string;
};

export type AiGrading = {
  gradedAt: string;
  questions: AiQuestionGrade[];
};

export type Sheet = {
  id: string;
  filename: string;
  fileSize: number;
  uploadedAt: string;
  status: "processing" | "ready" | "failed";
  ocrError?: string;
  pages: OcrPage[];
  questions: OcrQuestion[];
  evaluation: Record<string, EvaluationEntry>;
  submitted: boolean;
  aiGrading?: AiGrading | null;
};

type AppState = {
  sheets: Sheet[];
  activeSheetId: string | null;
  markingScheme: string;
  setMarkingScheme: (text: string) => void;
  addSheet: (input: { filename: string; fileSize: number }) => Sheet;
  updateSheet: (id: string, updater: (sheet: Sheet) => Sheet) => void;
  removeSheet: (id: string) => void;
  openSheet: (id: string) => void;
  closeSheet: () => void;
  activeSheet: Sheet | null;
};

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = "examai-session-v1";

function loadPersisted(): {
  sheets: Sheet[];
  activeSheetId: string | null;
  markingScheme: string;
} {
  const empty = { sheets: [], activeSheetId: null, markingScheme: "" };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.sheets)) return empty;
    return {
      sheets: parsed.sheets,
      activeSheetId: parsed.activeSheetId ?? null,
      markingScheme: typeof parsed.markingScheme === "string" ? parsed.markingScheme : ""
    };
  } catch {
    return empty;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [markingScheme, setMarkingSchemeState] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = loadPersisted();
    setSheets(persisted.sheets);
    setActiveSheetId(persisted.activeSheetId);
    setMarkingSchemeState(persisted.markingScheme);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sheets, activeSheetId, markingScheme })
    );
  }, [sheets, activeSheetId, markingScheme, hydrated]);

  const setMarkingScheme = useCallback((text: string) => {
    setMarkingSchemeState(text);
  }, []);

  const addSheet = useCallback((input: { filename: string; fileSize: number }) => {
    const sheet: Sheet = {
      id: `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: input.filename,
      fileSize: input.fileSize,
      uploadedAt: new Date().toISOString(),
      status: "processing",
      pages: [],
      questions: [],
      evaluation: {},
      submitted: false,
    };
    setSheets((prev) => [sheet, ...prev]);
    return sheet;
  }, []);

  const updateSheet = useCallback(
    (id: string, updater: (sheet: Sheet) => Sheet) => {
      setSheets((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
    },
    []
  );

  const removeSheet = useCallback((id: string) => {
    setSheets((prev) => prev.filter((s) => s.id !== id));
    setActiveSheetId((prev) => (prev === id ? null : prev));
  }, []);

  const openSheet = useCallback((id: string) => setActiveSheetId(id), []);
  const closeSheet = useCallback(() => setActiveSheetId(null), []);

  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeSheetId) ?? null,
    [sheets, activeSheetId]
  );

  return (
    <AppContext.Provider
      value={{
        sheets,
        activeSheetId,
        markingScheme,
        setMarkingScheme,
        addSheet,
        updateSheet,
        removeSheet,
        openSheet,
        closeSheet,
        activeSheet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function getEvaluationEntry(
  sheet: Sheet,
  questionNumber: string
): EvaluationEntry {
  return sheet.evaluation[questionNumber] ?? { score: "", notes: "", decision: null };
}
