import { assertProgramVenue, withVenueTransaction } from "../../../utils/venueAccess";
import { ApiError, apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { applyJudgeMarkPrivacy, judgeMarkVisibility } from "../../../utils/judgeMarkPrivacy";
import { objectBody, positiveInteger } from "../../../utils/validation";

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "judge"]);
    const body = objectBody(await request.json());
    const program = positiveInteger(body.program, "program");
    const topic = positiveInteger(body.topic, "topic");
    const student = String(body.student || "").slice(0, 500);
    return await withVenueTransaction(async db => {
      await assertProgramVenue(session, program, db, true);
      const [topics] = await db.execute("SELECT id FROM topics WHERE id = ? AND program = ?", [topic, program]);
      if (!topics.length) throw new ApiError("Topic does not belong to this program", 409);
      const [result] = await db.execute("UPDATE programlist SET topic = ? WHERE program = ? AND student = ?", [topic, program, student]);
      const [data] = await db.execute("SELECT * FROM programlist WHERE program = ?", [program]);
      return Response.json({ success: true, affectedRows: result.affectedRows, data: applyJudgeMarkPrivacy(data, judgeMarkVisibility(session)) });
    });
  } catch (error) { return apiErrorResponse(error); }
}
