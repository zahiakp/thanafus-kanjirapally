import { assertProgramVenue, withVenueTransaction } from "../../../utils/venueAccess";
import { ApiError, apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";

const statuses = new Set(["pending", "reporting", "ongoing", "finished", "judged", "announced"]);

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "judge", "announce", "report"]);
    const body = objectBody(await request.json());
    const status = requiredString(body, "type", 30);
    if (!statuses.has(status)) throw new Error("Invalid program status");
    const program = positiveInteger(body.program, "program");
    if (status === "judged" && session.role !== "admin") throw new ApiError("Administrator access is required to confirm results", 403);
    return await withVenueTransaction(async db => {
      await assertProgramVenue(session, program, db, true);
      if (session.role === "report" || session.role === "judge") {
        const [rows] = await db.execute("SELECT status FROM programs WHERE id = ? FOR UPDATE", [program]);
        const transitions = { pending: ["reporting"], reporting: ["pending", "ongoing"], ongoing: ["finished"] };
        if (!transitions[rows[0]?.status]?.includes(status)) throw new ApiError("Status transition is not allowed", 403);
      }
      const [result] = await db.execute("UPDATE programs SET status = ? WHERE id = ?", [status, program]);
      return Response.json({ success: true, affectedRows: result.affectedRows });
    });
  } catch (error) { return apiErrorResponse(error); }
}
