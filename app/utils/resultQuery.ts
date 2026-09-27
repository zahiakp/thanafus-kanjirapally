import pool from "./mysqlDb";
import { assignRanksAndCalculatePoints } from "./calculatePoints";

type ResultStatus = "judged" | "announced";

export async function getProgramResults(status: ResultStatus, programId?: number) {
  const participantStatuses = status === "announced" ? ["finished", "awarded"] : ["finished"];

  const sql = `SELECT p.*, pl.id AS participantId, pl.student, pl.campus, pl.code, pl.mark, pl.mark2, pl.mark3,
                      pl.status AS participantStatus, pl.topic,
                      s.name AS studentName, c.name AS campusName
                 FROM programs p
                 JOIN programlist pl ON pl.program = p.id
            LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(REPLACE(pl.student, ',', '&'), '&', 1)
            LEFT JOIN campus c ON c.jamiaNo = pl.campus
                WHERE p.status = ?
                      ${programId ? "AND p.id = ?" : ""}
             ORDER BY p.id, pl.mark DESC, pl.id`;
  const [rows]: any = await pool.execute(sql, [status, ...(programId ? [programId] : [])]);
  const programs = new Map<number, any>();

  for (const row of rows) {
    if (!programs.has(row.id)) {
      const { participantId, student, campus, code, mark, mark2, mark3, participantStatus, topic, studentName, campusName, ...program } = row;
      programs.set(row.id, { program, participants: [] });
    }
    programs.get(row.id).participants.push({ id: row.participantId, student: row.student, campus: row.campus, code: row.code, mark: Number(row.mark), mark2: Number(row.mark2 || 0), mark3: Number(row.mark3 || 0), status: row.participantStatus, topic: row.topic, studentName: Number(row.isGroup) ? `${row.studentName} & Party` : row.studentName, campusName: row.campusName });
  }

  return [...programs.values()].map(({ program, participants }) => {
    const ranked = assignRanksAndCalculatePoints({
      participants: participants.filter((item: any) => participantStatuses.includes(item.status)),
      program,
      markParticipants: participants,
    });
    return { ...program, first: ranked.filter((item: any) => item.rank === 1), second: ranked.filter((item: any) => item.rank === 2), third: ranked.filter((item: any) => item.rank === 3), grades: ranked.filter((item: any) => item.rank === 0 && item.grade) };
  });
}

export function flattenResultParticipants(programs: any[]) {
  return programs.flatMap((program) => ["first", "second", "third", "grades"].flatMap((key) => (program[key] || []).map((participant: any) => ({ ...participant, programId: program.id, programName: program.name }))));
}
