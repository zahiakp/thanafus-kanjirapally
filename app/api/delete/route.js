import pool from "../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../utils/apiAuth";
import { objectBody, requiredString } from "../../utils/validation";
import { isRegistrationClosed } from "../../utils/registration";

const targets = {
  students: { key: "jamiaNo", roles: ["admin", "campus"] },
  campus: { key: "jamiaNo", roles: ["admin"] },
  programs: { key: "id", roles: ["admin"] },
  programList: { key: "id", roles: ["admin", "campus"] },
  Topics: { key: "id", roles: ["admin", "judge"] },
};

export async function POST(request) {
  let connection;
  try {
    const body = objectBody(await request.json());
    const collectionName = requiredString(body, "collectionName", 40);
    const id = requiredString(body, "id", 100);
    const target = targets[collectionName];
    if (!target) throw new ApiError("Unsupported delete target", 400);
    const session = await requireApiSession(target.roles);
    if (session.role === "campus" && ["students", "programlist"].includes(collectionName) && isRegistrationClosed()) throw new ApiError("Registration is closed", 409);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (collectionName === "campus") await connection.execute("DELETE FROM access WHERE campusId = ?", [id]);

    let sql = `DELETE FROM ${collectionName} WHERE ${target.key} = ?`;
    const values = [id];
    if (session.role === "campus") {
      if (!session.campusId || !["students", "programlist"].includes(collectionName)) throw new ApiError("Permission denied", 403);
      sql += " AND campus = ?";
      values.push(session.campusId);
    }
    const [result] = await connection.execute(sql, values);
    await connection.commit();
    return Response.json({ success: true, affectedRows: result.affectedRows });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
