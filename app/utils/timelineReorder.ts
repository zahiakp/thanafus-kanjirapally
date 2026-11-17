import type { ScheduleEntry } from "./venueSchedule";

export const timelineKey = (row: ScheduleEntry) =>
  row.eventId != null ? `event:${row.eventId}` : `program:${row.programId}`;

export const canReorderTimelineItem = (row: ScheduleEntry) =>
  Boolean(row.time) && (row.eventId != null || row.status === "pending" || row.status === "reporting");

export function timelineOrderAtGap(rows: ScheduleEntry[], from: number, gap: number) {
  const to = gap > from ? gap - 1 : gap;
  if (from < 0 || to < 0 || to >= rows.length || from === to) return;
  if (!rows.slice(Math.min(from, to), Math.max(from, to) + 1).every(canReorderTimelineItem)) return;
  const order = rows.map(timelineKey);
  const [item] = order.splice(from, 1);
  order.splice(to, 0, item);
  return order;
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (time: number) => [Math.floor(time / 60), time % 60].map(n => String(n).padStart(2, "0")).join(":");

export function reorderTimeline(rows: ScheduleEntry[], order: string[]) {
  const byKey = new Map(rows.map(row => [timelineKey(row), row]));
  if (order.length !== rows.length || new Set(order).size !== rows.length || order.some(key => !byKey.has(key))) {
    throw new Error("The reorder must include each item in this timeline exactly once.");
  }
  const result = order.map(key => byKey.get(key)!);
  const originalIndexes = new Map(rows.map((row, index) => [row, index]));

  for (let first = 0; first < rows.length; first++) {
    if (rows[first] === result[first]) continue;
    // Find the smallest range that contains every displaced item in this part of the timeline.
    let last = first;
    for (let index = first; index <= last; index++) {
      last = Math.max(last, originalIndexes.get(result[index])!);
      if (!canReorderTimelineItem(rows[index])) throw new Error("Started or untimed programs cannot be moved or crossed.");
    }
    let start = minutes(rows[first].time!);
    const previous = rows[first - 1];
    if (previous?.time && minutes(previous.time) + previous.duration > start) {
      throw new Error("Fix the overlapping start times before reordering these items.");
    }
    for (let index = first; index <= last; index++) {
      const row = result[index];
      result[index] = { ...row, position: index + 1, time: clock(start) };
      start += row.duration;
      if (index < last) {
        const gap = minutes(rows[index + 1].time!) - minutes(rows[index].time!) - rows[index].duration;
        if (gap < 0) throw new Error("Fix the overlapping start times before reordering these items.");
        start += gap;
      }
    }
    const next = rows[last + 1];
    if (start > (next?.time ? minutes(next.time) : 1440)) {
      throw new Error("These items overlap the next item or finish after midnight.");
    }
    first = last;
  }
  return result;
}
