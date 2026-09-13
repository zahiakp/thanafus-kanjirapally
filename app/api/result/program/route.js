import { apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { getProgramResults } from "../../../utils/resultQuery";
import { objectBody, positiveInteger } from "../../../utils/validation";

export async function POST(request) {
  try {
    await requireApiSession(["admin", "judge", "announce", "award", "result"]);
    const body = objectBody(await request.json());
    const data = await getProgramResults("judged", positiveInteger(body.program, "program"));
    return Response.json({ success: true, data: data[0] || null });
  } catch (error) { return apiErrorResponse(error); }
}
