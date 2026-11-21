import type { StreamWinner } from "./types";
export const RESULT_INTRO_SECONDS = 4;
export const WINNER_SECONDS = 8;
export function orderedWinners(winners: StreamWinner[]) {
  return winners.filter(winner => winner.rank === 1 || winner.rank === 2)
    .slice().sort((a, b) => a.rank - b.rank);
}
export function resultDuration(winners: StreamWinner[]) {
  return RESULT_INTRO_SECONDS + Math.max(1, orderedWinners(winners).length) * WINNER_SECONDS;
}
export function winnerIndexAt(elapsedSeconds: number, count: number) {
  if (elapsedSeconds < RESULT_INTRO_SECONDS || count === 0) return -1;
  return Math.min(count - 1, Math.floor((elapsedSeconds - RESULT_INTRO_SECONDS) / WINNER_SECONDS));
}
