export type ScoreAward = { id: string; point: number; kind: 'first' | 'second' | 'grade' };
export type ScoreProgram = { id: string; name: string };
export type ScoreTeam = { id: string; name: string; scores: Record<string, ScoreAward[]> };
export type ScoreBoard = { programs: ScoreProgram[]; teams: ScoreTeam[] };

export function buildScoreBoard(
  teams: { id: string; name: string }[],
  programs: ScoreProgram[],
  results: { id: string; teamId: string; programId: string; point: unknown; rank: unknown }[],
): ScoreBoard {
  const rows: ScoreTeam[] = teams.map(team => ({ ...team, id: String(team.id), scores: {} }));
  const byTeam = new Map(rows.map(team => [team.id, team]));
  const programIds = new Set(programs.map(program => String(program.id)));
  const seen = new Set<string>();
  for (const result of results) {
    const id = String(result.id);
    const team = byTeam.get(String(result.teamId));
    const programId = String(result.programId);
    const point = Number(result.point);
    if (!team || !programIds.has(programId) || seen.has(id) || !Number.isFinite(point) || point <= 0) continue;
    seen.add(id);
    const rank = Number(result.rank);
    (team.scores[programId] ??= []).push({ id, point, kind: rank === 1 ? 'first' : rank === 2 ? 'second' : 'grade' });
  }
  const order = { first: 0, second: 1, grade: 2 };
  for (const team of rows) {
    for (const awards of Object.values(team.scores)) awards.sort((a, b) => order[a.kind] - order[b.kind] || b.point - a.point || a.id.localeCompare(b.id));
  }
  return { programs: programs.map(program => ({ ...program, id: String(program.id) })), teams: rows };
}
