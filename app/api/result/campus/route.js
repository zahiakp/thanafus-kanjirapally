import { getProgramResults, flattenResultParticipants } from "../../../utils/resultQuery";

export async function POST() {
  try {
    const participants = flattenResultParticipants(await getProgramResults("announced"));
    const campuses = new Map();
    for (const item of participants) {
      const current = campuses.get(item.campus) || { jamiaNo: item.campus, name: item.campusName, points: 0 };
      current.points += Number(item.points || 0);
      campuses.set(item.campus, current);
    }
    const data = [...campuses.values()].sort((a, b) => b.points - a.points);
    return Response.json({ success: true, data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, message: "Unable to load campus results" }, { status: 500 });
  }
}
