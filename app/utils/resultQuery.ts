import pool from "./mysqlDb";
import { pointsFor } from "./markingCriteria";

type ResultStatus = "judged" | "announced";

export async function getProgramResults(status: ResultStatus, programId?: number) {
  const participantStatuses = status === "announced" ? ["finished", "awarded"] : ["finished"];
  const placeholders = participantStatuses.map(() => "?").join(",");
  const sql = `SELECT p.*, pl.id AS participantId, pl.student, pl.campus, pl.code, pl.mark,
                      pl.status AS participantStatus, pl.topic,
                      s.name AS studentName, c.name AS campusName
                 FROM programs p
                 JOIN programlist pl ON pl.program = p.id
            LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(pl.student, '&', 1)
            LEFT JOIN campus c ON c.jamiaNo = pl.campus
                WHERE p.status = ? AND pl.status IN (${placeholders})
                      ${programId ? "AND p.id = ?" : ""}
             ORDER BY p.id, pl.mark DESC, pl.id`;
  const [rows]: any = await pool.execute(sql, [status, ...participantStatuses, ...(programId ? [programId] : [])]);
  const programs = new Map<number, any>();

  for (const row of rows) {
    if (!programs.has(row.id)) {
      const { participantId, student, campus, code, mark, participantStatus, topic, studentName, campusName, ...program } = row;
      programs.set(row.id, { program, participants: [] });
    }
    programs.get(row.id).participants.push({ id: row.participantId, student: row.student, campus: row.campus, code: row.code, mark: Number(row.mark), status: row.participantStatus, topic: row.topic, studentName: Number(row.isGroup) ? `${row.studentName} & Party` : row.studentName, campusName: row.campusName });
  }

  return [...programs.values()].map(({ program, participants }) => {
    const ranked = participants.map((item: any) => {
      const rankIndex = participants.filter((other: any) => other.mark > item.mark).length;
      return { ...item, ...pointsFor(item.mark, rankIndex + 1) };
    });
    return { ...program, first: ranked.filter((item: any) => item.rank === 1), second: ranked.filter((item: any) => item.rank === 2), third: ranked.filter((item: any) => item.rank === 3), grades: ranked.filter((item: any) => item.rank === 0 && item.grade) };
  });
}

export function flattenResultParticipants(programs: any[]) {
  return programs.flatMap((program) => ["first", "second", "third", "grades"].flatMap((key) => (program[key] || []).map((participant: any) => ({ ...participant, programId: program.id, programName: program.name }))));
}
