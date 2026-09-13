import pool from "../../utils/mysqlDb";
import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { objectBody, positiveInteger } from "../../utils/validation";
import { applyJudgeMarkPrivacy, judgeMarkVisibility } from "../../utils/judgeMarkPrivacy";

const ALLOWED_ROLES = ["admin", "campus", "judge", "report", "announce", "award", "result"];

function participantIds(value) {
  return String(value || "")
    .split(/[&,]/)
    .map((id) => id.trim())
    .filter(Boolean);
}

async function getParticipants(program, campusId) {
  const conditions = ["pl.program = ?"];
  const values = [program];
  if (campusId) {
    conditions.push("pl.campus = ?");
    values.push(campusId);
  }

  const [rows] = await pool.execute(
    `SELECT pl.*, COALESCE(c.name, pl.campus) AS campusName
       FROM programlist pl
  LEFT JOIN campus c ON c.jamiaNo = pl.campus
      WHERE ${conditions.join(" AND ")}
   ORDER BY pl.id`,
    values,
  );
  const ids = [...new Set(rows.flatMap((row) => participantIds(row.student)))];
  const names = new Map();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const [students] = await pool.execute(
      `SELECT jamiaNo, name FROM students WHERE jamiaNo IN (${placeholders})`,
      ids,
    );
    students.forEach((student) => names.set(String(student.jamiaNo), student.name));
  }

  return rows.map((row) => {
    const memberIds = participantIds(row.student);
    const students = memberIds.map((jamiaNo) => ({
      jamiaNo,
      name: names.get(jamiaNo) || jamiaNo,
    }));
    return {
      ...row,
      jamiaNo: memberIds.join(", "),
      studentName: students.map((student) => student.name).join(", "),
      students,
    };
  });
}

export async function GET(request) {
  try {
    const session = await requireApiSession(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const program = positiveInteger(searchParams.get("program"), "program");
    const requestedCampus = searchParams.get("campusId")?.trim() || null;
    const campusId = session.role === "campus" ? session.campusId : requestedCampus;
    const data = await getParticipants(program, campusId);
    return Response.json({ success: true, data: applyJudgeMarkPrivacy(data, judgeMarkVisibility(session)) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireApiSession(ALLOWED_ROLES);
    const body = objectBody(await request.json());
    const requestedCampus = typeof body.campusId === "string" ? body.campusId : null;
    const campusId = session.role === "campus" ? session.campusId : requestedCampus;
    const program = body.program ? positiveInteger(body.program, "program") : null;
    const conditions = [];
    const values = [];
    if (campusId) { conditions.push("campus = ?"); values.push(campusId); }
    if (program) { conditions.push("program = ?"); values.push(program); }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const [data] = await pool.execute(`SELECT * FROM programlist${where} ORDER BY id`, values);
    return Response.json({ success: true, data: applyJudgeMarkPrivacy(data, judgeMarkVisibility(session)) });
  } catch (error) { return apiErrorResponse(error); }
}
