export type Role = "EXAM_CELL" | "TEACHER";
export type SheetStatus = "PENDING" | "PROCESSING" | "AI_EVALUATED" | "NEEDS_REVIEW" | "FINALIZED" | "FAILED";

export type User = { id: string; name: string; email: string; role: Role; subject?: string };
export type OcrQuestion = { questionNumber: string; text: string; pageNumber: number };
export type OcrPage = { pageNumber: number; text: string };
export type EvaluationEntry = { score: string; notes: string; decision: "accept" | "override" | "flag" | null };
export type AiStep = { description: string; maxMarks: number; marks: number };
export type AiQuestionGrade = { questionNumber: string; maxScore: number; awarded: number; steps: AiStep[]; feedback: string };
export type AiGrading = { gradedAt: string; questions: AiQuestionGrade[] };
export type Exam = { academicYear: string; examination: string; major: string; semester: string; subject: string; courseCode: string; markingScheme: string };
export type AnswerSheet = {
  id: string; filename: string; fileSize: number; uploadedAt: string; studentId: string;
  storagePath?: string;
  exam: Exam; assignedTeacherId?: string; status: SheetStatus; ocrError?: string;
  pages: OcrPage[]; questions: OcrQuestion[]; evaluation: Record<string, EvaluationEntry>;
  aiGrading?: AiGrading | null; totalScore?: number;
};
export type Database = { users: User[]; sheets: AnswerSheet[] };

export const DEMO_USERS: User[] = [
  { id: "exam-cell", name: "Exam Cell", email: "examcell@examee.local", role: "EXAM_CELL" },
  { id: "math-teacher", name: "Dr. Meera Shah", email: "math@examee.local", role: "TEACHER", subject: "Engineering Mathematics" },
  { id: "physics-teacher", name: "Dr. Arjun Rao", email: "physics@examee.local", role: "TEACHER", subject: "Applied Physics" },
  { id: "cs-teacher", name: "Dr. Neha Iyer", email: "cs@examee.local", role: "TEACHER", subject: "Data Structures" }
];
