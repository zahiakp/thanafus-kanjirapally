import type { ScoreBoard, ScoreTeam } from "../utils/scoreboard";
export type StreamScoreBoard = Omit<ScoreBoard, "programs"> & { programs: { id: string; name: string; category: string }[] };
export type ScoreTablePage = {
  programs: StreamScoreBoard["programs"];
  teams: (ScoreTeam & { total: number })[];
  page: number; pages: number;
};
export const SCORE_COLUMNS = 5;
export const SCORE_ROWS = 7;
export function scoreTablePages(board?: StreamScoreBoard): ScoreTablePage[] {
  if (!board?.programs.length || !board.teams.length) return [];
  const teams = board.teams.map(team => ({ ...team, total: board.programs.reduce((sum, program) =>
    sum + (team.scores[program.id] || []).reduce((points, award) => points + award.point, 0), 0) }));
  const pages: ScoreTablePage[] = [];
  for (let column = 0; column < board.programs.length; column += SCORE_COLUMNS) {
    for (let row = 0; row < teams.length; row += SCORE_ROWS) {
      pages.push({ programs: board.programs.slice(column, column + SCORE_COLUMNS),
        teams: teams.slice(row, row + SCORE_ROWS), page: pages.length + 1, pages: 0 });
    }
  }
  return pages.map(page => ({ ...page, pages: pages.length }));
}
