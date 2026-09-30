"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AnswerSheet, User, EvaluationEntry } from "@/lib/domain";
export type { AnswerSheet as Sheet, EvaluationEntry, AiGrading, OcrPage, OcrQuestion, AiQuestionGrade, User } from "@/lib/domain";

type AppState = {
  user: User | null; users: User[]; sheets: AnswerSheet[]; activeSheetId: string | null; loading: boolean;
  markingScheme: string; setMarkingScheme: (text: string) => void;
  login: (email: string) => Promise<string | null>; logout: () => void; refresh: () => Promise<void>;
  createSheet: (sheet: Partial<AnswerSheet>) => Promise<AnswerSheet>; updateSheet: (id: string, patch: Partial<AnswerSheet>) => Promise<void>;
  openSheet: (id: string) => void; closeSheet: () => void; activeSheet: AnswerSheet | null;
};
const AppContext = createContext<AppState | null>(null); const KEY = "examee-demo-user"; const SCHEME_KEY = "examee-marking-scheme";
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [users, setUsers] = useState<User[]>([]); const [sheets, setSheets] = useState<AnswerSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const [markingScheme, setMarkingScheme] = useState("");
  const load = useCallback(async (email: string) => { const r = await fetch(`/api/app?email=${encodeURIComponent(email)}`, { cache: "no-store" }); if (!r.ok) throw new Error("Unable to load the Examee workspace."); const data = await r.json(); setUser(data.user); setUsers(data.users); setSheets(data.sheets); }, []);
  useEffect(() => { const email = localStorage.getItem(KEY); if (email) load(email).catch(() => localStorage.removeItem(KEY)).finally(() => setLoading(false)); else setLoading(false); }, [load]);
  useEffect(() => { setMarkingScheme(localStorage.getItem(SCHEME_KEY) || ""); }, []);
  useEffect(() => { localStorage.setItem(SCHEME_KEY, markingScheme); }, [markingScheme]);
  const login = useCallback(async (email: string) => { try { await load(email); localStorage.setItem(KEY, email); return null; } catch { return "Please select one of the demo accounts."; } }, [load]);
  const logout = useCallback(() => { localStorage.removeItem(KEY); setUser(null); setSheets([]); setActiveSheetId(null); }, []);
  const refresh = useCallback(async () => { if (user) await load(user.email); }, [user, load]);
  const mutation = useCallback(async (payload: Record<string, unknown>) => { if (!user) throw new Error("Not signed in."); const r = await fetch("/api/app", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, ...payload }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Could not save changes."); return data.sheet as AnswerSheet; }, [user]);
  const createSheet = useCallback(async (sheet: Partial<AnswerSheet>) => { const created = await mutation({ action: "create", sheet }); setSheets((s) => [created, ...s]); return created; }, [mutation]);
  const updateSheet = useCallback(async (id: string, patch: Partial<AnswerSheet>) => { const next = await mutation({ action: "update", sheetId: id, patch }); setSheets((s) => s.map((x) => x.id === id ? next : x)); }, [mutation]);
  const activeSheet = useMemo(() => sheets.find((s) => s.id === activeSheetId) ?? null, [sheets, activeSheetId]);
  return <AppContext.Provider value={{ user, users, sheets, activeSheetId, loading, markingScheme, setMarkingScheme, login, logout, refresh, createSheet, updateSheet, openSheet: setActiveSheetId, closeSheet: () => setActiveSheetId(null), activeSheet }}>{children}</AppContext.Provider>;
}
export function useApp() { const ctx = useContext(AppContext); if (!ctx) throw new Error("useApp must be used inside AppProvider"); return ctx; }
export function getEvaluationEntry(sheet: AnswerSheet, questionNumber: string): EvaluationEntry { return sheet.evaluation[questionNumber] ?? { score: "", notes: "", decision: null }; }
