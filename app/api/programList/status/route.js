import { assertEntryVenue, assertProgramVenue, withVenueTransaction } from "../../../utils/venueAccess";
import { applyJudgeMarkPrivacy, judgeMarkVisibility } from "../../../utils/judgeMarkPrivacy";
import { ApiError, apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

const statuses = new Set(["not reported", "reported", "finished", "awarded", "disqualified", "cancelled"]);

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "judge", "report", "award", "result"]);
    const body = objectBody(await request.json());
    const type = requiredString(body, "type", 30);
    if (!statuses.has(type)) throw new Error("Invalid participant status");
    const participant = objectBody(body.participant);
    const id = positiveInteger(participant.id, "participant.id");
    return await withVenueTransaction(async db => {
      await assertEntryVenue(session, id, db);
      if (session.role === "report" || session.role === "judge") {
        const [entries] = await db.execute("SELECT status FROM programlist WHERE id = ? FOR UPDATE", [id]);
        const current = entries[0]?.status;
        const transitions = { "not reported": ["reported"], reported: ["finished", "cancelled"], reporting: ["finished"], ongoing: ["finished"] };
        if (current !== type && (!transitions[current]?.includes(type) || (session.role === "judge" && type === "reported"))) {
          throw new ApiError("Participant status transition is not allowed", 403);
        }
      }
      const [result] = await db.execute("UPDATE programlist SET status = ? WHERE id = ?", [type, id]);
      let data;
      if (body.program) {
        const program = positiveInteger(body.program, "program");
        await assertProgramVenue(session, program, db, true);
        const [rows] = await db.execute("SELECT * FROM programlist WHERE program = ?", [program]);
        data = applyJudgeMarkPrivacy(rows, judgeMarkVisibility(session));
      }
      return Response.json({ success: true, affectedRows: result.affectedRows, data });
    });
  } catch (error) { return apiErrorResponse(error); }
}
