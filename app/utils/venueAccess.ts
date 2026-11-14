import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import pool from "./mysqlDb";
import { ApiError } from "./apiAuth";

type Actor = { username: string; role: string };
export const hasVenueRole = (role: string) => role === "judge" || role === "report";

export async function venueScope(actor: Actor, db: typeof pool | PoolConnection = pool, lock = false): Promise<number[] | null> {
  if (!hasVenueRole(actor.role)) return null;
  const [accounts] = await db.execute<RowDataPacket[]>(
    "SELECT id FROM access WHERE username = ? AND role = ?" + (lock ? " FOR UPDATE" : ""),
    [actor.username, actor.role],
  );
  if (!accounts.length) throw new ApiError("Staff account is no longer active", 403);
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT g.venue_id FROM venue_staff_scope s LEFT JOIN venue_staff_grants g ON g.access_id = s.access_id WHERE s.access_id = ?" + (lock ? " FOR UPDATE" : ""),
    [accounts[0].id],
  );
  return rows.length ? rows.flatMap(row => row.venue_id == null ? [] : [Number(row.venue_id)]) : null;
}

export async function assertProgramVenue(actor: Actor, program: number, db: typeof pool | PoolConnection = pool, lock = false) {
  if (!hasVenueRole(actor.role)) return;
  const scope = await venueScope(actor, db, lock);
  if (scope === null) return;
  if (lock) {
    const [programs] = await db.execute<RowDataPacket[]>("SELECT id FROM programs WHERE id = ? FOR UPDATE", [program]);
    if (!programs.length) throw new ApiError("Program not found", 404);
  }
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT venue_id FROM program_schedule WHERE program_id = ?" + (lock ? " FOR UPDATE" : ""), [program],
  );
  if (!rows.length || !scope.includes(Number(rows[0].venue_id))) {
    throw new ApiError("This program is outside your assigned venues", 403);
  }
}

export async function assertEntryVenue(actor: Actor, id: number, db: PoolConnection) {
  if (!hasVenueRole(actor.role)) return;
  const [entries] = await db.execute<RowDataPacket[]>("SELECT program FROM programlist WHERE id = ?", [id]);
  if (!entries.length) throw new ApiError("Participant entry not found", 404);
  const program = Number(entries[0].program);
  await assertProgramVenue(actor, program, db, true);
  const [current] = await db.execute<RowDataPacket[]>("SELECT program FROM programlist WHERE id = ? FOR UPDATE", [id]);
  if (!current.length || Number(current[0].program) !== program) throw new ApiError("Participant entry changed. Refresh and try again.", 409);
}

export async function withVenueTransaction<T>(operation: (db: PoolConnection) => Promise<T>) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const result = await operation(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback().catch(() => undefined);
    throw error;
  } finally {
    db.release();
  }
}
