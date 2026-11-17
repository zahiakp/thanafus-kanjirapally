import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "./apiAuth";
import { reorderTimeline, timelineKey } from "./timelineReorder";

export type Venue = { id: number; name: string; type: "stage" | "off-stage" };
export type EventKind = "launch" | "break" | "session";
export type ScheduleEntry = { programId: number | null; eventId: number | null; kind?: EventKind; name: string; category: string; venueId: number; venueName: string; date: string; position: number; time: string | null; duration: number; status?: string };

const timelineRows = `(
  SELECT p.id AS programId, NULL AS eventId, NULL AS kind, CONVERT(p.name USING utf8mb4) COLLATE utf8mb4_unicode_ci AS name, p.category, s.venue_id, s.event_date,
    s.planned_time, s.duration_minutes, p.status
  FROM program_schedule s JOIN programs p ON p.id = s.program_id
  UNION ALL
  SELECT NULL, e.id, e.kind, CONVERT(e.name USING utf8mb4) COLLATE utf8mb4_unicode_ci, '', e.venue_id, e.event_date, e.planned_time, e.duration_minutes, NULL
  FROM schedule_events e
)`;

export async function readSchedule(db: PoolConnection, scope: number[] | null, staff: boolean, focus?: { date: string; venueId: number }) {
  if (scope?.length === 0) return [];
  if (focus && scope && !scope.includes(focus.venueId)) return [];
  const filter = focus ? "WHERE s.venue_id = ? AND s.event_date = ?" :
    scope ? "WHERE s.venue_id IN (" + scope.map(() => "?").join(",") + ")" : "";
  const [rows] = await db.execute<(RowDataPacket & ScheduleEntry)[]>(`
    SELECT s.programId, s.eventId, s.kind, s.name, s.category, s.venue_id AS venueId, v.name AS venueName,
           DATE_FORMAT(s.event_date, '%Y-%m-%d') AS date, s.duration_minutes AS duration,
           TIME_FORMAT(s.planned_time, '%H:%i') AS time ${staff ? ", s.status" : ""}
    FROM ${timelineRows} s
    JOIN venues v ON v.id = s.venue_id ${filter}
    ORDER BY s.event_date, v.name, s.venue_id, s.planned_time IS NULL, s.planned_time, s.programId, s.eventId
  `, focus ? [focus.venueId, focus.date] : scope ?? []);
  let position = 0;
  return rows.map((row, index) => {
    const previous = rows[index - 1];
    if (previous?.venueId !== row.venueId || previous?.date !== row.date) position = 0;
    return { ...row, position: ++position };
  });
}

type QueueSummary = { date: string; venueId: number; venueName: string; count: number };

export async function readQueueSummaries(db: PoolConnection, scope: number[] | null) {
  if (scope?.length === 0) return [];
  const filter = scope ? "WHERE s.venue_id IN (" + scope.map(() => "?").join(",") + ")" : "";
  const [rows] = await db.execute<(RowDataPacket & QueueSummary)[]>(`
    SELECT DATE_FORMAT(s.event_date, '%Y-%m-%d') AS date, v.id AS venueId, v.name AS venueName, COUNT(*) AS count
    FROM ${timelineRows} s
    JOIN venues v ON v.id = s.venue_id ${filter}
    GROUP BY s.event_date, v.id, v.name ORDER BY s.event_date, v.id
  `, scope ?? []);
  return rows.map(row => ({ ...row, venueId: Number(row.venueId), count: Number(row.count) }));
}

export function selectQueue(queues: QueueSummary[], date: string | null, venueId: number | null) {
  const day = queues.some(queue => queue.date === date) ? date : queues[0]?.date;
  const dayQueues = queues.filter(queue => queue.date === day);
  return dayQueues.find(queue => queue.venueId === venueId) ?? dayQueues[0] ?? null;
}

export function scheduleDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1000-01-01") {
    throw new ApiError("Enter a valid event date", 400);
  }
  const parsed = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError("Enter a valid event date", 400);
  }
  return value;
}

export async function lockScheduleRevision(db: PoolConnection, expected: number) {
  const [revision] = await db.execute<RowDataPacket[]>("SELECT revision FROM schedule_revision WHERE id = 1 FOR UPDATE");
  if (!revision.length) throw new ApiError("The schedule revision row is missing. Ask an administrator to initialize it.", 503);
  if (Number(revision[0].revision) !== expected) throw new ApiError("The schedule changed. The latest schedule has been loaded.", 409);
}

type Slot = { venueId: number; date: string; time: string; duration: number };
type TimedProgram = { id: number; time: string | null; duration: number; status: string };
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (time: number) => [Math.floor(time / 60), time % 60].map(n => String(n).padStart(2, "0")).join(":");

export function checkSlot(time: string, duration: number, others: { time: string | null; duration: number }[]) {
  const start = minutes(time);
  const end = start + duration;
  if (end > 1440) throw new ApiError("An item cannot finish after midnight.", 400);
  if (others.some(other => other.time && start < minutes(other.time) + other.duration && minutes(other.time) < end)) {
    throw new ApiError("This time overlaps another item at this venue.", 409);
  }
}

async function occupiedSlots(db: PoolConnection, slot: Pick<Slot, "venueId" | "date">, skipProgram = 0, skipEvent = 0) {
  const [rows] = await db.execute<(RowDataPacket & { time: string | null; duration: number })[]>(`
    SELECT TIME_FORMAT(s.planned_time, '%H:%i') AS time, s.duration_minutes AS duration
    FROM program_schedule s JOIN programs p ON p.id = s.program_id
    WHERE s.venue_id = ? AND s.event_date = ? AND s.program_id <> ?
    UNION ALL
    SELECT TIME_FORMAT(planned_time, '%H:%i'), duration_minutes
    FROM schedule_events WHERE venue_id = ? AND event_date = ? AND id <> ?
  `, [slot.venueId, slot.date, skipProgram, slot.venueId, slot.date, skipEvent]);
  return rows;
}

async function refreshPositions(db: PoolConnection, venueId: number, date: string) {
  // Keep the legacy position column consistent for existing PHP consumers.
  const [rows] = await db.execute<RowDataPacket[]>(`
    SELECT program_id FROM program_schedule WHERE venue_id = ? AND event_date = ?
    ORDER BY planned_time IS NULL, planned_time, program_id
  `, [venueId, date]);
  await db.execute("UPDATE program_schedule SET position = -position WHERE venue_id = ? AND event_date = ?", [venueId, date]);
  for (const [index, row] of rows.entries()) {
    await db.execute("UPDATE program_schedule SET position = ? WHERE program_id = ?", [index + 1, row.program_id]);
  }
}

async function advanceRevision(db: PoolConnection) {
  await db.execute("UPDATE schedule_revision SET revision = revision + 1 WHERE id = 1");
}

export async function moveProgram(db: PoolConnection, change: { programId: number; revision: number; destination: Slot | null }) {
  const { programId, destination } = change;
  await lockScheduleRevision(db, change.revision);
  const [programs] = await db.execute<RowDataPacket[]>("SELECT status, isStage FROM programs WHERE id = ? FOR UPDATE", [programId]);
  const program = programs[0];
  if (!program) throw new ApiError("Program not found", 404);
  if (!["pending", "reporting"].includes(program.status)) throw new ApiError("Only programs that have not started can be moved", 409);

  const [entries] = await db.execute<RowDataPacket[]>(
    "SELECT venue_id AS venueId, DATE_FORMAT(event_date, '%Y-%m-%d') AS date FROM program_schedule WHERE program_id = ?", [programId],
  );
  const source = entries[0];
  if (destination) {
    const [venues] = await db.execute<RowDataPacket[]>("SELECT type FROM venues WHERE id = ? FOR UPDATE", [destination.venueId]);
    if (!venues.length) throw new ApiError("Venue not found", 404);
    if (venues[0].type !== (Number(program.isStage) > 0 ? "stage" : "off-stage")) throw new ApiError("Venue type does not match the program", 400);
    checkSlot(destination.time, destination.duration, await occupiedSlots(db, destination, programId));
  }

  await db.execute("DELETE FROM program_schedule WHERE program_id = ?", [programId]);
  if (destination) {
    await db.execute("INSERT INTO program_schedule (program_id, venue_id, event_date, position, planned_time, duration_minutes) VALUES (?, ?, ?, 0, ?, ?)",
      [programId, destination.venueId, destination.date, destination.time, destination.duration]);
    await refreshPositions(db, destination.venueId, destination.date);
  }
  if (source && (!destination || Number(source.venueId) !== destination.venueId || source.date !== destination.date)) {
    await refreshPositions(db, source.venueId, source.date);
  }
  await advanceRevision(db);
}

export function swapTimes(programs: TimedProgram[], first: number, second: number, events: { time: string | null; duration: number }[]) {
  const start = programs.findIndex(row => row.id === first);
  const end = programs.findIndex(row => row.id === second);
  if (start < 0 || end < 0 || start === end) throw new ApiError("Select two scheduled programs at the same venue and date.", 400);
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const original = programs.slice(low, high + 1);
  if (original.some(row => !row.time || !["pending", "reporting"].includes(row.status))) {
    throw new ApiError("Every affected program must have a start time and must not have started.", 409);
  }
  const gaps = original.slice(1).map((row, i) => minutes(row.time!) - minutes(original[i].time!) - original[i].duration);
  if (gaps.some(gap => gap < 0)) throw new ApiError("Resolve overlapping programs before swapping them.", 409);
  const reordered = [...original];
  [reordered[0], reordered[reordered.length - 1]] = [reordered[reordered.length - 1], reordered[0]];
  const outside = [...programs.slice(0, low), ...programs.slice(high + 1), ...events];
  let nextStart = minutes(original[0].time!);
  return reordered.map((row, index) => {
    const time = clock(nextStart);
    checkSlot(time, row.duration, outside);
    nextStart += row.duration + (gaps[index] ?? 0);
    return { id: row.id, time };
  });
}

export async function swapPrograms(db: PoolConnection, revision: number, first: number, second: number) {
  await lockScheduleRevision(db, revision);
  const [slots] = await db.execute<RowDataPacket[]>(
    "SELECT venue_id AS venueId, DATE_FORMAT(event_date, '%Y-%m-%d') AS date FROM program_schedule WHERE program_id = ?", [first],
  );
  const slot = slots[0];
  if (!slot) throw new ApiError("Program is no longer scheduled.", 404);
  const [programs] = await db.execute<(RowDataPacket & TimedProgram)[]>(`
    SELECT p.id, p.status, TIME_FORMAT(s.planned_time, '%H:%i') AS time, s.duration_minutes AS duration
    FROM program_schedule s JOIN programs p ON p.id = s.program_id
    WHERE s.venue_id = ? AND s.event_date = ?
    ORDER BY s.planned_time IS NULL, s.planned_time, p.id FOR UPDATE
  `, [slot.venueId, slot.date]);
  const [events] = await db.execute<(RowDataPacket & { time: string; duration: number })[]>(`
    SELECT TIME_FORMAT(planned_time, '%H:%i') AS time, duration_minutes AS duration
    FROM schedule_events WHERE venue_id = ? AND event_date = ?
  `, [slot.venueId, slot.date]);
  for (const change of swapTimes(programs, first, second, events)) {
    await db.execute("UPDATE program_schedule SET planned_time = ? WHERE program_id = ?", [change.time, change.id]);
  }
  await refreshPositions(db, slot.venueId, slot.date);
  await advanceRevision(db);
}

export async function saveScheduleEvent(db: PoolConnection, revision: number, id: number | null, event: (Slot & { name: string; kind: EventKind }) | null) {
  await lockScheduleRevision(db, revision);
  if (id) {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT id FROM schedule_events WHERE id = ? FOR UPDATE", [id]);
    if (!rows.length) throw new ApiError("Schedule event not found.", 404);
  }
  if (event) {
    checkSlot(event.time, event.duration, await occupiedSlots(db, event, 0, id ?? 0));
    const values = [event.venueId, event.date, event.name, event.kind, event.time, event.duration];
    if (id) await db.execute("UPDATE schedule_events SET venue_id = ?, event_date = ?, name = ?, kind = ?, planned_time = ?, duration_minutes = ? WHERE id = ?", [...values, id]);
    else await db.execute("INSERT INTO schedule_events (venue_id, event_date, name, kind, planned_time, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)", values);
  } else {
    await db.execute("DELETE FROM schedule_events WHERE id = ?", [id]);
  }
  await advanceRevision(db);
}

export async function saveTimelineOrder(db: PoolConnection, revision: number, focus: { date: string; venueId: number }, order: string[]) {
  await lockScheduleRevision(db, revision);
  const [programs] = await db.execute<(RowDataPacket & { id: number; status: string })[]>(`
    SELECT p.id, p.status FROM program_schedule s JOIN programs p ON p.id = s.program_id
    WHERE s.venue_id = ? AND s.event_date = ? FOR UPDATE
  `, [focus.venueId, focus.date]);
  const statuses = new Map(programs.map(program => [program.id, program.status]));
  const rows = (await readSchedule(db, null, true, focus)).map(row =>
    row.programId === null ? row : { ...row, status: statuses.get(row.programId) });
  let reordered;
  try {
    reordered = reorderTimeline(rows, order);
  } catch (error) {
    throw new ApiError((error as Error).message, 409);
  }

  const times = new Map(rows.map(row => [timelineKey(row), row.time]));
  const changes = reordered.filter(row => times.get(timelineKey(row)) !== row.time);
  if (!changes.length) return;
  for (const row of changes) {
    if (row.eventId !== null) {
      await db.execute("UPDATE schedule_events SET planned_time = ? WHERE id = ?", [row.time, row.eventId]);
    } else {
      await db.execute("UPDATE program_schedule SET planned_time = ? WHERE program_id = ?", [row.time, row.programId]);
    }
  }
  await refreshPositions(db, focus.venueId, focus.date);
  await advanceRevision(db);
}
