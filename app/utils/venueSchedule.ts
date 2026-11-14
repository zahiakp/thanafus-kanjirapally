import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApiError } from "./apiAuth";

export type Venue = { id: number; name: string; type: "stage" | "off-stage" };
export type ScheduleEntry = { programId: number; name: string; category: string; venueId: number; venueName: string; date: string; position: number; time: string | null; status?: string };

export async function readSchedule(db: PoolConnection, scope: number[] | null, staff: boolean) {
  if (scope?.length === 0) return [];
  const filter = scope ? " WHERE s.venue_id IN (" + scope.map(() => "?").join(",") + ")" : "";
  const [rows] = await db.execute<(RowDataPacket & ScheduleEntry)[]>(`
    SELECT p.id AS programId, p.name, p.category, s.venue_id AS venueId, v.name AS venueName,
           DATE_FORMAT(s.event_date, '%Y-%m-%d') AS date, s.position,
           TIME_FORMAT(s.planned_time, '%H:%i') AS time ${staff ? ", p.status" : ""}
    FROM program_schedule s JOIN programs p ON p.id = s.program_id
    JOIN venues v ON v.id = s.venue_id ${filter}
    ORDER BY s.event_date, v.name, s.venue_id, s.position
  `, scope ?? []);
  return rows;
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

export async function moveProgram(db: PoolConnection, change: {
  programId: number; revision: number; destination: { venueId: number; date: string; position?: number; time?: string | null } | null;
}) {
  const { programId, destination } = change;
  const [revision] = await db.execute<RowDataPacket[]>("SELECT revision FROM schedule_revision WHERE id = 1 FOR UPDATE");
  if (!revision.length) throw new ApiError("The schedule revision row is missing. Ask an administrator to initialize it.", 503);
  if (Number(revision[0]?.revision) !== change.revision) throw new ApiError("The schedule changed. The latest queue has been loaded.", 409);
  const [programs] = await db.execute<RowDataPacket[]>("SELECT status, isStage FROM programs WHERE id = ? FOR UPDATE", [programId]);
  const program = programs[0];
  if (!program) throw new ApiError("Program not found", 404);
  if (!["pending", "reporting"].includes(program.status)) throw new ApiError("Only programs that have not started can be moved", 409);

  const [entries] = await db.execute<RowDataPacket[]>(
    "SELECT venue_id AS venueId, DATE_FORMAT(event_date, '%Y-%m-%d') AS date, planned_time AS time FROM program_schedule WHERE program_id = ?", [programId],
  );
  const source = entries[0];
  if (destination) {
    const [venues] = await db.execute<RowDataPacket[]>("SELECT type FROM venues WHERE id = ? FOR UPDATE", [destination.venueId]);
    if (!venues.length) throw new ApiError("Venue not found", 404);
    if (venues[0].type !== (Number(program.isStage) > 0 ? "stage" : "off-stage")) throw new ApiError("Venue type does not match the program", 400);
  }

  await db.execute("DELETE FROM program_schedule WHERE program_id = ?", [programId]);
  async function rebuild(venueId: number, date: string, insert: boolean) {
    const [queue] = await db.execute<RowDataPacket[]>(
      "SELECT program_id FROM program_schedule WHERE venue_id = ? AND event_date = ? ORDER BY position", [venueId, date],
    );
    const ids = queue.map(row => Number(row.program_id));
    if (insert) {
      const index = destination?.position === undefined ? ids.length : destination.position - 1;
      if (index > ids.length) throw new ApiError("Queue position is no longer available", 409);
      ids.splice(index, 0, programId);
      await db.execute("INSERT INTO program_schedule (program_id, venue_id, event_date, position, planned_time) VALUES (?, ?, ?, 0, ?)",
        [programId, venueId, date, destination?.time === undefined ? source?.time ?? null : destination.time]);
    }
    await db.execute("UPDATE program_schedule SET position = -position WHERE venue_id = ? AND event_date = ?", [venueId, date]);
    for (const [index, id] of ids.entries()) {
      await db.execute("UPDATE program_schedule SET position = ? WHERE program_id = ?", [index + 1, id]);
    }
  }
  if (source && (!destination || Number(source.venueId) !== destination.venueId || source.date !== destination.date)) {
    await rebuild(source.venueId, source.date, false);
  }
  if (destination) await rebuild(destination.venueId, destination.date, true);
  await db.execute("UPDATE schedule_revision SET revision = revision + 1 WHERE id = 1");
}
