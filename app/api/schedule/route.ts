import type { RowDataPacket } from "mysql2/promise";
import { ApiError, apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../utils/validation";
import { hasVenueRole, readStaffVenueAssignments, venueScope, withVenueTransaction } from "../../utils/venueAccess";
import { moveProgram, readQueueSummaries, readSchedule, saveScheduleEvent, saveTimelineOrder, scheduleDate, selectQueue, swapPrograms } from "../../utils/venueSchedule";
import { venueLocation } from "../../utils/venueLocation";

export const dynamic = "force-dynamic";

function scheduleError(error: unknown) {
  if ((error as { code?: string } | null)?.code === "ER_BAD_FIELD_ERROR") {
    return apiErrorResponse(new ApiError("The schedule database schema is out of date. Ask an administrator to apply the venue and timeline migrations.", 503));
  }
  if ((error as { code?: string } | null)?.code === "ER_NO_SUCH_TABLE") {
    return apiErrorResponse(new ApiError("The scheduling database migration is missing. Ask an administrator to apply it.", 503));
  }
  return apiErrorResponse(error);
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const actor = query.get("view") === "public" ? null : await requireApiSession(["admin", "judge", "report"]);
    const data = await withVenueTransaction(async db => {
      if (query.get("view") === "staff-access" || query.has("accessId")) {
        if (actor?.role !== "admin") throw new ApiError("Forbidden", 403);
        if (!query.has("accessId")) return { assignments: await readStaffVenueAssignments(db) };
        const id = positiveInteger(query.get("accessId"), "accessId");
        const [assignment] = await readStaffVenueAssignments(db, id);
        if (!assignment) throw new ApiError("Staff user not found", 404);
        const [venues] = await db.execute<RowDataPacket[]>("SELECT id, name, type FROM venues ORDER BY name");
        return { venues: venues.map(venue => ({ ...venue, id: Number(venue.id) })), scope: assignment.venues?.map(venue => venue.id) ?? null };
      }
      if (query.get("view") === "venues") {
        if (actor?.role !== "admin") throw new ApiError("Forbidden", 403);
        const [venues] = await db.execute<RowDataPacket[]>(`
          SELECT v.id, v.name, v.type, v.description, v.map_url AS mapUrl, v.latitude, v.longitude,
            (SELECT COUNT(*) FROM program_schedule s JOIN programs p ON p.id = s.program_id WHERE s.venue_id = v.id) AS programs,
            (SELECT COUNT(*) FROM access a WHERE a.role = 'report' AND
              (NOT EXISTS (SELECT 1 FROM venue_staff_scope s WHERE s.access_id = a.id)
                OR EXISTS (SELECT 1 FROM venue_staff_grants g WHERE g.access_id = a.id AND g.venue_id = v.id))) AS managers,
            (SELECT COUNT(*) FROM access a WHERE a.role = 'judge' AND
              (NOT EXISTS (SELECT 1 FROM venue_staff_scope s WHERE s.access_id = a.id)
                OR EXISTS (SELECT 1 FROM venue_staff_grants g WHERE g.access_id = a.id AND g.venue_id = v.id))) AS judges
          FROM venues v ORDER BY v.name, v.id
        `);
        return { venues };
      }
      const isAdmin = actor?.role === "admin";
      const scope = actor ? await venueScope(actor, db) : null;
      const [revision] = isAdmin ? await db.execute<RowDataPacket[]>("SELECT revision FROM schedule_revision WHERE id = 1") : [[]];
      if (isAdmin && !revision.length) throw new ApiError("The schedule revision row is missing. Ask an administrator to initialize it.", 503);
      const [venues] = isAdmin ? await db.execute<RowDataPacket[]>("SELECT id, name, type FROM venues ORDER BY name") : [[]];
      const tab = query.get("tab") ?? "scheduled";
      if (tab !== "scheduled" && tab !== "unscheduled") throw new ApiError("Invalid schedule tab", 400);
      if (tab === "unscheduled" && !isAdmin) throw new ApiError("Forbidden", 403);
      const queues = await readQueueSummaries(db, scope);
      const focus = selectQueue(queues, query.get("date"), Number(query.get("venueId")));
      const [unscheduled] = tab === "unscheduled" ? await db.execute<RowDataPacket[]>(`
        SELECT p.id, p.name, p.category, p.isStage, p.status FROM programs p
        LEFT JOIN program_schedule s ON s.program_id = p.id
        WHERE s.program_id IS NULL ORDER BY p.category, p.name, p.id
      `) : [[]];
      const [count] = isAdmin && tab === "scheduled" ? await db.execute<RowDataPacket[]>(`
        SELECT COUNT(*) AS total FROM programs p
        WHERE NOT EXISTS (SELECT 1 FROM program_schedule s WHERE s.program_id = p.id)
      `) : [[]];
      return {
        revision: isAdmin ? Number(revision[0].revision) : undefined,
        queues, focus, venues, unscheduled,
        scheduledTotal: queues.reduce((total, queue) => total + queue.count, 0),
        unscheduledTotal: isAdmin ? Number(count[0]?.total ?? unscheduled.length) : undefined,
        entries: tab === "scheduled" && focus ? await readSchedule(db, scope, Boolean(actor), focus) : [],
      };
    });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return scheduleError(error); }
}

export async function POST(request: Request) {
  try {
    await requireApiSession(["admin"]);
    const body = objectBody(await request.json());
    const assignment = await withVenueTransaction(async db => {
      const action = body.action;
      if (action === "move" || action === "swap" || action === "event" || action === "reorder") {
        const revision = body.revision;
        if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) throw new ApiError("Invalid revision", 400);
        if (action === "reorder") {
          if (!Array.isArray(body.order) || !body.order.length || body.order.some(key => typeof key !== "string")) {
            throw new ApiError("Invalid timeline order", 400);
          }
          await saveTimelineOrder(db, revision, { date: scheduleDate(body.date), venueId: positiveInteger(body.venueId, "venueId") }, body.order);
          return;
        }
        if (action === "swap") {
          await swapPrograms(db, revision, positiveInteger(body.programId, "programId"), positiveInteger(body.targetId, "targetId"));
          return;
        }
        const id = action === "event" && body.id != null ? positiveInteger(body.id, "id") : null;
        const raw = body.destination === null ? null : objectBody(body.destination);
        const time = raw?.time;
        if (raw && (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new ApiError("Enter a valid start time", 400);
        const destination = raw && { venueId: positiveInteger(raw.venueId, "venueId"), date: scheduleDate(raw.date),
          time: time as string, duration: positiveInteger(raw.duration, "duration") };
        if (destination && destination.duration > 1440) throw new ApiError("Duration cannot exceed 1440 minutes", 400);
        if (action === "move") {
          await moveProgram(db, { revision, programId: positiveInteger(body.programId, "programId"), destination });
        } else if (destination) {
          const kind = raw?.kind;
          if (kind !== "launch" && kind !== "break" && kind !== "session") throw new ApiError("Select an event type", 400);
          await saveScheduleEvent(db, revision, id, { ...destination, kind, name: requiredString(raw, "name", 150) });
        } else {
          if (id === null) throw new ApiError("Event ID is required", 400);
          await saveScheduleEvent(db, revision, id, null);
        }
        return;
      }
      if (action === "staff") {
        const id = positiveInteger(body.accessId, "accessId");
        const [users] = await db.execute<RowDataPacket[]>("SELECT role FROM access WHERE id = ? FOR UPDATE", [id]);
        if (!users.length || !hasVenueRole(users[0].role)) throw new ApiError("Staff user not found", 404);
        if (body.venueIds !== null && !Array.isArray(body.venueIds)) throw new ApiError("Invalid venue scope", 400);
        const ids = body.venueIds === null ? null : [...new Set(body.venueIds.map(id => positiveInteger(id, "venueId")))].sort((a, b) => a - b);
        await db.execute("DELETE FROM venue_staff_scope WHERE access_id = ?", [id]);
        if (ids !== null) {
          await db.execute("INSERT INTO venue_staff_scope (access_id) VALUES (?)", [id]);
          for (const venue of ids) await db.execute("INSERT INTO venue_staff_grants (access_id, venue_id) VALUES (?, ?)", [id, venue]);
        }
        const [saved] = await readStaffVenueAssignments(db, id);
        return saved;
      }
      if (action !== "venue" && action !== "deleteVenue") throw new ApiError("Unknown schedule action", 400);
      const [revision] = await db.execute<RowDataPacket[]>("SELECT revision FROM schedule_revision WHERE id = 1 FOR UPDATE");
      if (!revision.length) throw new ApiError("The schedule revision row is missing. Ask an administrator to initialize it.", 503);
      const id = body.id == null ? null : positiveInteger(body.id, "id");
      if (action === "deleteVenue") {
        if (id === null) throw new ApiError("Venue ID is required", 400);
        const [result] = await db.execute<import("mysql2/promise").ResultSetHeader>("DELETE FROM venues WHERE id = ?", [id]);
        if (!result.affectedRows) throw new ApiError("Venue not found", 404);
      } else {
        const name = requiredString(body, "name", 100);
        if (body.type !== "stage" && body.type !== "off-stage") throw new ApiError("Invalid venue type", 400);
        const includesLocation = ["description", "mapUrl"].some(key => Object.hasOwn(body, key));
        const location = includesLocation ? venueLocation(body) : null;
        if (id === null) {
          if (location) await db.execute("INSERT INTO venues (name, type, description, map_url, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)", [name, body.type, ...location]);
          else await db.execute("INSERT INTO venues (name, type) VALUES (?, ?)", [name, body.type]);
        }
        else {
          const [current] = await db.execute<RowDataPacket[]>("SELECT type FROM venues WHERE id = ? FOR UPDATE", [id]);
          if (!current.length) throw new ApiError("Venue not found", 404);
          if (body.type !== current[0].type) {
            const [entries] = await db.execute<RowDataPacket[]>("SELECT 1 FROM program_schedule WHERE venue_id = ? LIMIT 1", [id]);
            if (entries.length) throw new ApiError("Remove scheduled programs before changing the venue type", 409);
          }
          if (location) {
            const [description, url, latitude, longitude] = location;
            await db.execute(`UPDATE venues SET name = ?, type = ?, description = ?,
              latitude = IF(? IS NULL AND map_url <=> ?, latitude, ?),
              longitude = IF(? IS NULL AND map_url <=> ?, longitude, ?), map_url = ? WHERE id = ?`,
            [name, body.type, description, latitude, url, latitude, longitude, url, longitude, url, id]);
          }
          else await db.execute("UPDATE venues SET name = ?, type = ? WHERE id = ?", [name, body.type, id]);
        }
      }
      await db.execute("UPDATE schedule_revision SET revision = revision + 1 WHERE id = 1");
    });
    return Response.json({ success: true, assignment });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ER_ROW_IS_REFERENCED_2") return apiErrorResponse(new ApiError("This venue still has scheduled programs or staff assignments", 409));
    if (code === "ER_NO_REFERENCED_ROW_2") return apiErrorResponse(new ApiError("A selected venue no longer exists", 409));
    if (code === "ER_DUP_ENTRY") return apiErrorResponse(new ApiError("The name or queue position is already in use", 409));
    return scheduleError(error);
  }
}
