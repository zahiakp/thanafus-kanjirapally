import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, requiredString } from "../../../utils/validation";
import { isRegistrationClosed } from "../../../utils/registration";

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "campus"]);
    const body = objectBody(await request.json());
    const name = requiredString(body, "name", 150);
    const category = requiredString(body, "category", 50);
    const jamiaNo = requiredString(body, "jamiaNo", 100);
    const edit = typeof body.edit === "string" && body.edit ? body.edit : null;
    const campus = session.role === "campus" ? session.campusId : requiredString(body, "campus", 100);
    if (!campus) throw new ApiError("Campus scope is required", 400);
    if (session.role === "campus" && isRegistrationClosed()) throw new ApiError("Registration is closed", 409);
    const [result] = edit
      ? await pool.execute(
          "UPDATE students SET jamiaNo = ?, name = ?, campus = ?, category = ? WHERE jamiaNo = ?" + (session.role === "campus" ? " AND campus = ?" : ""),
          session.role === "campus" ? [jamiaNo, name, campus, category, edit, campus] : [jamiaNo, name, campus, category, edit]
        )
      : await pool.execute("INSERT INTO students (jamiaNo, name, category, campus, point) VALUES (?, ?, ?, ?, 0)", [jamiaNo, name, category, campus]);
    return Response.json({ success: true, affectedRows: result.affectedRows });
  } catch (error) { return apiErrorResponse(error); }
}
