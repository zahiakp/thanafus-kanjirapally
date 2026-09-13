import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger } from "../../../utils/validation";
import { judgeSlotFromScope, judgeSlotFromUsername, markKeyForJudge } from "../../../utils/judges";

const markKeys = ["mark", "mark2", "mark3"];

export async function POST(request) {
  let connection;
  try {
    const session = await requireApiSession(["admin", "judge"]);
    const body = objectBody(await request.json());
    if (!Array.isArray(body.participants) || body.participants.length === 0 || body.participants.length > 500) throw new ApiError("Invalid participants", 400);
    const judgeSlot = session.role === "judge" ? judgeSlotFromUsername(session.username) ?? judgeSlotFromScope(session.judgeSlot ?? session.campusId) : null;
    const allowedKeys = judgeSlot ? [markKeyForJudge(judgeSlot)] : markKeys;
    const ids = new Set();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const value of body.participants) {
      const participant = objectBody(value);
      const id = positiveInteger(participant.id, "id");
      if (ids.has(id)) throw new ApiError("Duplicate participant", 400);
      ids.add(id);
      const submittedKeys = markKeys.filter((key) => Object.prototype.hasOwnProperty.call(participant, key));
      if (!submittedKeys.length) throw new ApiError("At least one mark is required", 400);
      if (submittedKeys.some((key) => !allowedKeys.includes(key))) throw new ApiError("This judge cannot edit that mark column", 403);
      const values = submittedKeys.map((key) => {
        const mark = Number(participant[key]);
        if (!Number.isFinite(mark) || mark < 0 || mark > 100) throw new ApiError("Marks must be between 0 and 100", 400);
        return mark;
      });
      const assignments = submittedKeys.map((key) => `${key} = ?`).join(", ");
      await connection.execute(`UPDATE programlist SET ${assignments} WHERE id = ?`, [...values, id]);
    }
    await connection.commit();
    return Response.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
