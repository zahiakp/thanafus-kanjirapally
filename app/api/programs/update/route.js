import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, requiredString } from "../../../utils/validation";

export async function POST(request) {
  try {
    await requireApiSession(["admin"]);
    const body = objectBody(await request.json());
    const name = requiredString(body, "name", 150);
    const category = requiredString(body, "category", 50);
    const stage = Number(body.stage);
    const isGroup = Number(body.groupItem);
    const limit = Number(body.limit);
    if (![stage, isGroup, limit].every(Number.isFinite)) throw new Error("Invalid numeric values");
    const edit = body.edit ? Number(body.edit) : null;
    const [result] = edit
      ? await pool.execute("UPDATE programs SET name = ?, category = ?, limitCount = ?, isGroup = ?, stage = ? WHERE id = ?", [name, category, limit, isGroup, stage, edit])
      : await pool.execute("INSERT INTO programs (name, category, stage, isGroup, limitCount, status) VALUES (?, ?, ?, ?, ?, 'pending')", [name, category, stage, isGroup, limit]);
    return Response.json({ success: true, affectedRows: result.affectedRows });
  } catch (error) { return apiErrorResponse(error); }
}
