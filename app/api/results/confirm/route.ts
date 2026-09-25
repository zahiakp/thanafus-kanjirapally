import pool from '../../../utils/mysqlDb';
import { ApiError, apiErrorResponse, requireApiSession } from '../../../utils/apiAuth';
import { objectBody, positiveInteger } from '../../../utils/validation';
import { assignRanksAndCalculatePoints } from '../../../utils/calculatePoints';

export async function POST(request: Request) {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  try {
    await requireApiSession(['admin']);
    const body = objectBody(await request.json());
    const programId = positiveInteger(body.program, 'program');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [programs]: any = await connection.execute('SELECT id, status, isGroup, members FROM programs WHERE id = ? FOR UPDATE', [programId]);
    const program = programs[0];
    if (!program) throw new ApiError('Program not found', 404);
    // A repeated confirmation must not duplicate results or reset awarded entries.
    if (program.status === 'resulted' || program.status === 'judged') {
      await connection.commit();
      return Response.json({ success: true, alreadyConfirmed: true });
    }
    if (program.status !== 'finished') throw new ApiError('Only a finished program can be confirmed', 409);
    const [rows]: any = await connection.execute('SELECT id, student, code, mark, mark2, mark3, status FROM programlist WHERE program = ? ORDER BY id FOR UPDATE', [programId]);
    const participants = rows.filter((row: any) => row.status === 'finished').map((row: any) => {
      const marks = [row.mark, row.mark2, row.mark3].map(value => Number(value ?? 0));
      if (marks.some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new ApiError('A participant has invalid marks', 400);
      return { ...row, mark: marks[0], mark2: marks[1], mark3: marks[2] };
    });
    if (!participants.length) throw new ApiError('No finished participants to confirm', 400);
    const ranked = assignRanksAndCalculatePoints({ participants, program });
    const results: { student: string; code: string; rank: number; grade: string; point: number }[] = [];
    const seen = new Set<string>();
    for (const row of ranked) {
      if (!row.points || row.points <= 0) continue;
      const students = String(row.student ?? '').split(/[&,]/).map(value => value.trim()).filter(Boolean);
      const identities = Number(program.isGroup) === 1 ? students.slice(0, 1) : students;
      if (!identities.length) throw new ApiError('A scored participant is missing a student ID', 400);
      const code = String(row.code ?? '');
      if (code.length > 10) throw new ApiError('Participant code is too long', 400);
      for (const student of identities) {
        if (student.length > 10) throw new ApiError('Student ID is too long for a result', 400);
        if (seen.has(student)) throw new ApiError('A student has multiple scored entries in this program', 409);
        seen.add(student);
        results.push({ student, code, rank: row.rank ?? 0, grade: row.grade ?? '', point: row.points });
      }
    }
    const [existing]: any = await connection.execute('SELECT id, student, status FROM results WHERE program = ? FOR UPDATE', [programId]);
    const existingByStudent = new Map<string, { id: number; status: string }>();
    for (const row of existing) {
      const student = String(row.student);
      if (existingByStudent.has(student)) throw new ApiError('Duplicate results from an earlier save exist. Reset results before confirming again.', 409);
      if (!seen.has(student) || row.status === 'awarded') throw new ApiError('Existing results differ from the current marks or have been awarded. Reset results before confirming again.', 409);
      existingByStudent.set(student, row);
    }
    for (const result of results) {
      const saved = existingByStudent.get(result.student);
      if (saved) {
        await connection.execute('UPDATE results SET code = ?, `rank` = ?, grade = ?, point = ? WHERE id = ?', [result.code, result.rank, result.grade, result.point, saved.id]);
      } else {
        await connection.execute(
          'INSERT INTO results (program, student, code, `rank`, grade, point, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [programId, result.student, result.code, result.rank, result.grade, result.point, 'pending'],
        );
      }
    }
    await connection.execute("UPDATE programs SET status = 'resulted' WHERE id = ?", [programId]);
    await connection.commit();
    return Response.json({ success: true, count: results.length });
  } catch (error) {
    await connection?.rollback().catch(() => undefined);
    return apiErrorResponse(error);
  } finally { connection?.release(); }
}
