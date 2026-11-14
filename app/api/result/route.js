import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { getProgramResults } from "../../utils/resultQuery";
import { venueScope } from "../../utils/venueAccess";

export async function POST() {
  try {
    const session = await requireApiSession(["admin", "judge", "announce", "award", "result"]);
    return Response.json({ success: true, data: await getProgramResults("judged", undefined, await venueScope(session)) });
  } catch (error) { return apiErrorResponse(error); }
}
