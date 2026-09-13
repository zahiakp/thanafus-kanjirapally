import type { SessionUser } from "./session";
import { judgeSlotFromScope, judgeSlotFromUsername, markKeyForJudge, type JudgeSlot } from "./judges";

export type JudgeMarkVisibility = "all" | "hidden" | JudgeSlot;

const markColumns = [
  { key: "mark", statusKey: "mark1Marked" },
  { key: "mark2", statusKey: "mark2Marked" },
  { key: "mark3", statusKey: "mark3Marked" },
] as const;

export function judgeMarkVisibility(session: SessionUser | null): JudgeMarkVisibility {
  if (!session) return "hidden";
  if (session.role === "admin") return "all";
  if (session.role !== "judge") return "hidden";
  return judgeSlotFromUsername(session.username) ?? judgeSlotFromScope(session.judgeSlot ?? session.campusId) ?? "all";
}

function hasJudgeMarks(value: Record<string, unknown>) {
  return markColumns.some(({ key }) => Object.prototype.hasOwnProperty.call(value, key));
}

function redactRecord(value: Record<string, unknown>, visibility: Exclude<JudgeMarkVisibility, "all">) {
  const copy = { ...value };
  const visibleKey = visibility === "hidden" ? null : markKeyForJudge(visibility);
  for (const { key, statusKey } of markColumns) {
    if (visibility !== "hidden") copy[statusKey] = Number(value[key]) > 0;
    if (key !== visibleKey) delete copy[key];
  }
  return copy;
}

export function applyJudgeMarkPrivacy(value: unknown, visibility: JudgeMarkVisibility): unknown {
  if (visibility === "all" || value == null) return value;
  if (Array.isArray(value)) return value.map((item) => applyJudgeMarkPrivacy(item, visibility));
  if (typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const copy = hasJudgeMarks(record) ? redactRecord(record, visibility) : { ...record };
  for (const [key, child] of Object.entries(copy)) {
    if (child && typeof child === "object") copy[key] = applyJudgeMarkPrivacy(child, visibility);
  }
  return copy;
}
