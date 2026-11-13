import pool from "../../../utils/mysqlDb";
import { ApiError, apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApiSession(["admin"]);

    const prefix = new URL(request.url).searchParams
      .get("prefix")
      ?.replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 20);

    if (!prefix) throw new ApiError("A team short name is required", 400);

    const like = `${prefix}%`;
    const [rows]: any = await pool.execute(
      `SELECT jamiaNo AS identifier FROM campus WHERE jamiaNo LIKE ?
       UNION
       SELECT username AS identifier FROM access WHERE username LIKE ?`,
      [like, like],
    );
    const used = new Set(rows.map((row: any) => String(row.identifier || "").toUpperCase()));

    for (let ordinal = 1; ordinal <= 999; ordinal += 1) {
      const teamId = `${prefix}${String(ordinal).padStart(2, "0")}`;
      if (!used.has(teamId)) {
        return Response.json(
          { success: true, teamId },
          { headers: { "Cache-Control": "private, no-store, max-age=0" } },
        );
      }
    }

    throw new ApiError(`No available team ID found for ${prefix}`, 409);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
