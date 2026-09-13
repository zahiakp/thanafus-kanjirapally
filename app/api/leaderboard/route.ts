import pool from "../../utils/mysqlDb";
import { ApiError, apiErrorResponse, requireApiSession } from "../../utils/apiAuth";

export const dynamic = "force-dynamic";

function tableMissing(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ER_NO_SUCH_TABLE");
}

async function readLeaderboard() {
  const [rows]: any = await pool.execute(
    `SELECT l.team_id AS teamId, COALESCE(c.name, l.team_id) AS teamName,
            COALESCE(c.shortName, '') AS shortName, l.point,
            l.after_result AS afterResult, l.updated_at AS updatedAt
       FROM leaderboard l
  LEFT JOIN campus c ON c.jamiaNo = l.team_id
   ORDER BY l.point DESC, teamName`,
  );
  return rows.map((row: any) => ({
    teamId: String(row.teamId),
    teamName: String(row.teamName),
    shortName: String(row.shortName || ""),
    point: Number(row.point || 0),
    after: Number(row.afterResult || 0),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}

export async function GET() {
  try {
    const data = await readLeaderboard();
    return Response.json(
      {
        success: true,
        data,
        after: data[0]?.after || 0,
        updatedAt: data[0]?.updatedAt || null,
      },
      { headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=30" } },
    );
  } catch (error) {
    if (tableMissing(error)) {
      return Response.json({ success: false, message: "Leaderboard is not initialized yet." }, { status: 503 });
    }
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  try {
    const session = await requireApiSession(["admin"]);
    const body = await request.json().catch(() => ({}));
    const after = Number(body.after);
    if (!Number.isInteger(after) || after < 1 || after > 100_000) {
      throw new ApiError("After result must be a whole number between 1 and 100000", 400);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [points]: any = await connection.execute(
      `SELECT c.jamiaNo AS teamId,
              CAST(COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN r.point ELSE 0 END), 0) AS SIGNED) AS point
         FROM campus c
    LEFT JOIN students s ON s.campus = c.jamiaNo
    LEFT JOIN results r ON SUBSTRING_INDEX(r.student, '&', 1) = s.jamiaNo
    LEFT JOIN programs p ON p.id = r.program
                        AND p.status = 'announced'
                        AND p.\`order\` IS NOT NULL
                        AND p.\`order\` <= ?
     GROUP BY c.jamiaNo
     ORDER BY point DESC, c.jamiaNo`,
      [after],
    );

    await connection.execute("DELETE FROM leaderboard");
    for (const row of points) {
      await connection.execute(
        "INSERT INTO leaderboard (team_id, point, after_result, updated_by) VALUES (?, ?, ?, ?)",
        [String(row.teamId), Number(row.point || 0), after, session.username],
      );
    }
    await connection.commit();

    // Wake connected Digital Stage displays without coupling sync success to stream setup.
    await pool.execute("UPDATE stream_channels SET version = version + 1 WHERE slug = 'main'").catch(() => undefined);
    const data = await readLeaderboard();
    return Response.json({ success: true, data, after, updatedAt: data[0]?.updatedAt || new Date().toISOString() });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    if (tableMissing(error)) {
      return Response.json({ success: false, message: "Install database/leaderboard-schema.sql before syncing." }, { status: 503 });
    }
    return apiErrorResponse(error);
  } finally {
    connection?.release();
  }
}
