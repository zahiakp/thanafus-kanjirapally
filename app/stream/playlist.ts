import { scoreTablePages, type StreamScoreBoard } from "./scoreTable";
import { resultDuration } from "./resultReveal";
import type { StreamPublicState, StreamScenePayload } from "./types";
export const RESULT_REFRESH_MS = 300_000;
export type ResultPlaylist = {
  success: true; version: string; enabled: boolean; eventTitle: string;
  scoreboard?: StreamScoreBoard;
  results: { id: number; payload: Extract<StreamScenePayload, { type: "result" }> }[];
};
export function playlistState(list: ResultPlaylist, tick: number, startedAt: string): StreamPublicState {
  const pages = list.enabled ? scoreTablePages(list.scoreboard) : [];
  type Slot = { result?: ResultPlaylist["results"][number]; page?: (typeof pages)[number] };
  const slots: Slot[] = [];
  if (list.enabled) {
    list.results.forEach((result, index) => {
      slots.push({ result }, {});
      if ((index + 1) % 5 === 0 || index === list.results.length - 1) {
        if (pages.length) slots.push(...pages.map(page => ({ page })), {});
      }
    });
    if (!list.results.length && pages.length) slots.push(...pages.map(page => ({ page })), {});
  }
  const { result, page } = slots[tick % Math.max(1, slots.length)] || {};
  const payload: StreamScenePayload = page ? { type: "scoretable", eventTitle: list.eventTitle, ...page } : result ? result.payload : {
    type: "idle", eventTitle: list.eventTitle, message: "Celebrating knowledge, talent and excellence",
  };
  return {
    success: true, changed: true, version: list.version, serverTime: startedAt, nextPollMs: RESULT_REFRESH_MS,
    enabled: list.enabled, scene: { key: String(tick) + "-" + (result?.id ?? "brand"), type: payload.type,
      startedAt, durationSeconds: page ? 15 : result ? resultDuration(result.payload.winners) : 10, pinned: false, payload },
  };
}
