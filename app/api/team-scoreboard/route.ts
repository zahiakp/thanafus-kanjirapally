import pool from '../../utils/mysqlDb';
import { ApiError, apiErrorResponse, requireApiSession } from '../../utils/apiAuth';
import { categoryMap } from '../../data/branding';
import { buildScoreBoard } from '../../utils/scoreboard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireApiSession(['admin', 'announce']);
    const category = new URL(request.url).searchParams.get('category') || '';
    if (!Object.hasOwn(categoryMap, category)) throw new ApiError('Choose a valid category', 400);
    const [[teams], [programs], [results]]: any = await Promise.all([
      pool.execute('SELECT jamiaNo AS id, name FROM campus ORDER BY name, jamiaNo'),
      pool.execute('SELECT id, name FROM programs WHERE category = ? ORDER BY `order` IS NULL, `order`, id', [category]),
      pool.execute(
        `SELECT r.id, r.program AS programId, s.campus AS teamId, r.point, r.rank
           FROM results r
           JOIN programs p ON p.id = r.program
           JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(r.student, '&', 1)
          WHERE p.category = ? AND p.status = 'announced'
          ORDER BY r.id`,
        [category],
      ),
    ]);
    return Response.json({ success: true, data: buildScoreBoard(teams, programs, results) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiErrorResponse(error); }
}
