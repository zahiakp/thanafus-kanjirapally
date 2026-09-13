import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";
import { isRegistrationClosed } from "../../../utils/registration";

export async function POST(request) {
  let connection;
  try {
    const session = await requireApiSession(["admin", "campus"]);
    const body = objectBody(await request.json());
    const program = positiveInteger(body.program, "program");
    if (!Array.isArray(body.participants) || body.participants.length > 500) throw new ApiError("Invalid participants", 400);
    const participants = body.participants.map((value) => String(value).slice(0, 500));
    const campus = session.role === "campus" ? session.campusId : requiredString(body, "campus", 100);
    if (!campus) throw new ApiError("Campus scope is required", 400);
    if (session.role === "campus" && isRegistrationClosed()) throw new ApiError("Registration is closed", 409);
    const edits = Array.isArray(body.edit) ? body.edit.map((value) => positiveInteger(value, "edit")) : [];

    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (edits.length) {
      if (edits.length !== participants.length) throw new ApiError("Edit IDs and participants must match", 400);
      for (let index = 0; index < edits.length; index += 1) {
        const sql = "UPDATE programlist SET student = ? WHERE id = ?" + (session.role === "campus" ? " AND campus = ?" : "");
        await connection.execute(sql, session.role === "campus" ? [participants[index], edits[index], campus] : [participants[index], edits[index]]);
      }
    } else {
      for (const student of participants) {
        await connection.execute(
          "INSERT INTO programlist (program, student, campus, code, mark, status, topic) VALUES (?, ?, ?, NULL, 0, 'not reported', 0)",
          [program, student, campus]
        );
      }
    }
    await connection.commit();
    return Response.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
