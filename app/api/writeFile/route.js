import pool from "../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../utils/apiAuth";
import { objectBody, requiredString } from "../../utils/validation";

export async function POST(request) {
  let connection;
  try {
    await requireApiSession(["admin"]);
    const data = await request.json();
    if (!Array.isArray(data) || data.length > 1000) throw new ApiError("Import must contain at most 1000 students", 400);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (const value of data) {
      const item = objectBody(value);
      await connection.execute(
        "INSERT INTO students (jamiaNo, name, category, campus, point) VALUES (?, ?, ?, ?, 0)",
        [requiredString(item, "jamiaNo", 100), requiredString(item, "name", 150), requiredString(item, "category", 50), requiredString(item, "campus", 100)]
      );
    }
    await connection.commit();
    return Response.json({ success: true, imported: data.length });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
