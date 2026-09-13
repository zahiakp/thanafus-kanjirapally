import pool from "../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { objectBody } from "../../utils/validation";

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "campus"]);
    const body = objectBody(await request.json());
    const requestedCampus = typeof body.campusId === "string" ? body.campusId : null;
    const campusId = session.role === "campus" ? session.campusId : requestedCampus;
    const [students] = campusId
      ? await pool.execute("SELECT id, jamiaNo, name, category, campus FROM students WHERE campus = ? ORDER BY jamiaNo", [campusId])
      : await pool.query("SELECT id, jamiaNo, name, category, campus FROM students ORDER BY jamiaNo");
    return Response.json({ success: true, data: students });
  } catch (error) { return apiErrorResponse(error); }
}
