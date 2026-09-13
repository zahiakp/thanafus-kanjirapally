import { getProgramResults } from "../../../../utils/resultQuery";
import { objectBody, positiveInteger } from "../../../../utils/validation";

export async function POST(request) {
  try {
    const body = objectBody(await request.json());
    const data = await getProgramResults("announced", positiveInteger(body.program, "program"));
    return Response.json({ success: true, data: data[0] || null }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    return Response.json({ success: false, message: "Unable to load announced result" }, { status: 400 });
  }
}
