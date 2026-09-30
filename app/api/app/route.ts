import { NextRequest, NextResponse } from "next/server";
import { getDatabase, saveDatabase } from "@/lib/database";
import { type AnswerSheet, type User } from "@/lib/domain";

function visibleSheets(sheets: AnswerSheet[], user: User) { return user.role === "EXAM_CELL" ? sheets : sheets.filter((sheet) => sheet.assignedTeacherId === user.id); }

export async function GET(req: NextRequest) {
  const db = await getDatabase(); const email = req.nextUrl.searchParams.get("email") || "";
  const user = db.users.find((item) => item.email === email);
  if (!user) return NextResponse.json({ error: "Please sign in with a demo account." }, { status: 401 });
  return NextResponse.json({ user, users: db.users, sheets: visibleSheets(db.sheets, user) });
}

export async function POST(req: NextRequest) {
  const db = await getDatabase(); const body = await req.json();
  const user = db.users.find((item) => item.email === body.email);
  if (!user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  if (body.action === "create" && user.role === "EXAM_CELL") {
    const input = body.sheet as Partial<AnswerSheet>; const code = input.exam?.courseCode || "SHEET";
    const next = db.sheets.filter((s) => s.exam.courseCode === code).length + 1;
    const sheet: AnswerSheet = { ...input, id: `${code}-SEM${input.exam?.semester || "1"}-2026-${String(next).padStart(4, "0")}`, uploadedAt: new Date().toISOString(), status: "PROCESSING", pages: [], questions: [], evaluation: {} } as AnswerSheet;
    db.sheets.unshift(sheet); await saveDatabase(db); return NextResponse.json({ sheet });
  }
  const index = db.sheets.findIndex((s) => s.id === body.sheetId);
  if (index < 0 || (user.role === "TEACHER" && db.sheets[index].assignedTeacherId !== user.id)) return NextResponse.json({ error: "Answer sheet not found." }, { status: 404 });
  const current = db.sheets[index];
  if (body.action === "update") db.sheets[index] = { ...current, ...body.patch, id: current.id };
  await saveDatabase(db); return NextResponse.json({ sheet: db.sheets[index] });
}
