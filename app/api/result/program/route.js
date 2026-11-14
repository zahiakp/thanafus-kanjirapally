import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { assertProgramVenue } from "../../../utils/venueAccess";
import { getProgramResults } from "../../../utils/resultQuery";
import { objectBody, positiveInteger } from "../../../utils/validation";

export async function POST(request) {
  try {
    const session = await requireApiSession(["admin", "judge", "announce", "award", "result"]);
    const body = objectBody(await request.json());
    const program = positiveInteger(body.program, "program");
    await assertProgramVenue(session, program);
    const data = await getProgramResults("judged", program);
    return Response.json({ success: true, data: data[0] || null });
  } catch (error) { return apiErrorResponse(error); }
}
