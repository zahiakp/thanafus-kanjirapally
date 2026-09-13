import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

export async function POST(request) {
  let connection;
  try {
    await requireApiSession(["admin", "report"]);
    const body = objectBody(await request.json());
    if (!Array.isArray(body.participants) || body.participants.length > 500) throw new ApiError("Invalid participants", 400);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const value of body.participants) {
      const participant = objectBody(value);
      await connection.execute("UPDATE programlist SET code = ? WHERE id = ?", [requiredString(participant, "code", 100), positiveInteger(participant.id, "id")]);
    }
    await connection.commit();
    return Response.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
