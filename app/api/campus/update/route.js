import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { hashPassword } from "../../../utils/password";
import { objectBody, requiredString } from "../../../utils/validation";

export async function POST(request) {
  let connection;
  try {
    await requireApiSession(["admin"]);
    const body = objectBody(await request.json());
    const name = requiredString(body, "name", 150);
    const jamiaNo = requiredString(body, "jamiaNo", 100);
    const password = requiredString(body, "password", 200);
    const categories = Array.isArray(body.categories) ? body.categories.join(",") : requiredString(body, "categories", 500);
    const strength = Number(body.strength);
    if (!Number.isSafeInteger(strength) || strength < 0) throw new Error("Invalid strength");
    const edit = typeof body.edit === "string" && body.edit ? body.edit : null;
    const passwordHash = await hashPassword(password);

    connection = await pool.getConnection();
    await connection.beginTransaction();
    if (edit) {
      await connection.execute("UPDATE access SET username = ?, role = 'campus', password = ?, campusId = ? WHERE username = ?", [jamiaNo, passwordHash, jamiaNo, edit]);
      await connection.execute("UPDATE campus SET jamiaNo = ?, name = ?, password = ?, categories = ?, strength = ? WHERE jamiaNo = ?", [jamiaNo, name, passwordHash, categories, strength, edit]);
    } else {
      await connection.execute("INSERT INTO access (username, role, password, campusId) VALUES (?, 'campus', ?, ?)", [jamiaNo, passwordHash, jamiaNo]);
      await connection.execute("INSERT INTO campus (jamiaNo, name, password, strength, categories, point) VALUES (?, ?, ?, ?, ?, 0)", [jamiaNo, name, passwordHash, strength, categories]);
    }
    await connection.commit();
    return Response.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
