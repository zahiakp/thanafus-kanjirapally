import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { getProgramResults } from "../../utils/resultQuery";

export async function POST() {
  try {
    await requireApiSession(["admin", "judge", "announce", "award", "result"]);
    return Response.json({ success: true, data: await getProgramResults("judged") });
  } catch (error) { return apiErrorResponse(error); }
}
