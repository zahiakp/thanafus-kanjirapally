export const GRADE_BOUNDARIES = [
  { grade: "A", minimum: 80 },
  { grade: "B", minimum: 70 },
] as const;
export const RANK_POINTS: Readonly<Record<number, number>> = { 1: 5, 2: 3 };
export const GRADE_ORDER = ["A", "B"] as const;
export const GRADE_POINTS: Readonly<Record<string, number>> = { A: 5, B: 3 };

export function pointsFor(mark: number, position: number) {
  const rank = Object.hasOwn(RANK_POINTS, position) ? position : 0;
  const grade = GRADE_BOUNDARIES.find((boundary) => mark >= boundary.minimum)?.grade ?? null;
  return { rank, grade, points: (RANK_POINTS[rank] || 0) + (grade ? GRADE_POINTS[grade] : 0) };
}
