import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

const statuses = new Set(["not reported", "reported", "finished", "awarded", "disqualified"]);

export async function POST(request) {
  try {
    await requireApiSession(["admin", "judge", "report", "award", "result"]);
    const body = objectBody(await request.json());
    const type = requiredString(body, "type", 30);
    if (!statuses.has(type)) throw new Error("Invalid participant status");
    const participant = objectBody(body.participant);
    const id = positiveInteger(participant.id, "participant.id");
    const [result] = await pool.execute("UPDATE programlist SET status = ? WHERE id = ?", [type, id]);
    let data;
    if (body.program) {
      const [rows] = await pool.execute("SELECT * FROM programlist WHERE program = ?", [positiveInteger(body.program, "program")]);
      data = rows;
    }
    return Response.json({ success: true, affectedRows: result.affectedRows, data });
  } catch (error) { return apiErrorResponse(error); }
}
