import pool from "../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../utils/apiAuth";
import { objectBody, positiveInteger } from "../../utils/validation";

export async function POST(request) {
  let connection;
  let locked = false;
  try {
    await requireApiSession(["admin", "announce"]);
    const body = objectBody(await request.json());
    const program = positiveInteger(body.program, "program");
    connection = await pool.getConnection();
    const [[lock]] = await connection.query("SELECT GET_LOCK('artivox-result-order', 5) AS acquired");
    locked = Number(lock.acquired) === 1;
    if (!locked) throw new ApiError("Result ordering is busy; retry shortly", 409);
    await connection.beginTransaction();
    const [[row]] = await connection.query("SELECT COALESCE(MAX(count), 0) + 1 AS nextCount FROM programs");
    const [result] = await connection.execute("UPDATE programs SET count = ? WHERE id = ?", [row.nextCount, program]);
    await connection.commit();
    return Response.json({ success: true, affectedRows: result.affectedRows, count: row.nextCount });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally {
    if (locked && connection) await connection.query("SELECT RELEASE_LOCK('artivox-result-order')").catch(() => undefined);
    connection?.release();
  }
}
