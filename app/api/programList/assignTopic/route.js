import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger } from "../../../utils/validation";

export async function POST(request) {
  try {
    await requireApiSession(["admin", "judge"]);
    const body = objectBody(await request.json());
    const program = positiveInteger(body.program, "program");
    const topic = positiveInteger(body.topic, "topic");
    const student = String(body.student || "").slice(0, 500);
    const [result] = await pool.execute("UPDATE programlist SET topic = ? WHERE program = ? AND student = ?", [topic, program, student]);
    const [data] = await pool.execute("SELECT * FROM programlist WHERE program = ?", [program]);
    return Response.json({ success: true, affectedRows: result.affectedRows, data });
  } catch (error) { return apiErrorResponse(error); }
}
