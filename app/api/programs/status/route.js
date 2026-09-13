import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

const statuses = new Set(["pending", "ongoing", "finished", "judged", "announced"]);

export async function POST(request) {
  try {
    await requireApiSession(["admin", "judge", "announce"]);
    const body = objectBody(await request.json());
    const status = requiredString(body, "type", 30);
    if (!statuses.has(status)) throw new Error("Invalid program status");
    const program = positiveInteger(body.program, "program");
    const [result] = await pool.execute("UPDATE programs SET status = ? WHERE id = ?", [status, program]);
    return Response.json({ success: true, affectedRows: result.affectedRows });
  } catch (error) { return apiErrorResponse(error); }
}
