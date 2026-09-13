import pool from "../../../utils/mysqlDb";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

export async function POST(request) {
  let connection;
  try {
    await requireApiSession(["admin", "judge"]);
    const body = objectBody(await request.json());
    const programId = positiveInteger(body.programId, "programId");
    const lang = requiredString(body, "lang", 20);
    if (!Array.isArray(body.topics) || body.topics.length > 100) throw new ApiError("Invalid topics", 400);
    const topics = body.topics.map((topic) => String(topic).trim()).filter(Boolean);
    if (topics.some((topic) => topic.length > 1000)) throw new ApiError("Topic is too long", 400);
    const edit = Array.isArray(body.edit) ? body.edit.map((id) => positiveInteger(id, "edit")) : [];

    connection = await pool.getConnection();
    await connection.beginTransaction();
    for (let index = 0; index < Math.min(edit.length, topics.length); index += 1) {
      await connection.execute("UPDATE Topics SET topic = ?, lang = ?, program = ? WHERE id = ?", [topics[index], lang, programId, edit[index]]);
    }
    for (const topic of topics.slice(edit.length)) {
      await connection.execute("INSERT INTO Topics (program, lang, topic) VALUES (?, ?, ?)", [programId, lang, topic]);
    }
    if (edit.length > topics.length) {
      const removed = edit.slice(topics.length);
      await connection.query(`DELETE FROM Topics WHERE id IN (${removed.map(() => "?").join(",")})`, removed);
    }
    await connection.commit();
    return Response.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
