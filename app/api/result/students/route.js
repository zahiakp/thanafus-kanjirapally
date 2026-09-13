import { getProgramResults, flattenResultParticipants } from "../../../utils/resultQuery";

export async function POST() {
  try {
    const participants = flattenResultParticipants(await getProgramResults("announced"));
    const students = new Map();
    for (const item of participants) {
      for (const jamiaNo of String(item.student || "").split(/[&,]/).map((value) => value.trim()).filter(Boolean)) {
        const current = students.get(jamiaNo) || { jamiaNo, studentName: item.studentName, campus: item.campus, campusName: item.campusName, points: 0 };
        current.points += Number(item.points || 0);
        students.set(jamiaNo, current);
      }
    }
    const data = [...students.values()].sort((a, b) => b.points - a.points);
    return Response.json({ success: true, data }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
  } catch (error) {
    console.error(error);
    return Response.json({ success: false, message: "Unable to load student results" }, { status: 500 });
  }
}
