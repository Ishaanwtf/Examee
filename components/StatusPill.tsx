export type Status =
  | "Evaluated"
  | "Pending"
  | "Flagged"
  | "Processing"
  | "Failed";

const STYLES: Record<Status, string> = {
  Evaluated: "bg-emerald-50 text-emerald-600",
  Pending: "bg-blue-50 text-blue-600",
  Flagged: "bg-rose-50 text-rose-500",
  Processing: "bg-amber-50 text-amber-600",
  Failed: "bg-slate-100 text-slate-500"
};

export default function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium",
        STYLES[status]
      ].join(" ")}
    >
      {status}
    </span>
  );
}
