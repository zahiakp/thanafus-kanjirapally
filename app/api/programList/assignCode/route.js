import { assertProgramVenue, withVenueTransaction } from "../../../utils/venueAccess";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, RequestValidationError, requiredString } from "../../../utils/validation";

const currentCode = (value) => value == null ? null : String(value).trim() || null;

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "report"]);
    const body = objectBody(await request.json());
    if (!Array.isArray(body.participants) || !body.participants.length || body.participants.length > 500) throw new ApiError("Invalid participants", 400);
    const changes = new Map();
    for (const value of body.participants) {
      const entry = objectBody(value);
      const id = positiveInteger(entry.id, "id");
      if (changes.has(id)) throw new ApiError("A participant appears more than once", 400);
      const code = requiredString(entry, "code", 100);
      changes.set(id, { code, previousCode: entry.previousCode });
    }
    const ids = [...changes.keys()];
    await withVenueTransaction(async db => {
      const [entries] = await db.execute(`SELECT id, program FROM programlist WHERE id IN (${ids.map(() => "?").join(", ")})`, ids);
      if (entries.length !== ids.length) throw new ApiError("A participant was removed. Reopen the code editor.", 409);
      const program = Number(entries[0].program);
      if (entries.some(entry => Number(entry.program) !== program)) throw new ApiError("Save codes for one program at a time", 400);
      await assertProgramVenue(session, program, db, true);
      const [programs] = await db.execute("SELECT status FROM programs WHERE id = ? FOR UPDATE", [program]);
      if (!["reporting", "ongoing"].includes(programs[0]?.status)) {
        throw new ApiError("Codes can be updated while the program is in Reporting or Ongoing. Reopen the code editor if its status changed.", 409);
      }
      const [participants] = await db.execute("SELECT id, code FROM programlist WHERE program = ? ORDER BY id FOR UPDATE", [program]);
      const saved = new Map(participants.map(entry => [Number(entry.id), currentCode(entry.code)]));
      for (const [id, change] of changes) {
        if (!saved.has(id) || (change.previousCode !== undefined && currentCode(change.previousCode) !== saved.get(id))) {
          throw new ApiError("Participant codes changed after this editor was opened. Reopen it and try again.", 409);
        }
      }
      const used = new Map();
      for (const [id, oldCode] of saved) {
        const code = (changes.get(id)?.code ?? oldCode)?.toUpperCase();
        if (!code) continue;
        const other = used.get(code);
        if (other !== undefined && (changes.has(other) || changes.has(id))) {
          throw new ApiError(`Code "${code}" is already assigned to another participant in this program.`, 409);
        }
        used.set(code, id);
      }

      // Release the old values first so a swap also works with a unique code index.
      await db.execute(`UPDATE programlist SET code = NULL WHERE program = ? AND id IN (${ids.map(() => "?").join(", ")})`, [program, ...ids]);
      for (const [id, { code }] of changes) {
        await db.execute("UPDATE programlist SET code = ? WHERE id = ? AND program = ?", [code, id, program]);
      }
    });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof RequestValidationError) return apiErrorResponse(new ApiError(error.message, 400));
    if (error?.code === "ER_DUP_ENTRY") return apiErrorResponse(new ApiError("A code is already in use. Check the codes and try again.", 409));
    return apiErrorResponse(error);
  }
}
