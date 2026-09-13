export const JUDGE_SLOTS = [1, 2, 3] as const;

export type JudgeSlot = (typeof JUDGE_SLOTS)[number];

export function judgeSlotFromScope(scope: unknown): JudgeSlot | null {
  const slot = Number(scope);
  return JUDGE_SLOTS.includes(slot as JudgeSlot) ? (slot as JudgeSlot) : null;
}

export function judgeLabel(scope: unknown) {
  const slot = judgeSlotFromScope(scope);
  return slot ? `Judge-${slot}` : "Judge (unassigned)";
}

export function markKeyForJudge(slot: JudgeSlot) {
  return slot === 1 ? "mark" : (`mark${slot}` as "mark2" | "mark3");
}

export function reservedJudgeUsername(slot: JudgeSlot) {
  return `judge-${slot}`;
}

export function judgeSlotFromUsername(username: unknown): JudgeSlot | null {
  if (typeof username !== "string") return null;
  const match = /^judge-([1-3])$/i.exec(username.trim());
  return match ? judgeSlotFromScope(match[1]) : null;
}
