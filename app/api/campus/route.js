import pool from "../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";

export async function POST() {
  try {
    await requireApiSession(["admin"]);
    const [campuses] = await pool.query("SELECT jamiaNo, name, strength, categories, point FROM campus ORDER BY jamiaNo");
    const data = campuses.map((item) => ({ ...item, categories: String(item.categories || "").split(",").filter(Boolean) }));
    return Response.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
