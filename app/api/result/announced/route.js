import { getProgramResults } from "../../../utils/resultQuery";

export async function POST() {
  try {
    return Response.json({ success: true, data: await getProgramResults("announced") }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, message: "Unable to load announced results" }, { status: 500 });
  }
}
